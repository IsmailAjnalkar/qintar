import { NextResponse } from "next/server";

import { getSessionFromRequest } from "@/lib/auth/session";
import { syncPaypalSubscription } from "@/lib/billing/paypal/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayPal redirects the payer here after they approve the subscription
 * (?subscription_id=…). We fetch the authoritative subscription, persist it, and
 * land the user on the onboarding done page. The webhook is the source of truth;
 * this just gives immediate feedback.
 */
export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in?next=/onboarding/plan", req.url));
  }
  const subscriptionId = new URL(req.url).searchParams.get("subscription_id");
  if (!subscriptionId) {
    return NextResponse.redirect(new URL("/onboarding/plan?error=missing_subscription", req.url));
  }
  try {
    await syncPaypalSubscription(subscriptionId);
  } catch {
    // Non-fatal: the webhook will reconcile. Land the user anyway.
  }
  return NextResponse.redirect(new URL("/onboarding/done?sub=paypal", req.url));
}
