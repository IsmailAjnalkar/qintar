/** PayPal billing configuration & env access (QIN-24 — PayPal-only rebuild). */

import { PLAN_KEYS, PLANS, type PlanKey } from "../plans";

/** Sandbox vs live API base, selected by PAYPAL_ENV (default sandbox). */
export function getPaypalApiBase(): string {
  const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  return env === "live" || env === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export interface PaypalEnv {
  clientId: string;
  clientSecret: string;
}

/**
 * Reads + validates the PayPal REST app credentials. Throws an actionable error
 * if the operator hasn't configured them yet (from developer.paypal.com → Apps &
 * Credentials). Mirrors the HubSpot/Stripe env-access pattern.
 */
export function getPaypalEnv(): PaypalEnv {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const missing: string[] = [];
  if (!clientId) missing.push("PAYPAL_CLIENT_ID");
  if (!clientSecret) missing.push("PAYPAL_CLIENT_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `PayPal is not configured. Missing: ${missing.join(", ")}. Create a PayPal ` +
        "REST app (developer.paypal.com → Apps & Credentials) and set these env vars.",
    );
  }
  return { clientId: clientId!, clientSecret: clientSecret! };
}

/** Webhook id from the PayPal app's webhook config — required to verify events. */
export function getPaypalWebhookId(): string {
  const id = process.env.PAYPAL_WEBHOOK_ID;
  if (!id) {
    throw new Error(
      "Missing PAYPAL_WEBHOOK_ID. Create a webhook in the PayPal app pointing at " +
        "/api/billing/paypal/webhook and set its Webhook ID.",
    );
  }
  return id;
}

/** The PayPal Billing Plan id (P-…) backing a tier. Throws if unset. */
export function getPaypalPlanId(plan: PlanKey): string {
  const envVar = `PAYPAL_PLAN_${plan.toUpperCase()}`;
  const planId = process.env[envVar];
  if (!planId) {
    throw new Error(
      `Missing ${envVar}. Create the ${PLANS[plan].name} ($${PLANS[plan].priceMonthlyUsd}/mo) ` +
        `monthly Billing Plan in PayPal and set ${envVar} to its plan id (P-…).`,
    );
  }
  return planId;
}

/** Reverse lookup: which tier does a PayPal plan id belong to? null if unknown. */
export function resolvePlanFromPaypalPlanId(planId: string | null | undefined): PlanKey | null {
  if (!planId) return null;
  for (const plan of PLAN_KEYS) {
    if (process.env[`PAYPAL_PLAN_${plan.toUpperCase()}`] === planId) return plan;
  }
  return null;
}

/**
 * Map a PayPal subscription status to our internal status vocabulary so the
 * existing entitlement logic (`statusGrantsAccess` in plans.ts) works unchanged.
 * PayPal: APPROVAL_PENDING | APPROVED | ACTIVE | SUSPENDED | CANCELLED | EXPIRED.
 */
export function mapPaypalStatus(paypalStatus: string | null | undefined): string {
  switch ((paypalStatus ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "past_due"; // dunning grace — still entitled briefly
    case "CANCELLED":
      return "canceled";
    case "EXPIRED":
      return "canceled";
    case "APPROVED":
    case "APPROVAL_PENDING":
      return "incomplete"; // not active until the payer approves
    default:
      return "incomplete";
  }
}
