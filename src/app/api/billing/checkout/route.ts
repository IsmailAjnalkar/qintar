import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { authorizeBillingOrg } from "@/lib/billing/auth";
import { getAppUrl, getStripePriceId } from "@/lib/billing/config";
import { isPlanKey } from "@/lib/billing/plans";
import { getOrCreateStripeCustomer } from "@/lib/billing/service";
import { createCheckoutSession } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a Stripe Checkout session for the signed-in org + a plan; returns the
 * hosted URL.
 *
 * Body: { plan: "starter"|"team"|"scale", email?: string }
 *
 * Auth: the authenticated session (org taken from the session, not the body).
 * Server-to-server callers may instead present BILLING_ADMIN_SECRET and name
 * `organizationId` in the body. See lib/billing/auth.ts.
 */
export async function POST(req: Request) {
  let payload: { organizationId?: string; plan?: string; email?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const auth = authorizeBillingOrg(req, payload.organizationId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const organizationId = auth.organizationId;

  const { plan, email } = payload;
  if (!isPlanKey(plan)) {
    return NextResponse.json(
      { ok: false, error: "a valid plan (starter|team|scale) is required" },
      { status: 400 },
    );
  }

  const orgs = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);
  if (orgs.length === 0) {
    return NextResponse.json({ ok: false, error: "organization_not_found" }, { status: 404 });
  }

  try {
    const priceId = getStripePriceId(plan);
    const { customerId } = await getOrCreateStripeCustomer(orgs[0], email);
    const base = getAppUrl();
    const session = await createCheckoutSession({
      customerId,
      priceId,
      organizationId,
      plan,
      successUrl: `${base}/onboarding/done?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/onboarding/plan?canceled=1`,
    });
    return NextResponse.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
