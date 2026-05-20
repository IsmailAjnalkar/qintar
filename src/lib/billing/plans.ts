/**
 * Billing plans & per-tier entitlements (QIN-24, W2).
 *
 * The three sellable tiers. `priceMonthlyUsd` is for display/marketing only —
 * the real source of truth for what Stripe charges is the Price object whose id
 * lives in env (see `config.ts`, `STRIPE_PRICE_*`). Entitlements are what a
 * paying org is allowed to do; they are resolved from the active subscription's
 * plan in `service.ts` and enforced by callers via `requireEntitlement`.
 */

export const PLAN_KEYS = ["starter", "team", "scale"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export interface Entitlements {
  /** Max simultaneously-connected HubSpot portals. */
  maxConnections: number;
  /** Seats (team members) allowed in the org. */
  maxSeats: number;
  /** LLM-generated email drafts allowed per billing month (W4 feature). */
  emailDraftsPerMonth: number;
  /** Daily Slack digest delivery. */
  dailyDigest: boolean;
  /** Pipeline Health Score access. */
  healthScore: boolean;
}

export interface Plan {
  key: PlanKey;
  name: string;
  /** Display price in whole USD/month. Stripe is the billing source of truth. */
  priceMonthlyUsd: number;
  /** Env var that holds this plan's Stripe Price id. */
  priceEnvVar: string;
  entitlements: Entitlements;
}

export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: "starter",
    name: "Starter",
    priceMonthlyUsd: 49,
    priceEnvVar: "STRIPE_PRICE_STARTER",
    entitlements: {
      maxConnections: 1,
      maxSeats: 3,
      emailDraftsPerMonth: 100,
      dailyDigest: true,
      healthScore: true,
    },
  },
  team: {
    key: "team",
    name: "Team",
    priceMonthlyUsd: 499,
    priceEnvVar: "STRIPE_PRICE_TEAM",
    entitlements: {
      maxConnections: 3,
      maxSeats: 15,
      emailDraftsPerMonth: 1_000,
      dailyDigest: true,
      healthScore: true,
    },
  },
  scale: {
    key: "scale",
    name: "Scale",
    priceMonthlyUsd: 1_499,
    priceEnvVar: "STRIPE_PRICE_SCALE",
    entitlements: {
      maxConnections: 10,
      maxSeats: 100,
      emailDraftsPerMonth: 10_000,
      dailyDigest: true,
      healthScore: true,
    },
  },
};

/** Entitlements for an org with no active/paid subscription (locked out). */
export const NO_ENTITLEMENTS: Entitlements = {
  maxConnections: 0,
  maxSeats: 1,
  emailDraftsPerMonth: 0,
  dailyDigest: false,
  healthScore: false,
};

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

/**
 * Stripe subscription statuses that grant access. `past_due` is intentionally
 * still entitled — it's a dunning grace window, not a hard cutoff (Stripe keeps
 * retrying the card). `unpaid`/`canceled`/`incomplete*` lose access.
 */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export function statusGrantsAccess(status: string | null | undefined): boolean {
  return status != null && ENTITLED_STATUSES.has(status);
}
