"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { IconButtonTooltip } from "@/components/ui/tooltip";
import { uploadScanAction } from "@/lib/scans/actions";
import {
  MAX_LARGE_SCAN_UPLOAD_BYTES,
  MAX_SCAN_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNK_BYTES,
  XML_FILE_TYPES,
  formatUploadLimit,
} from "@/lib/nmap/upload-validation-config";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "selected" | "parsing" | "success" | "error";
type UploadItemStatus = "selected" | "processing" | "success" | "error";
type ScanImportJobStatus =
  | "queued"
  | "validating"
  | "parsing"
  | "saving"
  | "complete"
  | "failed";

type UploadItem = {
  key: string;
  file: File;
  status: UploadItemStatus;
  scanId?: string;
  stats?: { hosts: number; services: number; findings: number };
  error?: string;
};

const IDLE_MESSAGE = "Drop Nmap XML files here, or click to browse.";
const JOB_POLL_INTERVAL_MS = 2000;

const PARSE_STEPS = [
  "Reading scan file…",
  "Parsing hosts & services…",
  "Generating findings…",
  "Scoring risk…",
];
const MIN_PARSE_MS = 1800;

const LARGE_STATUS_PROGRESS: Record<ScanImportJobStatus, number> = {
  queued: 45,
  validating: 55,
  parsing: 70,
  saving: 85,
  complete: 100,
  failed: 0,
};

function isXmlFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".xml") || XML_FILE_TYPES.has(file.type)
  );
}

function fileTier(file: File): "small" | "large" | "too-large" {
  if (file.size <= MAX_SCAN_UPLOAD_BYTES) return "small";
  if (file.size <= MAX_LARGE_SCAN_UPLOAD_BYTES) return "large";
  return "too-large";
}

function getClientFileValidationMessage(file: File): string | null {
  if (!isXmlFile(file)) return "Upload a valid Nmap XML file.";
  if (file.size === 0) return "Scan file is empty.";
  if (fileTier(file) === "too-large") {
    return `Scan file is too large. Upload an XML file under ${formatUploadLimit(MAX_LARGE_SCAN_UPLOAD_BYTES)}.`;
  }
  return null;
}

export function UploadCard() {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<UploadState>("idle");
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(IDLE_MESSAGE);

  useEffect(() => {
    return () => {
      if (parseTimerRef.current) clearInterval(parseTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  function stopParseAnimation() {
    if (parseTimerRef.current) {
      clearInterval(parseTimerRef.current);
      parseTimerRef.current = null;
    }
  }

  function stopJobPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function resetUpload() {
    stopParseAnimation();
    stopJobPolling();
    setUploadItems([]);
    setStatus("idle");
    setProgress(0);
    setStatusMessage(IDLE_MESSAGE);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function selectFiles(files: File[]) {
    if (status === "parsing") {
      return;
    }

    const items = files.map((file, index) => {
      const error = getClientFileValidationMessage(file) ?? undefined;
      return {
        key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        status: error ? ("error" as const) : ("selected" as const),
        error,
      };
    });
    const invalidCount = items.filter((item) => item.error).length;

    setUploadItems(items);
    setProgress(0);

    if (invalidCount > 0) {
      setStatus("error");
      setStatusMessage(
        `${invalidCount} ${invalidCount === 1 ? "file needs" : "files need"} attention before uploading.`,
      );
      return;
    }

    setStatus("selected");
    setStatusMessage(
      `${items.length} ${items.length === 1 ? "scan is" : "scans are"} ready to upload.`,
    );
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length > 0) {
      selectFiles(files);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const files = Array.from(event.dataTransfer.files ?? []);

    if (files.length > 0) {
      selectFiles(files);
    }
  }

  async function handleAnalyzeScan() {
    if (uploadItems.length === 0 || status === "parsing") {
      return;
    }

    if (uploadItems.some((item) => getClientFileValidationMessage(item.file))) {
      setStatus("error");
      setStatusMessage("Fix the invalid files before uploading this batch.");
      return;
    }

    setStatus("parsing");
    setProgress(0);
    let successCount = 0;
    let failureCount = 0;

    for (let index = 0; index < uploadItems.length; index++) {
      const item = uploadItems[index];
      const batchProgress = (fileProgress: number) =>
        setProgress(
          Math.round(((index + fileProgress / 100) / uploadItems.length) * 100),
        );

      setUploadItems((current) =>
        current.map((candidate) =>
          candidate.key === item.key
            ? { ...candidate, status: "processing", error: undefined }
            : candidate,
        ),
      );
      setStatusMessage(
        `Processing ${index + 1} of ${uploadItems.length}: ${item.file.name}`,
      );

      try {
        const result =
          fileTier(item.file) === "large"
            ? { scanId: await handleLargeUpload(item.file, batchProgress) }
            : await handleSmallUpload(item.file, batchProgress);

        successCount += 1;
        setUploadItems((current) =>
          current.map((candidate) =>
            candidate.key === item.key
              ? { ...candidate, ...result, status: "success" }
              : candidate,
          ),
        );
      } catch (error) {
        failureCount += 1;
        const message =
          error instanceof Error ? error.message : "Failed to import scan.";
        setUploadItems((current) =>
          current.map((candidate) =>
            candidate.key === item.key
              ? { ...candidate, status: "error", error: message }
              : candidate,
          ),
        );
      }
    }

    setProgress(100);
    if (failureCount === 0) {
      setStatus("success");
      setStatusMessage(
        `${successCount} ${successCount === 1 ? "scan" : "scans"} uploaded successfully.`,
      );
      toast.success(
        `${successCount} ${successCount === 1 ? "scan" : "scans"} uploaded`,
      );
    } else {
      setStatus("error");
      setStatusMessage(
        `${successCount} uploaded, ${failureCount} failed. Review the files below.`,
      );
      toast.error(`${failureCount} ${failureCount === 1 ? "scan" : "scans"} failed`);
    }
  }

  async function handleSmallUpload(
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<Pick<UploadItem, "scanId" | "stats">> {
    onProgress(8);
    let step = 0;
    stopParseAnimation();
    parseTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, PARSE_STEPS.length - 1);
      onProgress(Math.min(90, 8 + step * 22));
    }, MIN_PARSE_MS / PARSE_STEPS.length);

    const startedAt = Date.now();
    try {
      const formData = new FormData();
      formData.append("file", file);

      const scan = await uploadScanAction(formData);

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_PARSE_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_PARSE_MS - elapsed),
        );
      }

      stopParseAnimation();
      onProgress(100);
      return {
        scanId: scan.id,
        stats: {
          hosts: scan.hosts.length,
          services: scan.hosts.reduce(
            (total, host) => total + host.services.length,
            0,
          ),
          findings: scan.findings.length,
        },
      };
    } finally {
      stopParseAnimation();
    }
  }

  async function handleLargeUpload(
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<string> {
    onProgress(1);
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.max(1, Math.ceil(file.size / MAX_UPLOAD_CHUNK_BYTES));

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * MAX_UPLOAD_CHUNK_BYTES;
        const chunk = file.slice(start, start + MAX_UPLOAD_CHUNK_BYTES);

        const chunkResponse = await fetch(
          `/api/scan/import/chunk?uploadId=${uploadId}&chunkIndex=${chunkIndex}`,
          { method: "POST", body: chunk },
        );

        if (!chunkResponse.ok) {
          const body = await chunkResponse.json().catch(() => ({}));
          throw new Error(
            typeof body.error === "string" ? body.error : "Failed to upload scan data.",
          );
        }

        onProgress(
          Math.min(40, Math.round(((chunkIndex + 1) / totalChunks) * 40)),
        );
      }

      const response = await fetch("/api/scan/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          filename: file.name,
          fileSizeBytes: file.size,
          totalChunks,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : "Failed to queue scan import.",
        );
      }

      const { job } = (await response.json()) as {
        job: { id: string; status: ScanImportJobStatus };
      };

      return await pollImportJob(job.id, onProgress);
    } catch (error) {
      stopJobPolling();
      throw error;
    }
  }

  function pollImportJob(
    jobId: string,
    onProgress: (progress: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      stopJobPolling();
      pollTimerRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/scan/import?jobId=${jobId}`);
          if (!response.ok) throw new Error("Failed to check import status.");

          const { job } = (await response.json()) as {
            job: {
              status: ScanImportJobStatus;
              scanId?: string;
              errorMessage?: string;
            };
          };

          onProgress(LARGE_STATUS_PROGRESS[job.status]);

          if (job.status === "complete") {
            stopJobPolling();
            if (!job.scanId) {
              reject(new Error("Import completed without a scan ID."));
              return;
            }
            resolve(job.scanId);
          } else if (job.status === "failed") {
            stopJobPolling();
            reject(new Error(job.errorMessage ?? "Failed to import scan."));
          }
        } catch (error) {
          stopJobPolling();
          reject(
            error instanceof Error
              ? error
              : new Error("Failed to check import status."),
          );
        }
      }, JOB_POLL_INTERVAL_MS);
    });
  }

  const hasFiles = uploadItems.length > 0;
  const canAnalyze =
    hasFiles &&
    status === "selected" &&
    uploadItems.every((item) => item.status === "selected");
  const successfulItems = uploadItems.filter((item) => item.status === "success");
  const showResults = status === "success" || successfulItems.length > 0;
  const viewScanId = successfulItems.length === 1 ? successfulItems[0].scanId : null;
  const statusIcon = {
    idle: <FileUp className="size-5" />,
    selected: <FileText className="size-5" />,
    parsing: <Loader2 className="size-5 animate-spin" />,
    success: <CheckCircle2 className="size-5" />,
    error: <AlertTriangle className="size-5" />,
  }[status];

  return (
    <Card
      className={cn(
        "border-dashed py-0 transition-colors",
        isDragging && "border-ring bg-muted/40",
        status === "error" && "border-red-300 bg-red-50 dark:bg-red-950/20",
        status === "success" &&
          "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20",
      )}
    >
      <CardContent
        className="p-4"
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xml,text/xml,application/xml"
          className="sr-only"
          aria-label="Nmap XML scan files"
          onChange={handleFileChange}
        />

        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors",
            status === "parsing" && "bg-primary/90",
            status === "error" && "bg-red-600",
            status === "success" && "bg-emerald-600",
          )}
        >
          {statusIcon}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {showResults ? "Upload complete" : "Upload Nmap XML scans"}
            </h2>
            <p
              id="upload-status"
              className="mt-1 text-sm leading-6 text-muted-foreground"
              aria-live="polite"
            >
              {statusMessage}
            </p>
          </div>
          {hasFiles && !showResults ? (
            <IconButtonTooltip
              label="Clear selected files"
              disabled={status === "parsing"}
            >
              <Button
                aria-label="Clear selected files"
                className="shrink-0 rounded-md"
                disabled={status === "parsing"}
                size="icon"
                type="button"
                variant="ghost"
                onClick={resetUpload}
              >
                <X className="size-4" />
              </Button>
            </IconButtonTooltip>
          ) : null}
        </div>

        {hasFiles ? (
          <div className="mt-4 divide-y rounded-md border bg-background">
            {uploadItems.map((item) => (
              <div className="flex items-start gap-3 p-3" key={item.key}>
                {item.status === "processing" ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                ) : item.status === "success" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : item.status === "error" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
                ) : (
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.file.name}
                  </p>
                  {item.error ? (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {item.error}
                    </p>
                  ) : item.stats ? (
                    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {item.stats.hosts} {item.stats.hosts === 1 ? "host" : "hosts"} ·{" "}
                      {item.stats.services}{" "}
                      {item.stats.services === 1 ? "service" : "services"} ·{" "}
                      {item.stats.findings}{" "}
                      {item.stats.findings === 1 ? "finding" : "findings"}
                    </p>
                  ) : item.status === "success" ? (
                    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Imported in the background.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(item.file.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {status === "parsing" ? (
          <div className="mt-4 space-y-2">
            <Progress
              value={progress}
              aria-label="Processing scan"
              className="transition-all"
            />
            <p className="text-xs text-muted-foreground">{progress}% complete</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {showResults ? (
            <>
              <Button
                className="w-full rounded-md"
                size="lg"
                type="button"
                disabled={isNavigating || successfulItems.length === 0}
                onClick={() => {
                  startNavigation(() => {
                    router.push(
                      viewScanId ? `/dashboard/scans/${viewScanId}` : "/dashboard/scans",
                    );
                    resetUpload();
                  });
                }}
              >
                {isNavigating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Opening…
                  </>
                ) : (
                  viewScanId ? "View scan" : "View scans"
                )}
              </Button>
              <Button
                className="w-full rounded-md"
                size="lg"
                type="button"
                variant="outline"
                onClick={resetUpload}
              >
                Upload more
              </Button>
            </>
          ) : (
            <>
              <Button
                className="w-full rounded-md"
                disabled={status === "parsing"}
                size="lg"
                type="button"
                variant={hasFiles ? "outline" : "default"}
                onClick={openFilePicker}
              >
                {hasFiles ? "Choose different files" : "Select files"}
              </Button>
              {hasFiles ? (
                <Button
                  className="w-full rounded-md"
                  disabled={!canAnalyze}
                  size="lg"
                  type="button"
                  onClick={handleAnalyzeScan}
                >
                  {status === "parsing"
                    ? "Processing..."
                    : `Upload ${uploadItems.length} ${uploadItems.length === 1 ? "scan" : "scans"}`}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
