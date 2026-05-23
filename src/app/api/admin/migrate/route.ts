import { NextResponse } from "next/server";
import postgres from "postgres";

import { safeEqual } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * TEMPORARY admin migration endpoint (QIN-24). Applies migration 0006 (PayPal
 * columns) using the deployment's runtime DATABASE_URL — needed because the
 * correct DB password lives only in Vercel's (sensitive) env and couldn't be
 * supplied out-of-band. Statements are idempotent (IF NOT EXISTS / DROP NOT NULL),
 * so re-running is safe and a later `db:migrate` of 0006 won't conflict.
 * Gated by MIGRATE_SECRET. REMOVE this route + the secret once go-live verifies.
 */
const STATEMENTS = [
  `ALTER TABLE "subscriptions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL`,
  `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paypal_subscription_id" text`,
  `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paypal_plan_id" text`,
  `CREATE INDEX IF NOT EXISTS "subscriptions_paypal_sub_idx" ON "subscriptions" USING btree ("paypal_subscription_id")`,
];

export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const expected = process.env.MIGRATE_SECRET;
  if (!expected || !secret || !safeEqual(secret, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ ok: false, error: "no_database_url" }, { status: 500 });

  const sql = postgres(url, { max: 1, ssl: "require" });
  try {
    for (const stmt of STATEMENTS) await sql.unsafe(stmt);
    // Confirm the columns now exist.
    const cols = await sql`
      select column_name from information_schema.columns
      where table_name = 'subscriptions' and column_name like 'paypal_%'`;
    await sql.end();
    return NextResponse.json({ ok: true, applied: STATEMENTS.length, paypalColumns: cols.map((c) => c.column_name) });
  } catch (e) {
    await sql.end().catch(() => {});
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
