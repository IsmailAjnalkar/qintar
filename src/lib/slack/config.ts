/** Slack OAuth configuration & constants (QIN-24 #3 — connect Slack). */

import { getAppUrl } from "@/lib/billing/config";

export const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
export const SLACK_ACCESS_URL = "https://slack.com/api/oauth.v2.access";

/**
 * Bot scopes requested at install. `incoming-webhook` lets the installer pick a
 * channel and hands us a ready-to-post webhook URL (simplest path to the first
 * digest); `chat:write` keeps the door open for richer bot posting later. Keep
 * minimal — Slack shows every scope on the consent screen.
 *
 * Override with SLACK_SCOPES (space- or comma-separated) if a workspace needs more.
 */
export const DEFAULT_SCOPES = ["incoming-webhook", "chat:write"];

export function getScopes(): string {
  const fromEnv = process.env.SLACK_SCOPES?.trim();
  if (fromEnv) return fromEnv.split(/[ ,]+/).filter(Boolean).join(",");
  return DEFAULT_SCOPES.join(",");
}

export interface SlackEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Reads + validates the Slack app credentials. Throws an actionable error if the
 * operator hasn't configured them (mirrors `getHubspotEnv`). `redirectUri`
 * defaults to `<app-url>/api/slack/callback` but can be overridden — it must
 * EXACTLY match a redirect URL registered on the Slack app.
 */
export function getSlackEnv(): SlackEnv {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI ?? `${getAppUrl()}/api/slack/callback`;
  const missing: string[] = [];
  if (!clientId) missing.push("SLACK_CLIENT_ID");
  if (!clientSecret) missing.push("SLACK_CLIENT_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `Slack OAuth is not configured. Missing: ${missing.join(", ")}. ` +
        "Register a Slack app and set these env vars.",
    );
  }
  return { clientId: clientId!, clientSecret: clientSecret!, redirectUri };
}
