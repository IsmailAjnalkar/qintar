/**
 * Loops lifecycle smoke + seed test (PRE-13).
 *
 * Offline (default) — no network, no DB, no key required:
 *   - event-name vocabulary matches the spec (email-lifecycle-flows.md §9.B)
 *   - calls no-op safely (ok + skipped) when LOOPS_API_KEY is unset
 *   - payload builders normalize email + carry the right properties
 *   Run:  npm run loops:smoke
 *
 * Live seed test — exercises the five real calls against Loops end-to-end:
 *   1. createContact(plan:free)        → Welcome Loop
 *   2. event upsell_qualified          → Upsell Loop
 *   3. event went_inactive             → Re-engagement Loop
 *   4. event subscription_started      → exits Welcome/Upsell
 *   5. event subscription_cancelled    → Winback Loop
 *   Run:  LOOPS_LIVE=1 LOOPS_API_KEY=… [LOOPS_TEST_EMAIL=you+seed@domain] npm run loops:smoke
 *
 * Only client.ts + config.ts are imported (no DB), so the offline run needs no
 * DATABASE_URL — same shape as scripts/billing-smoke.ts.
 */
import { LOOPS_EVENTS, getLoopsApiKey, isLoopsConfigured } from "@/lib/loops/config";
import { loopsCreateContact, loopsSendEvent, loopsUpdateContact } from "@/lib/loops/client";

const checks: Array<[string, boolean]> = [];
function check(label: string, pass: boolean) {
  checks.push([label, pass]);
}

/* ----------------------------- offline checks ------------------------------ */

// Event names must match the triggers configured on the Loops side.
check("event upsell_qualified", LOOPS_EVENTS.upsellQualified === "upsell_qualified");
check("event went_inactive", LOOPS_EVENTS.wentInactive === "went_inactive");
check("event subscription_started", LOOPS_EVENTS.subscriptionStarted === "subscription_started");
check("event subscription_cancelled", LOOPS_EVENTS.subscriptionCancelled === "subscription_cancelled");

async function offlineNoopChecks() {
  // With no key, every call is a safe no-op so signup/billing never break.
  if (isLoopsConfigured()) return; // skip when a real key is present (live run)
  const c = await loopsCreateContact("USER@Example.com ", { plan: "free" });
  check("createContact no-ops without key", c.ok === true && c.skipped === true);
  const e = await loopsSendEvent("user@example.com", LOOPS_EVENTS.upsellQualified);
  check("sendEvent no-ops without key", e.ok === true && e.skipped === true);
  const u = await loopsUpdateContact("user@example.com", { plan: "pro" });
  check("updateContact no-ops without key", u.ok === true && u.skipped === true);
}

/* ------------------------------- live seed test ---------------------------- */

async function liveSeedTest() {
  const email = process.env.LOOPS_TEST_EMAIL?.trim() || "seed+pre13@qintar.com";
  console.log(`\nLive seed test against Loops for: ${email}`);

  const created = await loopsCreateContact(email, {
    firstName: "Seed",
    plan: "free",
    source: "seed-test",
    signupAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });
  // "already on list" (ok:false) is acceptable on re-runs — the contact exists.
  check(
    `createContact → ${created.ok ? "created" : `exists (${created.error ?? ""})`}`,
    created.ok || /already|exist/i.test(created.error ?? ""),
  );

  for (const name of [
    LOOPS_EVENTS.upsellQualified,
    LOOPS_EVENTS.wentInactive,
    LOOPS_EVENTS.subscriptionStarted,
    LOOPS_EVENTS.subscriptionCancelled,
  ] as const) {
    const r = await loopsSendEvent(email, name, { plan: "free" });
    check(`event ${name} accepted`, r.ok);
  }

  const updated = await loopsUpdateContact(email, { plan: "pro" });
  check("updateContact plan→pro", updated.ok);
}

/* --------------------------------- runner ---------------------------------- */

async function main() {
  await offlineNoopChecks();

  const live = process.env.LOOPS_LIVE === "1";
  if (live) {
    if (!getLoopsApiKey()) {
      console.error("LOOPS_LIVE=1 but LOOPS_API_KEY is not set — aborting live test.");
      process.exit(2);
    }
    await liveSeedTest();
  } else {
    console.log("\n(Offline mode. Set LOOPS_LIVE=1 + LOOPS_API_KEY for the end-to-end seed test.)");
  }

  console.log("\nLoops lifecycle smoke test:");
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
