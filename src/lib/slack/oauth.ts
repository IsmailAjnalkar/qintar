import { eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import type { SlackConnection } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";

import { SLACK_ACCESS_URL, SLACK_AUTHORIZE_URL, getScopes, getSlackEnv } from "./config";

/** Build the Slack install URL the user is redirected to. */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getSlackEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    scope: getScopes(),
    redirect_uri: redirectUri,
    state,
  });
  return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
}

/** Shape of the bits of oauth.v2.access we use. */
export interface SlackOAuthResult {
  ok: boolean;
  error?: string;
  access_token?: string; // bot token, xoxb-…
  scope?: string;
  bot_user_id?: string;
  team?: { id: string; name?: string };
  authed_user?: { id: string };
  incoming_webhook?: { url: string; channel?: string; channel_id?: string };
}

/**
 * Exchange an authorization code for a bot token. Slack returns HTTP 200 with
 * `{ ok: false, error }` on failure (not an HTTP error code), so we check `ok`.
 */
export async function exchangeCodeForTokens(code: string): Promise<SlackOAuthResult> {
  const { clientId, clientSecret, redirectUri } = getSlackEnv();
  const res = await fetch(SLACK_ACCESS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Slack token request failed: ${res.status}`);
  }
  const data = (await res.json()) as SlackOAuthResult;
  if (!data.ok) {
    // Do not log tokens; the error code is safe (e.g. invalid_code).
    throw new Error(`Slack OAuth error: ${data.error ?? "unknown"}`);
  }
  return data;
}

/**
 * Persist a Slack connection for an org. Upserts on organization_id so
 * reconnecting the same org refreshes the token/webhook in place. The bot token
 * and incoming-webhook URL are encrypted at rest.
 */
export async function persistConnection(params: {
  organizationId: string;
  result: SlackOAuthResult;
}): Promise<SlackConnection> {
  const { organizationId, result } = params;
  if (!result.access_token || !result.team?.id) {
    throw new Error("Slack OAuth result missing access_token/team");
  }

  const values = {
    organizationId,
    teamId: result.team.id,
    teamName: result.team.name ?? null,
    botUserId: result.bot_user_id ?? null,
    botTokenEnc: encryptSecret(result.access_token),
    incomingWebhookUrlEnc: result.incoming_webhook?.url
      ? encryptSecret(result.incoming_webhook.url)
      : null,
    webhookChannel: result.incoming_webhook?.channel ?? null,
    webhookChannelId: result.incoming_webhook?.channel_id ?? null,
    authedUserId: result.authed_user?.id ?? null,
    scopes: result.scope ?? null,
    status: "active",
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(schema.slackConnections)
    .values(values)
    .onConflictDoUpdate({ target: schema.slackConnections.organizationId, set: values })
    .returning();
  return row;
}

/** Fetch the Slack connection for an org, if any. */
export async function getSlackConnection(organizationId: string): Promise<SlackConnection | null> {
  const rows = await db
    .select()
    .from(schema.slackConnections)
    .where(eq(schema.slackConnections.organizationId, organizationId))
    .limit(1);
  return rows[0] ?? null;
}
