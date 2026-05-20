/**
 * Interim authorization for the billing admin endpoints (checkout / portal /
 * status) — QIN-24.
 *
 * There is no end-user auth system in the repo yet (Clerk/Auth.js is a separate
 * onboarding/auth issue). Until the authenticated session exists, these
 * endpoints are gated by a shared secret so they aren't open "create a checkout
 * for any org" holes. The webhook is NOT gated this way — it uses Stripe
 * signature verification.
 *
 * When the session lands, replace `billingAdminAuthorized` with a check that the
 * caller owns `organizationId`.
 */

import { safeEqual } from "@/lib/crypto";

export function billingAdminAuthorized(req: Request): boolean {
  const secret = process.env.BILLING_ADMIN_SECRET ?? process.env.SYNC_TRIGGER_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const fromQuery = new URL(req.url).searchParams.get("secret");
  return (
    (bearer != null && safeEqual(bearer, secret)) ||
    (fromQuery != null && safeEqual(fromQuery, secret))
  );
}
