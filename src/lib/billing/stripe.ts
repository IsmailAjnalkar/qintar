/**
 * Minimal Stripe REST client (QIN-24).
 *
 * Deliberately dependency-free: raw `fetch` + `node:crypto`, the same approach
 * the HubSpot integration uses (lib/hubspot/oauth.ts). The surface we need is
 * small and stable — create Checkout/Portal sessions, retrieve a subscription,
 * create a customer, and verify webhook signatures — so the official SDK isn't
 * worth the dependency weight here. (Stack default is "Stripe"; this is a
 * documented implementation choice, not a vendor switch.)
 *
 * Stripe's API is form-encoded with PHP-style bracket notation for nested
 * params, e.g. `line_items[0][price]=…&metadata[organizationId]=…`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { STRIPE_API_BASE, STRIPE_API_VERSION, getStripeSecretKey } from "./config";

type FormValue = string | number | boolean | undefined | null | FormObject | FormArray;
interface FormObject {
  [key: string]: FormValue;
}
type FormArray = FormValue[];

/** Flatten a nested object into Stripe's bracket-notation form pairs. */
function encodeForm(obj: FormObject, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const arrKey = `${fullKey}[${i}]`;
        if (item !== null && typeof item === "object") {
          parts.push(...encodeForm(item as FormObject, arrKey));
        } else if (item !== undefined && item !== null) {
          parts.push(`${encodeURIComponent(arrKey)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(...encodeForm(value, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

async function stripeRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: FormObject; idempotencyKey?: string } = {},
): Promise<T> {
  const { method = "POST", body, idempotencyKey } = options;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getStripeSecretKey()}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  let url = `${STRIPE_API_BASE}${path}`;
  let requestBody: string | undefined;
  if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    requestBody = body ? encodeForm(body).join("&") : "";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  } else if (body) {
    const qs = encodeForm(body).join("&");
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, { method, headers, body: requestBody });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Never echo the request body (it can carry secrets / customer data).
    throw new Error(`Stripe ${method} ${path} failed: ${res.status} ${text.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/* ----------------------------- API object shapes ---------------------------- */
/* Only the fields we actually read are typed; everything else rides in `raw`.  */

export interface StripeCustomer {
  id: string;
  email?: string | null;
  metadata?: Record<string, string>;
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  customer?: string | null;
  subscription?: string | null;
  metadata?: Record<string, string>;
}

export interface StripeBillingPortalSession {
  id: string;
  url: string;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number; // unix seconds
  canceled_at: number | null;
  trial_end: number | null;
  metadata?: Record<string, string>;
  items: {
    data: Array<{
      quantity?: number;
      price: { id: string };
    }>;
  };
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/* -------------------------------- API calls -------------------------------- */

export function createCustomer(params: {
  email?: string;
  name?: string;
  organizationId: string;
}): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>("/customers", {
    body: {
      email: params.email,
      name: params.name,
      metadata: { organizationId: params.organizationId },
    },
    idempotencyKey: `customer:${params.organizationId}`,
  });
}

export function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  organizationId: string;
  plan: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    body: {
      mode: "subscription",
      customer: params.customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      line_items: [{ price: params.priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // Stamp the org on both the session and the resulting subscription so the
      // webhook can always map back to a tenant without a DB round-trip.
      client_reference_id: params.organizationId,
      metadata: { organizationId: params.organizationId, plan: params.plan },
      subscription_data: {
        metadata: { organizationId: params.organizationId, plan: params.plan },
        ...(params.trialDays ? { trial_period_days: params.trialDays } : {}),
      },
    },
  });
}

export function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<StripeBillingPortalSession> {
  return stripeRequest<StripeBillingPortalSession>("/billing_portal/sessions", {
    body: { customer: params.customerId, return_url: params.returnUrl },
  });
}

export function retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(`/subscriptions/${subscriptionId}`, { method: "GET" });
}

/* ----------------------------- webhook verifier ----------------------------- */

/**
 * Verify a Stripe webhook signature and parse the event. Implements the same
 * scheme as `stripe.webhooks.constructEvent`: HMAC-SHA256 over `${t}.${rawBody}`
 * keyed by the endpoint signing secret, compared constant-time against the `v1`
 * signatures, with a replay-tolerance window on the `t` timestamp.
 *
 * `rawBody` MUST be the exact bytes Stripe sent — read it with `req.text()`
 * before any JSON parsing, or verification will fail.
 */
export function constructWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  toleranceSec = 300,
): StripeEvent {
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header");

  const fields = signatureHeader.split(",").map((s) => s.trim());
  const timestamp = fields.find((f) => f.startsWith("t="))?.slice(2);
  const signatures = fields.filter((f) => f.startsWith("v1=")).map((f) => f.slice(3));
  if (!timestamp || signatures.length === 0) {
    throw new Error("Malformed Stripe-Signature header");
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new Error("Invalid signature timestamp");
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) {
    throw new Error("Signature timestamp outside tolerance (possible replay)");
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const match = signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "hex");
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
  if (!match) throw new Error("Signature verification failed");

  return JSON.parse(rawBody) as StripeEvent;
}
