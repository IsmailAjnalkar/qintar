# Qintar — Brand Kit v0.2

**Owner:** UXDesigner · **Status:** v0.2 — wordmark assets converted to font-independent paths (QIN-8). Voice aligned to [CMO Brand Voice & Tone Guide v1, revision 3](/QIN/issues/QIN-3#document-brand-voice).

---

## 1. Brand essence

**Qintar is the AI Pipeline Coach for B2B sales teams on HubSpot.** A daily ritual — open Slack, scan a digest, take three actions. Pipeline review goes from a Monday slog to a 60-second habit.

The brand must signal: **serious revenue tool, not a chatbot demo**.

**Personality (CMO Brand Voice & Tone Guide v1 — owns final):**
- **Direct** — say the thing. Lead with the verb or the number. No throat-clearing, no "we believe…".
- **Practical** — every sentence answers "what does this do for me by Friday?". No vision-statement copy.
- **Confident** — we make recommendations because we built this for the people who do it. We don't hedge unless honesty requires it.

**Tone dimensions (NN/g scale, per CMO):** closer to **casual** than formal · mostly **serious**, occasional dry wit · always **respectful** (never punching down at users or competitors by name) · **matter-of-fact**, never enthusiastic-salesy.

**Reference brands for tone:** Linear (clarity), Basecamp (operator voice), Stripe (precision), Notion (warmth without fluff). NOT: Salesforce ("Trailblazer"), generic AI vendors ("revolutionize your workflow").

**Banned words** (do not ship anywhere user-facing): *revolutionize, leverage, synergy, empower, transform, AI-powered¹, unlock, supercharge, game-changer, paradigm, journey, seamless, world-class.* ¹ "AI" is fine when it describes a specific behavior ("AI-drafted email"); never as a vibe.

---

## 2. Wordmark

### Primary lockup
`qintar` — lowercase, set in **Geist Semibold** at `tracking-tight (-0.02em)`. The dot above the `i` is replaced with a 4px square indigo token, set 1px lower than the natural dot baseline. The square is the "signal dot" — a recurring brand element that appears in the UI on at-risk/urgent items.

```
q i n t a r
    ▪
```

- Minimum size: 88px wide (digital), 24mm (print)
- Clear space: at least 0.5× the cap height on all sides
- Always lowercase. Never use all caps as the wordmark.

### Monogram
`q.` — used as favicon, app icon, and small contexts (<24px). The terminal period is the same indigo signal square.

### Don't
- Don't recolor the wordmark outside the approved palette.
- Don't outline it.
- Don't apply gradients, drop shadows, or 3D effects.
- Don't pair with another sans-serif logo (e.g., "qintar | HubSpot"). Use the brand on its own.

---

## 3. Color

Full token definitions live in `design/tokens.json`. Brand-level summary:

| Role | Token | Hex | Use |
|---|---|---|---|
| Primary | `accent` / `indigo-500` | `#3B40E0` | Brand actions, links, focus ring, wordmark dot |
| Primary hover | `accent.hover` / `indigo-600` | `#2E2FB8` | Hover state |
| Primary active | `accent.active` / `indigo-700` | `#252595` | Pressed state |
| Brand dark | `ink-0` | `#0B0F1E` | Footer, code, dark surfaces |
| Body text | `text` / `ink-1` | `#111634` | Primary copy |
| Page bg | `bg` / `ink-10` | `#FFFFFF` | Light surfaces |
| Urgent (push today) | `signal.urgent` / `amber-400` | `#F5A800` | Time-sensitive items, "push today" |
| Positive (healthy) | `signal.positive` / `mint-500` | `#0D9D66` | Closed/healthy deals |
| Risk (at-risk) | `signal.risk` / `coral-500` | `#C92A2A` | Stalled, at-risk |

### Accessibility checks (WCAG AA, 4.5:1 for body, 3:1 for large)
- `text` on `bg`: ~16.4:1 — AAA ✓
- `text.muted` on `bg`: ~7.8:1 — AAA ✓
- `accent` on `bg`: ~7.2:1 — AAA (large text and UI) ✓
- White on `accent`: ~7.2:1 — AAA ✓
- White on `signal.risk`: ~5.5:1 — AA ✓
- White on `signal.urgent` (amber-400): ~2.5:1 — **FAILS**. Always pair amber with `ink-0` text on amber surfaces, never white.
- White on `signal.positive` (mint-500): ~3.6:1 — passes for large text only. Body text on mint must use `ink-0`.

**Color-independence rule:** never encode signal solely in color. Always pair with an icon + a label ("Urgent · 2 deals", "At risk · 1 customer").

### Iconography color
Default stroke: `ink-3` for body, `ink-1` for emphasis, `accent` for brand-only. Filled treatment reserved for signal pills.

---

## 4. Typography

**Two faces. That's the whole system.**

### Display — Geist
`'Geist', 'Inter', system-ui, sans-serif`
- Weights used: **600 Semibold** (primary), 700 Bold (rare, hero only)
- Optical: tight tracking on display sizes; slightly looser on headings
- Why Geist: free, modern, technical, was built for product UIs; signals "serious tool." Available on Google Fonts and Vercel CDN.
- Fallback: Inter is metric-similar enough that swap doesn't break layout.

### Body — Inter
`'Inter', system-ui, sans-serif`
- Weights used: **400 Regular** (body), **500 Medium** (labels, emphasis), 600 Semibold (link emphasis only)
- Why Inter: top-tier screen readability, dense glyph coverage, free.

### Utility — JetBrains Mono
`'JetBrains Mono', ui-monospace, monospace`
- Used **only** for numeric data in tables (deal $ amounts, scores), code blocks, and the API/data feel in marketing. Never for body or headings.

### Scale (see `design/tokens.json` → `type.scale`)
| Token | Size / lh / weight | Use |
|---|---|---|
| `display.xl` | 72 / 1.1 / 600 | Landing hero h1 (desktop only) |
| `display.lg` | 56 / 1.1 / 600 | Landing hero h1 (responsive) |
| `display.md` | 44 / 1.1 / 600 | Section title (mobile hero, desktop h2) |
| `heading.lg` | 36 / 1.25 / 600 | h2 |
| `heading.md` | 30 / 1.25 / 600 | h3 |
| `heading.sm` | 24 / 1.25 / 600 | h4, card title |
| `body.lg` | 20 / 1.65 / 400 | Lead paragraph |
| `body.md` | 16 / 1.5 / 400 | Body default |
| `body.sm` | 14 / 1.5 / 400 | Compact, table cell |
| `label` | 14 / 1.25 / 500 | Form label, button |
| `eyebrow` | 12 / 1.25 / 600 / 0.08em | Section kicker, status pill |
| `caption` | 12 / 1.5 / 400 | Footnote, helper text |

**Rule:** never set a font size outside the scale. Never use `font-style: italic` for emphasis in product UI (reserved for landing-page editorial flourishes only).

---

## 5. Iconography direction

**Style: outline, 1.5px stroke, 24px grid, rounded line caps + joins.** Inspired by Lucide / Phosphor (regular). We will use **Lucide** as the source library — MIT-licensed, free, comprehensive, matches the calm-technical tone.

Custom icons (the few we will need):
1. **Signal dot** — the brand element. Solid 4px or 8px square, indigo-500.
2. **Pipeline ring** — a circle with a notch indicating health percentage. Used in the Score card.
3. **Push arrow** — right arrow with a small triangle inset, used on the "Push today" pill.

**Rules:**
- Always 1.5px stroke at 24px. Scales by 2× at 48px (3px stroke), etc.
- Never mix outline + filled icons in the same row.
- Use filled icons only inside colored signal pills (white icon, colored bg).
- Don't apply gradients to icons.

---

## 6. Motion principles

- **Purposeful only.** No animation without a reason. We never spin/slide things just because we can.
- **Doherty Threshold:** any user-initiated transition must complete < 400ms or show a skeleton. Default to `--q-duration-short` (200ms).
- **Easing:** default `--q-ease-standard` (cubic-bezier(0.2, 0.8, 0.2, 1)). Use `--q-ease-spring` only for affirmative confirmations (toast in, checkmark draw).
- **Reduced motion:** honor `prefers-reduced-motion: reduce` — tokens already drop to 0ms; do not animate transforms larger than 4px even at reduced.

---

## 7. Imagery & illustration direction

**No stock photography.** Replace what would be a stock photo with one of:
1. **Product surface screenshots** — clean, lifelike Slack digests and dashboard views. These are the hero illustrations.
2. **Geometric line illustrations** — built from the icon stroke + the brand signal dot. One color (indigo-500) + one neutral (ink-3). Used for the "how it works" 3-step section.
3. **Tasteful gradient backgrounds** — a single radial from `indigo-100` at 0% to `bg` at 70%, used sparingly behind the hero.

**Never:**
- 3D robots, humanoid AI avatars, sparkles, "magic wand" tropes.
- Stock images of people in headsets pointing at laptops.
- Background office photography.

---

## 8. Voice (aligned to CMO Brand Voice & Tone Guide v1)

The CMO guide is the canonical source for voice. This section is the working table designers and engineers reach for at write time. If the CMO doc and this section disagree, the CMO doc wins.

### 8.1 Rules of the road (verbatim from CMO doc)

1. **Lead with the verb or the number.** "Cut pipeline review from 45 min to 60 sec." Not "We help sales teams be more efficient."
2. **Speak in second person.** "You see your top three deals."
3. **No buzzwords.** Banned list above.
4. **Numbers over adjectives.** "60-second daily ritual" > "fast and easy".
5. **Name the trade-off.** When we don't do something (Salesforce, mobile, forecasting), say so. Honesty is a moat.
6. **One idea per sentence.** Split when you reach for a semicolon.
7. **Active voice.** "Qintar drafts the email." Not "The email is drafted by Qintar."
8. **No exclamation marks** except product success states (one max).
9. **Capitalize sentences, not features.** "pipeline health score" in body copy, "Pipeline Health Score" only in product UI labels.
10. **No emoji in marketing copy.** Product Slack messages: sparingly, ✅ ⚠️ 🔥 only, one per message max.

### 8.2 ✅ / ❌ by surface

**Landing page**
| ✅ On brand | ❌ Off brand |
|---|---|
| "Stop running pipeline reviews. Start reading them at 9:01am." | "Revolutionize your sales process with AI." |
| "Connect HubSpot in 90 seconds. Get your first digest tomorrow morning." | "Empower your team with cutting-edge AI to unlock their full potential." |
| "For sales teams of 3–25 reps on HubSpot." | "For modern sales organizations." |
| "Built by people who ran a sales team. Not by AI hypebeasts." | "Built on advanced large language models." |

**Product Slack messages**
| ✅ On brand | ❌ Off brand |
|---|---|
| "Morning Maya. 3 deals to push, 2 stalled, 1 at-risk. 60 seconds 👇" | "Good morning! ✨ Your AI-powered pipeline insights are ready ✨" |
| "Acme Co. (Series B fintech) — no contact in 11 days. Demo was Apr 30. Suggest: send the proposal you drafted." | "We've detected reduced engagement signals for this opportunity." |
| "Heads up: pipeline coverage dropped to 2.4×. You typically close at 3.1×." | "Your pipeline metrics indicate concerning trends." |

**Error states**
| ✅ On brand | ❌ Off brand |
|---|---|
| "HubSpot auth expired. Reconnect in 10 seconds." | "Oops! Something went wrong 😕" |
| "We couldn't send that email. Gmail returned: \"recipient address rejected\". Try a different address or fix and retry." | "An unknown error occurred. Please try again later." |
| "Slack workspace not connected. Connect now or skip — we'll email digests instead." | "Configuration incomplete. Please complete setup." |

**Empty states**
| ✅ On brand | ❌ Off brand |
|---|---|
| "No urgent deals. Pipeline is clean today." | "Wow, such empty. Much pipeline!" |
| "No stalled deals this week. Coverage stayed above 3×." | "Looks like you're all caught up! 🎉" |

**CTA verbs (CMO order of preference):** Connect HubSpot · Start free trial · See a sample digest · Talk to a human.
**Avoid:** Get started · Learn more · Sign up now.

### 8.3 Voice patterns (formulas you can paste from)

**Headline formula:** `[Outcome verb] [pain noun]. [Friction-free contrast].`
- "Stop running pipeline reviews. Start reading them."
- "Cut deal slip in half. Without another dashboard."
- "Pipeline health, in Slack, by 9:01."

**Subhead formula:** Plain-English explanation of *what it does*, naming the integration.
- "Qintar reads your HubSpot pipeline every night and sends each rep their three deals to push, stalled deals to revive, and at-risk customers to call. With one-click email drafts."

**Default tone:** declarative, matter-of-fact, specific. Lead with the noun and the number.

---

## 9. Don'ts (the dark-pattern guardrail)

- No fake urgency ("3 spots left!") on the waitlist.
- No confirmshaming ("No thanks, I don't want better deals").
- No pre-checked opt-ins.
- No hidden unsubscribe paths in lifecycle email.
- No social-proof fabrication — placeholder logos must be labeled as such in W1.

---

## 10. Where things live

| Artifact | Path |
|---|---|
| Design tokens (canonical) | `design/tokens.json` |
| CSS variables | `design/tokens.css` |
| Component specs | `design/components.md` |
| Landing page mockup | `design/landing-page.html` |
| Slack digest mock | `design/slack-digest.html` |
| Component showcase | `design/showcase.html` |
| Wordmark SVG | `design/assets/wordmark.svg` |
| Wordmark inverse SVG | `design/assets/wordmark-inverse.svg` |
| Favicon SVG | `design/assets/favicon.svg` |
| This brand kit | `design/brand-kit.md` |

> **Font independence (v0.2):** All three wordmark assets (`wordmark.svg`, `wordmark-inverse.svg`, `favicon.svg`) have had their `<text>` elements converted to outlined `<path>` data using Geist SemiBold 48px with -0.02em letter-spacing. The dotless-i glyph is used so the natural tittle does not conflict with the indigo signal dot. These assets now render identically in email clients, offline contexts, and any environment without Geist installed.

Handoff to CTO (QIN-2): import `design/tokens.css` once in the global stylesheet. Mirror semantic class patterns from `design/landing-page.html`. Component spec details + accessibility requirements are in `design/components.md`.
