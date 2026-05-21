/**
 * Loops lifecycle wiring (PRE-13) — the product→Loops "tell it what happened"
 * layer. These are the functions app code calls; they resolve the contact email,
 * pick the right Loops call, and are SAFE TO FIRE-AND-FORGET: each one catches
 * its own errors and logs, so a Loops outage never breaks signup, billing, or a
 * cron run. Call them with `void loops.onFreeSignup(...)` (no await needed).
 *
 * Event → flow mapping (content/email-lifecycle-flows.md §3, §9.B):
 *   onFreeSignup          → createContact(plan:free)        → Welcome Loop
 *   markUpsellQualified   → event upsell_qualified          → Free→Pro Upsell Loop
 *   sweepInactiveContacts → event went_inactive (nightly)   → Re-engagement Loop
 *   onSubscriptionStarted → event subscription_started      → exits Welcome/Upsell
 *   onSubscriptionCancelled → event subscription_cancelled  → Winback Loop
 */
import { and, eq, gte, lt } from "drizzle-orm";

import { db, schema } from "@/db/client";

import { loopsCreateContact, loopsSendEvent, loopsUpdateContact } from "./client";
import { INACTIVITY_DAYS, LOOPS_EVENTS, isLoopsConfigured } from "./config";

function log(scope: string, result: { ok: boolean; skipped?: boolean; error?: string }) {
  if (result.skipped || result.ok) return;
  // Never throw from a lifecycle hook — just record the miss.
  console.warn(`[loops] ${scope} failed: ${result.error ?? "unknown error"}`);
}

/** "Ada Lovelace" → "Ada"; falls back to the email local part, else undefined. */
export function firstNameFrom(name: string | null | undefined, email: string): string | undefined {
  const fromName = name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim().split(/\s+/)[0];
  return local || undefined;
}

/** The email Loops should address for an org: the owner member, else the oldest member. */
export async function resolveOrgOwnerEmail(
  organizationId: string,
): Promise<{ email: string; name: string | null } | null> {
  const rows = await db
    .select({ email: schema.users.email, name: schema.users.name, role: schema.orgMembers.role })
    .from(schema.orgMembers)
    .innerJoin(schema.users, eq(schema.orgMembers.userId, schema.users.id))
    .where(eq(schema.orgMembers.organizationId, organizationId));
  if (rows.length === 0) return null;
  const owner = rows.find((r) => r.role === "owner") ?? rows[0];
  return { email: owner.email, name: owner.name };
}

/* -------------------------------- signup --------------------------------- */

/**
 * New free signup → create the Loops contact, which fires the Welcome Loop.
 * This single call meets the PRE-5 acceptance bar (welcome sending to new free
 * signups). Fire-and-forget from the signup path.
 */
export async function onFreeSignup(params: {
  email: string;
  name?: string | null;
}): Promise<void> {
  const result = await loopsCreateContact(params.email, {
    firstName: firstNameFrom(params.name, params.email),
    plan: "free",
    source: "signup",
    signupAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });
  log("onFreeSignup", result);
}

/* ----------------------------- subscription ------------------------------ */

/**
 * Org upgraded to a paid plan → fire subscription_started (exits Welcome/Upsell)
 * and flip the contact's plan to "pro" so suppression filters take effect.
 * Called from the Stripe webhook when a subscription transitions into access.
 */
export async function onSubscriptionStarted(organizationId: string): Promise<void> {
  if (!isLoopsConfigured()) return;
  const owner = await resolveOrgOwnerEmail(organizationId);
  if (!owner) return;
  const result = await loopsSendEvent(owner.email, LOOPS_EVENTS.subscriptionStarted, {
    plan: "pro",
  });
  log("onSubscriptionStarted", result);
  // Belt-and-suspenders: ensure the plan property is set even if the event's
  // contactProperties merge is a no-op for an existing contact.
  void loopsUpdateContact(owner.email, { plan: "pro" }).then((r) => log("onSubscriptionStarted.update", r));
}

/**
 * Org's subscription was cancelled → fire subscription_cancelled (Winback Loop)
 * and stamp cancelledAt + plan back to "free". Called from the Stripe webhook on
 * the transition out of access.
 */
export async function onSubscriptionCancelled(organizationId: string): Promise<void> {
  if (!isLoopsConfigured()) return;
  const owner = await resolveOrgOwnerEmail(organizationId);
  if (!owner) return;
  const result = await loopsSendEvent(owner.email, LOOPS_EVENTS.subscriptionCancelled, {
    plan: "free",
    cancelledAt: new Date().toISOString(),
  });
  log("onSubscriptionCancelled", result);
}

/* -------------------------------- upsell --------------------------------- */

/**
 * Engaged free user crossed the upsell threshold → fire upsell_qualified.
 *
 * SEAM (PRE-13): the spec's trigger is "3rd completed mock OR 7th active day".
 * Qintar has no mock-interview feature and no per-day activity counter today, so
 * there is no authentic place to call this yet. The function is ready: call it
 * once a qualifying product signal exists (e.g. from the activity tracker that
 * also feeds lastActiveAt, or a mock-completion handler). See docs/loops-lifecycle.md.
 */
export async function markUpsellQualified(email: string): Promise<void> {
  const result = await loopsSendEvent(email, LOOPS_EVENTS.upsellQualified);
  log("markUpsellQualified", result);
}

/* ------------------------------ inactivity ------------------------------- */

/**
 * Bump a user's lastActiveAt to now. Cheap, DB-only (no Loops call) — Loops'
 * lastActiveAt is refreshed by the nightly sweep + lifecycle events. Call from
 * real activity signals (sign-in today; extend to product usage as it lands).
 */
export async function touchLastActive(userId: string): Promise<void> {
  try {
    await db
      .update(schema.users)
      .set({ lastActiveAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  } catch (err) {
    console.warn(`[loops] touchLastActive failed: ${(err as Error).message}`);
  }
}

export interface InactiveSweepResult {
  scanned: number;
  fired: number;
  skippedPaid: number;
  errors: number;
}

/**
 * Nightly: fire went_inactive for users who JUST crossed INACTIVITY_DAYS of
 * inactivity in the last 24h, restricted to free users (paying orgs are
 * excluded — they don't get re-engagement). The 24h window means each user is
 * notified exactly once as they cross the threshold, even though the job runs
 * every night (no repeat enrollment). Idempotent and safe to re-run.
 */
export async function sweepInactiveContacts(now: Date = new Date()): Promise<InactiveSweepResult> {
  const result: InactiveSweepResult = { scanned: 0, fired: 0, skippedPaid: 0, errors: 0 };
  if (!isLoopsConfigured()) return result;

  const dayMs = 24 * 60 * 60 * 1000;
  const windowEnd = new Date(now.getTime() - INACTIVITY_DAYS * dayMs); // crossed 14d ago
  const windowStart = new Date(windowEnd.getTime() - dayMs); // ...within the last 24h

  const candidates = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      organizationId: schema.orgMembers.organizationId,
    })
    .from(schema.users)
    .innerJoin(schema.orgMembers, eq(schema.orgMembers.userId, schema.users.id))
    .where(
      and(
        gte(schema.users.lastActiveAt, windowStart),
        lt(schema.users.lastActiveAt, windowEnd),
      ),
    );

  result.scanned = candidates.length;

  // Resolve entitlement per org so paying customers are excluded. Imported here
  // (not at module top) to avoid a cycle: billing/service → ... → loops.
  const { getEntitlements } = await import("@/lib/billing/service");

  for (const c of candidates) {
    try {
      const ent = await getEntitlements(c.organizationId);
      if (ent.active) {
        result.skippedPaid += 1;
        continue;
      }
      const sent = await loopsSendEvent(c.email, LOOPS_EVENTS.wentInactive, {
        plan: "free",
        lastActiveAt: windowStart.toISOString(),
      });
      if (sent.ok) result.fired += 1;
      else {
        result.errors += 1;
        log("sweepInactiveContacts", sent);
      }
    } catch (err) {
      result.errors += 1;
      console.warn(`[loops] sweepInactiveContacts user ${c.userId}: ${(err as Error).message}`);
    }
  }

  return result;
}
