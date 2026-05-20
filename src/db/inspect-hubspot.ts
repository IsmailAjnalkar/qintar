import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Standalone verification helper (QIN-20): prints row counts for every HubSpot
 * table plus connection sync status. Confirms the schema is applied and the
 * synced data is queryable. Run with:
 *   DATABASE_URL=... npx tsx src/db/inspect-hubspot.ts
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1, prepare: false, ssl: "require" });
  const db = drizzle(client, { schema });

  const tables = {
    organizations: schema.organizations,
    hubspot_connections: schema.hubspotConnections,
    hs_companies: schema.hsCompanies,
    hs_contacts: schema.hsContacts,
    hs_deals: schema.hsDeals,
    hs_activities: schema.hsActivities,
    sync_runs: schema.syncRuns,
  };

  console.log("HubSpot data model — row counts:");
  for (const [name, table] of Object.entries(tables)) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(table);
    console.log(`  ${name.padEnd(22)} ${n}`);
  }

  const connections = await db
    .select({
      portalId: schema.hubspotConnections.hubPortalId,
      status: schema.hubspotConnections.status,
      lastSyncedAt: schema.hubspotConnections.lastSyncedAt,
      lastSyncStatus: schema.hubspotConnections.lastSyncStatus,
    })
    .from(schema.hubspotConnections);
  if (connections.length > 0) {
    console.log("\nConnections:");
    for (const c of connections) {
      console.log(
        `  portal=${c.portalId} status=${c.status} lastSync=${
          c.lastSyncedAt?.toISOString() ?? "never"
        } (${c.lastSyncStatus ?? "-"})`,
      );
    }
  } else {
    console.log("\nNo HubSpot connections yet — connect a portal via /api/hubspot/install.");
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
