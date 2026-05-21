/**
 * Auth service (QIN-25): sign-up / sign-in for the built-in password provider,
 * plus per-account org provisioning.
 *
 * Sign-up creates a `users` row, an `organizations` row (the tenant), and an
 * owner `org_members` link in one transaction. `organizationId` is later
 * resolved from the session -> the user's membership. The HubSpot connect flow
 * (QIN-20) currently mints a placeholder org per portal; once a user is signed
 * in, the connect step should attach the portal to the session's org instead
 * (see attachOrgToSession / QIN-25 connect route).
 */
import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import { onFreeSignup, touchLastActive } from "@/lib/loops/lifecycle";

import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "./password";

export type AuthErrorCode = "email_taken" | "invalid_credentials" | "weak_password" | "invalid_email";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthedUser {
  userId: string;
  organizationId: string;
  email: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function looksLikeEmail(email: string): boolean {
  // Deliberately permissive — the real validity check is "can we email them".
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Default org name derived from the email domain ("acme.com" -> "Acme"). */
function defaultOrgName(email: string): string {
  const domain = email.split("@")[1] ?? "";
  const label = domain.split(".")[0] ?? "";
  if (!label) return "My workspace";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export async function signUpWithPassword(params: {
  email: string;
  password: string;
  orgName?: string;
}): Promise<AuthedUser> {
  const email = normalizeEmail(params.email);
  if (!looksLikeEmail(email)) throw new AuthError("Enter a valid email address", "invalid_email");
  if (params.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      "weak_password",
    );
  }

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw new AuthError("An account with this email already exists", "email_taken");
  }

  const passwordHash = await hashPassword(params.password);
  const orgName = params.orgName?.trim() || defaultOrgName(email);

  // One transaction so we never leave a user without an org (or vice versa).
  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ email, passwordHash, provider: "password" })
      .returning({ id: schema.users.id });
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: orgName })
      .returning({ id: schema.organizations.id });
    await tx
      .insert(schema.orgMembers)
      .values({ organizationId: org.id, userId: user.id, role: "owner" });
    return { userId: user.id, organizationId: org.id };
  });

  // Tell Loops a free signup happened → fires the Welcome Loop (PRE-13).
  // Fire-and-forget: a Loops outage must never fail a signup. Signup captures a
  // workspace name, not a person's, so firstName is derived from the email.
  void onFreeSignup({ email, name: null });

  return { ...result, email };
}

export async function signInWithPassword(params: {
  email: string;
  password: string;
}): Promise<AuthedUser> {
  const email = normalizeEmail(params.email);
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  const user = rows[0];

  // Always run a verify (against the real or a null hash) so response timing
  // doesn't reveal whether the email exists.
  const ok = await verifyPassword(params.password, user?.passwordHash ?? null);
  if (!user || !ok) {
    throw new AuthError("Email or password is incorrect", "invalid_credentials");
  }

  const organizationId = await resolvePrimaryOrganizationId(user.id);
  if (!organizationId) {
    throw new AuthError("This account has no workspace", "invalid_credentials");
  }
  // Sign-in is a real activity signal — keep lastActiveAt fresh so the nightly
  // inactivity sweep (PRE-13) only re-engages genuinely dormant users.
  void touchLastActive(user.id);
  return { userId: user.id, organizationId, email };
}

/** The org a user acts as. First (oldest) membership wins for now (one org/user). */
export async function resolvePrimaryOrganizationId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: schema.orgMembers.organizationId })
    .from(schema.orgMembers)
    .where(eq(schema.orgMembers.userId, userId))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

/** True if the user is a member of the org (authorization for org-scoped actions). */
export async function userOwnsOrganization(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: schema.orgMembers.id })
    .from(schema.orgMembers)
    .where(
      and(
        eq(schema.orgMembers.userId, userId),
        eq(schema.orgMembers.organizationId, organizationId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
