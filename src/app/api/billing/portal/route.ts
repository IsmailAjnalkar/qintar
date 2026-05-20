import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { billingAdminAuthorized } from "@/lib/billing/auth";
import { getAppUrl } from "@/lib/billing/config";
import { createBillingPortalSession } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a Stripe Billing Portal session so a customer can manage their
 * subscription (update card, change plan, cancel). Returns the hosted URL.
 *
 * Body: { organizationId: string }
 */
export async function POST(req: Request) {
  if (!billingAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: { organizationId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!payload.organizationId) {
    return NextResponse.json({ ok: false, error: "organizationId is required" }, { status: 400 });
  }

  const rows = await db
    .select({ stripeCustomerId: schema.subscriptions.stripeCustomerId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.organizationId, payload.organizationId))
    .limit(1);
  if (rows.length === 0 || !rows[0].stripeCustomerId) {
    return NextResponse.json({ ok: false, error: "no_stripe_customer" }, { status: 404 });
  }

  try {
    const session = await createBillingPortalSession({
      customerId: rows[0].stripeCustomerId,
      returnUrl: `${getAppUrl()}/settings/billing`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
