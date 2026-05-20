import { eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import type { HubspotConnection } from "@/db/schema";

import { listAll, searchModifiedSince, type HubspotRecord } from "./client";
import { ACTIVITY_TYPES, PROPERTY_SETS } from "./config";
import { getValidAccessToken } from "./oauth";

/* ----------------------------- value coercion ----------------------------- */

function num(v: string | null | undefined): string | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : null;
}

function date(v: string | null | undefined): Date | null {
  if (!v) return null;
  // HubSpot returns ISO strings or epoch-ms strings depending on property.
  const asNum = Number(v);
  const d = Number.isFinite(asNum) && /^\d+$/.test(v) ? new Date(asNum) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bool(v: string | null | undefined): boolean | null {
  if (v == null || v === "") return null;
  return v === "true" || v === "1";
}

function assocIds(record: HubspotRecord, key: string): string[] {
  return record.associations?.[key]?.results?.map((r) => r.id) ?? [];
}

/* ------------------------------ entity mapping ---------------------------- */

type EntityCounts = { fetched: number; upserted: number };
type SyncCounts = Record<string, EntityCounts>;

async function syncCompanies(
  connectionId: string,
  records: AsyncGenerator<HubspotRecord>,
): Promise<EntityCounts> {
  const counts: EntityCounts = { fetched: 0, upserted: 0 };
  for await (const r of records) {
    counts.fetched += 1;
    const p = r.properties;
    await db
      .insert(schema.hsCompanies)
      .values({
        connectionId,
        hubspotId: r.id,
        name: p.name ?? null,
        domain: p.domain ?? null,
        industry: p.industry ?? null,
        ownerId: p.hubspot_owner_id ?? null,
        archived: r.archived ?? false,
        hubCreatedAt: date(p.createdate ?? r.createdAt),
        hubUpdatedAt: date(p.hs_lastmodifieddate ?? r.updatedAt),
        properties: p,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.hsCompanies.connectionId, schema.hsCompanies.hubspotId],
        set: {
          name: p.name ?? null,
          domain: p.domain ?? null,
          industry: p.industry ?? null,
          ownerId: p.hubspot_owner_id ?? null,
          archived: r.archived ?? false,
          hubUpdatedAt: date(p.hs_lastmodifieddate ?? r.updatedAt),
          properties: p,
          syncedAt: new Date(),
        },
      });
    counts.upserted += 1;
  }
  return counts;
}

async function syncContacts(
  connectionId: string,
  records: AsyncGenerator<HubspotRecord>,
): Promise<EntityCounts> {
  const counts: EntityCounts = { fetched: 0, upserted: 0 };
  for await (const r of records) {
    counts.fetched += 1;
    const p = r.properties;
    await db
      .insert(schema.hsContacts)
      .values({
        connectionId,
        hubspotId: r.id,
        email: p.email ?? null,
        firstName: p.firstname ?? null,
        lastName: p.lastname ?? null,
        company: p.company ?? null,
        ownerId: p.hubspot_owner_id ?? null,
        lifecycleStage: p.lifecyclestage ?? null,
        archived: r.archived ?? false,
        hubCreatedAt: date(p.createdate ?? r.createdAt),
        hubUpdatedAt: date(p.lastmodifieddate ?? r.updatedAt),
        properties: p,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.hsContacts.connectionId, schema.hsContacts.hubspotId],
        set: {
          email: p.email ?? null,
          firstName: p.firstname ?? null,
          lastName: p.lastname ?? null,
          company: p.company ?? null,
          ownerId: p.hubspot_owner_id ?? null,
          lifecycleStage: p.lifecyclestage ?? null,
          archived: r.archived ?? false,
          hubUpdatedAt: date(p.lastmodifieddate ?? r.updatedAt),
          properties: p,
          syncedAt: new Date(),
        },
      });
    counts.upserted += 1;
  }
  return counts;
}

async function syncDeals(
  connectionId: string,
  records: AsyncGenerator<HubspotRecord>,
): Promise<EntityCounts> {
  const counts: EntityCounts = { fetched: 0, upserted: 0 };
  for await (const r of records) {
    counts.fetched += 1;
    const p = r.properties;
    const base = {
      name: p.dealname ?? null,
      amount: num(p.amount),
      pipeline: p.pipeline ?? null,
      stage: p.dealstage ?? null,
      closeDate: date(p.closedate),
      ownerId: p.hubspot_owner_id ?? null,
      isClosed: bool(p.hs_is_closed),
      isWon: bool(p.hs_is_closed_won),
      lastActivityAt: date(p.hs_lastactivitydate),
      archived: r.archived ?? false,
      hubUpdatedAt: date(p.hs_lastmodifieddate ?? r.updatedAt),
      properties: p,
      syncedAt: new Date(),
    };
    // Associations only present on full (list) syncs; preserve existing on incremental.
    const contactIds = assocIds(r, "contacts");
    const companyIds = assocIds(r, "companies");
    await db
      .insert(schema.hsDeals)
      .values({
        connectionId,
        hubspotId: r.id,
        ...base,
        associatedContactIds: contactIds,
        associatedCompanyIds: companyIds,
        hubCreatedAt: date(p.createdate ?? r.createdAt),
      })
      .onConflictDoUpdate({
        target: [schema.hsDeals.connectionId, schema.hsDeals.hubspotId],
        set: {
          ...base,
          // Only overwrite associations when we actually fetched them.
          ...(r.associations
            ? { associatedContactIds: contactIds, associatedCompanyIds: companyIds }
            : {}),
        },
      });
    counts.upserted += 1;
  }
  return counts;
}

async function syncActivityType(
  connectionId: string,
  type: string,
  titleProp: string,
  records: AsyncGenerator<HubspotRecord>,
): Promise<EntityCounts> {
  const counts: EntityCounts = { fetched: 0, upserted: 0 };
  for await (const r of records) {
    counts.fetched += 1;
    const p = r.properties;
    const rawTitle = p[titleProp] ?? null;
    const set = {
      type,
      ownerId: p.hubspot_owner_id ?? null,
      occurredAt: date(p.hs_timestamp ?? p.hs_createdate ?? r.createdAt),
      title: rawTitle ? rawTitle.slice(0, 280) : null,
      bodyPreview: rawTitle ? rawTitle.slice(0, 280) : null,
      archived: r.archived ?? false,
      hubUpdatedAt: date(p.hs_lastmodifieddate ?? r.updatedAt),
      properties: p,
      syncedAt: new Date(),
    };
    await db
      .insert(schema.hsActivities)
      .values({
        connectionId,
        hubspotId: r.id,
        ...set,
        hubCreatedAt: date(p.hs_createdate ?? r.createdAt),
      })
      .onConflictDoUpdate({
        target: [schema.hsActivities.connectionId, schema.hsActivities.hubspotId],
        set,
      });
    counts.upserted += 1;
  }
  return counts;
}

/* ------------------------------- orchestrator ----------------------------- */

export interface SyncOptions {
  /** true = full pull (with associations); false = incremental since last sync. */
  full?: boolean;
  trigger?: "manual" | "cron" | "initial";
}

export interface SyncResult {
  connectionId: string;
  mode: "full" | "incremental";
  status: "success" | "error";
  counts: SyncCounts;
  error?: string;
}

/**
 * Sync a single connection. Full pulls use the list endpoint (associations
 * included); incremental pulls use the Search API filtered on
 * hs_lastmodifieddate >= lastSyncedAt. Upserts are idempotent on
 * (connection_id, hubspot_id), so re-runs never duplicate.
 */
export async function syncConnection(
  connection: HubspotConnection,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const isFull = opts.full ?? connection.lastSyncedAt == null;
  const mode = isFull ? "full" : "incremental";
  const sinceMs = connection.lastSyncedAt?.getTime() ?? 0;
  const startedAt = new Date();
  const counts: SyncCounts = {};

  const [run] = await db
    .insert(schema.syncRuns)
    .values({
      connectionId: connection.id,
      trigger: opts.trigger ?? "manual",
      mode,
      status: "running",
      startedAt,
    })
    .returning({ id: schema.syncRuns.id });

  try {
    const accessToken = await getValidAccessToken(connection);

    const stream = (objectType: string, props: readonly string[], assoc?: readonly string[]) =>
      isFull
        ? listAll(accessToken, objectType, { properties: props, associations: assoc })
        : searchModifiedSince(accessToken, objectType, sinceMs, props);

    counts.companies = await syncCompanies(
      connection.id,
      stream("companies", PROPERTY_SETS.companies),
    );
    counts.contacts = await syncContacts(
      connection.id,
      stream("contacts", PROPERTY_SETS.contacts),
    );
    counts.deals = await syncDeals(
      connection.id,
      stream("deals", PROPERTY_SETS.deals, ["contacts", "companies"]),
    );

    // Activities: each object type may require an extra scope on some portals.
    // Failures here are non-fatal — log the per-type error and keep going.
    let activitiesFetched = 0;
    let activitiesUpserted = 0;
    for (const { type, object, titleProp } of ACTIVITY_TYPES) {
      try {
        const c = await syncActivityType(
          connection.id,
          type,
          titleProp,
          stream(object, [titleProp, "hs_timestamp", "hubspot_owner_id", "hs_lastmodifieddate"]),
        );
        activitiesFetched += c.fetched;
        activitiesUpserted += c.upserted;
      } catch (err) {
        console.warn(`hubspot sync: activity type "${type}" skipped:`, (err as Error).message);
      }
    }
    counts.activities = { fetched: activitiesFetched, upserted: activitiesUpserted };

    await db
      .update(schema.syncRuns)
      .set({ status: "success", finishedAt: new Date(), counts })
      .where(eq(schema.syncRuns.id, run.id));
    await db
      .update(schema.hubspotConnections)
      .set({
        lastSyncedAt: startedAt,
        lastSyncStatus: "success",
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.hubspotConnections.id, connection.id));

    return { connectionId: connection.id, mode, status: "success", counts };
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    await db
      .update(schema.syncRuns)
      .set({ status: "error", finishedAt: new Date(), counts, error: message })
      .where(eq(schema.syncRuns.id, run.id));
    await db
      .update(schema.hubspotConnections)
      .set({ lastSyncStatus: "error", lastSyncError: message, updatedAt: new Date() })
      .where(eq(schema.hubspotConnections.id, connection.id));
    return { connectionId: connection.id, mode, status: "error", counts, error: message };
  }
}

/** Sync all active connections (used by the scheduled/cron trigger). */
export async function syncAllActiveConnections(
  opts: SyncOptions = {},
): Promise<SyncResult[]> {
  const connections = await db
    .select()
    .from(schema.hubspotConnections)
    .where(eq(schema.hubspotConnections.status, "active"));
  const results: SyncResult[] = [];
  for (const connection of connections) {
    results.push(await syncConnection(connection, opts));
  }
  return results;
}
