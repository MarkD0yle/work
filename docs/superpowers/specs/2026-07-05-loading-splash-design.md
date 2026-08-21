# Loading Splash Transition — Design

**Date:** 2026-07-05
**Status:** Approved

## Goal

Show an animated loading screen when the app first boots, then transition
(fade) into the existing gallery home page after 2 seconds. Built around the
provided `BackgroundCircles` component (Kokonut UI).

## Context

- Stack: Vite + React 19 + TypeScript + Tailwind CSS v4.
- **Not** a shadcn / Next.js project: no `components.json`, no `@/` alias, no
  `src/components/ui/` folder. The component's `"use client"` directive is a
  Next-only no-op here.
- Pages auto-load from `src/pages/*.tsx`; app boots to the `gallery` page.
- Hard rule: 0 border-radius (`--radius: 0rem` in `index.css`).

## Decisions

- **Trigger:** splash once on app start → fade into gallery.
- **Radius:** the animated rings stay `rounded-full` (intentional geometry, akin
  to a spinner). No other rounded chrome is introduced.
- **Text:** title = "Absurd Alpha".
- **Variant:** `senary` (blue) to match the existing blue-blob hero theme.

## Components

### `src/components/ui/background-circles.tsx`
Copy of the provided component, with adaptations:
- Remove inert `"use client"` and the broken/redundant `demo.tsx` duplicate.
- Remove the hardcoded `· Kokonut UI` attribution.
- Keep `rounded-full` rings.

*Why `src/components/ui/`:* a dedicated home for reusable presentational
primitives, distinct from feature components (`src/components/`) and route pages
(`src/pages/`). Keeps import paths predictable and matches the component's
authored convention.

### `src/components/LoadingGate.tsx`
Owns the timer and the transition:
- `loading` starts `true`; `setTimeout(…, 2000)` flips it to `false` (cleared on
  unmount).
- While loading: full-screen `<BackgroundCircles title="Absurd Alpha"
  variant="senary" />`.
- `AnimatePresence` fades the splash out as the app fades in.

### `src/main.tsx`
Wrap the app: `<LoadingGate><App /></LoadingGate>`.

## Data flow

`main → LoadingGate (2s timer) → [splash] → fade → App / gallery`

No external props, no state management, no assets.

## Dependencies

- `framer-motion` — animation.
- `clsx` — class merging.
