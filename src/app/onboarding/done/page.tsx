import Link from "next/link";

import { getSession } from "@/lib/auth/server";
import { getEntitlements } from "@/lib/billing/service";
import { OnboardingStepper } from "@/components/onboarding-stepper";

export const dynamic = "force-dynamic";

export default async function OnboardingDonePage() {
  const session = await getSession();
  const ent = session ? await getEntitlements(session.oid).catch(() => null) : null;
  const active = ent?.active ?? false;
  const planName = ent?.plan ? ent.plan.charAt(0).toUpperCase() + ent.plan.slice(1) : null;

  return (
    <>
      <OnboardingStepper current={4} />
      <div className="flow-card">
        {active ? (
          <>
            <h1 className="flow-title">You&apos;re all set ✅</h1>
            <p className="flow-subtitle">
              Your {planName ?? "subscription"} plan is active. Your pipeline digest is ready.
            </p>
            <div className="flow-pill active" style={{ marginBottom: "var(--q-space-6)" }}>
              ● {planName ?? "Active"} — active
            </div>
            <Link href="/dashboard" className="flow-btn primary fullWidth">
              Go to your dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="flow-title">Payment received — activating…</h1>
            <p className="flow-subtitle">
              Stripe is confirming your subscription. This usually takes a few seconds. Refresh to
              check, or head to your dashboard.
            </p>
            <div className="flow-pill inactive" style={{ marginBottom: "var(--q-space-6)" }}>
              ◌ Awaiting confirmation
            </div>
            <Link href="/onboarding/done" className="flow-btn primary fullWidth">
              Refresh status
            </Link>
            <p className="flow-meta">
              <Link className="flow-link" href="/dashboard">
                Go to dashboard →
              </Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
