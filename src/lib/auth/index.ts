/**
 * Auth provider resolution (QIN-25).
 *
 * Production target is **Clerk** (stack default — fastest path to org-scoped
 * sessions). Clerk requires operator-provisioned keys (CLERK_SECRET_KEY +
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY). Until those land — and so the keyless
 * staging environment keeps working end-to-end — the active provider is the
 * built-in password + HMAC-signed-cookie session. This mirrors the deliberate,
 * dependency-/key-optional choices already made for HubSpot and Stripe (raw
 * `fetch`, env-gated, actionable errors; see `lib/billing/stripe.ts`).
 *
 * Swap path when Clerk keys are provisioned:
 *   1. add `@clerk/nextjs`, wrap the app in <ClerkProvider> + middleware,
 *   2. in `./server#getSession`, read Clerk's session and map the active Clerk
 *      org -> our `organizations.id` (provision/link an org on first sign-in,
 *      reusing `service.ts`),
 *   3. point sign-up/sign-in at Clerk's components.
 * Everything downstream depends only on `getSession()` / `SessionPayload`, so
 * no call sites change.
 */
export const AUTH_PROVIDER: "password" | "clerk" = process.env.CLERK_SECRET_KEY
  ? "clerk"
  : "password";

export {
  SESSION_COOKIE,
  signSession,
  verifySession,
  newSessionPayload,
  getSessionFromRequest,
  parseSessionCookie,
  sessionCookieOptions,
  clearedSessionCookieOptions,
  type SessionPayload,
} from "./session";
