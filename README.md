# Qintar — web

AI Pipeline Coach for HubSpot. This repo is the marketing site + waitlist (W1) and will become the full app (W2+).

## Stack

- **App**: Next.js 15 (App Router) + TypeScript on Vercel
- **Styling**: Design-system CSS — token custom properties + component classes from UXDesigner's QIN-4 system (`src/app/tokens.css` + `src/app/landing.css`), imported once in `layout.tsx`
- **DB**: Neon Postgres + Drizzle ORM
- **Email (waitlist welcome)**: Resend
- **Analytics**: PostHog (client + server)
- **CI**: GitHub Actions (lint + typecheck + smoke build)

The stack-decision rationale lives in the QIN-2 issue thread.

## Run locally

Prereqs: Node 20+, a Neon (or any Postgres) database, a Resend account, a PostHog project.

```bash
# 1. Install deps
npm install

# 2. Set env
cp .env.example .env.local
# then fill in DATABASE_URL, RESEND_API_KEY, NEXT_PUBLIC_POSTHOG_KEY, ...

# 3. Generate + apply DB migrations
npm run db:generate   # writes migration files into src/db/migrations
npm run db:migrate    # applies them to the DB at DATABASE_URL

# 4. Dev server
npm run dev
# open http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on `:3000` |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint (Next.js config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate Drizzle migration from schema |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:studio` | Drizzle Studio (DB GUI) |

## Project layout

```
src/
  app/
    actions/waitlist.ts      # Server action — used by the landing-page form
    api/waitlist/route.ts    # POST /api/waitlist — validates, inserts, sends email, captures PostHog
    layout.tsx               # Root layout + fonts + PostHog provider; imports tokens.css + landing.css
    page.tsx                 # Landing page (design-system q-* classes, 1:1 with design/landing-page.html)
    tokens.css               # QIN-4 design tokens (--q-* custom properties)
    landing.css              # QIN-4 component styles (q-nav, q-hero, q-plan, …)
    opengraph-image.tsx      # OG/social card (Edge ImageResponse, 1200×630)
    twitter-image.tsx        # Twitter card
  components/
    waitlist-form.tsx        # Client component; default + inverse variants, toast-on-success
  db/
    client.ts                # Neon HTTP + Drizzle ORM
    schema.ts                # `waitlist` table
    migrate.ts               # Migration runner (used by `npm run db:migrate`)
    migrations/              # Generated SQL (created by `db:generate`)
  lib/
    analytics-server.ts      # PostHog server capture helper
    email.ts                 # Resend wrapper for waitlist welcome
    posthog-provider.tsx     # Client provider + pageview tracker
```

## HubSpot integration (W2 — QIN-20)

The product wedge: connect a HubSpot portal via OAuth and sync deals, contacts,
companies, and activities into Postgres for the W3 Pipeline Health Score.

### Data model (`src/db/schema.ts`)

- `organizations` — tenant anchor (one per connected portal for now).
- `hubspot_connections` — per-portal OAuth tokens (**AES-256-GCM encrypted at
  rest**, `src/lib/crypto.ts`), refresh metadata, last-sync status. Unique on
  `hub_portal_id`, so reconnecting the same portal updates in place.
- `hs_companies` / `hs_contacts` / `hs_deals` / `hs_activities` — synced CRM
  entities. Each keeps the full raw HubSpot `properties` JSONB **plus** the
  normalized columns the Health Score needs. Unique on
  `(connection_id, hubspot_id)` → re-running a sync upserts, never duplicates.
- `sync_runs` — per-run audit log (trigger, mode, counts, errors).

> ⚠️ Activity bodies and contact PII live in these rows. They must pass through
> the redaction/allowlist layer before any LLM prompt (W4) — never log them raw.

### Code

| Path | Role |
|---|---|
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt for tokens; `safeEqual` for secrets |
| `src/lib/hubspot/config.ts` | Endpoints, scopes, property selections |
| `src/lib/hubspot/oauth.ts` | Authorize URL, code exchange, token refresh, connection persistence |
| `src/lib/hubspot/client.ts` | Paginated list + Search API readers (429/5xx backoff) |
| `src/lib/hubspot/sync.ts` | Sync engine: full (list+associations) / incremental (Search by `hs_lastmodifieddate`) |
| `src/app/api/hubspot/install` | `GET` → redirect to HubSpot consent (sets CSRF state cookie) |
| `src/app/api/hubspot/callback` | `GET` → exchange code, persist connection, run initial full sync |
| `src/app/api/hubspot/sync` | `POST` manual / `GET` cron trigger (secret-gated). `vercel.json` runs it every 15 min |
| `src/app/api/hubspot/status` | `GET` → row counts + connection sync status (secret-gated) |

### One-time setup (operator)

1. Create a **HubSpot developer app** at <https://developers.hubspot.com> → Apps.
   On the **Auth** tab, copy the Client ID + Client Secret and add a redirect
   URL of `https://<staging-host>/api/hubspot/callback` (and
   `http://localhost:3000/api/hubspot/callback` for local). Add scopes:
   `crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read`.
2. Create a **HubSpot test account** (developer app → Testing → Create test
   account) and seed a few deals/contacts/companies.
3. Set env vars (locally in `.env.local`, on Vercel in project settings):
   `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`,
   `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`),
   `SYNC_TRIGGER_SECRET` (`openssl rand -hex 32`), and on Vercel `CRON_SECRET`.
4. Apply migrations: `DATABASE_URL=... npm run db:migrate`.

### Verify (acceptance criteria)

```bash
# 1. Connect: open in a browser, approve the HubSpot consent screen.
open https://<staging-host>/api/hubspot/install
#    → callback runs the initial full sync and returns { ok, counts }.

# 2. Confirm data is persisted + queryable:
DATABASE_URL=... npm run db:inspect
#    → row counts per table + connection status.
curl "https://<staging-host>/api/hubspot/status?secret=$SYNC_TRIGGER_SECRET"

# 3. Re-sync is idempotent (updates, no dupes):
curl -X POST "https://<staging-host>/api/hubspot/sync?secret=$SYNC_TRIGGER_SECRET"
#    → re-run db:inspect; counts stay stable, no duplicate rows.
```

## Deploying

The app is built to deploy to Vercel.

1. **Provision external services**
   - Neon Postgres → grab the pooled `DATABASE_URL`.
   - Resend → create API key + verify the sending domain.
   - PostHog → create a project, copy the public key.
2. **Run migrations** against the production database:
   ```bash
   DATABASE_URL=... npm run db:migrate
   ```
3. **Push the repo to GitHub**, import it into Vercel, and set the env vars from `.env.example` in the Vercel project settings. Deploy from this repo — a v0.dev mockup will not have the waitlist server action, DB writes, Resend email, or PostHog wiring.
4. **Disable Deployment Protection** if you need the URL publicly reachable (Vercel → Project → Settings → Deployment Protection → Vercel Authentication → Disabled). Otherwise preview URLs return HTTP 401 to anyone not logged into the Vercel team.
5. **Connect the domain** (`qintar.com`) in Vercel and follow the DNS instructions.
6. **Verify**:
   - Landing page renders publicly at the apex domain (HTTP 200, not 401).
   - Submit the waitlist form with a test email — confirm row in DB + welcome email + PostHog `waitlist_signup` event.

## Brand

UXDesigner's QIN-4 design system is **applied**. Tokens live in `src/app/tokens.css` (the `--q-*` custom properties — colors, spacing, type ramp, radii, shadows, motion) and component styles in `src/app/landing.css`. The landing page is built 1:1 against `design/landing-page.html`; use the `--q-space-*` / `--q-font-size-*` scales for any new styling rather than hard-coded values. Fonts (Geist / Inter / JetBrains Mono) load via a `<link>` in `layout.tsx`.

## License

Proprietary. © Qintar.
