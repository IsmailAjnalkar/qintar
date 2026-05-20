# Qintar Design — W1 deliverables (QIN-4)

Code-resident design system, brand kit, and landing page mockups. Source of truth for everything visual in Qintar v0.1.

## How to view

Open any HTML file directly in a browser. All assets are local; no build step needed.

- `landing-page.html` — full responsive landing page. Resize to ≤768px to see mobile breakpoint.
- `slack-digest.html` — W3 daily digest low-fi mock.
- `showcase.html` — every core component + token swatches in one place.

## What's here

| File | Purpose |
|---|---|
| `tokens.json` | Canonical design tokens (DTCG-flavored). Run a build step or copy into your CSS/TS to consume. |
| `tokens.css` | CSS custom properties — drop-in for any framework. Import once at app root. |
| `brand-kit.md` | 1-page brand identity (wordmark, palette, type, iconography, voice, don'ts). |
| `components.md` | Component API + states + accessibility rules. Source of truth. |
| `landing-page.html` | Desktop (1440×900) + mobile (390×844) responsive mockup. |
| `slack-digest.html` | Daily Slack digest low-fi mock + open W3 questions. |
| `showcase.html` | All components + tokens, single page. |
| `assets/wordmark.svg` | Primary wordmark (light bg). |
| `assets/wordmark-inverse.svg` | Wordmark for dark surfaces. |
| `assets/favicon.svg` | Favicon / app icon (rounded square monogram). |

## Handoff to CTO (QIN-2)

1. Copy `tokens.css` into the Next.js app (e.g., `app/styles/tokens.css`) and import it once in `app/layout.tsx`.
2. Mirror the class names in `landing-page.html` (`.q-btn`, `.q-card`, `.q-section`, etc.) into Tailwind utility groups or CSS modules. Either is fine — pick one and stay consistent.
3. Use **Lucide** for icons (MIT, free, matches the spec).
4. Fonts: load Geist + Inter + JetBrains Mono from Google Fonts (`https://fonts.googleapis.com/css2?...`) — the `<link>` in `landing-page.html` is the exact tag to use.
5. The waitlist form posts to `/waitlist` — wire to whatever Resend / Postgres flow you build.

The landing page HTML uses no JS. Convert to Next.js components freely; spacing / type / color come from tokens and should not change.

## What's open

- **Brand voice doc** (CMO, QIN-3): pending. Voice section in `brand-kit.md` is the designer's v0 read; will be refined when CMO publishes their doc.
- **Final wordmark** (designer, v0.2): the current SVG sets the wordmark in Geist directly. v0.2 will outline it to SVG paths so it survives without the web font.
- **Real social proof logos**: placeholders only until first design partners commit (W5).
