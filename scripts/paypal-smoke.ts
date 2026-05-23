/**
 * PayPal billing smoke test (QIN-24 PayPal-only rebuild) — fully offline.
 *
 * Pure config/mapping logic only (no network): API base selection, plan id
 * resolution, PayPal→internal status mapping, and the unconfigured-env error.
 *
 * Run:  npx tsx scripts/paypal-smoke.ts
 */
import {
  getPaypalApiBase,
  getPaypalEnv,
  getPaypalPlanId,
  mapPaypalStatus,
  resolvePlanFromPaypalPlanId,
} from "@/lib/billing/paypal/config";
import { statusGrantsAccess } from "@/lib/billing/plans";

const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

// Unconfigured -> actionable throw.
delete process.env.PAYPAL_CLIENT_ID;
delete process.env.PAYPAL_CLIENT_SECRET;
try {
  getPaypalEnv();
  check("getPaypalEnv throws when unconfigured", false);
} catch (e) {
  check("getPaypalEnv throws when unconfigured", /PAYPAL_CLIENT_ID/.test((e as Error).message));
}

// API base selection.
delete process.env.PAYPAL_ENV;
check("default API base = sandbox", getPaypalApiBase().includes("sandbox"));
process.env.PAYPAL_ENV = "live";
check("PAYPAL_ENV=live -> live base", getPaypalApiBase() === "https://api-m.paypal.com");
process.env.PAYPAL_ENV = "sandbox";
check("PAYPAL_ENV=sandbox -> sandbox base", getPaypalApiBase().includes("api-m.sandbox.paypal.com"));

// Plan id resolution + reverse lookup.
process.env.PAYPAL_PLAN_STARTER = "P-STARTER";
process.env.PAYPAL_PLAN_TEAM = "P-TEAM";
process.env.PAYPAL_PLAN_SCALE = "P-SCALE";
check("getPaypalPlanId(starter)", getPaypalPlanId("starter") === "P-STARTER");
check("resolve P-TEAM -> team", resolvePlanFromPaypalPlanId("P-TEAM") === "team");
check("resolve unknown -> null", resolvePlanFromPaypalPlanId("P-NOPE") === null);
check("resolve null -> null", resolvePlanFromPaypalPlanId(null) === null);

// Status mapping aligns with entitlement access rules.
check("ACTIVE -> active (grants access)", mapPaypalStatus("ACTIVE") === "active" && statusGrantsAccess(mapPaypalStatus("ACTIVE")));
check("SUSPENDED -> past_due (grants access, grace)", mapPaypalStatus("SUSPENDED") === "past_due" && statusGrantsAccess(mapPaypalStatus("SUSPENDED")));
check("CANCELLED -> canceled (no access)", mapPaypalStatus("CANCELLED") === "canceled" && !statusGrantsAccess(mapPaypalStatus("CANCELLED")));
check("EXPIRED -> canceled (no access)", mapPaypalStatus("EXPIRED") === "canceled");
check("APPROVAL_PENDING -> incomplete (no access)", mapPaypalStatus("APPROVAL_PENDING") === "incomplete" && !statusGrantsAccess(mapPaypalStatus("APPROVAL_PENDING")));

console.log("\nPayPal billing smoke test:");
let allPass = true;
for (const [label, pass] of checks) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) allPass = false;
}
console.log(allPass ? "\nALL CHECKS PASSED" : "\nFAILURES PRESENT");
process.exit(allPass ? 0 : 1);
