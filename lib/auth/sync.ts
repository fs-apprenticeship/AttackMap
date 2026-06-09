import "server-only";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

async function syncUser(userId: string): Promise<void> {
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";
  await db.user.upsert({
    where: { id: userId },
    // Keep email in sync rather than an empty update (some Prisma versions
    // reject `update: {}`, which broke the upsert on the second sync).
    update: { email },
    create: { id: userId, email },
  });
}

/**
 * Use in pages and server actions that require authentication.
 * Redirects to "/" if the user is not signed in.
 * Syncs the User DB row on first call, then is a no-op.
 */
export async function requireAuthSync(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/");
  await syncUser(userId);
  return userId;
}

/**
 * Use in pages and routes that work with or without authentication.
 * Returns userId if signed in and synced, null otherwise.
 */
export async function getOptionalAuth(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  await syncUser(userId);
  return userId;
}
