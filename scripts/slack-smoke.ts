/**
 * Slack OAuth smoke test (QIN-24 #3) — fully offline.
 *
 * Exercises the pure config/URL logic with NO network and NO database:
 *   - authorize URL contains client_id, redirect_uri, scope, state
 *   - scope defaults + SLACK_SCOPES override (normalized to comma-separated)
 *   - getSlackEnv throws an actionable error when unconfigured
 *   - redirect_uri defaults to <app-url>/api/slack/callback
 *
 * Run:  npx tsx scripts/slack-smoke.ts
 */
import { DEFAULT_SCOPES, getScopes, getSlackEnv } from "@/lib/slack/config";

// oauth.ts (dynamically imported below) pulls in db/client, which constructs a
// postgres client at import time. postgres.js connects lazily, so a dummy URL
// lets the module load without a real DB — none of these checks issue queries.
process.env.DATABASE_URL ??= "postgresql://smoke:smoke@localhost:5432/smoke";

const checks: Array<[string, boolean]> = [];
function check(label: string, pass: boolean) {
  checks.push([label, pass]);
}

// Unconfigured -> actionable throw.
delete process.env.SLACK_CLIENT_ID;
delete process.env.SLACK_CLIENT_SECRET;
try {
  getSlackEnv();
  check("getSlackEnv throws when unconfigured", false);
} catch (err) {
  check("getSlackEnv throws when unconfigured", /SLACK_CLIENT_ID/.test((err as Error).message));
}

// Configure test creds.
process.env.SLACK_CLIENT_ID = "123.abc";
process.env.SLACK_CLIENT_SECRET = "shhh";
process.env.NEXT_PUBLIC_SITE_URL = "https://app.qintar.com";
delete process.env.SLACK_REDIRECT_URI;

const env = getSlackEnv();
check("clientId read", env.clientId === "123.abc");
check("redirect_uri defaults to <app-url>/api/slack/callback",
  env.redirectUri === "https://app.qintar.com/api/slack/callback");

// SLACK_REDIRECT_URI override wins.
process.env.SLACK_REDIRECT_URI = "https://app.qintar.com/custom/cb";
check("SLACK_REDIRECT_URI override wins", getSlackEnv().redirectUri === "https://app.qintar.com/custom/cb");

// Scopes: default + override.
check("default scopes = incoming-webhook,chat:write", getScopes() === DEFAULT_SCOPES.join(","));
process.env.SLACK_SCOPES = "incoming-webhook chat:write channels:read";
check("SLACK_SCOPES space-separated normalized to commas",
  getScopes() === "incoming-webhook,chat:write,channels:read");
delete process.env.SLACK_SCOPES;

// buildAuthorizeUrl after env is set (import here so config reads current env).
import("@/lib/slack/oauth").then(({ buildAuthorizeUrl }) => {
  process.env.SLACK_REDIRECT_URI = "https://app.qintar.com/api/slack/callback";
  const url = new URL(buildAuthorizeUrl("state-xyz"));
  check("authorize URL host is slack.com", url.host === "slack.com");
  check("authorize URL carries client_id", url.searchParams.get("client_id") === "123.abc");
  check("authorize URL carries state", url.searchParams.get("state") === "state-xyz");
  check("authorize URL carries redirect_uri",
    url.searchParams.get("redirect_uri") === "https://app.qintar.com/api/slack/callback");
  check("authorize URL carries scope", (url.searchParams.get("scope") ?? "").includes("incoming-webhook"));

  console.log("\nSlack OAuth smoke test:");
  let allPass = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
    if (!pass) allPass = false;
  }
  console.log(allPass ? "\nALL CHECKS PASSED" : "\nFAILURES PRESENT");
  process.exit(allPass ? 0 : 1);
});
