import { NextResponse } from "next/server";

import { authorizeBillingOrg } from "@/lib/billing/auth";
import { isPlanKey } from "@/lib/billing/plans";
import { createSubscription } from "@/lib/billing/paypal/client";
import { upsertPaypalSubscription } from "@/lib/billing/paypal/service";
import { getSessionFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a PayPal subscription for the signed-in org + a plan; returns the PayPal
 * payer-approval URL to redirect to. Records a pending subscription row so the
 * webhook/return can map back to the tenant. Body: { plan }.
 */
export async function POST(req: Request) {
  const auth = authorizeBillingOrg(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let payload: { plan?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!isPlanKey(payload.plan)) {
    return NextResponse.json(
      { ok: false, error: "a valid plan (starter|team|scale) is required" },
      { status: 400 },
    );
  }

  try {
    const email = getSessionFromRequest(req)?.email;
    const { subscription, approveUrl } = await createSubscription({
      plan: payload.plan,
      organizationId: auth.organizationId,
      email,
    });
    await upsertPaypalSubscription(subscription); // records the pending row
    if (!approveUrl) {
      return NextResponse.json({ ok: false, error: "no_approval_url" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, url: approveUrl, subscriptionId: subscription.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
