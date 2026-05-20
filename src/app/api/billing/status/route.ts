import { NextResponse } from "next/server";

import { authorizeBillingOrg } from "@/lib/billing/auth";
import { getEntitlements } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Report the current subscription + resolved entitlements for the signed-in org.
 *
 * GET /api/billing/status
 *   - end users: authenticated session (org from the session)
 *   - server-to-server: ?organizationId=<uuid>&secret=<BILLING_ADMIN_SECRET>
 */
export async function GET(req: Request) {
  const requestedOrgId = new URL(req.url).searchParams.get("organizationId");
  const auth = authorizeBillingOrg(req, requestedOrgId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const result = await getEntitlements(auth.organizationId);
  return NextResponse.json({ ok: true, organizationId: auth.organizationId, ...result });
}
