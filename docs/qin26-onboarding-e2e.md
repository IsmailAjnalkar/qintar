# QIN-26 — Live test-mode e2e onboarding verification (runbook)

Follow-up to QIN-25 (`f04baf6`). Tracks the *live* verification of the headline
acceptance: a brand-new user signs up → connects HubSpot → pays via Stripe test
mode → sees their entitlement reflected.

## Status (2026-05-20, CTO)

The DB-side of the flow is **migrated and verified live** against the real
(Supabase) Postgres. The only unverified pieces are the two **external hosted
UIs** that need operator-provisioned credentials.

### ✅ Done / verified live (no operator keys needed)

| Issue step | What | Evidence |
|---|---|---|
| 1 | `npm run db:migrate` applied 0002 (billing) + 0003 (auth). All 12 tables present (`subscriptions`, `billing_events`, `users`, `org_members`). | `migrations applied`; 4 rows in `drizzle.__drizzle_migrations` |
| 1 | `AUTH_SESSION_SECRET` set (local/staging, gitignored `.env.local`). Production value is the operator's Vercel job. | — |
| 2 (data-plane) | Webhook → `upsertSubscriptionFromStripe` flips `subscriptions.status` `incomplete`→`active`, resolves plan, records `stripe_subscription_id`; entitlements go active (dashboard would show **Team**); cancel event revokes; idempotent; unmappable event returns null. | `npm run verify:webhook` — 14/14 PASS |
| 3 | `ENFORCE_ENTITLEMENTS=true` gates a **canceled** org (`requireActiveSubscription` throws `no_subscription`); a **keyless staging** org (no sub row) stays **allowed** — so `/api/hubspot/sync` is unaffected. Plus active/past_due/incomplete edges. | `npm run verify:entitlements` — 17/17 PASS |

Run both: `npm run verify:live` (seeds throwaway orgs, asserts, self-cleans).

These exercise the **real production code paths** (`gateOrganization`,
`getEntitlements`, `requireActiveSubscription`, `upsertSubscriptionFromStripe`)
against the live DB — not mocks. Combined with the offline smokes
(`billing:smoke` 22/22 webhook-signature + plan/entitlement mapping;
`onboarding:smoke` 18/18 password/session/billing-authz), the entire
onboarding **data-plane** is covered.

### ⛔ Operator-gated remainder (blocked on QIN-24 / QIN-20 provisioning)

The only thing left is clicking through the two **hosted third-party UIs**,
which require credentials this build environment does not have:

1. **Stripe hosted Checkout** (card `4242 4242 4242 4242`) — needs
   `STRIPE_SECRET_KEY` (test), `STRIPE_PRICE_STARTER|TEAM|SCALE`,
   `STRIPE_WEBHOOK_SECRET`.
2. **HubSpot OAuth consent screen** — needs `HUBSPOT_CLIENT_ID`,
   `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`, plus `TOKEN_ENCRYPTION_KEY`.

Set these in Vercel (or `.env.local` for a local run) — **do not paste secrets
into Paperclip threads.** Unblock owner: operator / CEO.

## When credentials land — finish the click-through

```bash
# .env.local must have: DATABASE_URL, AUTH_SESSION_SECRET, STRIPE_*, HUBSPOT_*,
# TOKEN_ENCRYPTION_KEY, and ENFORCE_ENTITLEMENTS=true
npm run db:migrate          # idempotent; no-op if already applied
npm run verify:live         # re-confirm the data-plane (should stay green)
npm run dev                 # then drive the browser flow below
```

1. `/sign-up` → create account (creates an `organizations` row + owner `org_members`).
2. `/onboarding` → **Connect HubSpot** (OAuth consent → callback persists an
   encrypted token in `hubspot_connections`).
3. `/onboarding/plan` → pick a plan → **Stripe Checkout** → pay with
   `4242 4242 4242 4242`, any future expiry/CVC.
4. Confirm the webhook flips `subscriptions.status=active` (Stripe CLI:
   `stripe listen --forward-to localhost:3000/api/billing/webhook`, or check the
   row directly).
5. `/dashboard` shows the active plan.
6. Negative path: set the org's subscription to `canceled` (or use Stripe
   Portal to cancel) with `ENFORCE_ENTITLEMENTS=true` → confirm
   `syncAllActiveConnections` skips that org while a keyless staging org
   (no sub row) still syncs.

> A headless variant of steps 1–5 can be scripted with the already-installed
> `playwright` dep once Stripe test keys exist (Checkout is Stripe-hosted, so it
> still needs a real test key — there is no fully-offline substitute for the
> hosted payment page itself).
