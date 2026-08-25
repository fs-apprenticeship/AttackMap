"use client";

import { useSyncExternalStore } from "react";
import { UserButton } from "@clerk/nextjs";

import { Skeleton } from "@/components/ui/skeleton";

// Clerk's UserButton mounts its widget imperatively into a host div once
// ClerkJS loads client-side, so its rendered content on the server (or on
// the client's first, hydration-matching pass) never matches what it mounts
// moments later — a structural hydration mismatch React can't be told to
// ignore via suppressHydrationWarning (that only covers text/attribute
// diffs on a single element, not added/changed subtrees).
//
// The standard fix for a client-only widget like this: never render it
// during the render pass hydration compares. useSyncExternalStore's server
// snapshot (`false`) is what both the server render and the client's first,
// hydration-matching render see; only once React re-renders post-hydration
// does the client snapshot (`true`) take over — no effect/setState involved.
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export function ClerkUserButton() {
  const hasMounted = useHasMounted();

  if (!hasMounted) {
    return <Skeleton className="size-8 shrink-0 rounded-full" aria-hidden />;
  }

  return <UserButton />;
}
