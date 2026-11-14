# CLAUDE.md — Ledgerline

Ledgerline is a web platform for investment accounting operations. It is a workbench, not a set of CRUD screens. Users search, filter, select, process and resolve groups of financial records: transactions, positions, prices, cash and accounting periods.

Read these before any work:

1. `docs/SPEC.md` — what we are building and why. Capabilities, rules, acceptance criteria.
2. `docs/PLAN.md` — the build order. Work one milestone at a time.
3. `docs/API.md` — the backend contract the UI depends on.
4. `packages/contracts/src/index.ts` — shared types. The source of truth for data shapes.

## How to work in this repo

- Ledgerline lives in the `ledgerline/` folder of a larger repository. Run every command from `ledgerline/`.
- Adding a shadcn/ui component: put its source in `packages/ui/src/components`, replace raw colours and sizes with token-backed utilities (`bg-primary`, `h-(--ll-control-height)`, `text-body`), export it from `packages/ui/src/index.ts` and add stories.

- Work **one milestone per session** from `docs/PLAN.md`. Do not start the next milestone until the current one's exit checks pass.
- Before writing code for a task, restate the task's acceptance criteria in your plan.
- After each task: run `pnpm typecheck && pnpm lint && pnpm test`. Fix failures before moving on.
- At the end of a milestone: run `pnpm test:e2e` and `pnpm test:a11y`, then update the milestone checklist in `docs/PLAN.md`.
- If a spec rule conflicts with what seems easier, follow the spec and note the tension in `docs/DECISIONS.md`.
- If a requirement is ambiguous, pick the option that keeps data safe and states visible, log it in `docs/DECISIONS.md`, and continue.
- Never mark a capability `Stable` yourself. You may move it from `Hypothesis` to `Draft` when its acceptance criteria pass.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | |
| Language | TypeScript strict, ES2022 | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Web app | React 19, Vite, React Router | React 19 is required by current shadcn/ui components (ref as a prop) |
| Server state | TanStack Query | No global store for server data |
| Client state | Zustand only for UI state (selection, panels) | |
| Grid engine | AG Grid (Enterprise if `VITE_AG_GRID_LICENSE` is set, Community otherwise) | Only imported inside `packages/ui/src/grid` |
| Primitives | shadcn/ui (Radix UI + Tailwind) | Component source lives in `packages/ui/src/components`; apps never import Radix directly |
| Styling | Tailwind CSS v4, themed only through CSS variables from `packages/tokens` | No raw colours or pixel sizes in components; no CSS-in-JS runtime |
| Decimal maths | `decimal.js` | Never use JS `number` for money, price, units or rates |
| Dates | `date-fns` + ISO strings | Never use `Date` for business dates; use ISO `YYYY-MM-DD` strings |
| API | Fastify + Zod + Drizzle ORM + SQLite (better-sqlite3) | Mock of the real accounting engine |
| Jobs | In-process queue in the API (`apps/api/src/jobs`) | Persisted to SQLite so jobs survive restart |
| Seed data | `@faker-js/faker` with fixed seed, shaped generators | Deterministic: same seed, same data |
| Tests | Vitest + Testing Library, Playwright, axe-core | |
| Docs | Storybook 10 | Every `@ledgerline/ui` export has stories |

## Repo layout

```
apps/
  web/                 # the Ledgerline workbench (journeys)
  api/                 # mock accounting engine API
packages/
  contracts/           # types only. Imports nothing.
  tokens/              # design tokens as CSS variables + TS constants
  ui/                  # the 11 capabilities, cells, primitives, grid wrapper
  compositions/        # domain compositions: blotters, consoles, queues
  test-utils/          # fixtures, render helpers, axe helpers
docs/
  SPEC.md  PLAN.md  API.md  DECISIONS.md  EVIDENCE.md  OWNERS.md
e2e/                   # Playwright journeys and axe checks
.storybook/
```

## Dependency rules (enforced by lint)

- `contracts` imports nothing.
- `tokens` imports nothing.
- `ui` imports `contracts`, `tokens`, AG Grid, Radix (through shadcn/ui components). Only `packages/ui/src/financial` may format or parse financial numbers.
- `compositions` imports `ui`, `contracts`.
- The grid is imported from `@ledgerline/ui/grid`, never from the main `@ledgerline/ui` entry, and grid screens are loaded on demand. This keeps the grid engine out of the initial bundle.
- `apps/web` imports `compositions`, `ui`, `contracts`. **Never** `ag-grid-*` or `@radix-ui/*` directly.
- `apps/api` imports `contracts` only from the frontend packages.
- Add ESLint `no-restricted-imports` rules for all of the above in milestone 0.

## Non-negotiable rules

1. **Money is never a `number`.** Financial values travel as decimal strings in a `FinancialValue`. Display precision comes from the precision registry, never from the cell.
2. **Business dates are ISO strings with a basis.** No `new Date('2026-01-01')` for business dates. Null dates are `null`, never `1900-01-01` or `9999-12-31`.
3. **Every state is designed.** Any component that loads data handles all relevant `UiState` kinds. No blank screens, no silent failures.
4. **No hidden filters.** Every active filter shows as a removable tag.
5. **Nothing irreversible happens without a confirm step** that states the consequence. Post, Reverse, Delete, Override and Reopen always confirm.
6. **Partial success is a first-class outcome.** Bulk results show succeeded, failed and skipped rows separately.
7. **Every data-changing action writes an audit event** with before and after values.
8. **Disabled actions explain why.** Restricted records explain why. Never just grey out.
9. **Power users keep their power.** Density, keyboard control, saved views and bulk actions are core, not optional. Defaults vary by role; capability does not get removed.
10. **Critical information is never a toast.** Toasts are only for lightweight confirmation.
11. **Accessibility target is WCAG 2.2 AA.** Status never relies on colour alone.
12. **One action registry.** Toolbar, selection bar, context menu, command palette and the future assistant all read the same `ActionDef` list.

## Commands (create these in milestone 0)

```
pnpm dev            # web + api together
pnpm build
pnpm typecheck
pnpm lint
pnpm test           # vitest, all packages
pnpm test:e2e       # playwright
pnpm test:a11y      # playwright + axe on every route and story
pnpm storybook
pnpm db:reset       # drop, migrate and reseed SQLite with the fixed seed
```

## Definition of done for any component

- Typed props using `@ledgerline/contracts` types.
- Stories for: normal, loading, empty, no matches, warning, blocking error, permission-limited, and any state in its spec.
- Keyboard path tested.
- axe passes with zero serious or critical violations.
- Light and dark themes render correctly.
- Unit tests for logic; interaction test for each acceptance criterion.
