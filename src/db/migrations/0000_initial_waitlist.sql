CREATE TABLE IF NOT EXISTS "waitlist" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "source" text,
  "referrer" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_email_unique" ON "waitlist" ("email");
