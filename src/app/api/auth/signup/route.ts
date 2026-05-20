import { NextResponse } from "next/server";

import { SESSION_COOKIE, newSessionPayload, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { AuthError, signUpWithPassword } from "@/lib/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign up (built-in password provider). Creates the user + org + owner
 * membership, then sets the signed session cookie so the caller lands in the
 * onboarding flow already authenticated.
 *
 * Body: { email, password, orgName? }
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string; orgName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ ok: false, error: "email and password are required" }, { status: 400 });
  }

  try {
    const user = await signUpWithPassword({
      email: body.email,
      password: body.password,
      orgName: body.orgName,
    });
    const token = signSession(newSessionPayload(user));
    const res = NextResponse.json({ ok: true, organizationId: user.organizationId, next: "/onboarding" });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "email_taken" ? 409 : 400;
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ ok: false, error: "signup_failed" }, { status: 500 });
  }
}
