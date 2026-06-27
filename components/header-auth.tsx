"use client";

import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

export function HeaderAuth() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <>
      <SignInButton forceRedirectUrl="/scans">
        <Button variant="outline" className="bg-background">
          Sign in
        </Button>
      </SignInButton>
      <SignUpButton forceRedirectUrl="/scans">
        <Button>
          Sign up
        </Button>
      </SignUpButton>
    </>
  );
}
