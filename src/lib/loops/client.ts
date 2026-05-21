/**
 * Loops.so API client (PRE-13) — thin wrapper over the two endpoints the
 * product needs:
 *   - POST /contacts/create   → create/identify a contact (fires Welcome Loop)
 *   - PUT  /contacts/update    → update contact properties (e.g. plan on upgrade)
 *   - POST /events/send        → fire a lifecycle event (Upsell/Re-engagement/Winback)
 *
 * Pattern mirrors lib/hubspot/client.ts: bearer auth, JSON, and a 429/5xx-aware
 * retry with backoff. Every call returns a typed result instead of throwing, so
 * callers can fire-and-forget without try/catch (see lib/loops/lifecycle.ts).
 * When LOOPS_API_KEY is unset the call no-ops with { ok: true, skipped: true }.
 */
import {
  LOOPS_API_BASE,
  getLoopsApiKey,
  type LoopsContactProperties,
  type LoopsEventName,
} from "./config";

export interface LoopsResult {
  ok: boolean;
  /** True when the call was a no-op because LOOPS_API_KEY is unset. */
  skipped?: boolean;
  status?: number;
  /** Loops record id, when the endpoint returns one. */
  id?: string;
  error?: string;
}

/** A 429/5xx-aware POST/PUT against the Loops API. */
async function loopsFetch(path: string, init: RequestInit): Promise<Response> {
  const apiKey = getLoopsApiKey();
  if (!apiKey) throw new Error("LOOPS_API_KEY missing");

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(`${LOOPS_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
  throw new Error("loopsFetch: exhausted retries");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function readResult(res: Response): Promise<LoopsResult> {
  // Loops returns { success: boolean, id?, message? } as JSON.
  let body: { success?: boolean; id?: string; message?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // Non-JSON body (rare); fall back to HTTP status.
  }
  const ok = res.ok && body.success !== false;
  return {
    ok,
    status: res.status,
    id: body.id,
    error: ok ? undefined : body.message ?? `HTTP ${res.status}`,
  };
}

/**
 * Create/identify a contact. Fires the Welcome Loop when the contact is new and
 * matches its "contact created" trigger. Idempotent enough for signup: Loops
 * returns success:false ("already on list") for an existing email — surfaced as
 * ok:false so callers can fall back to update if they care (signup doesn't).
 */
export async function loopsCreateContact(
  email: string,
  props: LoopsContactProperties = {},
): Promise<LoopsResult> {
  if (!getLoopsApiKey()) return { ok: true, skipped: true };
  try {
    const res = await loopsFetch("/contacts/create", {
      method: "POST",
      body: JSON.stringify({ email: normalizeEmail(email), ...props }),
    });
    return await readResult(res);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Update properties on an existing contact (e.g. plan: "pro" on upgrade). */
export async function loopsUpdateContact(
  email: string,
  props: LoopsContactProperties,
): Promise<LoopsResult> {
  if (!getLoopsApiKey()) return { ok: true, skipped: true };
  try {
    const res = await loopsFetch("/contacts/update", {
      method: "PUT",
      body: JSON.stringify({ email: normalizeEmail(email), ...props }),
    });
    return await readResult(res);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Fire a lifecycle event for a contact. `contactProperties` are merged onto the
 * contact in the same call (Loops upserts the contact if it doesn't exist), so
 * an event can carry the latest plan/cancelledAt alongside the trigger.
 */
export async function loopsSendEvent(
  email: string,
  eventName: LoopsEventName,
  contactProperties: LoopsContactProperties = {},
): Promise<LoopsResult> {
  if (!getLoopsApiKey()) return { ok: true, skipped: true };
  try {
    const res = await loopsFetch("/events/send", {
      method: "POST",
      body: JSON.stringify({
        email: normalizeEmail(email),
        eventName,
        ...(Object.keys(contactProperties).length ? { contactProperties } : {}),
      }),
    });
    return await readResult(res);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
