import { eq } from "drizzle-orm";
import Link from "next/link";

import { db, schema } from "@/db/client";
import { requireSession } from "@/lib/auth/server";
import { getEntitlements } from "@/lib/billing/service";
import { BillingPortalButton } from "@/components/billing-portal-button";

import "../flow.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession("/dashboard");
  const [ent, connection] = await Promise.all([
    getEntitlements(session.oid).catch(() => null),
    db
      .select({ hubDomain: schema.hubspotConnections.hubDomain, portalId: schema.hubspotConnections.hubPortalId })
      .from(schema.hubspotConnections)
      .where(eq(schema.hubspotConnections.organizationId, session.oid))
      .limit(1)
      .then((r) => r[0] ?? null)
      .catch(() => null),
  ]);

  const active = ent?.active ?? false;
  const planName = ent?.plan ? ent.plan.charAt(0).toUpperCase() + ent.plan.slice(1) : null;

  return (
    <main className="flow-page">
      <Link href="/" className="flow-wordmark">
        Qintar
      </Link>
      <div className="flow-card wide">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--q-space-4)" }}>
          <h1 className="flow-title" style={{ margin: 0 }}>
            Your pipeline
          </h1>
          <span className={`flow-pill ${active ? "active" : "inactive"}`}>
            {active ? `● ${planName ?? "Active"}` : "◌ No active plan"}
          </span>
        </div>
        <p className="flow-subtitle">Signed in as {session.email}.</p>

        {/* Graceful paywall: no 500, just a route back into the flow. */}
        {active ? (
          <div
            style={{
              border: "1px solid var(--q-border)",
              borderRadius: "var(--q-radius-lg)",
              padding: "var(--q-space-6)",
              background: "var(--q-bg-subtle)",
            }}
          >
            <h2 style={{ fontSize: 16, margin: "0 0 var(--q-space-2)" }}>Today&apos;s digest</h2>
            <p className="flow-caption">
              {connection
                ? `Connected to ${connection.hubDomain ?? `portal ${connection.portalId}`}. Your daily digest is being assembled from your live pipeline.`
                : "Connect HubSpot to start building your digest."}
            </p>
            {!connection ? (
              <a href="/api/hubspot/install" className="flow-btn primary" style={{ marginTop: "var(--q-space-4)" }}>
                Connect HubSpot
              </a>
            ) : null}
          </div>
        ) : (
          <div className="flow-error" role="status" style={{ background: "var(--q-signal-urgent-bg)", color: "var(--q-signal-urgent)" }}>
            Your workspace doesn&apos;t have an active subscription yet. Pick a plan to unlock your
            daily digest and Pipeline Health Score.
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--q-space-3)", marginTop: "var(--q-space-6)", flexWrap: "wrap" }}>
          {!active ? (
            <Link href="/onboarding/plan" className="flow-btn primary">
              Choose a plan
            </Link>
          ) : (
            <BillingPortalButton />
          )}
          <a href="/api/auth/signout" className="flow-btn ghost">
            Sign out
          </a>
        </div>
      </div>
    </main>
  );
}
