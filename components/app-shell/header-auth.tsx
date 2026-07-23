"use client";

import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function HeaderAuth() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <>
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/dashboard/scans">Open app</Link>
        </Button>
        <UserButton />
      </>
    );
  }

  return (
    <>
      <SignInButton forceRedirectUrl="/dashboard/scans">
        <Button variant="ghost" className="hidden px-2.5 sm:inline-flex sm:px-3">
          Sign in
        </Button>
      </SignInButton>
      <SignUpButton forceRedirectUrl="/dashboard/scans">
        <Button className="px-2.5 sm:px-3">
          Sign up
        </Button>
      </SignUpButton>
    </>
  );
}
