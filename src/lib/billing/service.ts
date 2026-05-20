/**
 * Billing service (QIN-24): maps Stripe customers/subscriptions onto the
 * multi-tenant data model and resolves entitlements for a tenant.
 *
 * Tenant = `organizations` row. One `subscriptions` row per org is the source
 * of truth for entitlement. The Stripe webhook calls `upsertSubscriptionFromStripe`;
 * the rest of the app calls `getEntitlements` / `requireEntitlement`.
 */

import { eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import type { Organization, Subscription } from "@/db/schema";

import { resolvePlanFromPriceId } from "./config";
import {
  NO_ENTITLEMENTS,
  PLANS,
  statusGrantsAccess,
  type Entitlements,
  type PlanKey,
} from "./plans";
import { createCustomer, type StripeSubscription } from "./stripe";

/**
 * Returns the Stripe customer id for an org, creating the customer (and a stub
 * subscription row) on first use. Idempotent: a second call returns the
 * existing customer. Stamps `metadata.organizationId` on the Stripe customer so
 * the org is recoverable from Stripe alone.
 */
export async function getOrCreateStripeCustomer(
  org: Organization,
  email?: string,
): Promise<{ customerId: string; subscription: Subscription }> {
  const existing = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.organizationId, org.id))
    .limit(1);
  if (existing.length > 0 && existing[0].stripeCustomerId) {
    return { customerId: existing[0].stripeCustomerId, subscription: existing[0] };
  }

  const customer = await createCustomer({ email, name: org.name, organizationId: org.id });
  const [row] = await db
    .insert(schema.subscriptions)
    .values({ organizationId: org.id, stripeCustomerId: customer.id, status: "incomplete" })
    .onConflictDoUpdate({
      target: schema.subscriptions.organizationId,
      set: { stripeCustomerId: customer.id, updatedAt: new Date() },
    })
    .returning();
  return { customerId: customer.id, subscription: row };
}

function unixToDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

/** Find the org a Stripe subscription belongs to: metadata first, then customer. */
async function resolveOrganizationId(sub: StripeSubscription): Promise<string | null> {
  const fromMetadata = sub.metadata?.organizationId;
  if (fromMetadata) return fromMetadata;
  const byCustomer = await db
    .select({ organizationId: schema.subscriptions.organizationId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.stripeCustomerId, sub.customer))
    .limit(1);
  return byCustomer[0]?.organizationId ?? null;
}

/**
 * Upsert the local subscription row from a Stripe subscription object (from a
 * webhook or a retrieve). Returns null if we can't map it to an org (logged by
 * the caller). Keyed on `organizationId` so each tenant keeps exactly one row.
 */
export async function upsertSubscriptionFromStripe(
  sub: StripeSubscription,
): Promise<Subscription | null> {
  const organizationId = await resolveOrganizationId(sub);
  if (!organizationId) return null;

  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const plan = resolvePlanFromPriceId(priceId);
  const quantity = sub.items?.data?.[0]?.quantity ?? 1;

  const values = {
    organizationId,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    plan,
    priceId,
    status: sub.status,
    quantity,
    currentPeriodEnd: unixToDate(sub.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    canceledAt: unixToDate(sub.canceled_at),
    trialEndsAt: unixToDate(sub.trial_end),
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

export interface EntitlementResult {
  plan: PlanKey | null;
  status: string | null;
  active: boolean;
  entitlements: Entitlements;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Resolve what a tenant is allowed to do right now. Access requires both an
 * access-granting status (active/trialing/past_due) AND a recognized plan.
 */
export async function getEntitlements(organizationId: string): Promise<EntitlementResult> {
  const rows = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.organizationId, organizationId))
    .limit(1);
  const sub = rows[0];

  const plan = (sub?.plan as PlanKey | null) ?? null;
  const status = sub?.status ?? null;
  const active = statusGrantsAccess(status) && plan != null;

  return {
    plan,
    status,
    active,
    entitlements: active && plan ? PLANS[plan].entitlements : NO_ENTITLEMENTS,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
  };
}

/**
 * Guard for entitlement-gated features. Throws `EntitlementError` when the
 * tenant lacks an active subscription or the requested numeric limit is 0/false.
 * Callers in HubSpot connect/sync, digest delivery, and email drafts should
 * wrap with this (wiring tracked as a follow-up — see QIN-24).
 */
export class EntitlementError extends Error {
  constructor(
    message: string,
    public readonly reason: "no_subscription" | "feature_unavailable",
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

export async function requireActiveSubscription(organizationId: string): Promise<EntitlementResult> {
  const result = await getEntitlements(organizationId);
  if (!result.active) {
    throw new EntitlementError("Organization has no active subscription", "no_subscription");
  }
  return result;
}
