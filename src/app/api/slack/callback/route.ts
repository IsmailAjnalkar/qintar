import { NextResponse } from "next/server";

import { getSessionFromRequest } from "@/lib/auth/session";
import { safeEqual } from "@/lib/crypto";
import { exchangeCodeForTokens, persistConnection } from "@/lib/slack/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "slack_oauth_state";

/**
 * Slack OAuth callback. Validates the CSRF state cookie, requires the same
 * session that started the install, exchanges the code for a bot token, and
 * persists an encrypted connection for the session's org. Redirects back into
 * onboarding on success.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/onboarding?slack_error=${encodeURIComponent(oauthError)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.json({ ok: false, error: "missing_code_or_state" }, { status: 400 });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in?next=/onboarding", req.url));
  }

  // CSRF: the state echoed back must match the cookie we set at install.
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];
  if (!cookieState || !safeEqual(cookieState, state)) {
    return NextResponse.json({ ok: false, error: "invalid_state" }, { status: 400 });
  }

  try {
    const result = await exchangeCodeForTokens(code);
    await persistConnection({ organizationId: session.oid, result });
    const res = NextResponse.redirect(new URL("/onboarding?slack=connected", req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/onboarding?slack_error=${encodeURIComponent((err as Error).message)}`, req.url),
    );
  }
}
