/**
 * Entitlement enforcement — LIVE DB verification (QIN-26, step 3).
 *
 * Proves the entitlement gate against the real (migrated) Postgres, exercising
 * the actual production code paths — `gateOrganization` (enforcement.ts),
 * `getEntitlements` / `requireActiveSubscription` (service.ts) — with NO Stripe,
 * NO HubSpot, and NO browser. It seeds a throwaway org + subscription row,
 * toggles ENFORCE_ENTITLEMENTS per scenario, asserts behavior, then deletes
 * everything it created (try/finally) so the shared DB is left untouched.
 *
 * What the live click-through CANNOT cover offline (Stripe Checkout, the webhook
 * flipping status=active, HubSpot OAuth) is the operator-gated remainder tracked
 * on QIN-26 / QIN-24. This covers the half that does not need operator keys:
 *   - ENFORCE_ENTITLEMENTS=true gates a canceled org            (issue step 3a)
 *   - keyless staging sync (org with no sub row) is unaffected  (issue step 3b)
 *
 * Run:  npx tsx scripts/entitlement-live-verify.ts
 *       (requires a reachable, migrated DATABASE_URL in .env.local)
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
    /* no .env.local — rely on ambient env */
  }
}

// Must run before @/db/client is imported (it reads DATABASE_URL at load time).
loadEnvLocal();

const checks: Array<[string, boolean]> = [];
function check(label: string, pass: boolean) {
  checks.push([label, pass]);
}

function setEnforce(on: boolean) {
  if (on) process.env.ENFORCE_ENTITLEMENTS = "true";
  else delete process.env.ENFORCE_ENTITLEMENTS;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set (need .env.local)");

  // Dynamic imports so DATABASE_URL is set before the db client module loads.
  const { db, schema } = await import("@/db/client");
  const { eq } = await import("drizzle-orm");
  const { gateOrganization } = await import("@/lib/billing/enforcement");
  const { getEntitlements, requireActiveSubscription, EntitlementError } = await import(
    "@/lib/billing/service"
  );

  const tag = `__qin26_verify_${Date.now()}`;
  let orgId: string | null = null;

  // Helper: write/replace the single subscription row for the org.
  async function setSub(fields: { status: string; plan: string | null }) {
    const values = {
      organizationId: orgId!,
      stripeCustomerId: `cus_${tag}`,
      plan: fields.plan,
      status: fields.status,
      updatedAt: new Date(),
    };
    await db
      .insert(schema.subscriptions)
      .values(values)
      .onConflictDoUpdate({ target: schema.subscriptions.organizationId, set: values });
  }
  async function clearSub() {
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.organizationId, orgId!));
  }
  async function denied(reason: string): Promise<boolean> {
    const r = await gateOrganization(orgId!);
    return r.allowed === false && r.reason === reason;
  }
  async function allowed(): Promise<boolean> {
    return (await gateOrganization(orgId!)).allowed === true;
  }

  try {
    const [org] = await db.insert(schema.organizations).values({ name: tag }).returning();
    orgId = org.id;
    check("seed: throwaway org created", Boolean(orgId));

    /* -- Scenario 1: flag OFF, no sub row -> open (baseline) ----------------- */
    setEnforce(false);
    check("flag OFF, no sub -> allowed", await allowed());

    /* -- Scenario 2: flag ON, no sub row -> keyless staging stays open ------- */
    setEnforce(true);
    check("flag ON, no sub row (keyless staging) -> allowed", await allowed());

    /* -- Scenario 3: flag ON, canceled org -> GATED ------------------------- */
    await setSub({ status: "canceled", plan: "team" });
    check("flag ON, canceled org -> denied(inactive_subscription)", await denied("inactive_subscription"));
    {
      const ent = await getEntitlements(orgId);
      check("canceled org: getEntitlements.active = false", ent.active === false);
      check("canceled org: entitlements locked (maxConnections 0)", ent.entitlements.maxConnections === 0);
    }
    {
      let threw = false;
      let reason = "";
      try {
        await requireActiveSubscription(orgId);
      } catch (e) {
        threw = e instanceof EntitlementError;
        reason = (e as InstanceType<typeof EntitlementError>).reason;
      }
      check("canceled org: requireActiveSubscription throws no_subscription", threw && reason === "no_subscription");
    }

    /* -- Scenario 4: flag ON, incomplete (started checkout, never paid) ------ */
    await setSub({ status: "incomplete", plan: null });
    check("flag ON, incomplete/unpaid org -> denied", await denied("inactive_subscription"));

    /* -- Scenario 5: flag ON, ACTIVE team -> allowed + correct entitlements -- */
    await setSub({ status: "active", plan: "team" });
    check("flag ON, active team org -> allowed", await allowed());
    {
      const ent = await getEntitlements(orgId);
      check("active team: active = true", ent.active === true);
      check("active team: plan = team", ent.plan === "team");
      check("active team: maxConnections = 3", ent.entitlements.maxConnections === 3);
      check("active team: dailyDigest granted", ent.entitlements.dailyDigest === true);
    }
    check("flag ON, active team, feature=dailyDigest -> allowed", (await gateOrganization(orgId, "dailyDigest")).allowed === true);

    /* -- Scenario 6: flag ON, past_due (dunning grace) -> still allowed ------ */
    await setSub({ status: "past_due", plan: "starter" });
    check("flag ON, past_due (grace) -> allowed", await allowed());

    /* -- Scenario 7: flag OFF master switch bypasses a canceled org --------- */
    await setSub({ status: "canceled", plan: "team" });
    setEnforce(false);
    check("flag OFF, canceled org -> allowed (master switch off)", await allowed());

    await clearSub();
  } finally {
    // Cleanup: remove the sub row + org we created (cascade also covers the row).
    setEnforce(false);
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

  /* --------------------------------- report -------------------------------- */
  console.log("\nEntitlement live-DB verification (QIN-26 step 3):");
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
