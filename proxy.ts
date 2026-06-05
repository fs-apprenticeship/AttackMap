import { clerkMiddleware } from "@clerk/nextjs/server";

// Route protection is handled at the page/action level via auth() and
// requireAuthSync() in lib/auth/sync.ts — not here.
// The middleware only runs Clerk so that auth() resolves correctly
// in Server Components and API routes without causing redirect loops.
// clockSkewInMs tolerates small differences between the server clock and
// Clerk's servers when validating JWT nbf/exp claims (seen up to ~11s locally).
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
