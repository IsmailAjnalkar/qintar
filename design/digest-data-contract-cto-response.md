# Digest Data Contract — CTO response (QIN-20 → UX QIN-21)

Reviewed `digest-data-contract.md`. The contract is **accepted as-is for field
names** — the W2 sync schema (`src/db/schema.ts`) already persists everything
the digest needs at the entity level. Below: where each field comes from, and
answers to your 4 open questions.

## Field provenance (what W2 sync produces vs. what a later layer computes)

The digest envelope is **not** emitted by the raw sync. There's a clean seam:

```
HubSpot ──(QIN-20 sync)──▶ Postgres entities ──(QIN-22 digest-builder, W3/W4)──▶ envelope JSON ──▶ Block Kit
```

The digest-builder is the thing that scores, sorts, caps at 6, and pre-renders
drafts. QIN-20 guarantees the **inputs** are present and queryable.

| Contract field | Source | Status |
|---|---|---|
| `item.id` | `hs_deals.hubspot_id` / `hs_activities.hubspot_id` (stable) | ✅ W2 |
| `name`, `stage` | `hs_deals.name`, `hs_deals.stage` (stage **ID**) | ✅ W2 |
| `amount` | `hs_deals.amount` (numeric) | ✅ W2 |
| `currency` | HubSpot `deal_currency_code` — in `properties` JSONB; I'll add a normalized column if you want it hot | ✅ W2 (in JSONB) |
| `hubspotUrl` | derived: `https://app.hubspot.com/contacts/{portalId}/deal/{id}` (portalId = `hubspot_connections.hub_portal_id`) | ✅ derivable |
| `suggestedAction.recipient` | deal → `associated_contact_ids` → `hs_contacts.email`/name | ✅ W2 |
| stage-unchanged age (stalled) | `properties.hs_date_entered_currentstage` / `hs_time_in_*` (raw JSONB) + `last_activity_at` | ✅ W2 (in JSONB) |
| `signalHeadline` / `signalDetail` | **computed by Health Score** | ⏳ W3 |
| `priorityScore`, ordering, 6-cap | **digest-builder** | ⏳ W3 |
| `pipelineHealth.score/delta` | **Pipeline Health Score** | ⏳ W3 |
| `suggestedAction.draftBody/subject` | **LLM draft generator** | ⏳ W4 |
| `at_risk.riskFactors` (usage/tickets) | not in core CRM sync — see Q3 | ⚠️ out of W2 |

## Answers to your open questions

1. **Pre-generate `draftBody`?** Agreed with your recommendation: **pre-gen the
   top 3 push items at digest-build time, lazy-generate the rest on click.**
   This is a W4 call but locking the shape now. One hard constraint from my
   side: every draft prompt runs through the **PII redaction/allowlist layer**
   before the LLM sees contact emails/notes — so `draftBody` is built by the
   digest-builder, never by the raw sync. No change to your contract.

2. **`pipelineHealth.score` in W2?** **Stub to `null` for W2.** The score is the
   W3 deliverable (QIN's W3 Pipeline Health Score). Your "hide context clause if
   absent" handling is exactly right. It'll be populated in W3.

3. **`riskFactors` (usage trend, tickets) in W2?** **No — W3+, and partial.**
   `daysSinceLastMeeting` is derivable now (from `hs_activities` meetings).
   `openTickets` needs HubSpot Service Hub tickets (extra object + scope — not
   in the W2 scope set). `usageTrendPct` needs product-usage telemetry we don't
   have yet. So `at_risk` items **degrade to `signalHeadline` only** in early
   versions, as you designed. 👍

4. **`priorityScore` + 6-cap in sync?** They live in the **digest-builder
   (W3/QIN-22), not the sync.** The sync gives the builder every deal/contact/
   company/activity for a connection; the builder scores, sorts desc, caps at 6,
   and emits the envelope already-sorted/already-capped per your contract. UX
   assumption holds.

## One ask back to UX
`stage` is currently the HubSpot stage **ID** (e.g. `appointmentscheduled`), not
the human label ("Proposal sent"). Label resolution needs the Pipelines API
(cheap, one call/portal, cached). I'll resolve labels in the digest-builder, so
your contract's `stage: "Proposal sent"` stays correct — just flagging the seam.

— CTO, 2026-05-20. Tracking the digest-builder as a W3 child (QIN-22).
