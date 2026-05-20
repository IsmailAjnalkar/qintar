/**
 * HubSpot sync smoke test (QIN-20 acceptance criteria #2 & #3).
 *
 * Runs the REAL sync engine + DB upserts against the staging Postgres, with
 * only the HubSpot HTTP boundary stubbed (globalThis.fetch). Proves:
 *   - deals/contacts/companies/activities are persisted (#2)
 *   - re-running the sync updates changed records WITHOUT duplicates (#3)
 *
 * No HubSpot account/credentials required. Uses a throwaway TEST-SMOKE portal
 * that is created and fully cleaned up (cascade) at the end.
 *
 * Run:  DATABASE_URL=... TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32) \
 *         npx tsx scripts/hubspot-sync-smoke.ts
 */
import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import { encryptSecret } from "@/lib/crypto";

/* --------------------------- fixture HubSpot data ------------------------- */

type Rec = {
  id: string;
  properties: Record<string, string>;
  archived?: boolean;
  associations?: Record<string, { results: Array<{ id: string }> }>;
};

function makeFixtures(dealAmount: string) {
  const companies: Rec[] = [
    { id: "co1", properties: { name: "Acme Co", domain: "acme.com", industry: "SaaS" } },
    { id: "co2", properties: { name: "Northwind", domain: "northwind.com" } },
  ];
  const contacts: Rec[] = [
    { id: "c1", properties: { email: "lisa@acme.com", firstname: "Lisa", lastname: "Chen" } },
    { id: "c2", properties: { email: "sam@northwind.com", firstname: "Sam", lastname: "Doe" } },
  ];
  const deals: Rec[] = [
    {
      id: "d1",
      properties: {
        dealname: "Acme Co — Q3 expansion",
        amount: dealAmount,
        pipeline: "default",
        dealstage: "presentationscheduled",
        hs_is_closed: "false",
      },
      associations: {
        contacts: { results: [{ id: "c1" }] },
        companies: { results: [{ id: "co1" }] },
      },
    },
    {
      id: "d2",
      properties: { dealname: "Northwind renewal", amount: "12000", pipeline: "default", dealstage: "qualifiedtobuy" },
    },
  ];
  const notes: Rec[] = [
    { id: "n1", properties: { hs_note_body: "Sent proposal, awaiting reply", hs_timestamp: "1747700000000" } },
  ];
  return { companies, contacts, deals, notes };
}

/** Install a fetch stub that answers HubSpot CRM v3 list/search calls. */
function installFetchStub(getFixtures: () => ReturnType<typeof makeFixtures>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const f = getFixtures();
    const body = (results: Rec[]) =>
      new Response(JSON.stringify({ results, paging: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    if (url.includes("/crm/v3/objects/companies")) return body(f.companies);
    if (url.includes("/crm/v3/objects/contacts")) return body(f.contacts);
    if (url.includes("/crm/v3/objects/deals")) return body(f.deals);
    if (url.includes("/crm/v3/objects/notes")) return body(f.notes);
    // calls/emails/meetings/tasks → empty
    if (url.includes("/crm/v3/objects/")) return body([]);
    throw new Error(`unexpected fetch in smoke test: ${url}`);
  }) as typeof fetch;
}

async function rowCount(table: typeof schema.hsDeals, connectionId: string) {
  const rows = await db.select().from(table).where(eq(table.connectionId, connectionId));
  return rows.length;
}

async function main() {
  const portalId = `TEST-SMOKE-${Date.now()}`;
  let amount = "48000";
  installFetchStub(() => makeFixtures(amount));

  // Seed an org + connection with a valid (future) token so the engine runs
  // without hitting the OAuth refresh path.
  const [org] = await db.insert(schema.organizations).values({ name: "smoke-test-org" }).returning();
  const [connection] = await db
    .insert(schema.hubspotConnections)
    .values({
      organizationId: org.id,
      hubPortalId: portalId,
      accessTokenEnc: encryptSecret("dummy-access-token"),
      refreshTokenEnc: encryptSecret("dummy-refresh-token"),
      expiresAt: new Date(Date.now() + 3_600_000),
      status: "active",
    })
    .returning();

  const { syncConnection } = await import("@/lib/hubspot/sync");
  const checks: Array<[string, boolean]> = [];

  try {
    // Run 1 — initial full sync persists everything.
    const r1 = await syncConnection(connection, { full: true, trigger: "initial" });
    checks.push(["run1 status success", r1.status === "success"]);
    checks.push(["companies persisted (2)", (await rowCount(schema.hsCompanies, connection.id)) === 2]);
    checks.push(["contacts persisted (2)", (await rowCount(schema.hsContacts, connection.id)) === 2]);
    checks.push(["deals persisted (2)", (await rowCount(schema.hsDeals, connection.id)) === 2]);
    checks.push(["activities persisted (1)", (await rowCount(schema.hsActivities, connection.id)) === 1]);

    const dealAssoc = await db
      .select()
      .from(schema.hsDeals)
      .where(and(eq(schema.hsDeals.connectionId, connection.id), eq(schema.hsDeals.hubspotId, "d1")));
    checks.push([
      "deal associations captured",
      JSON.stringify(dealAssoc[0]?.associatedContactIds) === JSON.stringify(["c1"]),
    ]);

    // Run 2 — identical fixtures: must NOT duplicate (idempotent upsert).
    // Re-fetch connection so lastSyncedAt is set (forces incremental path too).
    const [conn2] = await db
      .select()
      .from(schema.hubspotConnections)
      .where(eq(schema.hubspotConnections.id, connection.id));
    const r2 = await syncConnection(conn2, { full: true });
    checks.push(["run2 status success", r2.status === "success"]);
    checks.push(["no dup companies (still 2)", (await rowCount(schema.hsCompanies, connection.id)) === 2]);
    checks.push(["no dup deals (still 2)", (await rowCount(schema.hsDeals, connection.id)) === 2]);

    // Run 3 — changed deal amount: must UPDATE in place, not insert.
    amount = "60000";
    const r3 = await syncConnection(conn2, { full: true });
    checks.push(["run3 status success", r3.status === "success"]);
    checks.push(["still 2 deals after change", (await rowCount(schema.hsDeals, connection.id)) === 2]);
    const updated = await db
      .select()
      .from(schema.hsDeals)
      .where(and(eq(schema.hsDeals.connectionId, connection.id), eq(schema.hsDeals.hubspotId, "d1")));
    checks.push(["deal amount updated to 60000", Number(updated[0]?.amount) === 60000]);
  } finally {
    // Cascade-clean everything this test created.
    await db.delete(schema.hubspotConnections).where(eq(schema.hubspotConnections.id, connection.id));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, org.id));
  }

  console.log("\nHubSpot sync smoke test:");
  let allPass = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✅" : "❌"} ${label}`);
    if (!pass) allPass = false;
  }
  console.log(allPass ? "\nALL CHECKS PASSED" : "\nFAILURES PRESENT");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
