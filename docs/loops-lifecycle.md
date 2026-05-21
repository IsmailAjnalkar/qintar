# Loops lifecycle events (PRE-13)

Wires the product → Loops.so so the no-code drip "Loops" (built in the Loops
dashboard by marketing — see `content/email-lifecycle-flows.md` §9) actually
fire. **Loops owns all drip timing/sending; the product's only job is to tell
Loops what happened.** This is a handful of API calls, not a send engine.

> **Product note.** This codebase is **Qintar** (AI Pipeline Coach for HubSpot:
> Stripe `starter`/`team`/`scale` plans, no "mock interview" feature). The
> lifecycle spec was authored for the InterviewAce funnel (free/Pro, mocks), so
> the events are mapped onto Qintar's real surface below. Four of the five fire
> from genuine product events today; the fifth (`upsell_qualified`) has no
> authentic source in Qintar yet and ships as a ready-to-call seam (§Gaps).

## Configuration

| Env var | Purpose |
|---|---|
| `LOOPS_API_KEY` | Bearer token for the Loops API. **Opt-in:** if unset, every Loops call no-ops (`{ ok: true, skipped: true }`) so local/staging/unconfigured envs behave unchanged. |
| `CRON_SECRET` / `SYNC_TRIGGER_SECRET` | Authorize the nightly sweep route (same pattern as the HubSpot sync cron). |

Set `LOOPS_API_KEY` in the Vercel project env (never in code or the issue
thread). Code seam: `src/lib/loops/`.

## Event mapping

| Lifecycle event | Loops call | Fired from | Status |
|---|---|---|---|
| **Free signup** | `POST /contacts/create` `{ email, firstName, plan:"free", source, signupAt }` → **Welcome Loop** | `signUpWithPassword()` (`src/lib/auth/service.ts`) | ✅ wired — meets the PRE-5 acceptance bar |
| **Upgrade** | `POST /events/send` `subscription_started` + `plan→pro` (exits Welcome/Upsell) | Stripe webhook, on transition into access (`src/app/api/billing/webhook/route.ts`) | ✅ wired |
| **Cancel** | `POST /events/send` `subscription_cancelled` → **Winback Loop** | Stripe webhook, on transition to `canceled` | ✅ wired |
| **14d inactive** | `POST /events/send` `went_inactive` → **Re-engagement Loop** | Nightly cron `/api/loops/nightly` → `sweepInactiveContacts()` | ✅ wired |
| **3rd mock / 7th active day** | `POST /events/send` `upsell_qualified` → **Upsell Loop** | `markUpsellQualified(email)` — **not yet called** | ⚠️ seam (see Gaps) |

### How the pieces fit

- **`src/lib/loops/config.ts`** — base URL, key getter, event-name + property vocabulary, 14-day threshold.
- **`src/lib/loops/client.ts`** — `loopsCreateContact` / `loopsUpdateContact` / `loopsSendEvent`. Bearer auth, 429/5xx retry/backoff (mirrors `lib/hubspot/client.ts`). Returns a typed result instead of throwing.
- **`src/lib/loops/lifecycle.ts`** — the functions app code calls (`onFreeSignup`, `onSubscriptionStarted`, `onSubscriptionCancelled`, `markUpsellQualified`, `touchLastActive`, `sweepInactiveContacts`). **All fire-and-forget**: each catches + logs, so a Loops outage never breaks signup, billing, or a cron run. Call with `void`.

### `lastActiveAt` & the inactivity sweep

- `users.last_active_at` (migration `0005_violet_cloak.sql`) is stamped on signup and refreshed by `touchLastActive()` on sign-in. Extend `touchLastActive` to real product usage as features land.
- The nightly job fires `went_inactive` only for users whose `lastActiveAt` falls in the **[now−15d, now−14d)** window — i.e. they crossed 14 days of inactivity in the last 24h. This notifies each user **exactly once** at the threshold (no repeat enrollment) and excludes paying orgs.

## Testing

```bash
# Offline (no key, no DB): event vocab + no-op safety
npm run loops:smoke

# End-to-end seed test against real Loops — fires all 5 calls for a seed contact
LOOPS_LIVE=1 LOOPS_API_KEY=… LOOPS_TEST_EMAIL=you+seed@domain npm run loops:smoke

# Trigger the nightly inactivity sweep manually
curl -X POST "https://app.qintar.com/api/loops/nightly?secret=$SYNC_TRIGGER_SECRET"
```

Definition of done (PRE-13): the five calls fire from the product and the
corresponding Loops flows trigger end-to-end in a seed test. Run the live seed
test above once `LOOPS_API_KEY` is set, then confirm in the Loops dashboard that
each Loop entered the seed contact.

## Gaps / follow-ups

- **`upsell_qualified` has no product source in Qintar.** The spec trigger is
  "3rd completed mock OR 7th active day." Qintar has neither a mock-interview
  feature nor a per-day activity counter. `markUpsellQualified(email)` is built
  and ready — call it from the activity tracker (the one that also feeds
  `lastActiveAt`) or a mock-completion handler once such a signal exists. Until
  then the Upsell Loop simply receives no enrollments.
- **`firstName` is derived from the email** (signup captures a workspace name,
  not a person's name). Pass a real name to `onFreeSignup` if/when collected.
- **Cancel = effective cancellation** (`status: "canceled"`), not
  `cancel_at_period_end` — so we don't winback-email someone still in their paid
  period. Revisit if marketing wants a "scheduled to cancel" nudge instead.
