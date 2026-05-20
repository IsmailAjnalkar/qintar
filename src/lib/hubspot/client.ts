import { HUBSPOT_API_BASE } from "./config";

export interface HubspotRecord {
  id: string;
  properties: Record<string, string | null>;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  associations?: Record<
    string,
    { results: Array<{ id: string; type?: string }> }
  >;
}

interface ListResponse {
  results: HubspotRecord[];
  paging?: { next?: { after?: string } };
}

/** A 401/403/429/5xx-aware fetch against the HubSpot API. */
async function hubspotFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    // Back off on rate limit / transient server errors.
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
  // Unreachable, but satisfies the type checker.
  throw new Error("hubspotFetch: exhausted retries");
}

/**
 * Page through a CRM v3 list endpoint, yielding every record. Used for full
 * syncs; supports requesting associations (only the list endpoint returns them).
 */
export async function* listAll(
  accessToken: string,
  objectType: string,
  opts: { properties?: readonly string[]; associations?: readonly string[] } = {},
): AsyncGenerator<HubspotRecord> {
  let after: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "100" });
    if (after) params.set("after", after);
    if (opts.properties?.length) params.set("properties", opts.properties.join(","));
    if (opts.associations?.length) params.set("associations", opts.associations.join(","));

    const res = await hubspotFetch(accessToken, `/crm/v3/objects/${objectType}?${params}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HubSpot list ${objectType} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as ListResponse;
    for (const record of data.results) yield record;
    after = data.paging?.next?.after;
  } while (after);
}

/**
 * Page through the CRM v3 Search endpoint filtered by hs_lastmodifieddate >=
 * `sinceMs`. Used for incremental syncs. NOTE: Search does not return
 * associations — incremental runs refresh entity fields but not association
 * graphs (full sync covers those).
 */
export async function* searchModifiedSince(
  accessToken: string,
  objectType: string,
  sinceMs: number,
  properties: readonly string[],
): AsyncGenerator<HubspotRecord> {
  let after: string | undefined;
  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(sinceMs) },
          ],
        },
      ],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
      properties: [...properties],
      limit: 100,
      ...(after ? { after } : {}),
    };
    const res = await hubspotFetch(accessToken, `/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HubSpot search ${objectType} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as ListResponse;
    for (const record of data.results) yield record;
    after = data.paging?.next?.after;
  } while (after);
}
