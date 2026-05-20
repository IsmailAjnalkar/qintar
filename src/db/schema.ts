import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const waitlist = pgTable(
  "waitlist",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    source: text("source"),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("waitlist_email_unique").on(table.email),
  }),
);

export type WaitlistRow = typeof waitlist.$inferSelect;
export type WaitlistInsert = typeof waitlist.$inferInsert;

/* -------------------------------------------------------------------------- */
/* HubSpot integration (QIN-20, W2)                                            */
/*                                                                            */
/* Multi-tenant model: each customer is an `organizations` row that owns one  */
/* or more `hubspot_connections` (one per connected HubSpot portal). Synced   */
/* CRM entities hang off a connection and are de-duplicated on                */
/* (connection_id, hubspot_id) so re-running a sync upserts in place.         */
/*                                                                            */
/* Every entity keeps the full raw HubSpot `properties` payload as JSONB plus */
/* a handful of normalized columns the W3 Pipeline Health Score reads         */
/* directly. NOTE: activity bodies/contact PII live in these rows — they must */
/* go through the redaction/allowlist layer before any LLM prompt (W4).       */
/* -------------------------------------------------------------------------- */

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const hubspotConnections = pgTable(
  "hubspot_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // HubSpot portal / hub id — stable per connected account.
    hubPortalId: text("hub_portal_id").notNull(),
    hubDomain: text("hub_domain"),
    // OAuth tokens, AES-256-GCM encrypted at rest (see lib/crypto.ts).
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    scopes: text("scopes"),
    status: text("status").notNull().default("active"), // active | revoked | error
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status"),
    lastSyncError: text("last_sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    portalUnique: uniqueIndex("hubspot_connections_portal_unique").on(table.hubPortalId),
    orgIdx: index("hubspot_connections_org_idx").on(table.organizationId),
  }),
);

export const hsCompanies = pgTable(
  "hs_companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => hubspotConnections.id, { onDelete: "cascade" }),
    hubspotId: text("hubspot_id").notNull(),
    name: text("name"),
    domain: text("domain"),
    industry: text("industry"),
    ownerId: text("owner_id"),
    archived: boolean("archived").notNull().default(false),
    hubCreatedAt: timestamp("hub_created_at", { withTimezone: true }),
    hubUpdatedAt: timestamp("hub_updated_at", { withTimezone: true }),
    properties: jsonb("properties"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idUnique: uniqueIndex("hs_companies_conn_hubspot_unique").on(
      table.connectionId,
      table.hubspotId,
    ),
  }),
);

export const hsContacts = pgTable(
  "hs_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => hubspotConnections.id, { onDelete: "cascade" }),
    hubspotId: text("hubspot_id").notNull(),
    email: text("email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    company: text("company"),
    ownerId: text("owner_id"),
    lifecycleStage: text("lifecycle_stage"),
    archived: boolean("archived").notNull().default(false),
    hubCreatedAt: timestamp("hub_created_at", { withTimezone: true }),
    hubUpdatedAt: timestamp("hub_updated_at", { withTimezone: true }),
    properties: jsonb("properties"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idUnique: uniqueIndex("hs_contacts_conn_hubspot_unique").on(
      table.connectionId,
      table.hubspotId,
    ),
  }),
);

export const hsDeals = pgTable(
  "hs_deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => hubspotConnections.id, { onDelete: "cascade" }),
    hubspotId: text("hubspot_id").notNull(),
    name: text("name"),
    amount: numeric("amount", { precision: 18, scale: 2 }),
    pipeline: text("pipeline"),
    stage: text("stage"),
    closeDate: timestamp("close_date", { withTimezone: true }),
    ownerId: text("owner_id"),
    isClosed: boolean("is_closed"),
    isWon: boolean("is_won"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    associatedContactIds: jsonb("associated_contact_ids"),
    associatedCompanyIds: jsonb("associated_company_ids"),
    archived: boolean("archived").notNull().default(false),
    hubCreatedAt: timestamp("hub_created_at", { withTimezone: true }),
    hubUpdatedAt: timestamp("hub_updated_at", { withTimezone: true }),
    properties: jsonb("properties"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idUnique: uniqueIndex("hs_deals_conn_hubspot_unique").on(table.connectionId, table.hubspotId),
    pipelineIdx: index("hs_deals_pipeline_idx").on(table.connectionId, table.pipeline),
  }),
);

export const hsActivities = pgTable(
  "hs_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => hubspotConnections.id, { onDelete: "cascade" }),
    hubspotId: text("hubspot_id").notNull(),
    // note | call | email | meeting | task
    type: text("type").notNull(),
    ownerId: text("owner_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    title: text("title"),
    // Short preview only; full body stays in `properties`. PII — never log/LLM raw.
    bodyPreview: text("body_preview"),
    associatedDealIds: jsonb("associated_deal_ids"),
    associatedContactIds: jsonb("associated_contact_ids"),
    archived: boolean("archived").notNull().default(false),
    hubCreatedAt: timestamp("hub_created_at", { withTimezone: true }),
    hubUpdatedAt: timestamp("hub_updated_at", { withTimezone: true }),
    properties: jsonb("properties"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idUnique: uniqueIndex("hs_activities_conn_hubspot_unique").on(
      table.connectionId,
      table.hubspotId,
    ),
    typeIdx: index("hs_activities_type_idx").on(table.connectionId, table.type),
  }),
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => hubspotConnections.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull(), // manual | cron | initial
    mode: text("mode").notNull(), // full | incremental
    status: text("status").notNull().default("running"), // running | success | error
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    counts: jsonb("counts"),
    error: text("error"),
  },
  (table) => ({
    connIdx: index("sync_runs_conn_idx").on(table.connectionId),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type HubspotConnection = typeof hubspotConnections.$inferSelect;
export type HsCompany = typeof hsCompanies.$inferSelect;
export type HsContact = typeof hsContacts.$inferSelect;
export type HsDeal = typeof hsDeals.$inferSelect;
export type HsActivity = typeof hsActivities.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
