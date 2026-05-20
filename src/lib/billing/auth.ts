/**
 * Authorization for the billing endpoints (checkout / portal / status) — QIN-24
 * gate, replaced by the authenticated session in QIN-25.
 *
 * Resolution order in `authorizeBillingOrg`:
 *   1. **Session** — the normal end-user path. The org is taken FROM the signed
 *      session (`oid`), never trusted from the request body. If the caller also
 *      names an `organizationId`, it must match the session's, or it's a 403
 *      (defends against one tenant acting on another).
 *   2. **Admin secret** — server-to-server / internal tooling fallback
 *      (BILLING_ADMIN_SECRET, falling back to SYNC_TRIGGER_SECRET). Here the
 *      org MUST be supplied explicitly since there's no session to derive it.
 *
 * The webhook is NOT gated by either — it uses Stripe signature verification.
 */
import { getSessionFromRequest } from "@/lib/auth/session";
import { safeEqual } from "@/lib/crypto";

/** True if the request carries a valid admin/server-to-server secret. */
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

export type BillingAuthResult =
  | { ok: true; organizationId: string; via: "session" | "admin" }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Resolve the org a billing call is authorized to act on. `requestedOrgId` is
 * whatever the caller named (body/query) — optional, and only used to (a)
 * tripwire a session/org mismatch and (b) supply the org for admin calls.
 */
export function authorizeBillingOrg(req: Request, requestedOrgId?: string | null): BillingAuthResult {
  const session = getSessionFromRequest(req);
  if (session) {
    if (requestedOrgId && requestedOrgId !== session.oid) {
      return { ok: false, status: 403, error: "forbidden: organization does not match session" };
    }
    return { ok: true, organizationId: session.oid, via: "session" };
  }

  if (billingAdminAuthorized(req)) {
    if (!requestedOrgId) {
      return { ok: false, status: 403, error: "organizationId is required for admin calls" };
    }
    return { ok: true, organizationId: requestedOrgId, via: "admin" };
  }

  return { ok: false, status: 401, error: "unauthorized" };
}
