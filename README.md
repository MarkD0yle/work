# Work — Capital Markets UI Prototype Gallery

A single-page React app that hosts a growing catalogue of **standalone UI prototype screens** for capital-markets, risk, trading, and wealth-management workflows. Each screen is a self-contained page; the app auto-discovers them, groups them in a sidebar, and lets you browse the whole set from one place.

Live: https://absurdalpha.web.app

## What this is

Think of it as a design/UX sandbox rather than a wired-up product. There's no backend or shared app state — every page under `src/pages/` renders independently with realistic mock data, so you can prototype, review, and iterate on individual screens without standing up services. There are currently **~49 pages** spanning operations dashboards, risk & exposure views, trading blotters, onboarding forms, wealth summaries, and reusable UI patterns.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 |
| Build tool | Vite 8 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Data grids | AG Grid (Community + Enterprise) |
| Hosting | Firebase Hosting (project `absurdalpha`) |
| Lint | ESLint + typescript-eslint |

> **Design rule:** all components use **0 border radius** (square corners), enforced via `--radius: 0rem` in [`src/index.css`](src/index.css). Don't reintroduce a non-zero `--radius`.

## Getting started

```bash
npm install
npm run dev      # start Vite dev server with HMR
```

Then open the printed local URL. The app opens on the **File Gallery** landing page; use the sidebar to jump between screens. Your last-viewed page is remembered via `localStorage`.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint over the repo |
| `npm run deploy` | Build, then deploy to Firebase Hosting |
| `npm run deploy:nobuild` | Deploy the existing `dist/` without rebuilding |

## How it works

The architecture is deliberately router-free and convention-driven.

### Auto-discovered pages

[`src/App.tsx`](src/App.tsx) globs every file in `src/pages/*.tsx` at build time (`import.meta.glob`, eager). Each file becomes a browsable page keyed by its filename slug — **dropping a new `.tsx` file into `src/pages/` is all it takes to add a screen.**

A page module is just a default-exported component, with three optional named exports to control presentation:

```tsx
// src/pages/my-screen.tsx
export const title = "My Screen";     // sidebar label (defaults to a prettified slug)
export const section = "risk";        // section id (defaults to the slug→section map)
export const fullWidth = true;        // render edge-to-edge instead of the centered container

export default function MyScreen() {
  return <div>…</div>;
}
```

### Sidebar sections

[`src/lib/pageSections.ts`](src/lib/pageSections.ts) defines the sidebar groups and maps each slug to one:

- **Operations** — ops overview, oversight, my queue, reconciliation, NAV sign-off, settlement timeline, …
- **Risk & Exposure** — credit exposure, counterparty 360, limit monitor, stress scenarios, XVA desk, …
- **Trading & Liquidity** — blotter, TCA, liquidity ladder, repo financing, collateral optimizer, heatmaps, …
- **Forms & Flows** — client/counterparty onboarding, sign-up, settings
- **Wealth & Clients** — client overview, portfolio performance, wealth summary, asset allocation, goals
- **Patterns & Tools** — pattern gallery, date pickers, GitHub cheat sheet, Awesome Quant resource directory
- **Other** — catch-all for any page not yet mapped (so new files always show up)

A page's section is resolved by `sectionForSlug(slug, explicitSection)`: an explicit `export const section` wins, otherwise the slug→section map is used, otherwise it falls into **Other**.

### Navigation

Pages render standalone inside `<main>` with no props, so they can't call `App`'s state setter directly. Instead, in-app navigation (e.g. opening a card from the File Gallery) fires a `window` `CustomEvent` that `App` listens for — see [`src/lib/navigation.ts`](src/lib/navigation.ts). This keeps page signatures clean and avoids threading a router through everything. The active slug is persisted with the `useLocalStorage` hook.

## Project layout

```
src/
  App.tsx            # page discovery, sidebar wiring, active-page routing
  main.tsx           # React entry point
  index.css          # Tailwind import + global rules (incl. 0-radius, scoped dark mode)
  pages/             # one .tsx per prototype screen (auto-discovered)
  components/        # shared UI (e.g. Sidebar)
  hooks/             # reusable hooks (localStorage, saved views, forensic sizing, …)
  lib/               # data + logic helpers (mock data, filters, section map, firebase, …)
scripts/deploy.sh    # build + Firebase deploy helper
firebase.json        # Hosting config (serves dist/, SPA rewrite to index.html)
```

## Deployment

Deploys go to Firebase Hosting (project `absurdalpha`, configured in `.firebaserc`). The [`scripts/deploy.sh`](scripts/deploy.sh) helper builds the production bundle and runs `firebase deploy --only hosting`, resolving the Firebase CLI from a global install or falling back to `npx firebase-tools`.

```bash
npm run deploy              # full build + deploy
npm run deploy:nobuild      # deploy current dist/ only
```

Live URLs: https://absurdalpha.web.app · https://absurdalpha.firebaseapp.com

## Adding a new screen

1. Create `src/pages/<your-slug>.tsx` with a default-exported component.
2. (Optional) add `export const title`, `section`, and/or `fullWidth`.
3. If you want it in a specific sidebar group, add the slug to `SLUG_SECTION` in [`src/lib/pageSections.ts`](src/lib/pageSections.ts) (or set `export const section`).
4. `npm run dev` — it appears in the sidebar automatically.
