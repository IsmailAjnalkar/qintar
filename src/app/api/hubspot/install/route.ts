import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { buildAuthorizeUrl } from "@/lib/hubspot/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "hs_oauth_state";

/**
 * Kicks off the HubSpot OAuth install flow. Sets a short-lived, signed-ish
 * CSRF state cookie and redirects the user to HubSpot's consent screen.
 */
export async function GET() {
  let authorizeUrl: string;
  const state = randomBytes(16).toString("hex");
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (err) {
    // Credentials not configured yet — return an actionable message.
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
