import { cn } from "@/lib/utils";

import type { Severity } from "@/lib/types";
import { severityOrder } from "@/lib/scans/severity";

export { severityOrder };

export const severityClass: Record<Severity, string> = {
  critical: "border-red-300 bg-red-50 text-red-700",
  high: "border-red-300 bg-red-50 text-red-700",
  medium: "border-amber-300 bg-amber-50 text-amber-700",
  low: "border-emerald-300 bg-emerald-50 text-emerald-700",
  info: "border-sky-300 bg-sky-50 text-sky-700",
};

export const nodeClass: Record<Severity, string> = {
  critical: "border-red-400 bg-red-50 text-red-900",
  high: "border-red-400 bg-red-50 text-red-900",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-emerald-300 bg-emerald-50 text-emerald-900",
  info: "border-sky-300 bg-sky-50 text-sky-900",
};

export const priorityClass = {
  now: "bg-red-600 text-white",
  next: "bg-amber-500 text-white",
  later: "bg-zinc-700 text-white",
};

export function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getSeverityBadgeClass(severity: Severity) {
  return cn(
    "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold uppercase",
    severityClass[severity],
  );
}
