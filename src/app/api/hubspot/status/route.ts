import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { safeEqual } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verification endpoint: returns per-connection row counts and the last sync
 * status so we can confirm staging data is present and queryable. Protected by
 * SYNC_TRIGGER_SECRET (no customer data is returned — counts only).
 */
export async function GET(req: Request) {
  const secret = process.env.SYNC_TRIGGER_SECRET;
  const provided = new URL(req.url).searchParams.get("secret") ?? "";
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [connections, companies, contacts, deals, activities] = await Promise.all([
    db
      .select({
        id: schema.hubspotConnections.id,
        portalId: schema.hubspotConnections.hubPortalId,
        status: schema.hubspotConnections.status,
        lastSyncedAt: schema.hubspotConnections.lastSyncedAt,
        lastSyncStatus: schema.hubspotConnections.lastSyncStatus,
      })
      .from(schema.hubspotConnections),
    db.select({ n: sql<number>`count(*)` }).from(schema.hsCompanies),
    db.select({ n: sql<number>`count(*)` }).from(schema.hsContacts),
    db.select({ n: sql<number>`count(*)` }).from(schema.hsDeals),
    db.select({ n: sql<number>`count(*)` }).from(schema.hsActivities),
  ]);

  return NextResponse.json({
    ok: true,
    connections,
    counts: {
      companies: Number(companies[0]?.n ?? 0),
      contacts: Number(contacts[0]?.n ?? 0),
      deals: Number(deals[0]?.n ?? 0),
      activities: Number(activities[0]?.n ?? 0),
    },
  });
}
