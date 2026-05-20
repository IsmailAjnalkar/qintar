import { NextResponse } from "next/server";

import { SESSION_COOKIE, newSessionPayload, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { AuthError, signInWithPassword } from "@/lib/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign in (built-in password provider). Sets the signed session cookie.
 *
 * Body: { email, password, next? }
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ ok: false, error: "email and password are required" }, { status: 400 });
  }

  try {
    const user = await signInWithPassword({ email: body.email, password: body.password });
    const token = signSession(newSessionPayload(user));
    // Only allow same-site relative redirects from the client-supplied `next`.
    const next = body.next && body.next.startsWith("/") ? body.next : "/dashboard";
    const res = NextResponse.json({ ok: true, next });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "signin_failed" }, { status: 500 });
  }
}
