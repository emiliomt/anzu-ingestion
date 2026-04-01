import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/status(.*)",
  "/sign-in(.*)",
  "/portal",            // vendor portal landing (unauthenticated upload allowed)
  "/portal/sign-in(.*)",
  "/portal/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/status(.*)",
  "/api/upload",        // unauthenticated upload (email/name provided in form)
  "/api/health",
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
