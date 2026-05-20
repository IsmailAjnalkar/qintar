import { eq } from "drizzle-orm";
import { Eye, Plug, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { db, schema } from "@/db/client";
import { getSession } from "@/lib/auth/server";
import { OnboardingStepper } from "@/components/onboarding-stepper";

export const dynamic = "force-dynamic";

async function getConnection(organizationId: string) {
  const rows = await db
    .select({
      portalId: schema.hubspotConnections.hubPortalId,
      hubDomain: schema.hubspotConnections.hubDomain,
      status: schema.hubspotConnections.status,
    })
    .from(schema.hubspotConnections)
    .where(eq(schema.hubspotConnections.organizationId, organizationId))
    .limit(1);
  return rows[0] ?? null;
}

export default async function ConnectPage() {
  const session = await getSession();
  const connection = session ? await getConnection(session.oid).catch(() => null) : null;
  const slackConfigured = Boolean(process.env.SLACK_CLIENT_ID);

  return (
    <>
      <OnboardingStepper current={2} />
      <div className="flow-card">
        <h1 className="flow-title">
          <Plug size={20} style={{ verticalAlign: "-3px", color: "var(--q-accent)" }} /> Connect HubSpot
        </h1>
        <p className="flow-subtitle">
          Qintar reads your pipeline so it can tell you which deals to push, revive, or rescue.
        </p>

        {connection ? (
          <>
            <div className="flow-pill active" style={{ marginBottom: "var(--q-space-4)" }}>
              ✓ Connected{connection.hubDomain ? ` — ${connection.hubDomain}` : ` — portal ${connection.portalId}`}
            </div>
            <p className="flow-caption" style={{ marginBottom: "var(--q-space-6)" }}>
              Your pipeline is syncing. Next, choose a plan to unlock your daily digest.
            </p>
            <Link href="/onboarding/plan" className="flow-btn primary fullWidth">
              Continue to plans
            </Link>
          </>
        ) : (
          <>
            <div className="flow-trust">
              <div className="flow-trust-row">
                <Eye size={20} />
                <div>
                  <div>
                    We <strong>read</strong> deals &amp; contacts — to know what&apos;s worth your attention.
                  </div>
                </div>
              </div>
              <div className="flow-trust-row">
                <ShieldCheck size={20} />
                <div>
                  We <strong>never</strong> write, edit, or delete in HubSpot.
                </div>
              </div>
              <div className="flow-trust-row">
                <RotateCcw size={20} />
                <div>Disconnect anytime — one click, in settings.</div>
              </div>
            </div>

            {/* Server-side redirect kicks off OAuth (sets CSRF state cookie). */}
            <a href="/api/hubspot/install" className="flow-btn primary fullWidth">
              Connect HubSpot
            </a>
          </>
        )}

        <div className="flow-divider">Slack (optional)</div>
        {slackConfigured ? (
          <a href="/api/slack/install" className="flow-btn secondary fullWidth">
            Add to Slack
          </a>
        ) : (
          <p className="flow-caption">
            Slack delivery is coming shortly — you can connect it later from settings. Your first
            digest will be viewable in the app in the meantime.
          </p>
        )}

        <p className="flow-meta">
          <Link className="flow-link" href="/onboarding/plan">
            Skip for now — choose a plan →
          </Link>
        </p>
      </div>
    </>
  );
}
