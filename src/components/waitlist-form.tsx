"use client";

import { CircleCheck } from "lucide-react";
import posthog from "posthog-js";
import { useActionState, useEffect, useId, useRef } from "react";

import { submitWaitlistAction, type WaitlistFormState } from "@/app/actions/waitlist";

const INITIAL: WaitlistFormState = { status: "idle" };

type Variant = "default" | "inverse";

export function WaitlistForm({
  source,
  variant = "default",
  ctaLabel = "Join waitlist",
  placeholder = "you@company.com",
}: {
  source: string;
  variant?: Variant;
  ctaLabel?: string;
  placeholder?: string;
}) {
  const [state, formAction, isPending] = useActionState(submitWaitlistAction, INITIAL);
  const inputId = useId();
  const errorId = useId();
  const referrerRef = useRef<HTMLInputElement | null>(null);

  // Fill referrer client-side (server-side document.referrer isn't available).
  useEffect(() => {
    if (referrerRef.current && typeof document !== "undefined") {
      referrerRef.current.value = document.referrer;
    }
  }, []);

  // Mirror submit lifecycle to PostHog.
  useEffect(() => {
    if (state.status === "success") {
      try {
        posthog.capture?.("waitlist_submit_success", { source, isNew: state.isNew });
      } catch {
        /* noop */
      }
    } else if (state.status === "error") {
      try {
        posthog.capture?.("waitlist_submit_error", { source, message: state.message });
      } catch {
        /* noop */
      }
    }
  }, [state, source]);

  if (state.status === "success") {
    return (
      <div
        className="q-form-success"
        role="status"
        aria-live="polite"
        data-source={source}
      >
        <CircleCheck size={20} aria-hidden className="q-form-success__icon" />
        <div>
          <p className="q-form-success__title">
            {state.isNew ? "You're on the list." : "You're already on the list."}
          </p>
          <p className="q-form-success__body">
            {state.isNew
              ? "Check your inbox for confirmation. We'll email you when private beta opens."
              : "We've still got you. We'll be in touch when private beta opens."}
          </p>
        </div>
      </div>
    );
  }

  const hasError = state.status === "error";
  const formClass = variant === "inverse" ? "q-cta-band__form" : "q-form";

  return (
    <form
      action={formAction}
      className={formClass}
      noValidate
      onSubmit={() => {
        try {
          posthog.capture?.("waitlist_submit_attempt", { source });
        } catch {
          /* noop */
        }
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Work email
      </label>
      <input
        id={inputId}
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder={placeholder}
        disabled={isPending}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={variant === "inverse" ? undefined : "q-input"}
        style={variant === "inverse" ? undefined : { flex: "1 1 280px", minWidth: 0, height: 48 }}
      />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="referrer" ref={referrerRef} defaultValue="" />
      <button
        type="submit"
        disabled={isPending}
        className="q-btn q-btn--primary q-btn--lg"
        aria-disabled={isPending}
      >
        {isPending ? "Joining…" : ctaLabel}
      </button>
      {hasError ? (
        <p
          id={errorId}
          role="alert"
          className={variant === "inverse" ? "q-cta-band__error" : "q-form__error"}
          style={{ flexBasis: "100%" }}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
