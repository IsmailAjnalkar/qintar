import { getSession } from "@/lib/auth/server";
import { PLAN_KEYS, PLANS } from "@/lib/billing/plans";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { PlanPicker, type PlanOption } from "@/components/plan-picker";

export const dynamic = "force-dynamic";

function planFeatures(key: PlanOption["key"]): string[] {
  const e = PLANS[key].entitlements;
  return [
    `${e.maxConnections} HubSpot ${e.maxConnections === 1 ? "portal" : "portals"}`,
    `${e.maxSeats} seats`,
    `${e.emailDraftsPerMonth.toLocaleString()} email drafts / mo`,
    "Daily Slack digest",
    "Pipeline Health Score",
  ];
}

export default async function PlanPage() {
  const session = await getSession();
  const plans: PlanOption[] = PLAN_KEYS.map((key) => ({
    key,
    name: PLANS[key].name,
    priceMonthlyUsd: PLANS[key].priceMonthlyUsd,
    features: planFeatures(key),
  }));

  return (
    <>
      <OnboardingStepper current={3} />
      <div className="flow-card wide">
        <h1 className="flow-title">Choose your plan</h1>
        <p className="flow-subtitle">
          Start with what fits today — change or cancel anytime from the billing portal.
        </p>
        <PlanPicker plans={plans} email={session?.email} />
      </div>
    </>
  );
}
