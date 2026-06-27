"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

import { AppStateCard } from "@/components/app-state-common";
import { Button } from "@/components/ui/button";

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
    <AppStateCard
      icon={<AlertTriangle className="size-5" />}
      title="Scan details could not load"
      description="This scan view could not finish rendering. Try again, or return to the scan list."
      actions={
        <>
          <Button type="button" className="rounded-md" onClick={unstable_retry}>
            <RotateCw className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline" className="rounded-md bg-white">
            <Link href="/scans">View scans</Link>
          </Button>
        </>
      }
    />
  );
}
