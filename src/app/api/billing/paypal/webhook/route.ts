import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { verifyWebhookSignature, type PaypalWebhookEvent } from "@/lib/billing/paypal/client";
import { syncPaypalSubscription } from "@/lib/billing/paypal/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayPal webhook receiver. Verifies the event via PayPal's
 * verify-webhook-signature endpoint over the RAW body, then drives subscription
 * lifecycle into the local model. Idempotent: each PayPal event id is claimed in
 * `billing_events` (the `stripe_event_id` column is reused as a generic event id)
 * before processing.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  let verified = false;
  try {
    verified = await verifyWebhookSignature({ headers: req.headers, rawBody });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
  if (!verified) {
    return NextResponse.json({ ok: false, error: "signature_verification_failed" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as PaypalWebhookEvent;

  // Idempotency gate (reuse billing_events; stripe_event_id holds the event id).
  const claimed = await db
    .insert(schema.billingEvents)
    .values({ stripeEventId: event.id, type: event.event_type, status: "processed" })
    .onConflictDoNothing({ target: schema.billingEvents.stripeEventId })
    .returning({ id: schema.billingEvents.id });
  if (claimed.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await handleEvent(event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    await db
      .update(schema.billingEvents)
      .set({ status: "error", error: (err as Error).message.slice(0, 500) })
      .where(eq(schema.billingEvents.stripeEventId, event.id))
      .catch(() => {});
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

async function handleEvent(event: PaypalWebhookEvent): Promise<void> {
  const type = event.event_type;
  const resource = event.resource;
  if (type.startsWith("BILLING.SUBSCRIPTION.")) {
    // resource is the subscription object; its id is authoritative.
    const subId = resource.id as string | undefined;
    if (subId) await syncPaypalSubscription(subId);
    return;
  }
  if (type === "PAYMENT.SALE.COMPLETED") {
    // A recurring charge — refresh the subscription so currentPeriodEnd advances.
    const subId = resource.billing_agreement_id as string | undefined;
    if (subId) await syncPaypalSubscription(subId);
    return;
  }
  // Other event types are acked (already recorded).
}
