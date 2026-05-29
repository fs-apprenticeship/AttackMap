// Auth is deferred to a future cycle. Clerk middleware is disabled for the MVP
// so routes load without Clerk env keys. To re-enable, uncomment the two lines
// below (and remove the no-op proxy), then add the Clerk keys to the env.
//
// import { clerkMiddleware } from '@clerk/nextjs/server';
// export default clerkMiddleware();

// No-op proxy: matcher is empty, so this never runs and every request passes
// through untouched.
export default function proxy() {}

export const config = {
  matcher: [],
};
