"use client";

import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function HomeCTA() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <Button asChild size="lg">
        <Link href="/scans">View scans</Link>
      </Button>
    );
  }

  return (
    <>
      <SignUpButton forceRedirectUrl="/scans">
        <Button size="lg">
          Get started
        </Button>
      </SignUpButton>
      <SignInButton forceRedirectUrl="/scans">
        <Button size="lg" variant="outline" className="bg-background">
          Sign in
        </Button>
      </SignInButton>
    </>
  );
}
