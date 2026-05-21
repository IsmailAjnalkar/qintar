ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- PRE-13: backfill existing rows to their created_at so already-dormant users
-- are seen as inactive (not "active now") by the nightly Loops sweep.
UPDATE "users" SET "last_active_at" = "created_at";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_last_active_idx" ON "users" USING btree ("last_active_at");