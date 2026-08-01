import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only the author area and its APIs require auth; the landing page,
// recipient pages (/l/*) and legacy redirects stay public.
const isProtectedRoute = createRouteMatcher(["/notes(.*)", "/api/notes(.*)", "/api/letter(.*)", "/api/checkout(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|wav|mp3)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
