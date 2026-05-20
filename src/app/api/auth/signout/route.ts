import { NextResponse } from "next/server";

import { SESSION_COOKIE, clearedSessionCookieOptions } from "@/lib/auth/session";
import { getAppUrl } from "@/lib/billing/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clear the session cookie and return to the landing page. */
export async function POST() {
  const res = NextResponse.json({ ok: true, next: "/" });
  res.cookies.set(SESSION_COOKIE, "", clearedSessionCookieOptions());
  return res;
}

/** GET form/link support — redirects home after clearing the cookie. */
export async function GET() {
  const res = NextResponse.redirect(`${getAppUrl()}/`);
  res.cookies.set(SESSION_COOKIE, "", clearedSessionCookieOptions());
  return res;
}
