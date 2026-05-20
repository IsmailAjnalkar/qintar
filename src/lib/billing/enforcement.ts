/**
 * Entitlement enforcement (QIN-25): gate value-delivery features on an active
 * subscription — gracefully, and WITHOUT breaking the keyless staging sync.
 *
 * Feature flag: ENFORCE_ENTITLEMENTS (default OFF). With the flag off nothing is
 * gated, so staging behaves exactly as it does today. With it on, an org is only
 * gated once it HAS a subscription row — i.e. once it has entered billing
 * (`getOrCreateStripeCustomer` creates the row at checkout). Orgs that never
 * started checkout (staging / pre-billing) have no row and stay open. Net: the
 * existing keyless `/api/hubspot/sync` keeps working untouched, while recurring
 * delivery is cut off for a customer who started billing but isn't paying.
 *
 * This is intentionally NOT applied to the initial connect + first sync during
 * onboarding (the activation moment happens before the user picks a plan — see
 * design/onboarding-flow.md). It gates the recurring/cron sync and (W3) digest
 * delivery and (W4) email drafts.
 */
import { eq } from "drizzle-orm";

import { db, schema } from "@/db/client";

import type { Entitlements } from "./plans";
import { getEntitlements } from "./service";

export function entitlementsEnforced(): boolean {
  return process.env.ENFORCE_ENTITLEMENTS === "true";
}

export type GateReason = "inactive_subscription" | "feature_unavailable";

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: GateReason };

/**
 * Decide whether an org may run a recurring / value-delivery action right now.
 * Allows when enforcement is off, or when the org has no subscription row
 * (keyless staging / pre-billing). When a numeric/boolean `feature` is given it
 * must additionally be granted by the active plan.
 */
export async function gateOrganization(
  organizationId: string,
  feature?: keyof Entitlements,
): Promise<GateResult> {
  if (!entitlementsEnforced()) return { allowed: true };

  const rows = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.organizationId, organizationId))
    .limit(1);

  // Org never entered billing -> not gated (preserves keyless staging sync).
  if (rows.length === 0) return { allowed: true };

  const ent = await getEntitlements(organizationId);
  if (!ent.active) return { allowed: false, reason: "inactive_subscription" };

  if (feature) {
    const value = ent.entitlements[feature];
    const granted = typeof value === "number" ? value > 0 : Boolean(value);
    if (!granted) return { allowed: false, reason: "feature_unavailable" };
  }
  return { allowed: true };
}
