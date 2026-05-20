CREATE TABLE IF NOT EXISTS "hs_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"hubspot_id" text NOT NULL,
	"type" text NOT NULL,
	"owner_id" text,
	"occurred_at" timestamp with time zone,
	"title" text,
	"body_preview" text,
	"associated_deal_ids" jsonb,
	"associated_contact_ids" jsonb,
	"archived" boolean DEFAULT false NOT NULL,
	"hub_created_at" timestamp with time zone,
	"hub_updated_at" timestamp with time zone,
	"properties" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hs_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"hubspot_id" text NOT NULL,
	"name" text,
	"domain" text,
	"industry" text,
	"owner_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	"hub_created_at" timestamp with time zone,
	"hub_updated_at" timestamp with time zone,
	"properties" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hs_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"hubspot_id" text NOT NULL,
	"email" text,
	"first_name" text,
	"last_name" text,
	"company" text,
	"owner_id" text,
	"lifecycle_stage" text,
	"archived" boolean DEFAULT false NOT NULL,
	"hub_created_at" timestamp with time zone,
	"hub_updated_at" timestamp with time zone,
	"properties" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hs_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"hubspot_id" text NOT NULL,
	"name" text,
	"amount" numeric(18, 2),
	"pipeline" text,
	"stage" text,
	"close_date" timestamp with time zone,
	"owner_id" text,
	"is_closed" boolean,
	"is_won" boolean,
	"last_activity_at" timestamp with time zone,
	"associated_contact_ids" jsonb,
	"associated_company_ids" jsonb,
	"archived" boolean DEFAULT false NOT NULL,
	"hub_created_at" timestamp with time zone,
	"hub_updated_at" timestamp with time zone,
	"properties" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hubspot_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"hub_portal_id" text NOT NULL,
	"hub_domain" text,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scopes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"counts" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text,
	"referrer" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hs_activities" ADD CONSTRAINT "hs_activities_connection_id_hubspot_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hubspot_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hs_companies" ADD CONSTRAINT "hs_companies_connection_id_hubspot_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hubspot_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hs_contacts" ADD CONSTRAINT "hs_contacts_connection_id_hubspot_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hubspot_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hs_deals" ADD CONSTRAINT "hs_deals_connection_id_hubspot_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hubspot_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hubspot_connections" ADD CONSTRAINT "hubspot_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_connection_id_hubspot_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hubspot_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hs_activities_conn_hubspot_unique" ON "hs_activities" USING btree ("connection_id","hubspot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hs_activities_type_idx" ON "hs_activities" USING btree ("connection_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hs_companies_conn_hubspot_unique" ON "hs_companies" USING btree ("connection_id","hubspot_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hs_contacts_conn_hubspot_unique" ON "hs_contacts" USING btree ("connection_id","hubspot_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hs_deals_conn_hubspot_unique" ON "hs_deals" USING btree ("connection_id","hubspot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hs_deals_pipeline_idx" ON "hs_deals" USING btree ("connection_id","pipeline");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hubspot_connections_portal_unique" ON "hubspot_connections" USING btree ("hub_portal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hubspot_connections_org_idx" ON "hubspot_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_runs_conn_idx" ON "sync_runs" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_email_unique" ON "waitlist" USING btree ("email");