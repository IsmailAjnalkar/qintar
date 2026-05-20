"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Mode = "signup" | "signin";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const emailId = useId();
  const pwId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignup = mode === "signup";
  const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/signin";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      ...(isSignup ? {} : { next }),
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; next?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      router.push(data.next ?? (isSignup ? "/onboarding" : "/dashboard"));
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="flow-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flow-field">
        <label className="flow-label" htmlFor={emailId}>
          Work email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          required
          className="flow-input"
          placeholder="you@company.com"
        />
      </div>

      <div className="flow-field">
        <label className="flow-label" htmlFor={pwId}>
          Password
        </label>
        <input
          id={pwId}
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={8}
          className="flow-input"
          placeholder={isSignup ? "At least 8 characters" : "Your password"}
        />
      </div>

      <button type="submit" className="flow-btn primary fullWidth" disabled={pending}>
        {pending ? "One moment…" : isSignup ? "Create account" : "Sign in"}
      </button>

      {isSignup ? (
        <p className="flow-caption" style={{ marginTop: "var(--q-space-3)", textAlign: "center" }}>
          No credit card. You&apos;re setting up your first digest, not buying anything.
        </p>
      ) : null}
    </form>
  );
}
