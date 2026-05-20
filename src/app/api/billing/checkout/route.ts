import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, schema } from "@/db/client";
import { billingAdminAuthorized } from "@/lib/billing/auth";
import { getAppUrl, getStripePriceId } from "@/lib/billing/config";
import { isPlanKey } from "@/lib/billing/plans";
import { getOrCreateStripeCustomer } from "@/lib/billing/service";
import { createCheckoutSession } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a Stripe Checkout session for an org + plan and return its hosted URL.
 *
 * Body: { organizationId: string, plan: "starter"|"team"|"scale", email?: string }
 *
 * Interim auth: BILLING_ADMIN_SECRET (see lib/billing/auth.ts). The onboarding
 * flow will call this server-side once the authenticated session exists.
 */
export async function POST(req: Request) {
  if (!billingAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: { organizationId?: string; plan?: string; email?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { organizationId, plan, email } = payload;
  if (!organizationId || !isPlanKey(plan)) {
    return NextResponse.json(
      { ok: false, error: "organizationId and a valid plan (starter|team|scale) are required" },
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
