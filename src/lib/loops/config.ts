/**
 * Loops.so lifecycle-email config (PRE-13).
 *
 * Loops handles all drip timing/sending no-code (the marketing "Loops" built in
 * the dashboard — see content/email-lifecycle-flows.md §9). The product's only
 * job is to tell Loops what happened: create/update the contact and fire a
 * handful of lifecycle events. This module holds the connection details and the
 * event/property vocabulary shared by client.ts + lifecycle.ts.
 *
 * The integration is OPT-IN: with no LOOPS_API_KEY set, every call no-ops
 * (returns { ok: true, skipped: true }) so local/staging and unconfigured
 * environments behave exactly as before. Set LOOPS_API_KEY in the product env
 * to go live (see .env.example).
 */

export const LOOPS_API_BASE = "https://app.loops.so/api/v1";

export function getLoopsApiKey(): string | null {
  return process.env.LOOPS_API_KEY?.trim() || null;
}

export function isLoopsConfigured(): boolean {
  return getLoopsApiKey() != null;
}

/**
 * Lifecycle events the product fires to Loops. Names MUST match the event
 * triggers configured on the Loops side (email-lifecycle-flows.md §9):
 *   - upsell_qualified       → Free→Pro Upsell Loop
 *   - went_inactive          → Re-engagement Loop
 *   - subscription_started   → exits Welcome + Upsell (upgrade/convert)
 *   - subscription_cancelled → Winback Loop
 *
 * The Welcome Loop is triggered by "contact created" (createContact), not an
 * event, so it has no entry here.
 */
export const LOOPS_EVENTS = {
  upsellQualified: "upsell_qualified",
  wentInactive: "went_inactive",
  subscriptionStarted: "subscription_started",
  subscriptionCancelled: "subscription_cancelled",
} as const;

export type LoopsEventName = (typeof LOOPS_EVENTS)[keyof typeof LOOPS_EVENTS];

/** Plan value sent as a Loops contact property; drives Welcome/Upsell audience filters. */
export type LoopsPlan = "free" | "pro";

/**
 * Contact properties registered in Loops (email-lifecycle-flows.md §9.A.2).
 * `email` is the contact key; the rest are optional and updated as we learn them.
 */
export interface LoopsContactProperties {
  firstName?: string;
  plan?: LoopsPlan;
  source?: string;
  /** ISO 8601 string; Loops stores dates as strings. */
  signupAt?: string;
  lastActiveAt?: string;
  cancelledAt?: string;
}

/** Inactivity threshold for the Re-engagement Loop (spec: 14 days). */
export const INACTIVITY_DAYS = 14;
