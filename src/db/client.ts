import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase Postgres. `prepare: false` keeps us compatible with Supabase's
// transaction-mode connection pooler (port 6543) and is harmless on a direct
// (5432) connection. Keep the pool tiny + short-lived for serverless so we
// don't exhaust Postgres connections across function instances.
const client = postgres(databaseUrl, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  ssl: "require",
});

export const db = drizzle(client, { schema });
export { schema };
