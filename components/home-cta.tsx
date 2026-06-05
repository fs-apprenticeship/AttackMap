"use client";

import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";

export function HomeCTA() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <Link
        href="/scans"
        className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
      >
        View dashboard
      </Link>
    );
  }

  return (
    <>
      <SignUpButton forceRedirectUrl="/scans">
        <button className="h-10 rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800">
          Get started
        </button>
      </SignUpButton>
      <SignInButton forceRedirectUrl="/scans">
        <button className="h-10 rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
          Sign in
        </button>
      </SignInButton>
    </>
  );
}
