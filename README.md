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
