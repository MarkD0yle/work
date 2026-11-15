# Ledgerline Build Plan

Work one milestone per Claude Code session. Each task lists what to build and how to verify it. Tick boxes as you go. Do not start a milestone until the previous exit gate passes.

Session prompt template:

> Read CLAUDE.md, docs/SPEC.md and docs/PLAN.md. Implement Milestone N. Plan first, listing the acceptance criteria you will test. Stop at the exit gate and report what passed, what failed, and any decisions logged.

---

## Milestone 0 — Foundations and tooling

- [x] 0.1 Monorepo: pnpm workspaces, Turborepo, TypeScript project references, strict tsconfig base.
- [x] 0.2 ESLint + Prettier. `no-restricted-imports` enforcing the dependency rules in CLAUDE.md. A lint rule (or custom check) that flags `toFixed`, `parseFloat` and `Number(` inside `packages/ui` financial code.
- [x] 0.3 `packages/contracts`: copy `src/index.ts` from this spec. Build and export. Add a Zod mirror in `apps/api/src/schemas` with a type test proving they match.
- [x] 0.4 `packages/tokens`: CSS variables for light/dark and three densities (SPEC §5). Export TS constants. Theme and density switch via `data-theme` and `data-density` on `<html>`.
- [x] 0.5 `apps/api`: Fastify, Drizzle, SQLite schema for every entity in API.md. `pnpm db:reset` migrates and seeds deterministically. Start with reduced volumes behind `SEED_SCALE=small|full`.
- [x] 0.6 `apps/web`: Vite + React Router shell placeholder; dev role switcher setting `X-LL-User`.
- [x] 0.7 Storybook with theme and density toolbar. Vitest, Playwright, axe wired. CI script runs all.
- [x] 0.8 Create `docs/DECISIONS.md`, `docs/EVIDENCE.md`, `docs/OWNERS.md`.

**Exit gate (passed 2026-11-14):** `pnpm dev` serves web and api; `pnpm lint` fails on a deliberate `ag-grid` import from `apps/web`; `pnpm db:reset` produces identical row counts twice.

## Milestone 1 — Grid, Financial Fields, State and Validation

- [x] 1.1 Precision registry and formatting utilities with `decimal.js`. Unit tests for every kind, currencies USD/EUR/GBP/JPY, both sign conventions, shorthand parsing.
- [x] 1.2 `FinancialCell` and `FinancialInput` (SPEC 7.5). Override flow with reason. Provenance popover. Null reasons.
- [x] 1.3 `UiState` renderer components: `StateOverlay`, `SectionBanner`, `FieldMessage`, `RowMarker`. Stories for all 15 kinds.
- [x] 1.4 Notification panel with session history and jump-to-target.
- [x] 1.5 `LLGrid` wrapper: AG Grid theme from tokens, column types, typed cells, density, selection, status bar, state overlay, Enterprise feature switch by env.
- [x] 1.6 Server-side data source adapter for the `/…/query` contract.
- [x] 1.7 Keyboard model and screen-reader announcements (SPEC 7.1).
- [x] 1.8 Transactions grid route, read-only, on seeded data.

**Exit gate (passed 2026-11-14, on AG Grid Community; see DECISIONS.md for the two caveats):** SPEC acceptance for 7.1 (except views), 7.5 and 7.7 pass in tests. 100k-row scroll check documented (Enterprise) or noted as blocked by licence in DECISIONS.md.

## Milestone 2 — Views, Workspaces, Entity Picker, Dates

- [x] 2.1 Filter model, filter tags, task chips, quick search, Clear all, Restore default.
- [x] 2.2 Saved views CRUD with ownership rules, URL state, `schemaVersion` migration.
- [x] 2.3 Workspaces: panels, single and tabs layouts, groups, load at startup, pop-out windows kept in sync (BroadcastChannel). Team default workspaces and views per role.
- [x] 2.4 Entity Picker in three modes (inline, sheet with criteria and multi-select, global search). Identifier detection. Restricted records. Recent items.
- [x] 2.5 `BusinessDateInput` with basis label, shortcuts, calendars, business-day rules. `PeriodPicker` with state.

**Exit gate (passed 2026-11-15):** SPEC acceptance for 7.2, 7.3, 7.6 pass.

## Milestone 3 — Shell and Action Registry

- [x] 3.1 App shell: left rail, top bar, job tray placeholder, notification toggle, user menu (theme, density).
- [x] 3.2 `ActionDef` registry hooks: toolbar, selection bar, context menu all render from one list.
- [x] 3.3 Command palette: navigation, views, entities, actions in context. Shortcut sheet on `?`.
- [x] 3.4 Disabled-with-reason pattern for actions and records.
- [x] 3.5 Analytics event sink (console in dev).

**Exit gate (passed 2026-11-15):** SPEC acceptance for 7.8 pass. All domains reachable without a mouse.

## Milestone 4 — High-volume proof: Transaction Workbench and Import

- [x] 4.1 Transaction Blotter composition: grid, views, picker filters, financial and date columns, actions. *Lives in `packages/compositions`; the app supplies API and analytics through `configureServices`.*
- [x] 4.2 Transaction detail panel: fields, provenance, audit tab (read from API), edit with If-Match and conflict state.
- [x] 4.3 Create and edit transaction form with all validation levels and warning acknowledgement.
- [x] 4.4 Quick paste into batch grid with last mapping, then the Spreadsheet Import Wizard for files (SPEC 8.1).
- [x] 4.6 Clone row, fill-down and inline delta columns (SPEC 7.1). *One delta column so far: Price vs vendor. "vs prior day" arrives with Price Review in Milestone 6.*
- [x] 4.7 Glossary tooltips and plain-language-first messages for new users (SPEC 7.7).
- [x] 4.5 Inline single-record post and reverse (bulk comes in M5). *Done early in Milestone 3, with Delete, so the action registry had real actions; see DECISIONS.md.*

**Exit gate (passed, `e2e/milestone4.e2e.ts`):** a Playwright journey: Ada finds yesterday's unposted trades with a saved view, quick-pastes 50 corrections, fixes 2 row errors, clones a trade and fills down a field, and posts 1 record with a single confirm. Ben sees Reverse disabled with a reason.

## Milestone 5 — Bulk Actions and Jobs

- [x] 5.1 Eligibility evaluation and risk-scaled confirm dialog (SPEC 7.4).
- [x] 5.2 Preview: automatic when rows have warnings or for new-user roles; one click otherwise.
- [x] 5.3 Inline run ≤200 rows; job above. Results panel with succeeded, failed, skipped.
- [x] 5.4 Remediation: filter to failures, retry failed only, export results.
- [x] 5.5 Jobs: tray, grid, detail, SSE progress, retry, cancel, persistence across API restart.
- [x] 5.6 Reports run as jobs with downloadable output.

**Exit gate (passed, `e2e/milestone5.e2e.ts`):** SPEC acceptance for 7.4 and 7.11 pass. Journey: Ada bulk-posts 500 transactions, ~10 fail, she retries after fixing, closes the browser mid-run once and recovers results.

## Milestone 6 — Exception-heavy proof: Close, Exceptions, Comparison, Audit, Price Review

- [ ] 6.1 Comparison component (SPEC 7.9) including investment book vs accounting book.
- [ ] 6.2 Audit timeline and grid with evidence (SPEC 7.10).
- [ ] 6.3 Exception Queue (SPEC 8.2) with thread, evidence, owner, age and SLA, root-cause categories, recurring-break rules, group similar, bulk assign, bulk evidence, bulk resolve.
- [ ] 6.4 API close checks generating exceptions (SPEC 8.3 table).
- [ ] 6.5 Period Close Console: portfolio overview with cutoff countdown, checklist, close per type, multi-portfolio close job, block override with second approver, reopen with reason, sign-off, close package export (PDF, XLSX).
- [ ] 6.6 Price Review: tolerance rules screen with impact preview, failed-rule display, holiday-aware stale checks, bulk accept, accept conditionally with challenge, override.
- [ ] 6.7 Approval Queue (SPEC 8.5) for overrides, reopens and close-block overrides, with segregation of duties.

**Exit gate:** journey: Cleo opens the close console for 3 portfolios, sees blocked close with named exceptions, Dev resolves 2 price exceptions, Rafa applies a recurring-break rule and attaches one statement to 10 breaks, Cleo closes 2 portfolios in one job, overrides the block on the third with a second approver, signs off and downloads the close package, then reopens one with a reason. All actions visible in audit.

## Milestone 7 — Admin and hardening

- [ ] 7.1 Admin: users, permission groups, access levels per action, blotter scope. Changes audited.
- [ ] 7.2 Client Home (SPEC 8.6): positions, transactions, statements; Eli reaches last month's statement in two clicks.
- [ ] 7.3 Performance pass: bundle size budget (initial JS < 400 KB gz), grid render budgets, API query indexes.
- [ ] 7.4 Accessibility pass: full axe on every route and story; manual screen-reader script for both journeys.
- [ ] 7.5 Visual regression baseline for every story.
- [ ] 7.6 Documentation: every Stable-candidate asset has the Draft-tier contract fields complete in its MDX page.

**Exit gate:** every acceptance checkbox in SPEC.md ticked or explicitly deferred in DECISIONS.md with a reason.
