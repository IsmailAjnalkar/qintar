import { Fragment } from "react";

const STEPS = ["Account", "Connect", "Plan", "Digest"] as const;

/** 4-node onboarding stepper (design/onboarding-flow.md §2). State conveyed by
 *  icon + text + aria-current, not color alone (WCAG 1.4.1). */
export function OnboardingStepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav className="flow-stepper" aria-label="Onboarding progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <Fragment key={label}>
            {i > 0 ? <span className="flow-step-line" aria-hidden="true" /> : null}
            <span
              className="flow-step"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="flow-step-dot" aria-hidden="true">
                {state === "done" ? "✓" : n}
              </span>
              <span className="flow-step-label">{label}</span>
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}
