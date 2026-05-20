import { NextResponse } from "next/server";

import { billingAdminAuthorized } from "@/lib/billing/auth";
import { getEntitlements } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Report the current subscription + resolved entitlements for an org.
 *
 * GET /api/billing/status?organizationId=<uuid>&secret=<BILLING_ADMIN_SECRET>
 */
export async function GET(req: Request) {
  if (!billingAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const organizationId = new URL(req.url).searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "organizationId is required" }, { status: 400 });
  }

  const result = await getEntitlements(organizationId);
  return NextResponse.json({ ok: true, ...result });
}
