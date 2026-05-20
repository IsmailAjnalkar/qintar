import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { authorizeBillingOrg } from "@/lib/billing/auth";
import { getAppUrl } from "@/lib/billing/config";
import { createBillingPortalSession } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a Stripe Billing Portal session so a customer can manage their
 * subscription (update card, change plan, cancel). Returns the hosted URL.
 *
 * Auth: the authenticated session (org taken from the session). Body may be
 * empty; server-to-server callers present BILLING_ADMIN_SECRET + organizationId.
 */
export async function POST(req: Request) {
  let payload: { organizationId?: string } = {};
  try {
    payload = (await req.json()) as { organizationId?: string };
  } catch {
    // Body is optional for session callers — ignore parse errors.
  }

  const auth = authorizeBillingOrg(req, payload.organizationId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const rows = await db
    .select({ stripeCustomerId: schema.subscriptions.stripeCustomerId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.organizationId, auth.organizationId))
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
