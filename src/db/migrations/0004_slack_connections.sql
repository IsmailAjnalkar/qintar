CREATE TABLE IF NOT EXISTS "slack_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" text NOT NULL,
	"team_name" text,
	"bot_user_id" text,
	"bot_token_enc" text NOT NULL,
	"incoming_webhook_url_enc" text,
	"webhook_channel" text,
	"webhook_channel_id" text,
	"authed_user_id" text,
	"scopes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "slack_connections_org_unique" ON "slack_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slack_connections_team_idx" ON "slack_connections" USING btree ("team_id");