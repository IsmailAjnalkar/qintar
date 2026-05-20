/**
 * Billing webhook -> DB live verification (QIN-26, step 2 data-plane).
 *
 * `billing-smoke.ts` proves the webhook *signature* logic offline. This proves
 * the other half against the real (migrated) Postgres: that a Stripe
 * subscription event flips the tenant's `subscriptions` row and therefore its
 * entitlements — i.e. the "confirm webhook flips subscriptions.status=active ->
 * /dashboard shows the plan" assertion from the issue, minus the hosted Stripe
 * Checkout UI (the only part that needs a real Stripe key + a browser).
 *
 * It exercises the exact function the webhook route calls after verifying the
 * signature: `upsertSubscriptionFromStripe` (service.ts). NO real Stripe key,
 * NO network to Stripe, NO browser. Seeds a throwaway org + checkout-stub sub
 * row, drives it through active -> canceled, asserts entitlements track, then
 * deletes everything (try/finally).
 *
 * Run:  npx tsx scripts/billing-webhook-live-verify.ts
 */
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* rely on ambient env */
  }
}

loadEnvLocal();
// Test Price ids so resolvePlanFromPriceId() maps our synthetic event -> a plan
// without needing the operator's real STRIPE_PRICE_* values.
process.env.STRIPE_PRICE_STARTER ??= "price_starter_test";
process.env.STRIPE_PRICE_TEAM ??= "price_team_test";
process.env.STRIPE_PRICE_SCALE ??= "price_scale_test";

const checks: Array<[string, boolean]> = [];
function check(label: string, pass: boolean) {
  checks.push([label, pass]);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set (need .env.local)");

  const { db, schema } = await import("@/db/client");
  const { eq } = await import("drizzle-orm");
  const { upsertSubscriptionFromStripe, getEntitlements } = await import("@/lib/billing/service");

  const tag = `__qin26_whk_${Date.now()}`;
  const customerId = `cus_${tag}`;
  const subId = `sub_${tag}`;
  let orgId: string | null = null;

  const now = Math.floor(Date.now() / 1000);
  function stripeSub(status: string, priceId: string) {
    return {
      id: subId,
      customer: customerId,
      status,
      cancel_at_period_end: false,
      current_period_end: now + 60 * 60 * 24 * 30,
      canceled_at: status === "canceled" ? now : null,
      trial_end: null,
      metadata: { organizationId: orgId! },
      items: { data: [{ quantity: 1, price: { id: priceId } }] },
    };
  }
  async function readSub() {
    const rows = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.organizationId, orgId!))
      .limit(1);
    return rows[0];
  }

  try {
    const [org] = await db.insert(schema.organizations).values({ name: tag }).returning();
    orgId = org.id;

    // Checkout start: getOrCreateStripeCustomer writes a stub (incomplete) row.
    await db.insert(schema.subscriptions).values({
      organizationId: orgId,
      stripeCustomerId: customerId,
      status: "incomplete",
    });
    check("seed: checkout-stub sub row (incomplete)", (await readSub()).status === "incomplete");
    check("pre-webhook: entitlements inactive", (await getEntitlements(orgId)).active === false);

    /* -- Webhook #1: customer.subscription.updated -> active (team) ---------- */
    const r1 = await upsertSubscriptionFromStripe(stripeSub("active", "price_team_test"));
    check("webhook(active) maps to org (not null)", r1 !== null);
    {
      const row = await readSub();
      check("webhook flips status -> active", row.status === "active");
      check("webhook resolves plan -> team", row.plan === "team");
      check("webhook records stripe_subscription_id", row.stripeSubscriptionId === subId);
    }
    {
      const ent = await getEntitlements(orgId);
      check("post-webhook: entitlements active", ent.active === true);
      check("post-webhook: plan = team (dashboard would show Team)", ent.plan === "team");
      check("post-webhook: team maxConnections = 3", ent.entitlements.maxConnections === 3);
    }

    /* -- Idempotency: same active event again -> still one row, still active - */
    await upsertSubscriptionFromStripe(stripeSub("active", "price_team_test"));
    {
      const count = await db
        .select({ id: schema.subscriptions.id })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.organizationId, orgId));
      check("idempotent: still exactly one sub row per org", count.length === 1);
    }

    /* -- Webhook #2: customer.subscription.deleted -> canceled -------------- */
    await upsertSubscriptionFromStripe(stripeSub("canceled", "price_team_test"));
    check("webhook(canceled) flips status -> canceled", (await readSub()).status === "canceled");
    check("post-cancel: entitlements revoked", (await getEntitlements(orgId)).active === false);

    /* -- Unmappable event -> null (defensive) ------------------------------ */
    const orphan = stripeSub("active", "price_team_test");
    orphan.metadata = {};
    orphan.customer = "cus_does_not_exist_anywhere";
    const rNull = await upsertSubscriptionFromStripe(orphan);
    check("unmappable event returns null (no crash)", rNull === null);
  } finally {
    if (orgId) {
      try {
        await db.delete(schema.subscriptions).where(eq(schema.subscriptions.organizationId, orgId));
        await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
        check("cleanup: throwaway org + sub removed", true);
      } catch (e) {
        check(`cleanup FAILED (manual delete needed: org ${orgId})`, false);
        console.error("cleanup error:", (e as Error).message);
      }
    }
  }

  console.log("\nBilling webhook -> DB live verification (QIN-26 step 2 data-plane):");
  let allPass = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
    if (!pass) allPass = false;
  }
  console.log(allPass ? "\nALL CHECKS PASSED" : "\nFAILURES PRESENT");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
