/** Stripe billing configuration & env access (QIN-24). */

import { PLAN_KEYS, PLANS, type PlanKey } from "./plans";

export const STRIPE_API_BASE = "https://api.stripe.com/v1";
// Pin the Stripe API version so server-side behavior is stable across deploys.
export const STRIPE_API_VERSION = "2024-06-20";

/**
 * Secret API key (sk_test_… in test mode, sk_live_… in production). Throws an
 * actionable error if the operator hasn't configured Stripe yet — mirrors the
 * HubSpot `getHubspotEnv` pattern.
 */
export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Stripe is not configured. Missing STRIPE_SECRET_KEY. Create a Stripe " +
        "account, copy the (test first) secret key, and set STRIPE_SECRET_KEY.",
    );
  }
  return key;
}

/** Webhook signing secret (whsec_…) from the Stripe webhook endpoint config. */
export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "Missing STRIPE_WEBHOOK_SECRET. Add a webhook endpoint in the Stripe " +
        "dashboard (or `stripe listen`) and set its signing secret.",
    );
  }
  return secret;
}

/** The Stripe Price id backing a plan. Throws if that plan's price isn't set. */
export function getStripePriceId(plan: PlanKey): string {
  const envVar = PLANS[plan].priceEnvVar;
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(
      `Missing ${envVar}. Create the ${PLANS[plan].name} ($${PLANS[plan].priceMonthlyUsd}/mo) ` +
        `recurring Price in Stripe and set ${envVar} to its price id.`,
    );
  }
  return priceId;
}

/**
 * Reverse lookup: which plan does a Stripe Price id belong to? Used by the
 * webhook to map an incoming subscription back to a tier. Returns null if the
 * price isn't one of ours (e.g. a legacy/manual price).
 */
export function resolvePlanFromPriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  for (const plan of PLAN_KEYS) {
    if (process.env[PLANS[plan].priceEnvVar] === priceId) return plan;
  }
  return null;
}

/** Absolute base URL for building Checkout success/cancel + portal return URLs. */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}
