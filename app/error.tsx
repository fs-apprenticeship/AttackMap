"use client";

import { useEffect } from "react";

import { RouteErrorState } from "@/components/app-shell/app-state-common";

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

  return <RouteErrorState onRetry={unstable_retry} />;
}
