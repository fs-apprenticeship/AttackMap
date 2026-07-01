"use client";

import { useEffect } from "react";

import { RouteErrorState } from "@/components/app-state-common";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteErrorState
      title="Scans could not load"
      description="The scan history could not be loaded. Try again, or upload a new scan."
      onRetry={unstable_retry}
    />
  );
}
