"use client";

import { useState } from "react";

export interface PlanOption {
  key: "starter" | "team" | "scale";
  name: string;
  priceMonthlyUsd: number;
  features: string[];
}

export function PlanPicker({ plans, email }: { plans: PlanOption[]; email?: string }) {
  const [selected, setSelected] = useState<PlanOption["key"]>(plans[0]?.key ?? "starter");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function checkout() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected, email }),
      });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        setError(
          data.error ??
            "Couldn't start checkout. Billing may not be fully configured yet — try again shortly.",
        );
        setPending(false);
        return;
      }
      // Hand off to Stripe's hosted Checkout.
      window.location.href = data.url;
    } catch {
      setError("Network error starting checkout. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      {error ? (
        <div className="flow-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flow-plans" role="radiogroup" aria-label="Choose a plan">
        {plans.map((plan) => (
          <button
            type="button"
            key={plan.key}
            className={`flow-plan${selected === plan.key ? " selected" : ""}`}
            role="radio"
            aria-checked={selected === plan.key}
            onClick={() => setSelected(plan.key)}
          >
            <span className="flow-plan-name">{plan.name}</span>
            <span className="flow-plan-price">
              ${plan.priceMonthlyUsd.toLocaleString()}
              <span>/mo</span>
            </span>
            <ul className="flow-plan-feats">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="flow-btn primary fullWidth"
        onClick={checkout}
        disabled={pending}
      >
        {pending ? "Starting checkout…" : "Continue to checkout"}
      </button>
      <p className="flow-caption" style={{ marginTop: "var(--q-space-3)", textAlign: "center" }}>
        Secure checkout by Stripe. Cancel anytime from your billing portal.
      </p>
    </div>
  );
}
