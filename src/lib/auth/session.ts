/**
 * Session token: a stateless, tamper-evident signed cookie — QIN-25.
 *
 * Format: `<bodyB64url>.<sigB64url>` where body is the JSON `SessionPayload`
 * and sig is HMAC-SHA256(body) keyed by AUTH_SESSION_SECRET. Verification is
 * constant-time and re-checks the issued-at age, so a stolen-then-expired or
 * tampered cookie is rejected. Pure node:crypto — no `next/headers` import here
 * so this module is usable from route handlers (via a Request) and from
 * offline tests. Server-component access lives in `./server`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "qintar_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  /** users.id */
  uid: string;
  /** organizations.id — the tenant this session acts as. */
  oid: string;
  email: string;
  /** issued-at, unix seconds */
  iat: number;
  v: 1;
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "AUTH_SESSION_SECRET is not set (and no TOKEN_ENCRYPTION_KEY fallback). " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function newSessionPayload(params: { userId: string; organizationId: string; email: string }): SessionPayload {
  return {
    uid: params.userId,
    oid: params.organizationId,
    email: params.email,
    iat: Math.floor(Date.now() / 1000),
    v: 1,
  };
}

export function signSession(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", getSessionSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string | null | undefined): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64url(createHmac("sha256", getSessionSecret()).update(body).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.v !== 1 || !payload.uid || !payload.oid || !payload.email) return null;
    if (typeof payload.iat !== "number") return null;
    if (Date.now() / 1000 - payload.iat > MAX_AGE_SEC) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

/** Extract + verify the session from a raw `Cookie` header value. */
export function parseSessionCookie(cookieHeader: string | null | undefined): SessionPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return verifySession(decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)));
}

/** Verify the session from an incoming Request (route handlers). */
export function getSessionFromRequest(req: Request): SessionPayload | null {
  return parseSessionCookie(req.headers.get("cookie"));
}

export function sessionCookieOptions(maxAge: number = MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Cookie options that immediately clear the session (sign-out). */
export function clearedSessionCookieOptions() {
  return sessionCookieOptions(0);
}
