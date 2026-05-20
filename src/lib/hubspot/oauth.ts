import { eq } from "drizzle-orm";

import { db, schema } from "@/db/client";
import type { HubspotConnection } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

import {
  HUBSPOT_API_BASE,
  HUBSPOT_AUTHORIZE_URL,
  HUBSPOT_TOKEN_URL,
  getHubspotEnv,
  getScopes,
} from "./config";

/** Build the HubSpot install URL the user is redirected to. */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getHubspotEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: getScopes(),
    state,
  });
  return `${HUBSPOT_AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
}

async function postTokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Do not log the body params (they contain client_secret / tokens).
    throw new Error(`HubSpot token request failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Exchange an authorization code for tokens. */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = getHubspotEnv();
  return postTokenRequest({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
}

interface AccessTokenInfo {
  hub_id: number;
  hub_domain?: string;
  scopes?: string[];
  expires_in?: number;
}

/** Look up portal/account metadata for an access token. */
export async function getTokenInfo(accessToken: string): Promise<AccessTokenInfo> {
  const res = await fetch(`${HUBSPOT_API_BASE}/oauth/v1/access-tokens/${accessToken}`);
  if (!res.ok) {
    throw new Error(`HubSpot token info failed: ${res.status}`);
  }
  return (await res.json()) as AccessTokenInfo;
}

/**
 * Persist a freshly authorized connection. Upserts on hub_portal_id so
 * reconnecting the same portal refreshes tokens in place (no duplicate orgs
 * for the same portal).
 *
 * Org attachment (QIN-25): if `organizationId` is provided (the signed-in user's
 * org from the onboarding flow), the new connection attaches to it. With no
 * session (keyless staging install), a placeholder organization is created on
 * first connect — preserving the pre-auth behavior.
 */
export async function persistConnection(params: {
  tokens: TokenResponse;
  info: AccessTokenInfo;
  organizationId?: string;
}): Promise<HubspotConnection> {
  const { tokens, info, organizationId } = params;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const scopes = info.scopes?.join(" ") ?? null;
  const portalId = String(info.hub_id);

  const existing = await db
    .select()
    .from(schema.hubspotConnections)
    .where(eq(schema.hubspotConnections.hubPortalId, portalId))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(schema.hubspotConnections)
      .set({
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        expiresAt,
        scopes,
        hubDomain: info.hub_domain ?? null,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(schema.hubspotConnections.id, existing[0].id))
      .returning();
    return updated;
  }

  // Attach to the signed-in org, or mint a placeholder for keyless installs.
  const orgId =
    organizationId ??
    (
      await db
        .insert(schema.organizations)
        .values({ name: info.hub_domain ?? `HubSpot portal ${portalId}` })
        .returning({ id: schema.organizations.id })
    )[0].id;

  const [created] = await db
    .insert(schema.hubspotConnections)
    .values({
      organizationId: orgId,
      hubPortalId: portalId,
      hubDomain: info.hub_domain ?? null,
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      expiresAt,
      scopes,
      status: "active",
    })
    .returning();
  return created;
}

const EXPIRY_BUFFER_MS = 60_000; // refresh 1 min before expiry

/**
 * Returns a valid access token for a connection, transparently refreshing (and
 * re-persisting the encrypted tokens) when the current one is near expiry.
 */
export async function getValidAccessToken(connection: HubspotConnection): Promise<string> {
  const stillValid = connection.expiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now();
  if (stillValid) {
    return decryptSecret(connection.accessTokenEnc);
  }

  const { clientId, clientSecret } = getHubspotEnv();
  const refreshToken = decryptSecret(connection.refreshTokenEnc);
  const tokens = await postTokenRequest({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await db
    .update(schema.hubspotConnections)
    .set({
      accessTokenEnc: encryptSecret(tokens.access_token),
      // HubSpot may rotate the refresh token; persist whatever it returns.
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.hubspotConnections.id, connection.id));

  return tokens.access_token;
}
