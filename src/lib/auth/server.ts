/**
 * Server-component / server-action session access (QIN-25).
 *
 * Reads the session cookie via `next/headers`. Kept separate from `session.ts`
 * (which is pure node:crypto) so route handlers and offline tests don't pull in
 * the request-scoped `next/headers` API.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Require a session in a server component / page. Redirects to sign-in
 * (preserving where the user was headed) when there isn't one.
 */
export async function requireSession(redirectTo = "/onboarding"): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(redirectTo)}`);
  }
  return session;
}
