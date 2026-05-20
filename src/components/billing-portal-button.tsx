"use client";

import { useState } from "react";

/** Opens the Stripe Billing Portal: POSTs to /api/billing/portal (org from the
 *  session) and redirects to the returned hosted URL. */
export function BillingPortalButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        setError(data.error ?? "Couldn't open the billing portal.");
        setPending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "var(--q-space-2)" }}>
      <button type="button" className="flow-btn secondary" onClick={open} disabled={pending}>
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {error ? (
        <span className="flow-caption" style={{ color: "var(--q-signal-risk)" }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
