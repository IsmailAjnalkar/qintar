# Qintar Design System — Core Components v0.1

**Owner:** UXDesigner · **Status:** v0 spec for W1 · **Consumer:** CTO (QIN-2) implementation

This document is the source of truth for component API, states, and a11y. Visual implementation reference: `design/landing-page.html` and `design/showcase.html`. Tokens: `design/tokens.css`.

Universal rules:
- Every interactive element gets a visible focus ring: `box-shadow: var(--q-shadow-focus)`.
- Every component honors `prefers-reduced-motion`.
- Tap targets: minimum 44×44px on touch (Fitts's Law / WCAG 2.5.5).
- Text contrast: AA minimum, AAA where reasonable (already met by the semantic tokens).

---

## Button

### API
```ts
type ButtonProps = {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  iconLeft?: ReactNode; iconRight?: ReactNode;
  loading?: boolean; disabled?: boolean;
  fullWidth?: boolean;
  as?: 'button' | 'a';  // anchor for nav use
};
```

### Tokens

| Aspect | sm | md (default) | lg |
|---|---|---|---|
| Height | 32px | 40px | 48px |
| Padding-x | `--q-space-3` (12) | `--q-space-4` (16) | `--q-space-6` (24) |
| Font | `label` 14/500 | `label` 14/500 | `body.md` 16/500 |
| Radius | `--q-radius-md` (8) | `--q-radius-md` (8) | `--q-radius-lg` (12) |
| Icon size | 16 | 16 | 20 |
| Gap (icon-text) | `--q-space-2` (8) | `--q-space-2` (8) | `--q-space-2` (8) |

### Variants

| Variant | Bg | Text | Border | Hover bg | Active bg |
|---|---|---|---|---|---|
| primary | `--q-accent` | `--q-text-inverse` | none | `--q-accent-hover` | `--q-accent-active` |
| secondary | `--q-surface` | `--q-text` | 1px `--q-border-strong` | `--q-bg-subtle` | `--q-bg-muted` |
| ghost | transparent | `--q-text` | none | `--q-bg-subtle` | `--q-bg-muted` |
| danger | `--q-signal-risk` | `--q-text-inverse` | none | `#9F1F1F` | `#741515` |

### States
- **Loading**: replace icon-left with a 16px spinner (rotating border, `--q-duration-long` linear); disable click; keep label.
- **Disabled**: opacity 0.5, `cursor: not-allowed`, no hover state, no focus ring on `:focus:not(:focus-visible)`.
- **Focus-visible**: `--q-shadow-focus` (3px indigo ring at 32% alpha).

### Don't
- No more than one primary button per visible viewport (Hick's Law).
- No icon-only without aria-label.

---

## Input (text)

### API
```ts
type InputProps = {
  label: string;
  helperText?: string;
  error?: string;
  iconLeft?: ReactNode;
  size: 'sm' | 'md';
  type: 'text' | 'email' | 'url' | 'password' | 'search';
};
```

### Spec
- Height: sm 32 / md 40
- Padding: `var(--q-space-3) var(--q-space-4)`
- Bg: `--q-surface`
- Border: 1px `--q-border-strong` (default), `--q-border-focus` (focus), `--q-signal-risk` (error)
- Radius: `--q-radius-md`
- Font: `body.md` (16) — never below 16 on mobile or iOS will zoom.
- Label: above field, `label` token (14/500), `--q-space-1` gap to field.
- Helper / error text: `caption` (12/400), `--q-space-1` gap below field. Error uses `--q-signal-risk`.

### Accessibility
- Label always present; if visually hidden, use `aria-label` + `sr-only` text.
- Error: `aria-invalid="true"` + `aria-describedby` pointing at the error text.
- Validate **on blur**, not on every keystroke (Postel's law — be tolerant). Show error only after the user has tried.

---

## Card

### API
```ts
type CardProps = { elevation: 'flat' | 'raised'; padding: 'md' | 'lg'; };
```

### Spec
- Bg: `--q-surface`
- Border: 1px `--q-border` (flat) or none (raised)
- Shadow: none (flat) or `--q-shadow-md` (raised)
- Radius: `--q-radius-lg` (12)
- Padding: md = `--q-space-6` (24), lg = `--q-space-8` (32)
- Hover (only if `as="button"` or has onClick): translate y -1px, shadow ramps to `--q-shadow-lg`, `--q-duration-short`.

---

## Modal

### Spec
- Backdrop: `rgba(11, 15, 30, 0.48)`, fade in `--q-duration-short`.
- Surface: `--q-surface`, `--q-radius-xl`, `--q-shadow-xl`, max-width 520px (default), centered.
- Padding: header `--q-space-6` + body `--q-space-6` + footer `--q-space-6`.
- Header: `heading.sm` (24) with close button (ghost button, 32×32, X icon).
- Footer: right-aligned button group; primary on the right (`btn-primary` after `btn-ghost`).

### Accessibility
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby={titleId}`.
- Focus trap; restore focus to opener on close (Shneiderman: reversible).
- Close on `Esc`. Close on backdrop click ONLY if no destructive consequence; otherwise require explicit dismiss (Nielsen #5, error prevention).

---

## Tooltip

### Spec
- Bg: `--q-bg-inverse` (`#0B0F1E`)
- Text: `--q-text-inverse`, `body.sm` (14)
- Padding: `--q-space-2 var(--q-space-3)` (8 / 12)
- Radius: `--q-radius-sm` (6)
- Max-width: 280px
- Delay: 400ms in, 100ms out
- Position: 8px from anchor; flip if it would clip viewport.
- Never put critical information in a tooltip (mobile can't reach it).

---

## Toast

### API
```ts
type ToastProps = {
  kind: 'success' | 'info' | 'error';
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; };
  duration?: number;  // default 5000, error 8000, with-action sticky
};
```

### Spec
- Position: top-right desktop / top-center mobile, `--q-space-4` from edge.
- Surface: `--q-surface`, `--q-radius-lg`, `--q-shadow-lg`.
- Padding: `--q-space-4`.
- Leading icon (20px) colored to match kind: `--q-signal-positive` / `--q-text-link` / `--q-signal-risk`.
- Stacks vertically; max 3 visible; older toasts auto-dismiss.
- Enter: slide-down `--q-space-2` + fade, `--q-duration-medium`, `--q-ease-entrance`.
- Exit: fade only, `--q-duration-short`, `--q-ease-exit`.

### Accessibility
- `role="status"` (info/success) or `role="alert"` (error). Live-region polite/assertive matching.

---

## Empty state

### Spec
- Container: centered column, max-width 480px, `--q-space-12` (48) vertical padding.
- Optional icon at 48px, `--q-text-subtle`, `--q-space-4` below.
- Title: `heading.sm` (24), `--q-text` color.
- Description: `body.md` (16), `--q-text-muted`.
- Primary action below: `Button primary md`.

**Voice:** declarative — "No urgent deals. Your pipeline is clean today." Never "Wow, such empty."

---

## Loading state

### Spec
- **Skeleton (preferred)**: gray block sized to incoming content, `--q-bg-muted` bg, `--q-radius-md`, with a 1.4s shimmer (linear gradient sweep at 40% alpha). Honors reduced motion (no shimmer; static block).
- **Spinner**: 20px (inline) / 32px (page-level). 1.5px stroke, `--q-accent` color, 0.8s linear rotation. Used inside buttons and for actions < 2s.
- **Progress bar**: 4px tall, `--q-radius-full`, `--q-bg-muted` track, `--q-accent` fill. Show for any operation expected to take > 2s; show a label + ETA when known.

Doherty Threshold rules:
- < 100ms: no loading state.
- 100–400ms: optimistic UI (assume success, undo on fail).
- > 400ms: spinner or skeleton.

---

## Containers, grids, sections (marketing)

Reference: `design/landing-page.html`. Class names that the CTO should mirror in CSS modules / Tailwind:

- `.q-container` — `max-width: var(--q-container-max); margin-inline: auto; padding-inline: var(--q-space-12)` (24 on mobile)
- `.q-section` — `padding-block: var(--q-space-24)` desktop / `--q-space-16` mobile
- `.q-section--inverse` — flips to `bg-inverse` + `text-inverse`
- `.q-grid` — 12-column grid, `gap: var(--q-space-6)`; on mobile collapses to 1 col

---

## Component-to-feature mapping (for landing page handoff)

| Landing-page block | Components |
|---|---|
| Top nav | `Button ghost sm` (nav links), `Button primary sm` (CTA) |
| Hero | `Eyebrow` text, `display.lg/xl` h1, `body.lg` lede, `Button primary lg`, `Input md` (waitlist) |
| Problem | `heading.lg` h2, `Card flat md` ×3 |
| How it works (3 steps) | `Card raised md` ×3 with step number eyebrow |
| Pricing | `Card raised lg` ×3 (middle = featured), `Button primary md` per tier |
| Social proof | `eyebrow` label + logo strip (placeholders) |
| FAQ | Disclosure rows (no component yet — render as `<details>`) |
| Footer | `bg-inverse` section, wordmark-inverse + link columns |
| Waitlist CTA band | `Input md`, `Button primary md`, helper `caption` |
