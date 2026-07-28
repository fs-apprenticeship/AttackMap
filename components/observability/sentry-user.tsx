"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import * as Sentry from "@sentry/nextjs";

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
