import { NextResponse } from "next/server";

import { getSessionFromRequest } from "@/lib/auth/session";
import { getAppUrl } from "@/lib/billing/config";
import { safeEqual } from "@/lib/crypto";
import {
  exchangeCodeForTokens,
  getTokenInfo,
  persistConnection,
} from "@/lib/hubspot/oauth";
import { syncConnection } from "@/lib/hubspot/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "hs_oauth_state";

/**
 * HubSpot OAuth callback. Validates the CSRF state cookie, exchanges the code
 * for tokens, persists an encrypted connection, then kicks off the initial
 * full sync so the staging DB is populated immediately after connect.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.json({ ok: false, error: `hubspot_denied: ${oauthError}` }, { status: 400 });
  }
  if (!code || !state) {
    return NextResponse.json({ ok: false, error: "missing_code_or_state" }, { status: 400 });
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

  // Attach the portal to the signed-in user's org when there is a session;
  // keyless staging installs fall back to a placeholder org (see persistConnection).
  const session = getSessionFromRequest(req);

  try {
    const tokens = await exchangeCodeForTokens(code);
    const info = await getTokenInfo(tokens.access_token);
    const connection = await persistConnection({
      tokens,
      info,
      organizationId: session?.oid,
    });

    // Initial full sync. Run inline so the connect flow lands on real data.
    // (The initial sync is intentionally NOT entitlement-gated — it's the
    // onboarding activation moment, before the user picks a plan.)
    const result = await syncConnection(connection, { full: true, trigger: "initial" });

    // In-flow (browser) connect: continue the onboarding stepper. API/keyless
    // callers (no session) keep getting JSON for scripted verification.
    if (session) {
      const next = `${getAppUrl()}/onboarding/plan?connected=1`;
      const res = NextResponse.redirect(next);
      res.cookies.delete(STATE_COOKIE);
      return res;
    }

    const res = NextResponse.json({
      ok: true,
      portalId: connection.hubPortalId,
      initialSync: { status: result.status, counts: result.counts },
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
