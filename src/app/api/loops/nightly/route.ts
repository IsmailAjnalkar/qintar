import { NextResponse } from "next/server";

import { safeEqual } from "@/lib/crypto";
import { isLoopsConfigured } from "@/lib/loops/config";
import { sweepInactiveContacts } from "@/lib/loops/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly Loops maintenance (PRE-13): fire `went_inactive` for free users who
 * just crossed 14 days of inactivity → Re-engagement Loop. Loops owns all drip
 * timing; this job only emits the trigger event.
 *
 * Auth mirrors /api/hubspot/sync: Vercel Cron sends `Authorization: Bearer
 * CRON_SECRET`; manual curls can pass `?secret=SYNC_TRIGGER_SECRET`. Either
 * CRON_SECRET or SYNC_TRIGGER_SECRET satisfies the check.
 */
function authorized(req: Request): boolean {
  const secrets = [process.env.CRON_SECRET, process.env.SYNC_TRIGGER_SECRET].filter(
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

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isLoopsConfigured()) {
    // Not an error — Loops is opt-in. Report it so the cron log is clear.
    return NextResponse.json({ ok: true, skipped: "LOOPS_API_KEY unset" });
  }
  const result = await sweepInactiveContacts();
  return NextResponse.json({ ok: result.errors === 0, ...result });
}

/** Manual trigger. */
export async function POST(req: Request) {
  return run(req);
}

/** Scheduled trigger (Vercel Cron). */
export async function GET(req: Request) {
  return run(req);
}
