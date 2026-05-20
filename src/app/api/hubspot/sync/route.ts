import { NextResponse } from "next/server";

import { safeEqual } from "@/lib/crypto";
import { syncAllActiveConnections } from "@/lib/hubspot/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // allow long-running syncs (Vercel)

/**
 * Authorize the caller via a shared secret. Accepts:
 *   - `Authorization: Bearer <secret>` — Vercel Cron sends CRON_SECRET here, or
 *   - `?secret=<SYNC_TRIGGER_SECRET>` for manual curl triggers.
 * Either SYNC_TRIGGER_SECRET or CRON_SECRET satisfies the check.
 */
function authorized(req: Request): boolean {
  const secrets = [process.env.SYNC_TRIGGER_SECRET, process.env.CRON_SECRET].filter(
    (s): s is string => !!s,
  );
  if (secrets.length === 0) return false;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const fromQuery = new URL(req.url).searchParams.get("secret");
  return secrets.some(
    (s) => (bearer != null && safeEqual(bearer, s)) || (fromQuery != null && safeEqual(fromQuery, s)),
  );
}

async function runSync(req: Request, trigger: "manual" | "cron") {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const full = new URL(req.url).searchParams.get("full") === "true";
  const results = await syncAllActiveConnections({ full, trigger });
  const allOk = results.every((r) => r.status === "success");
  return NextResponse.json(
    { ok: allOk, connections: results.length, results },
    { status: allOk ? 200 : 207 },
  );
}

/** Manual trigger. */
export async function POST(req: Request) {
  return runSync(req, "manual");
}

/** Scheduled trigger (Vercel Cron hits this every 15 min). */
export async function GET(req: Request) {
  return runSync(req, "cron");
}
