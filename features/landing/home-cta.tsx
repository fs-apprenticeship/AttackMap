"use client";

import { useAuth, SignUpButton } from "@clerk/nextjs";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function HomeCTA() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="lg">
          <Link href="/dashboard/scans">
            View scans
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="bg-background">
          <Link href="/docs">
            <BookOpen className="size-4" />
            Read the docs
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <SignUpButton forceRedirectUrl="/dashboard/scans">
        <Button size="lg">
          Get started
          <ArrowRight className="size-4" />
        </Button>
      </SignUpButton>
      <Button asChild size="lg" variant="outline" className="bg-background">
        <Link href="/docs">
          <BookOpen className="size-4" />
          Read the docs
        </Link>
      </Button>
    </>
  );
}
