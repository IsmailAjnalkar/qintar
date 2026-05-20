import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { getStripeWebhookSecret } from "@/lib/billing/config";
import { upsertSubscriptionFromStripe } from "@/lib/billing/service";
import {
  constructWebhookEvent,
  retrieveSubscription,
  type StripeSubscription,
} from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver — drives subscription lifecycle into the local model.
 *
 * Security: verifies the Stripe signature over the RAW body (read with
 * `req.text()` before any parse). Idempotency: each Stripe event id is INSERTed
 * into `billing_events` first; a duplicate delivery hits the unique constraint
 * and is acked without reprocessing (Stripe delivers at least once).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (err) {
    // 400 tells Stripe the signature/secret is wrong — do not retry-storm us.
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }

  // Idempotency gate: claim this event id, or bail if already handled.
  const claimed = await db
    .insert(schema.billingEvents)
    .values({ stripeEventId: event.id, type: event.type, status: "processed" })
    .onConflictDoNothing({ target: schema.billingEvents.stripeEventId })
    .returning({ id: schema.billingEvents.id });
  if (claimed.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await handleEvent(event.type, event.data.object);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Record the failure and 500 so Stripe retries with backoff.
    await db
      .update(schema.billingEvents)
      .set({ status: "error", error: (err as Error).message.slice(0, 500) })
      .where(eq(schema.billingEvents.stripeEventId, event.id))
      .catch(() => {});
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

async function handleEvent(type: string, object: Record<string, unknown>): Promise<void> {
  switch (type) {
    case "checkout.session.completed": {
      // The session carries the subscription id; fetch the full object so we
      // persist real status/period/price rather than the thin session payload.
      const subscriptionId = object.subscription as string | undefined;
      if (subscriptionId) {
        const sub = await retrieveSubscription(subscriptionId);
        await upsertSubscriptionFromStripe(sub);
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      await upsertSubscriptionFromStripe(object as unknown as StripeSubscription);
      return;
    }
    default:
      // Unhandled types are acked (we already recorded them); add cases as needed.
      return;
  }
}
