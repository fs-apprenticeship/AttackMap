"use client";

import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function HeaderAuth() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <>
      <SignInButton forceRedirectUrl="/scans">
        <button className="h-9 rounded-md border bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton forceRedirectUrl="/scans">
        <button className="h-9 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800">
          Sign up
        </button>
      </SignUpButton>
    </>
  );
}
