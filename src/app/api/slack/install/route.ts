import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { getSessionFromRequest } from "@/lib/auth/session";
import { buildAuthorizeUrl } from "@/lib/slack/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "slack_oauth_state";

/**
 * Kicks off the Slack OAuth install flow. Requires a signed-in session (the
 * connection attaches to the session's org). Sets a short-lived CSRF state
 * cookie and redirects to Slack's consent screen.
 */
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in?next=/onboarding", req.url));
  }

  let authorizeUrl: string;
  const state = randomBytes(16).toString("hex");
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (err) {
    // Credentials not configured yet — actionable message.
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
