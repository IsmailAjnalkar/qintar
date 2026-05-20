/**
 * Onboarding / auth smoke test (QIN-25) — fully offline.
 *
 * Exercises the security-critical pure functions with NO network, NO database,
 * NO real keys:
 *   - password hashing: roundtrip, wrong password, null/malformed hash, salting
 *   - session token: sign/verify roundtrip, tampered body, tampered sig, wrong
 *     secret, expiry (the part that gates every authenticated request)
 *   - billing authorization: session org ownership, org mismatch (403),
 *     admin-secret fallback, unauthorized
 *
 * Run:  npx tsx scripts/onboarding-smoke.ts
 */

// Set the session secret BEFORE any signing/verifying.
process.env.AUTH_SESSION_SECRET = "test_session_secret_aaaaaaaaaaaaaaaaaaaaaaaa";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  newSessionPayload,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/auth/session";
import { authorizeBillingOrg } from "@/lib/billing/auth";

const checks: Array<[string, boolean]> = [];
function check(label: string, pass: boolean) {
  checks.push([label, pass]);
}

function reqWith(headers: Record<string, string>, url = "https://app.test/api/billing/checkout"): Request {
  return new Request(url, { headers });
}

async function main() {
  /* -------------------------------- password ------------------------------- */
  const hash = await hashPassword("correct horse battery");
  check("password roundtrip verifies", await verifyPassword("correct horse battery", hash));
  check("wrong password rejected", !(await verifyPassword("wrong password", hash)));
  check("verify against null hash is false", !(await verifyPassword("x", null)));
  check("verify against malformed hash is false", !(await verifyPassword("x", "not-a-hash")));
  const hash2 = await hashPassword("correct horse battery");
  check("same password -> different stored hash (salted)", hash !== hash2);

  /* -------------------------------- session -------------------------------- */
  const payload = newSessionPayload({
    userId: "user-1",
    organizationId: "org-1",
    email: "a@acme.com",
  });
  const token = signSession(payload);
  const verified = verifySession(token);
  check(
    "session roundtrip returns payload",
    verified?.uid === "user-1" && verified?.oid === "org-1" && verified?.email === "a@acme.com",
  );

  const [body, sig] = token.split(".");
  check("tampered body rejected", verifySession(`${body}x.${sig}`) === null);
  check("tampered signature rejected", verifySession(`${body}.${sig}AA`) === null);
  check("empty token rejected", verifySession("") === null);

  // Wrong secret: re-key the env, verify the old token -> mismatch.
  process.env.AUTH_SESSION_SECRET = "a_different_secret_bbbbbbbbbbbbbbbbbbbbbbbb";
  check("token signed with another secret rejected", verifySession(token) === null);
  process.env.AUTH_SESSION_SECRET = "test_session_secret_aaaaaaaaaaaaaaaaaaaaaaaa";

  // Expiry: craft a payload issued 60 days ago.
  const expired: SessionPayload = {
    uid: "u",
    oid: "o",
    email: "e@e.com",
    iat: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 60,
    v: 1,
  };
  check("expired session rejected", verifySession(signSession(expired)) === null);

  /* ---------------------------- billing authz ------------------------------ */
  const cookie = `${SESSION_COOKIE}=${token}`;

  const a1 = authorizeBillingOrg(reqWith({ cookie }));
  check("session authorizes its own org", a1.ok && a1.organizationId === "org-1" && a1.via === "session");

  const a2 = authorizeBillingOrg(reqWith({ cookie }), "org-1");
  check("session + matching requested org ok", a2.ok && a2.organizationId === "org-1");

  const a3 = authorizeBillingOrg(reqWith({ cookie }), "org-2");
  check("session + mismatched org -> 403", !a3.ok && a3.status === 403);

  process.env.BILLING_ADMIN_SECRET = "admin_secret_value";
  const a4 = authorizeBillingOrg(
    reqWith({ authorization: "Bearer admin_secret_value" }),
    "org-9",
  );
  check("admin secret + org authorizes (server-to-server)", a4.ok && a4.organizationId === "org-9" && a4.via === "admin");

  const a5 = authorizeBillingOrg(reqWith({ authorization: "Bearer admin_secret_value" }));
  check("admin secret without org -> 403", !a5.ok && a5.status === 403);

  const a6 = authorizeBillingOrg(reqWith({}));
  check("no session, no secret -> 401", !a6.ok && a6.status === 401);

  const a7 = authorizeBillingOrg(reqWith({ authorization: "Bearer wrong_secret" }), "org-9");
  check("wrong admin secret -> 401", !a7.ok && a7.status === 401);

  /* --------------------------------- report -------------------------------- */
  console.log("\nOnboarding / auth smoke test:");
  let allPass = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
    if (!pass) allPass = false;
  }
  console.log(allPass ? "\nALL CHECKS PASSED" : "\nFAILURES PRESENT");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
