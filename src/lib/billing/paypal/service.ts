/**
 * PayPal subscription persistence (QIN-24 — PayPal-only). Maps a PayPal
 * subscription onto the shared `subscriptions` table (one row per org), reusing
 * the entitlement model in `service.ts` (`getEntitlements` reads plan + status).
 */

import { eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import type { Subscription } from "@/db/schema";

import { mapPaypalStatus, resolvePlanFromPaypalPlanId } from "./config";
import { getSubscription, type PaypalSubscription } from "./client";

function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The org a PayPal subscription belongs to: custom_id, else existing row. */
async function resolveOrganizationId(sub: PaypalSubscription): Promise<string | null> {
  if (sub.custom_id) return sub.custom_id;
  const rows = await db
    .select({ organizationId: schema.subscriptions.organizationId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.paypalSubscriptionId, sub.id))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

/**
 * Upsert the local subscription row from a PayPal subscription object. Keyed on
 * organizationId (one row per tenant). Returns null if it can't map to an org.
 */
export async function upsertPaypalSubscription(sub: PaypalSubscription): Promise<Subscription | null> {
  const organizationId = await resolveOrganizationId(sub);
  if (!organizationId) return null;

  const plan = resolvePlanFromPaypalPlanId(sub.plan_id);
  const values = {
    organizationId,
    paypalSubscriptionId: sub.id,
    paypalPlanId: sub.plan_id ?? null,
    plan,
    status: mapPaypalStatus(sub.status),
    currentPeriodEnd: isoToDate(sub.billing_info?.next_billing_time),
    cancelAtPeriodEnd: false,
    canceledAt: (sub.status ?? "").toUpperCase() === "CANCELLED" ? new Date() : null,
    raw: sub as unknown,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(schema.subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: schema.subscriptions.organizationId, set: values })
    .returning();
  return row;
}

/** Fetch the authoritative subscription from PayPal by id, then persist it. */
export async function syncPaypalSubscription(subscriptionId: string): Promise<Subscription | null> {
  const sub = await getSubscription(subscriptionId);
  return upsertPaypalSubscription(sub);
}
