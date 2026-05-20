import {
  boolean,
  index,
  integer,
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

/* -------------------------------------------------------------------------- */
/* Auth / sessions (QIN-25, W2)                                                 */
/*                                                                            */
/* A `users` row is an authenticated person; an `org_members` row links a user */
/* to an `organizations` row (the tenant) with a role. Onboarding creates one  */
/* org per signed-up account and an owner membership. `organizationId` for a   */
/* request is resolved from the session -> the user's membership.             */
/*                                                                            */
/* `provider` records where the identity came from: "password" (built-in,     */
/* keyless-staging path) or an external IdP ("clerk", "google") once those     */
/* keys are provisioned. `password_hash` is scrypt (see lib/auth/password.ts)  */
/* and is null for externally-authenticated users. NEVER log it.              */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    // scrypt hash (`scrypt:<saltB64>:<hashB64>`); null for external IdP users.
    passwordHash: text("password_hash"),
    name: text("name"),
    // password | clerk | google
    provider: text("provider").notNull().default("password"),
    // External IdP subject id (e.g. Clerk user id) — null for built-in users.
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    externalIdx: index("users_external_idx").on(table.externalId),
  }),
);

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // owner | admin | member
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    memberUnique: uniqueIndex("org_members_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    userIdx: index("org_members_user_idx").on(table.userId),
  }),
);

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

/* -------------------------------------------------------------------------- */
/* Stripe billing (QIN-24, W2)                                                 */
/*                                                                            */
/* One subscription row per organization (the tenant) — `subscriptions` is    */
/* the source of truth for entitlement. It's written by the Stripe webhook    */
/* (subscription lifecycle) and read by `lib/billing/service.ts` to resolve   */
/* what a tenant is allowed to do. The Stripe customer is created lazily at    */
/* checkout; the row may briefly exist with status "incomplete" and a null    */
/* plan until the first `customer.subscription.*` event lands.                 */
/*                                                                            */
/* `billing_events` gives webhook idempotency: we INSERT the Stripe event id  */
/* (unique) before processing and skip on conflict, so Stripe's at-least-once */
/* delivery never double-applies a state change.                              */
/* -------------------------------------------------------------------------- */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    // starter | team | scale | null (null until first subscription event)
    plan: text("plan"),
    priceId: text("price_id"),
    // Stripe subscription status: active | trialing | past_due | canceled | unpaid | incomplete | incomplete_expired | paused
    status: text("status").notNull().default("incomplete"),
    quantity: integer("quantity").notNull().default(1),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    // Full raw Stripe subscription object for debugging / future fields.
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgUnique: uniqueIndex("subscriptions_org_unique").on(table.organizationId),
    customerIdx: index("subscriptions_customer_idx").on(table.stripeCustomerId),
    subIdUnique: uniqueIndex("subscriptions_stripe_sub_unique").on(table.stripeSubscriptionId),
  }),
);

export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("processed"), // processed | ignored | error
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventUnique: uniqueIndex("billing_events_event_unique").on(table.stripeEventId),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type BillingEvent = typeof billingEvents.$inferSelect;

/* -------------------------------------------------------------------------- */
/* Slack connection (QIN-24 #3 — "connect Slack")                              */
/*                                                                            */
/* One Slack workspace per org (the digest delivery target). Created during    */
/* onboarding via OAuth v2; the bot token + incoming-webhook URL are AES-256-  */
/* GCM encrypted at rest (lib/crypto.ts), same as HubSpot tokens. The digest   */
/* feature (W3) posts to `incoming_webhook_url_enc` / via the bot token.       */
/* Unique on organization_id → reconnecting updates in place.                  */
/* -------------------------------------------------------------------------- */

export const slackConnections = pgTable(
  "slack_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: text("team_id").notNull(),
    teamName: text("team_name"),
    botUserId: text("bot_user_id"),
    // Bot token (xoxb-…), encrypted at rest.
    botTokenEnc: text("bot_token_enc").notNull(),
    // Incoming-webhook URL (a secret) + the channel the installer chose, if the
    // incoming-webhook scope was granted. Used for digest delivery.
    incomingWebhookUrlEnc: text("incoming_webhook_url_enc"),
    webhookChannel: text("webhook_channel"),
    webhookChannelId: text("webhook_channel_id"),
    authedUserId: text("authed_user_id"),
    scopes: text("scopes"),
    status: text("status").notNull().default("active"), // active | revoked | error
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgUnique: uniqueIndex("slack_connections_org_unique").on(table.organizationId),
    teamIdx: index("slack_connections_team_idx").on(table.teamId),
  }),
);

export type SlackConnection = typeof slackConnections.$inferSelect;

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type OrgMember = typeof orgMembers.$inferSelect;
export type HubspotConnection = typeof hubspotConnections.$inferSelect;
export type HsCompany = typeof hsCompanies.$inferSelect;
export type HsContact = typeof hsContacts.$inferSelect;
export type HsDeal = typeof hsDeals.$inferSelect;
export type HsActivity = typeof hsActivities.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
