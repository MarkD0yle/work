# Ledgerline

A web workbench for investment accounting operations, built from eleven reusable capabilities instead of hundreds of bespoke screens.

**Status:** Milestones 0 to 3 are complete: foundations; grid, financial fields and state; saved views, workspaces, entity picker and dates; shell, action registry and command palette. Milestones 4 to 7 are not started. See `docs/PLAN.md`.

## Run it

All commands run from this folder (`ledgerline/`). Needs Node 22+ and pnpm 10.

```bash
pnpm install
pnpm db:reset     # optional: the API seeds itself on first start
pnpm dev          # web on http://localhost:5310, API on http://localhost:4310/api/v1
pnpm storybook    # http://localhost:6006
```

| Command | Does |
| --- | --- |
| `pnpm typecheck` | `tsc -b` across all project references, including the Zod-vs-contracts type proof |
| `pnpm lint` | ESLint (import boundaries, no float maths on money in UI code) and Prettier |
| `pnpm test` | Vitest: tokens, API and seed, UI components, lint-rule proofs |
| `pnpm test:e2e` | Playwright journeys against a freshly seeded API |
| `pnpm test:a11y` | Builds Storybook, then axe on every route and every story, light and dark |
| `pnpm db:reset` | Drop, migrate and reseed SQLite. Prints row counts and a content checksum |
| `pnpm ci` | Everything above, in order |

## Next milestone

Open Claude Code in this folder and prompt:

> Read CLAUDE.md, docs/SPEC.md and docs/PLAN.md. Implement Milestone 5. Plan first, listing the acceptance criteria you will test. Stop at the exit gate and report.

## Files

| File | Purpose |
| --- | --- |
| `CLAUDE.md` | Rules for every session: stack, boundaries, non-negotiables, commands |
| `docs/SPEC.md` | Product and capability spec with acceptance criteria |
| `docs/PLAN.md` | Milestones, tasks and exit gates |
| `docs/API.md` | Backend contract and seed data shape |
| `docs/DECISIONS.md` | Log of judgement calls made during the build |
| `docs/EVIDENCE.md` | Research findings per capability |
| `docs/OWNERS.md` | Capability owners |
| `packages/contracts/src/index.ts` | Shared types; source of truth for data shapes |

## Environment

| Variable | Effect |
| --- | --- |
| `VITE_AG_GRID_ENTERPRISE` | AG Grid Enterprise is on by default. Set `false` to run on Community |
| `VITE_AG_GRID_LICENSE` | Licence key. Without one, Enterprise shows AG Grid's watermark: fine for a design concept, not for production |
| `SEED_SCALE` | `small` (default, about 1s) for dev; `full` (1M securities, 250k transactions, about 1 min) for performance tests |
| `LL_DB_PATH` | SQLite file. Default `apps/api/data/ledgerline.sqlite` |
| `LL_API_PORT` | API port. Default `4310` |
