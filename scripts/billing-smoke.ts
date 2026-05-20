/**
 * Stripe billing smoke test (QIN-24) — fully offline.
 *
 * Exercises the security- and logic-critical pure functions with NO network,
 * NO database, and NO real Stripe keys:
 *   - webhook signature verification: valid roundtrip, tampered body, bad
 *     signature, replay window (the part that gates all subscription state)
 *   - plan <-> Stripe Price id resolution
 *   - entitlement mapping by plan + subscription status
 *
 * Run:  npx tsx scripts/billing-smoke.ts
 */
import { createHmac } from "node:crypto";

import { resolvePlanFromPriceId } from "@/lib/billing/config";
import { PLANS, statusGrantsAccess, NO_ENTITLEMENTS } from "@/lib/billing/plans";
import { constructWebhookEvent } from "@/lib/billing/stripe";

// Set test price ids BEFORE calling the env-reading resolver.
process.env.STRIPE_PRICE_STARTER = "price_starter_test";
process.env.STRIPE_PRICE_TEAM = "price_team_test";
process.env.STRIPE_PRICE_SCALE = "price_scale_test";

const checks: Array<[string, boolean]> = [];
function check(label: string, pass: boolean) {
  checks.push([label, pass]);
}

/* ----------------------------- webhook verifier ---------------------------- */

const SECRET = "whsec_test_secret";
const payload = JSON.stringify({ id: "evt_123", type: "customer.subscription.updated", data: { object: {} } });

function sign(body: string, secret: string, ts: number): string {
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`, "utf8").digest("hex");
  return `t=${ts},v1=${sig}`;
}

// 1) valid signature -> parses event
try {
  const header = sign(payload, SECRET, Math.floor(Date.now() / 1000));
  const event = constructWebhookEvent(payload, header, SECRET);
  check("valid signature parses event", event.id === "evt_123");
} catch {
  check("valid signature parses event", false);
}

// 2) tampered body -> rejected
try {
  const header = sign(payload, SECRET, Math.floor(Date.now() / 1000));
  constructWebhookEvent(payload + " ", header, SECRET);
  check("tampered body rejected", false);
} catch {
  check("tampered body rejected", true);
}

// 3) wrong secret -> rejected
try {
  const header = sign(payload, "whsec_wrong", Math.floor(Date.now() / 1000));
  constructWebhookEvent(payload, header, SECRET);
  check("wrong secret rejected", false);
} catch {
  check("wrong secret rejected", true);
}

// 4) stale timestamp (replay) -> rejected
try {
  const header = sign(payload, SECRET, Math.floor(Date.now() / 1000) - 10_000);
  constructWebhookEvent(payload, header, SECRET);
  check("replay (stale timestamp) rejected", false);
} catch {
  check("replay (stale timestamp) rejected", true);
}

// 5) missing header -> rejected
try {
  constructWebhookEvent(payload, null, SECRET);
  check("missing signature header rejected", false);
} catch {
  check("missing signature header rejected", true);
}

/* --------------------------- plan/price resolution ------------------------- */

check("resolve starter price -> starter", resolvePlanFromPriceId("price_starter_test") === "starter");
check("resolve team price -> team", resolvePlanFromPriceId("price_team_test") === "team");
check("resolve scale price -> scale", resolvePlanFromPriceId("price_scale_test") === "scale");
check("resolve unknown price -> null", resolvePlanFromPriceId("price_unknown") === null);
check("resolve null price -> null", resolvePlanFromPriceId(null) === null);

/* ------------------------------- entitlements ------------------------------ */

check("starter price = $49", PLANS.starter.priceMonthlyUsd === 49);
check("team price = $499", PLANS.team.priceMonthlyUsd === 499);
check("scale price = $1499", PLANS.scale.priceMonthlyUsd === 1499);
check("scale > team > starter connections",
  PLANS.scale.entitlements.maxConnections > PLANS.team.entitlements.maxConnections &&
  PLANS.team.entitlements.maxConnections > PLANS.starter.entitlements.maxConnections);

check("active grants access", statusGrantsAccess("active") === true);
check("trialing grants access", statusGrantsAccess("trialing") === true);
check("past_due grants access (grace)", statusGrantsAccess("past_due") === true);
check("canceled denies access", statusGrantsAccess("canceled") === false);
check("incomplete denies access", statusGrantsAccess("incomplete") === false);
check("unpaid denies access", statusGrantsAccess("unpaid") === false);
check("null status denies access", statusGrantsAccess(null) === false);
check("no-entitlements locks connections", NO_ENTITLEMENTS.maxConnections === 0);

/* --------------------------------- report ---------------------------------- */

console.log("\nStripe billing smoke test:");
let allPass = true;
for (const [label, pass] of checks) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) allPass = false;
}
console.log(allPass ? "\nALL CHECKS PASSED" : "\nFAILURES PRESENT");
process.exit(allPass ? 0 : 1);
