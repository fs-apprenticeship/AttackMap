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
import type { Scan } from "@/lib/types";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "selected" | "parsing" | "success" | "error";

const XML_FILE_TYPES = new Set(["text/xml", "application/xml"]);

const IDLE_MESSAGE = "Drop an Nmap XML file here, or click to browse.";

// Cosmetic parse steps + a minimum on-screen time, so parsing reads as a
// deliberate moment rather than an imperceptible flash.
const PARSE_STEPS = [
  "Reading scan file…",
  "Parsing hosts & services…",
  "Generating findings…",
  "Scoring risk…",
];
const MIN_PARSE_MS = 1800;

function isXmlFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".xml") || XML_FILE_TYPES.has(file.type)
  );
}

export function UploadCard() {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedScan, setParsedScan] = useState<Scan | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(IDLE_MESSAGE);

  // Clear the animation interval if the user navigates away mid-parse.
  useEffect(() => {
    return () => {
      if (parseTimerRef.current) clearInterval(parseTimerRef.current);
    };
  }, []);

  function stopParseAnimation() {
    if (parseTimerRef.current) {
      clearInterval(parseTimerRef.current);
      parseTimerRef.current = null;
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function resetUpload() {
    stopParseAnimation();
    setSelectedFile(null);
    setParsedScan(null);
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

    if (!isXmlFile(file)) {
      setSelectedFile(file);
      setParsedScan(null);
      setStatus("error");
      setProgress(0);
      setStatusMessage("Upload a valid Nmap XML file.");
      return;
    }

    setSelectedFile(file);
    setParsedScan(null);
    setStatus("selected");
    setProgress(0);
    setStatusMessage("Ready to parse this scan.");
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

    if (!isXmlFile(selectedFile)) {
      setStatus("error");
      setStatusMessage("Upload a valid Nmap XML file.");
      return;
    }

    setStatus("parsing");
    setProgress(8);
    setStatusMessage(PARSE_STEPS[0]);

    // Cycle the step messages and ease the progress bar forward while we wait.
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
      formData.append("file", selectedFile);

      const response = await fetch("/api/scan/parse", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Failed to parse scan.");
      }

      const scan = (await response.json()) as Scan;

      // Let the animation breathe even when the request returns quickly.
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

  const hasFile = selectedFile !== null;
  const canAnalyze = hasFile && status === "selected";
  const isSuccess = status === "success" && parsedScan !== null;
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
        "rounded-md border-dashed border-zinc-300 bg-white py-0 shadow-sm transition-colors",
        isDragging && "border-zinc-950 bg-zinc-50",
        status === "error" && "border-red-300 bg-red-50",
        status === "success" && "border-emerald-300 bg-emerald-50",
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
          onChange={handleFileChange}
        />

        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white transition-colors",
            status === "parsing" && "bg-zinc-900",
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
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {statusMessage}
            </p>
          </div>
          {hasFile && !isSuccess ? (
            <Button
              aria-label="Clear selected file"
              className="size-8 shrink-0 rounded-md"
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
          <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-zinc-500" />
              <p className="truncate text-sm font-medium text-zinc-900">
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
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
        ) : null}

        {status === "parsing" ? (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="transition-all" />
            <p className="text-xs text-zinc-500">{progress}% complete</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {isSuccess ? (
            <>
              <Button
                className="w-full rounded-md"
                size="lg"
                type="button"
                disabled={isNavigating}
                onClick={() => {
                  if (!parsedScan) return;
                  // Navigate and reset inside the same transition: React keeps
                  // the success card on screen until the scan page is ready,
                  // then commits both — so the form is cleared off-screen
                  // without a visible blank-out before the redirect.
                  startNavigation(() => {
                    router.push(`/scans/${parsedScan.id}`);
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
                  {status === "parsing" ? "Parsing..." : "Analyze scan"}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
