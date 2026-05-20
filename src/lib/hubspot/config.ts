/** HubSpot integration configuration & constants (QIN-20). */

export const HUBSPOT_AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
export const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
export const HUBSPOT_API_BASE = "https://api.hubapi.com";

/**
 * Scopes requested at install time. Keep this to the minimum the wedge needs:
 * read access to the four CRM entities we sync. Activity object reads
 * (notes/calls/emails/meetings/tasks) ride on the contacts scope; if a portal
 * lacks them, the sync degrades gracefully (logged, non-fatal).
 *
 * Override via HUBSPOT_SCOPES (space-separated) if a test portal needs more.
 */
export const DEFAULT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
];

export function getScopes(): string {
  const fromEnv = process.env.HUBSPOT_SCOPES?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_SCOPES.join(" ");
}

export interface HubspotEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Reads + validates the OAuth app credentials. Throws a clear, actionable
 * error if the operator hasn't configured them yet (these come from a HubSpot
 * developer app — see README "HubSpot integration").
 */
export function getHubspotEnv(): HubspotEnv {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
  const missing: string[] = [];
  if (!clientId) missing.push("HUBSPOT_CLIENT_ID");
  if (!clientSecret) missing.push("HUBSPOT_CLIENT_SECRET");
  if (!redirectUri) missing.push("HUBSPOT_REDIRECT_URI");
  if (missing.length > 0) {
    throw new Error(
      `HubSpot OAuth is not configured. Missing: ${missing.join(", ")}. ` +
        "Create a HubSpot developer app and set these env vars.",
    );
  }
  return { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri! };
}

/** Per-object property selections we want HubSpot to return for the sync. */
export const PROPERTY_SETS = {
  companies: ["name", "domain", "industry", "hubspot_owner_id", "createdate", "hs_lastmodifieddate"],
  contacts: [
    "email",
    "firstname",
    "lastname",
    "company",
    "lifecyclestage",
    "hubspot_owner_id",
    "createdate",
    "lastmodifieddate",
  ],
  deals: [
    "dealname",
    "amount",
    "pipeline",
    "dealstage",
    "closedate",
    "hubspot_owner_id",
    "hs_is_closed",
    "hs_is_closed_won",
    "hs_lastactivitydate",
    "createdate",
    "hs_lastmodifieddate",
  ],
} as const;

/** Activity object types in the HubSpot CRM v3 API and the title prop each uses. */
export const ACTIVITY_TYPES = [
  { type: "note", object: "notes", titleProp: "hs_note_body" },
  { type: "call", object: "calls", titleProp: "hs_call_title" },
  { type: "email", object: "emails", titleProp: "hs_email_subject" },
  { type: "meeting", object: "meetings", titleProp: "hs_meeting_title" },
  { type: "task", object: "tasks", titleProp: "hs_task_subject" },
] as const;
