"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
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
import { cn } from "@/lib/utils";

type UploadState = "idle" | "selected" | "parsing" | "success" | "error";

const XML_FILE_TYPES = new Set(["text/xml", "application/xml"]);

function isXmlFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".xml") || XML_FILE_TYPES.has(file.type)
  );
}

export function UploadCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "Parse a scan and add it to this workspace.",
  );

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function resetUpload() {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    setSelectedFile(null);
    setStatus("idle");
    setProgress(0);
    setStatusMessage("Parse a scan and add it to this workspace.");

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
      setStatus("error");
      setProgress(0);
      setStatusMessage("Upload a valid Nmap XML file.");
      return;
    }

    setSelectedFile(file);
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

  function handleAnalyzeScan() {
    if (!selectedFile || status === "parsing") {
      return;
    }

    if (!isXmlFile(selectedFile)) {
      setStatus("error");
      setStatusMessage("Upload a valid Nmap XML file.");
      return;
    }

    const checkpoints = [28, 54, 78, 100];
    let checkpointIndex = 0;

    setStatus("parsing");
    setProgress(8);
    setStatusMessage("Parsing scan file...");

    progressTimerRef.current = window.setInterval(() => {
      const nextProgress = checkpoints[checkpointIndex];
      checkpointIndex += 1;

      setProgress(nextProgress);

      if (nextProgress === 100) {
        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        setStatus("success");
        setStatusMessage("Scan parsed and ready for review.");
      }
    }, 450);
  }

  const hasFile = selectedFile !== null;
  const canAnalyze = hasFile && status === "selected";
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
            "flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white",
            status === "error" && "bg-red-600",
            status === "success" && "bg-emerald-600",
          )}
        >
          {statusIcon}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Upload Nmap XML</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {statusMessage}
            </p>
          </div>
          {hasFile ? (
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
            <p className="mt-1 text-xs text-zinc-500">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : null}

        {status === "parsing" ? (
          <div className="mt-4 space-y-2">
            <Progress value={progress} />
            <p className="text-xs text-zinc-500">{progress}% complete</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
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
              {status === "parsing"
                ? "Parsing..."
                : status === "success"
                  ? "Parsed"
                  : "Analyze scan"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
