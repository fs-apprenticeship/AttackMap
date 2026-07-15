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
import { uploadScanAction } from "@/lib/scans/actions";
import {
  MAX_LARGE_SCAN_UPLOAD_BYTES,
  MAX_SCAN_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNK_BYTES,
  XML_FILE_TYPES,
  formatUploadLimit,
} from "@/lib/nmap/upload-validation-config";
import type { Scan } from "@/lib/types";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "selected" | "parsing" | "success" | "error";
type ScanImportJobStatus =
  | "queued"
  | "validating"
  | "parsing"
  | "saving"
  | "complete"
  | "failed";

const IDLE_MESSAGE = "Drop an Nmap XML file here, or click to browse.";
const JOB_POLL_INTERVAL_MS = 2000;

const PARSE_STEPS = [
  "Reading scan file…",
  "Parsing hosts & services…",
  "Generating findings…",
  "Scoring risk…",
];
const MIN_PARSE_MS = 1800;

const LARGE_STATUS_MESSAGES: Record<ScanImportJobStatus, string> = {
  queued: "Queued for processing…",
  validating: "Validating scan…",
  parsing: "Parsing hosts & services…",
  saving: "Saving to database…",
  complete: "Scan imported. Ready to review.",
  failed: "Import failed.",
};
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedScan, setParsedScan] = useState<Scan | null>(null);
  const [completedScanId, setCompletedScanId] = useState<string | null>(null);
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
    setSelectedFile(null);
    setParsedScan(null);
    setCompletedScanId(null);
    setStatus("idle");
    setProgress(0);
    setStatusMessage(IDLE_MESSAGE);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function selectFile(file: File) {
    if (status === "parsing") {
      return;
    }

    const validationMessage = getClientFileValidationMessage(file);
    if (validationMessage) {
      setSelectedFile(file);
      setParsedScan(null);
      setCompletedScanId(null);
      setStatus("error");
      setProgress(0);
      setStatusMessage(validationMessage);
      return;
    }

    setSelectedFile(file);
    setParsedScan(null);
    setCompletedScanId(null);
    setStatus("selected");
    setProgress(0);
    setStatusMessage(
      fileTier(file) === "large"
        ? "Ready to upload this large scan for background processing."
        : "Ready to parse this scan.",
    );
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      selectFile(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      selectFile(file);
    }
  }

  async function handleAnalyzeScan() {
    if (!selectedFile || status === "parsing") {
      return;
    }

    const validationMessage = getClientFileValidationMessage(selectedFile);
    if (validationMessage) {
      setStatus("error");
      setStatusMessage(validationMessage);
      return;
    }

    if (fileTier(selectedFile) === "large") {
      await handleLargeUpload(selectedFile);
    } else {
      await handleSmallUpload(selectedFile);
    }
  }

  async function handleSmallUpload(file: File) {
    setStatus("parsing");
    setProgress(8);
    setStatusMessage(PARSE_STEPS[0]);

    let step = 0;
    stopParseAnimation();
    parseTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, PARSE_STEPS.length - 1);
      setStatusMessage(PARSE_STEPS[step]);
      setProgress((p) => Math.min(90, p + 22));
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
      setProgress(100);
      setParsedScan(scan);
      setStatus("success");
      setStatusMessage("Scan parsed. Ready to review.");
      toast.success("Scan parsed");
    } catch (error) {
      stopParseAnimation();
      const message =
        error instanceof Error ? error.message : "Failed to parse scan.";
      setStatus("error");
      setProgress(0);
      setStatusMessage(message);
      toast.error(message);
    }
  }

  async function handleLargeUpload(file: File) {
    setStatus("parsing");
    setProgress(1);
    setStatusMessage("Uploading large scan…");

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

        setProgress(Math.min(40, Math.round(((chunkIndex + 1) / totalChunks) * 40)));
        setStatusMessage(`Uploading large scan… (${chunkIndex + 1}/${totalChunks})`);
      }

      setStatusMessage("Queuing import job…");
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

      await pollImportJob(job.id);
    } catch (error) {
      stopJobPolling();
      const message =
        error instanceof Error ? error.message : "Failed to import scan.";
      setStatus("error");
      setProgress(0);
      setStatusMessage(message);
      toast.error(message);
    }
  }

  function pollImportJob(jobId: string): Promise<void> {
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

          setProgress(LARGE_STATUS_PROGRESS[job.status]);
          setStatusMessage(job.errorMessage ?? LARGE_STATUS_MESSAGES[job.status]);

          if (job.status === "complete") {
            stopJobPolling();
            setCompletedScanId(job.scanId ?? null);
            setStatus("success");
            toast.success("Scan imported");
            resolve();
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

  const hasFile = selectedFile !== null;
  const canAnalyze = hasFile && status === "selected";
  const isSuccess =
    status === "success" && (parsedScan !== null || completedScanId !== null);
  const viewScanId = parsedScan?.id ?? completedScanId;
  const stats = parsedScan
    ? {
        hosts: parsedScan.hosts.length,
        services: parsedScan.hosts.reduce(
          (total, host) => total + host.services.length,
          0,
        ),
        findings: parsedScan.findings.length,
      }
    : null;
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
          accept=".xml,text/xml,application/xml"
          className="sr-only"
          aria-label="Nmap XML scan file"
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
              {isSuccess ? "Scan ready" : "Upload Nmap XML"}
            </h2>
            <p
              id="upload-status"
              className="mt-1 text-sm leading-6 text-muted-foreground"
              aria-live="polite"
            >
              {statusMessage}
            </p>
          </div>
          {hasFile && !isSuccess ? (
            <Button
              aria-label="Clear selected file"
              className="shrink-0 rounded-md"
              disabled={status === "parsing"}
              size="icon"
              type="button"
              variant="ghost"
              onClick={resetUpload}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        {hasFile ? (
          <div className="mt-4 rounded-md border bg-background p-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <p className="truncate text-sm font-medium text-foreground">
                {selectedFile.name}
              </p>
            </div>
            {isSuccess && stats ? (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                {stats.hosts} {stats.hosts === 1 ? "host" : "hosts"} ·{" "}
                {stats.services} {stats.services === 1 ? "service" : "services"}{" "}
                · {stats.findings}{" "}
                {stats.findings === 1 ? "finding" : "findings"}
              </p>
            ) : isSuccess ? (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Large scan imported in the background.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            )}
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
          {isSuccess ? (
            <>
              <Button
                className="w-full rounded-md"
                size="lg"
                type="button"
                disabled={isNavigating || !viewScanId}
                onClick={() => {
                  if (!viewScanId) return;
                  startNavigation(() => {
                    router.push(`/scans/${viewScanId}`);
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
                  "View scan"
                )}
              </Button>
              <Button
                className="w-full rounded-md"
                size="lg"
                type="button"
                variant="outline"
                onClick={resetUpload}
              >
                Upload another
              </Button>
            </>
          ) : (
            <>
              <Button
                className="w-full rounded-md"
                disabled={status === "parsing"}
                size="lg"
                type="button"
                variant={hasFile ? "outline" : "default"}
                onClick={openFilePicker}
              >
                {hasFile ? "Replace file" : "Select file"}
              </Button>
              {hasFile ? (
                <Button
                  className="w-full rounded-md"
                  disabled={!canAnalyze}
                  size="lg"
                  type="button"
                  onClick={handleAnalyzeScan}
                >
                  {status === "parsing" ? "Processing..." : "Analyze scan"}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
