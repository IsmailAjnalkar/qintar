/**
 * Minimal PayPal REST client (QIN-24 — PayPal-only rebuild).
 *
 * Dependency-free: raw `fetch`, matching the HubSpot/Stripe pattern. Covers the
 * surface the subscription flow needs — OAuth2 token, create/get/cancel
 * subscription, and webhook signature verification (PayPal verifies server-side
 * via its own endpoint, so no local crypto needed).
 */

import { getAppUrl } from "../config";
import { getPaypalApiBase, getPaypalEnv, getPaypalPlanId, getPaypalWebhookId } from "./config";

let cachedToken: { value: string; expiresAt: number } | null = null;

/** OAuth2 client_credentials token, cached until ~1 min before expiry. */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value;
  }
  const { clientId, clientSecret } = getPaypalEnv();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${getPaypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal token request failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function paypalFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${getPaypalApiBase()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal ${options.method ?? "GET"} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  // 204 No Content (e.g. cancel) returns empty.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface PaypalSubscription {
  id: string;
  status: string;
  plan_id?: string;
  start_time?: string;
  subscriber?: { email_address?: string };
  billing_info?: { next_billing_time?: string };
  links?: Array<{ rel: string; href: string; method: string }>;
  custom_id?: string;
}

/**
 * Create a subscription for a plan and return the PayPal subscription + the
 * payer approval URL the user must be redirected to. `custom_id` carries our
 * organizationId so the webhook/return can map back to a tenant.
 */
export async function createSubscription(params: {
  plan: Parameters<typeof getPaypalPlanId>[0];
  organizationId: string;
  email?: string;
}): Promise<{ subscription: PaypalSubscription; approveUrl: string | null }> {
  const base = getAppUrl();
  const subscription = await paypalFetch<PaypalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      plan_id: getPaypalPlanId(params.plan),
      custom_id: params.organizationId,
      subscriber: params.email ? { email_address: params.email } : undefined,
      application_context: {
        brand_name: "Qintar",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${base}/api/billing/paypal/return`,
        cancel_url: `${base}/onboarding/plan?canceled=1`,
      },
    },
  });
  const approveUrl = subscription.links?.find((l) => l.rel === "approve")?.href ?? null;
  return { subscription, approveUrl };
}

export function getSubscription(subscriptionId: string): Promise<PaypalSubscription> {
  return paypalFetch<PaypalSubscription>(`/v1/billing/subscriptions/${subscriptionId}`);
}

export function cancelSubscription(subscriptionId: string, reason = "Customer requested"): Promise<void> {
  return paypalFetch<void>(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export interface PaypalWebhookEvent {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
}

/**
 * Verify a PayPal webhook by calling PayPal's verify-webhook-signature endpoint
 * with the transmission headers + raw body. Returns true only on
 * verification_status === "SUCCESS". `rawBody` must be the exact bytes received,
 * parsed into an object for the verification request.
 */
export async function verifyWebhookSignature(params: {
  headers: Headers;
  rawBody: string;
}): Promise<boolean> {
  const h = params.headers;
  const payload = {
    transmission_id: h.get("paypal-transmission-id"),
    transmission_time: h.get("paypal-transmission-time"),
    cert_url: h.get("paypal-cert-url"),
    auth_algo: h.get("paypal-auth-algo"),
    transmission_sig: h.get("paypal-transmission-sig"),
    webhook_id: getPaypalWebhookId(),
    webhook_event: JSON.parse(params.rawBody),
  };
  if (!payload.transmission_id || !payload.transmission_sig) return false;
  const res = await paypalFetch<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    { method: "POST", body: payload },
  );
  return res.verification_status === "SUCCESS";
}
