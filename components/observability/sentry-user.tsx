"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import * as Sentry from "@sentry/nextjs";

// Sets/clears the opaque Clerk user id on the Sentry scope. No email, name,
// or session data — see docs/SENTRY_IMPLEMENTATION.md, "Add identity context
// safely". Renders nothing; mounted once under ClerkProvider.
export function SentryUser() {
  const { isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (isSignedIn && userId) {
      Sentry.setUser({ id: userId });
    } else {
      Sentry.setUser(null);
    }
  }, [isSignedIn, userId]);

  return null;
}
