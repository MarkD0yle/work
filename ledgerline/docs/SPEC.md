# Ledgerline — Product and Build Specification

Version 0.1 · Status: Hypothesis (no capability validated with users yet)

## 1. What Ledgerline is

Ledgerline is an investment accounting operations workbench. It replaces a legacy desktop client (ribbon navigation, dense forms, many single-purpose screens) with a web platform built on a small set of reusable, governed capabilities.

**Core idea:** do not redesign hundreds of legacy screens. Build eleven behaviours that repeat everywhere — grid, views, picker, fields, dates, states, actions, bulk, comparison, audit, jobs — then configure journeys from them.

**What the platform covers:** portfolios and accounting structures, security master, transactions (purchases, sales, income, corporate actions, repo, swaps, futures margin, TBAs), market data (prices, FX, curves, ratings), cash and settlement, reporting jobs, performance, period close and reopen, permissions and administration.

**What this build delivers:** the full frontend platform, a mock accounting engine API with deterministic seed data, and two complete proof journeys.

## 2. Known weaknesses of this spec

Read these first. They are risks, not solved problems.

| # | Weakness | Consequence | Mitigation in this build |
| --- | --- | --- | --- |
| 1 | The API is a mock. The real accounting engine may not expose these endpoints. | The UI can be finished while integration is impossible. | `docs/API.md` is written as the contract to negotiate with the backend owner. Keep it stable. |
| 2 | No capability has been tested with real users. | Assumptions harden into standards. | Every capability starts at `Hypothesis`. Research protocol in §11. |
| 3 | The foundation design system is a stand-in (`packages/tokens` + shadcn/ui on Radix and Tailwind). | An enterprise design system may replace it later. | All primitives are wrapped in `packages/ui`. Swapping the foundation changes one package. |
| 4 | AG Grid Enterprise needs a paid licence. | Without it: no row grouping, server-side row model, Excel export or range selection. | Grid works on Community; Enterprise features switch on when the licence key exists. The 100k-row target needs Enterprise. |
| 5 | Approval volume is unknown. | If approval is heavier than assumed, the queue becomes a bottleneck. | Approval Queue is core in milestone 6 (8.5). Measure queue time from day one. |
| 7 | The end-user review in §15 is simulated, not observed. | It reflects the spec author's assumptions about users. | Every §15 change is tagged `Hypothesis` and is the first thing tested in research. |
| 6 | Scope is large. | Breadth ships, no journey works end to end. | Build order is gated by proof journeys (§10). |

## 3. Users

### Teams (work areas)

| Team | Core work | Capabilities they lean on |
| --- | --- | --- |
| Portfolio Operations | Maintain portfolios, positions, managers | Grid, Entity Picker, Saved Views |
| Transaction Operations | Enter, review, post, reverse transactions; corporate actions | Grid, Bulk Actions, Financial Fields, Actions, Import |
| Investment Accounting | Accounting bases, journals, accruals, impairments, close | Date and Period, Comparison, Bulk, Audit |
| Market Data | Prices, FX, curves, ratings; tolerance checks | Grid, Comparison, State (stale), Exceptions |
| Reference Data | Securities, issuers, accounts, banks | Entity Picker, Validation, Audit |
| Cash and Settlement | Custodian cash, receipts, wires | Comparison, Exceptions, Bulk |
| Performance | Returns, benchmarks, composites | Grid, Comparison, Jobs |
| Reporting and Data Ops | Report definitions, queues, exports | Jobs, Saved Views |
| Reconciliation and Control | Breaks, corrections, pre-close validation | Comparison, Exceptions, Audit |
| Administrators | Users, permission groups, blotters, queues | Permissions, Audit |
| External clients | Read-heavy views and exports | Grid, export, explained restrictions |

### Experience segments (cut across teams)

| Segment | Needs |
| --- | --- |
| Super users | Density, keyboard speed, saved views, workspaces, bulk actions, command palette |
| Regular operators | Fast repeatable daily flows, stable defaults |
| New or occasional users | Guidance, explained restrictions, task-led flows, comfortable density |
| Approvers and controllers | Review, approve, exceptions, audit; little data entry |
| External clients | Restricted permissions, read and export |

### Seeded demo users

Create these in seed data. Each signs in with a role switcher in dev mode.

| User | Role | Default density | Notable permissions |
| --- | --- | --- | --- |
| Ada (super user) | Transaction Ops | compact | full on transactions; edit on prices |
| Ben (new user) | Transaction Ops | comfortable | edit on transactions; cannot reverse |
| Cleo (controller) | Investment Accounting | standard | approve, close, reopen; view-only on transaction entry |
| Dev (market data) | Market Data | compact | full on prices, view on transactions |
| Eli (client) | External client | comfortable | view and export only, two portfolios in blotter scope |
| Fay (admin) | Administrator | standard | full on admin; view elsewhere; second approver for controller requests |
| Rafa (reconciliation) | Reconciliation and Control | standard | full on exceptions and recurring-break rules; view elsewhere |

## 4. Architecture

```
apps/web  ── journeys (Transaction Workbench, Period Close Console, Price Review, Admin)
   │
packages/compositions ── Transaction Blotter, Close Console, Exception Queue, Import Wizard
   │
packages/ui ── the 11 capabilities + cells + shadcn/ui primitives + AG Grid wrapper
   │
packages/tokens ── colour, type, spacing, density, radius, motion (light + dark)
   │
packages/contracts ── shared types (imported by every layer above tokens, and by apps/api)
```

- `apps/api` is a Fastify service with SQLite. It mimics the accounting engine: validation, posting, jobs, periods, audit.
- The AG Grid theme is generated from `packages/tokens`. A token change reaches every grid.
- Feature flags live in `apps/web/src/flags.ts`, read from env. Flags: `agGridEnterprise`, `assistant`, `approvals`.

## 5. Foundations (`packages/tokens`)

Tokens are CSS variables with a TS mirror. Tailwind's theme in `packages/ui/src/styles.css` maps shadcn/ui's semantic names onto these variables, so components never hold raw values. Two themes: light, dark. Three densities.

| Group | Tokens |
| --- | --- |
| Colour | `--ll-bg`, `--ll-surface`, `--ll-surface-raised`, `--ll-border`, `--ll-text`, `--ll-text-muted`, `--ll-accent`, `--ll-focus`, status: `--ll-status-good`, `--ll-status-warning`, `--ll-status-critical`, `--ll-status-info`, `--ll-status-neutral` |
| Type | Inter (UI), JetBrains Mono or tabular numerals for numbers. Sizes 11, 12, 13, 14, 16, 20, 24 |
| Spacing | 2, 4, 8, 12, 16, 24, 32, 48 |
| Density | Row heights: compact 24, standard 32, comfortable 40. Control heights match |
| Radius | 2, 4, 8 |
| Motion | 120ms and 200ms; respect `prefers-reduced-motion` |

Visual direction: calm, flat, high information density without clutter. Think modern professional tools: clear hierarchy, quiet chrome, colour reserved for status and focus. Numbers right-aligned in tabular figures. No gradients or shadows beyond one elevation level for popovers.

## 6. Application shell

Replaces ribbon navigation.

- **Left rail:** domain navigation (Portfolios, Securities, Transactions, Market Data, Cash, Accounting, Reports, Admin). Collapsible.
- **Top bar:** global entity search (Entity Picker in search mode), workspace switcher, job tray, notification panel toggle, user menu with density and theme.
- **Command palette:** Ctrl/Cmd + K. Searches navigation, saved views, entities and every available action in the current context. This is the replacement for ribbon hunting.
- **Context toolbar:** in each workspace, primary actions for the current selection. Replaces contextual ribbons.
- **Notification panel:** docked right, collapsible, session history of all messages.
- **Workspace area:** one or more panels (single, split, tabs).

Keyboard: `g` then a letter navigates domains (`g t` transactions). `?` opens the shortcut sheet.

## 7. Capabilities

Each capability: purpose, rules, acceptance criteria. Acceptance criteria become tests. Status starts at `Hypothesis` for all.

### 7.1 Data Grid (`LLGrid`) — Milestone 1

The central workspace. AG Grid wrapped; apps never import AG Grid.

**Anatomy:** toolbar (view selector, quick search, filter tags, density, columns, export) · selection bar (selected, eligible, ineligible counts, actions) · header · body with typed cells · status bar (row count, aggregates of selected range, last refreshed, stale warning) · state overlay.

**Props (minimum):** `gridId`, `columns: LLColumnDef[]`, `dataSource` (client or server), `rowId`, `features` (role-based feature set), `selection`, `editing`, `actions: ActionDef[]`, `permissions`, `density`, `onStateChange`.

**Column types:** `financial` (requires `financialKind`), `date` (requires `dateBasis`), `status`, `entity`, `text`, `boolean`.

**Rules**
- Financial columns right-align, tabular numerals, precision from the registry.
- More than 10,000 rows, or unbounded data, uses the server-side row model.
- Copy uses displayed precision. "Copy raw values" is a separate command. Columns flagged `restricted` block copy with an explanation.
- Inline edits show a dirty marker until saved. Batch edits show a pending count. Nothing commits silently.
- Feature set is chosen by role. Super users keep grouping, pinning, multi-view and full keyboard control. Nothing is removed for everyone.
- Focus, selection and scroll position survive data refresh.
- **Fill-down** (Ctrl/Cmd+D) in batch edit copies the value above into the selected cells, with validation per cell.
- **Clone row** creates a new unposted record from the selected one, cursor on the first field that usually changes.
- **Delta columns:** any financial column can add an inline "vs prior day" or "vs other source" column with tolerance marking, without leaving the grid.
- **Pop out:** any panel opens in a new browser window that stays in sync (selection and refresh). Multi-monitor users rely on this.

**Keyboard:** arrows move; Space selects; Shift extends; Ctrl/Cmd+A selects all in view (not all server rows); Enter or F2 edits; Escape cancels then clears; Ctrl/Cmd+C copies; Shift+F10 opens actions.

**Acceptance**
- [ ] 100,000 server-side rows: first paint under 1.5s, smooth scroll (Enterprise only).
- [ ] A financial column never shows more or fewer decimals than its registry entry.
- [ ] Refresh keeps focus, selection and scroll.
- [ ] Every keyboard interaction works with no mouse.
- [ ] Lint fails if `ag-grid-*` is imported outside `packages/ui/src/grid`.
- [ ] Row and column counts announced to screen readers, including server totals.

### 7.2 Saved Views and Workspaces — Milestone 2

**Saved view** = columns, sort, filters, quick search, grouping, density. Ownership: personal, shared, default.
**Workspace** = a named set of panels, each with a grid and view, optionally grouped and loaded at startup. Layouts are `single` or `tabs`; side-by-side work uses pop-out windows (7.1), not in-page split panes.

**Team defaults:** each role gets a default workspace and default views set by its team lead. New users start there; they never face an empty view list.

**Rules**
- Every active condition shows as a removable tag. Task chips: Exceptions only, My records, Today.
- Relative dates are stored as relative ("today" stays today).
- Editing a shared view you do not own creates a personal copy.
- A view that references a removed column loads with a warning and drops the column.
- Restore default resets to the grid's default view, not empty.
- URL carries the view id plus unsaved diff, so a view can be shared by link.
- Shared views and workspaces have a reassignable owner.

**Acceptance**
- [ ] Active filter count on screen equals conditions applied to the query.
- [ ] A saved view restores columns, sort, filters, search, grouping and density exactly.
- [ ] A user cannot overwrite a shared view they do not own.
- [ ] Views survive a column rename through `schemaVersion` migration.
- [ ] A workspace marked load-at-startup opens on sign-in with all its panels.

### 7.3 Entity Picker — Milestone 2

One selection pattern for portfolios, securities, issuers, accounts, banks, managers, blotters, reports and templates. Modes: inline combobox, sheet (criteria search and large multi-select), global search.

**Rules**
- Exact identifier match (internal id, ISIN, CUSIP, SEDOL, ticker) ranks first.
- Results show id, description, type, currency, status, parent.
- Restricted records appear disabled with the reason. Never silently omitted.
- Type-ahead after 2 characters or any identifier pattern; 200ms debounce.
- Inactive records hidden by default with a "Show inactive" toggle. Last 10 recent items shown.

**Acceptance**
- [ ] Pasting a known ISIN selects the security in one step.
- [ ] p95 search under 500ms on a 1M-row seeded universe (API index required).
- [ ] Restricted records expose their reason on focus and to screen readers.

### 7.4 Bulk Action System — Milestone 5

**Flow:** select → choose action → eligibility evaluated per row → preview (optional) → confirm → run inline (≤200 rows) or as job → results → remediate.

**Confirm dialog shows:** action, total selected, eligible, ineligible grouped by reason, consequence, reversibility, reason field when required.

**Rules**
- Ineligible rows are counted and listed before submit. Never dropped silently.
- Confirmation scales with risk. One confirm for reversible actions. A typed confirmation only for irreversible actions or runs over 50 rows. Daily single-record reverses must not need typing.
- Preview opens automatically when any row has warnings, and for roles flagged as new. Otherwise it is one click away. Super users are not forced through it.
- Partial success uses warning styling with three counts.
- Retry targets failed rows only and is idempotent.
- One audit event per row plus one for the batch (shared `batchId`).

**Acceptance**
- [ ] 500 selected with 40 ineligible shows 460 eligible and the 40 grouped by reason before submit.
- [ ] Partial results: filter to failures and retry in two clicks.
- [ ] Closing the browser mid-run loses nothing; results recoverable from the job tray.
- [ ] Retrying a posted row cannot post it twice.

### 7.5 Financial Fields and Cells — Milestone 1

One input and one display cell per financial kind.

**Precision registry** (defaults; journeys may tighten, never loosen)

| Kind | Display decimals | Entry | Notes |
| --- | --- | --- | --- |
| amount, currencyAmount | Currency minor units (USD 2, JPY 0) | Free; rounded on blur with warning | Currency code always visible |
| units, quantity, originalFace | 4 | Free | Show original face beside current face when factor ≠ 1 |
| price | 6 | Free | Price type label: clean, dirty, % of par |
| rate | 6 | Free | Rate basis label |
| percentage | 2 | Accepts `5` or `5%` | Stored as fraction |
| basisPoints | 2 | Accepts `25` or `25bp` | Stored as fraction |

**Rules**
- Shorthand: `1.5m`, `250k`, `3bn` expand on blur; expanded value shown before save.
- Sign convention per column; never mixed in one grid.
- Calculated values show a calculator icon. Overriding shows the overridden state, keeps the original on hover, requires a reason.
- Locked values show a lock and the reason on focus.
- Provenance (source, as-of, who overrode) is one hover or keystroke away.
- Null displays by `nullReason`: missing `—`, unavailable `n/a` with tooltip, not applicable blank with aria label. Zero is `0.00`.

**Acceptance**
- [ ] `1.5m` in a USD amount saves as `"1500000.00"`.
- [ ] JPY amounts never show decimals.
- [ ] An override cannot save without a reason; audit holds before and after.
- [ ] Missing, unavailable, not applicable and zero render differently.

### 7.6 Date and Period Fields — Milestone 2

**Rules**
- Every date field shows its basis label.
- Typed entry accepts ISO and locale; shortcuts `t`, `t+2`, `-1m`, `eom` resolve on blur.
- Null renders as a dash with aria label "No date".
- Business-day rules apply on entry; a non-business date warns and shows the adjusted date.
- Period pickers show state. Entry into a closed period is blocked with the period and who can reopen.
- Close types are explicit: transaction, valuation, bank account, general ledger.

**Acceptance**
- [ ] `t+2` on a Friday trade resolves to Tuesday using the portfolio's calendar.
- [ ] An API value of `9999-12-31` renders as "No date" (converted at the boundary).
- [ ] Posting into a closed period is blocked; the message names the period and the reopen role.

### 7.7 State and Validation System — Milestone 1

Implements `UiState` and `Message`. Every other capability depends on it.

**Surfaces**

| Surface | Use for | Persists |
| --- | --- | --- |
| Inline field message | Field validation | Until fixed |
| Row marker + tooltip | Row errors in grids | Until fixed |
| Section banner | Section or record warnings and blockers | Until fixed or dismissed |
| Notification panel | All messages this session | Session history |
| Toast | Saved, copied | 5s |

**Validation levels:** field (blur), row (row exit), section (section exit), record (save), operation (submit), processing (server job checks).

**Rules**
- Every message has a stable code, what happened, and what to do next. Codes are shown small; the plain-language text leads.
- Domain terms (original face, accrued, amortised cost, basis) have a glossary tooltip on first use per session for users flagged as new.
- Warnings can be acknowledged and saved through (acknowledgement is audited). Blockers cannot.
- Stale data shows as-of and a refresh action. It never refreshes over unsaved edits; that is a conflict state.

**Acceptance**
- [ ] All 15 `UiState` kinds have stories in light and dark.
- [ ] New blocking errors announced via an assertive live region; warnings polite.
- [ ] Clicking a notification-panel message focuses its field or row.

### 7.8 Action Registry and Contextual Actions — Milestone 3

One `ActionDef[]` per grid or record feeds the toolbar, selection bar, context menu, command palette and (later) the assistant.

**Rules**
- At most 3 primary actions visible; the rest in overflow.
- Right-click accelerates; it is never the only path.
- Unavailable actions stay visible but disabled with the reason on hover and focus.
- Post, Reverse, Delete, Override, Reopen use destructive treatment and route through the bulk confirm.
- Each action declares `description`, `inputSchema` and `agentRequiresConfirmation` so an assistant can call it later through the same permissions and audit.

**Acceptance**
- [ ] The same action has the same label and shortcut in toolbar, menu and palette.
- [ ] Every right-click action is reachable by keyboard.
- [ ] A unit test asserts every registered action has a description and an explicit `agentRequiresConfirmation`.

### 7.9 Comparison — Milestone 6

Side-by-side and delta views: basis vs basis (e.g. GAAP vs tax), previous vs current, expected vs actual, source vs source, investment book vs accounting book.

**Rules**
- Deltas show absolute, percentage and unit values; user picks the primary.
- Tolerances come from configuration and mark the delta with a text label (within, near, breach) plus colour.
- Missing, unavailable, not applicable and zero are four different displays.
- Each side shows source, effective date, update time, override provenance.

**Acceptance**
- [ ] A tolerance breach is identifiable without colour.
- [ ] Zero and missing never render the same.

### 7.10 Audit History — Milestone 6

Record timeline plus a filterable grid, from `AuditEvent`.

**Rules**
- Shows actor type (user, system, job, interface, external, agent), time, effective date, before and after, note, evidence.
- Immutable events show a lock; the UI cannot edit or delete them.
- Evidence can be attached (files, linked records, jobs).
- Data-changing actions write audit from their first release, even before this UI ships.

**Acceptance**
- [ ] Every proof-journey action that changes data produces an event with before and after.
- [ ] Agent events show the user they acted on behalf of.

### 7.11 Jobs, Processing and Results — Milestone 5

Reports, exports, data requests, large bulk actions, imports and close processing run as jobs.

**Anatomy:** job tray (badge for running and unread finished) · jobs grid (type, status, mine) · job detail (inputs, log, outputs, row results) · retry, cancel.

**Rules**
- Users can leave after submit. Completion raises a notification linking to results.
- Failed jobs show the reason and retry with the original inputs.
- Jobs persist across API restart.

**Acceptance**
- [ ] A job submitted, browser closed, shows its result on next sign-in.
- [ ] Retry needs no re-entry of inputs.

## 8. Compositions (`packages/compositions`)

| Composition | Built from | Milestone |
| --- | --- | --- |
| Transaction Blotter | Grid, Views, Picker, Fields, Dates, Actions, Bulk | 4 |
| Spreadsheet Import Wizard | Grid, Fields, Dates, Validation, Bulk, Jobs | 4 |
| Exception Queue | Grid, State, Bulk, Audit, Jobs, Comparison | 6 |
| Period Close Console | Dates and Periods, Exception Queue, Bulk, Jobs, Audit | 6 |
| Price Review | Grid, Comparison, Exception Queue, Fields | 6 |
| Approval Queue | Grid, Bulk, Audit | 6 |
| Client Home | Grid, Views, Jobs (statements) | 7 |

### 8.1 Spreadsheet Import Wizard

Spreadsheets are how manual work enters the system today. Make them a governed entry point.

**Quick paste (default for ≤500 rows):** paste straight into a blank batch grid using the user's last mapping. Cells validate as they land. No wizard steps. The wizard below is for files and first-time mappings.

1. Paste from clipboard or upload CSV/XLSX.
2. Map columns to target fields (auto-match by header; save mapping per user).
3. Validate every row against `FinancialValue` and `BusinessDate` rules and API checks.
4. Show a results grid: valid, warning, error, with messages per cell.
5. Fix in-grid or exclude rows.
6. Commit as a bulk action (preview, confirm, audit). Large files run as a job.

**Acceptance**
- [ ] A 5,000-row paste validates in under 5s and shows row-level errors.
- [ ] No row commits while it has an error.
- [ ] Every committed row has an audit event with source `imported` and the file as evidence.

### 8.2 Exception Queue

Each exception has type, severity, record, portfolio, detected by, owner (person, team, vendor or system), status, expected vs actual vs tolerance, root cause, evidence, thread, and an optional agent proposal.

**Resolutions:** resolve, accept, accept conditionally (linked to a challenge), override with reason, reassign, escalate.

**What reconciliation users need beyond a list**
- **Age and SLA:** days open, and a due date by exception type. Sort by oldest by default.
- **Root-cause categories:** pick from a team-maintained list (timing, missing price, custodian error, manual entry error, corporate action). Free text is extra, not instead.
- **Recurring-break rules:** most breaks repeat every month. A user can save "this pattern, this root cause, this resolution" as a rule that auto-tags matching new exceptions as a proposal for a person to accept.
- **Group similar:** group by type + root cause + counterparty to resolve many at once.
- **Bulk evidence:** attach one custodian statement to many exceptions.

**Acceptance**
- [ ] A user can filter to "mine, high severity, new" and bulk-assign.
- [ ] A saved recurring-break rule tags next month's matching exceptions as proposals; none resolve without a person.
- [ ] One file can be attached to 50 exceptions in one action.
- [ ] Every resolution writes audit with a note.
- [ ] Evidence and thread stay with the exception; no email needed.

### 8.3 Period Close Console

**Overview first.** The landing view is a grid of every portfolio the controller owns for the period: cutoff countdown, checks passed, open high-severity exceptions, close status per type, sign-off status. Drill into one portfolio for its checklist.

Per portfolio and period: close checklist, exception counts, close status per close type, close and reopen actions, sign-off.

**Sign-off and package.** After close, the controller signs off (name, time, note) and exports a close package (PDF and XLSX): checklist results, control reports, exceptions accepted or overridden with reasons, audit summary.

**Close checklist rows (seed these as checks run by the API):**

| Check | Catches |
| --- | --- |
| Aged income and unsettled trades | Trade-date vs settle-date timing breaks |
| Cash to custodian | Unapplied receipts, outstanding wires |
| Positions and par, multi-party | Count and par mismatches |
| Missing, stale and variant prices | Prices outside thresholds |
| Regulatory rating completeness | Unrated holdings |
| Due and accrued | Unrecorded or overstated accruals |
| Market value | Differences outside tolerance |
| Earned income month over month | Missed accruals, misclassification |
| Impairments | Charges not matching credit-loss analysis |
| GL to accounting reports | Mapping breaks |

**Acceptance**
- [ ] Close is blocked while any high-severity exception is open; the block names them. A controller with the `period.overrideBlock` permission can close anyway with a reason; the override needs a second approver and is audited.
- [ ] The overview shows all owned portfolios with cutoff countdown and blocking counts on one screen.
- [ ] Sign-off produces a downloadable close package.
- [ ] Closing many portfolios runs as one job with per-portfolio results.
- [ ] Reopen requires a reason and the reopen permission; both are audited.

### 8.4 Price Review

- **Tolerance rules are user-owned.** Market data users set thresholds per asset class, currency and price source in a rules screen. Changes are audited and versioned.
- **Show which rule failed** on every price exception, with the threshold and the actual move.
- **Holiday-aware stale checks:** a price unchanged across a market holiday is not stale.
- **Bulk accept** for a filtered set (e.g. all stale prices on one closed market), with one reason.
- Vendor-vs-vendor and prior-day deltas are inline delta columns (7.1), not a separate screen.

**Acceptance**
- [ ] Changing a tolerance re-evaluates today's prices and shows how many exceptions appear or clear before saving.
- [ ] Each price exception names the rule, threshold and actual move.

### 8.5 Approval Queue

Maker-checker for overrides, reopens, close-block overrides and any action with `requiresApproval`.

- The maker sees `pendingApproval` with the approver and time waiting.
- The approver sees a queue with the before and after values, the maker's reason and evidence. Approve or reject with a note, single or in bulk.
- The maker cannot approve their own request (segregation of duties).

**Acceptance**
- [ ] A self-approval attempt is blocked with a segregation-of-duties explanation.
- [ ] Rejected requests return to the maker with the note.

### 8.6 Client Home

External clients need three things, not the full workbench: their positions, their transactions, and their statements.

- One home page: positions and transactions grids (blotter scope only), a statements list with month-end downloads.
- No job tray, no bulk actions, no admin. The command palette only shows navigation and views.
- Restricted records explain why ("outside your account scope").

**Acceptance**
- [ ] A client reaches last month's statement in two clicks from sign-in.

## 9. Journeys (`apps/web`)

| Journey | Proof type | Milestone |
| --- | --- | --- |
| Transaction Workbench: search, review, edit, import, post, reverse | High-volume | 4 |
| Period Close and Reopen across portfolios | Exception-heavy | 6 |
| Price Review | Exception-heavy, daily | 6 |
| Admin: users, groups, blotter scope | Supporting | 7 |

## 10. Build order

See `docs/PLAN.md`. Summary:

| Milestone | Delivers | Exit gate |
| --- | --- | --- |
| 0 | Repo, tooling, tokens, API skeleton, seed | `pnpm dev` runs; lint rules enforce boundaries |
| 1 | Grid, Financial Fields, State and Validation | Read-only transaction grid on 100k seeded rows |
| 2 | Views and Workspaces, Entity Picker, Date and Period | Saved views and pickers work on real API |
| 3 | Shell, Action Registry, command palette | Navigation without ribbon; palette lists actions |
| 4 | Transaction Workbench + Import | High-volume proof end to end |
| 5 | Bulk Actions, Jobs | Bulk post 500 rows with partial failure and retry |
| 6 | Exceptions, Comparison, Audit, Close Console, Price Review | Period close end to end on 2+ portfolios |
| 7 | Admin, hardening, performance, docs | All acceptance criteria green |

## 11. Research protocol (runs alongside the build)

- Each milestone: one super user and one less-experienced user from every team the milestone's journey touches.
- Method: observe the real task first, then test the prototype on the same task.
- Log findings in `docs/EVIDENCE.md` with capability, finding, decision.
- A capability moves `Hypothesis` → `Draft` with logged evidence from 3+ users.

Questions to answer:
- Which manual steps happen today, and how long does each take at month-end?
- Which spreadsheets are built every month, and what goes into them?
- What arrives by email that should arrive in the platform (prices, impairments, approvals, break evidence)?
- Which exceptions are highest-volume, highest-risk and hardest to recover from?
- Which grids and data volumes cause performance problems?

## 12. Measurement

| Headline metric | Baseline method | Target (proposed) |
| --- | --- | --- |
| Median task time, proof journeys | Timed observation of 10 users on legacy | 30% faster |
| First-time-right rate | Corrections and reversals per 100 transactions | +20 points |
| Exception resolution time | Exception created to resolved | 25% faster |
| Framework reuse | Share of journey UI from Stable assets | 80% |

Instrument analytics events from milestone 1: `view.saved`, `view.applied`, `action.invoked`, `bulk.submitted`, `bulk.retried`, `import.committed`, `exception.resolved`, `period.closed`. Send to a pluggable sink (console in dev).

## 13. Governance

- **Source of truth:** code and Storybook. Design files are optional, for stakeholder review only.
- **Each capability has** one product, one design and one engineering owner (named in `docs/OWNERS.md`).
- **Asset contract, tiered.** Draft requires: name and purpose, when to use and not, foundations, states, data contract, permissions, accessibility, code reference. Stable adds: anatomy, variants, keyboard, validation, density, analytics events, examples, tests, ownership, versioning notes, research evidence.
- **Conformance in CI:** import boundaries, no raw number formatting of financial values, axe, visual regression, interaction tests.
- **Versioning:** semver per package; breaking changes need a migration note and one release of deprecation warnings.

## 14. Assistant readiness (not built in this phase)

Do not build an AI assistant yet. Build so one can be added safely:

- All actions go through the `ActionDef` registry with schemas and descriptions.
- Agents are an `ActorType`. Their actions carry `onBehalfOf` and use that user's permissions.
- Exceptions support an agent `proposal` that a person accepts or rejects.
- `agentRequiresConfirmation` defaults to `true` for any action with consequence other than `none`.

## 15. Simulated end-user review

Six seeded users "walked through" this spec. This is a design exercise, not research. It catches obvious friction; it cannot confirm anything. Every change below is `Hypothesis` until tested with real users.

| User | What they said | Change made |
| --- | --- | --- |
| Ada, Transaction Ops super user | "I paste 40 trades from Excel straight into the grid. Don't give me a wizard." | Quick paste into a batch grid (8.1); wizard only for files and first mappings |
| Ada | "Most of my entry is cloning yesterday's trade and changing two fields." | Clone row and fill-down (7.1) |
| Ada | "Typing a word to confirm every reverse at 6pm will make me hate this." | Confirmation scales with risk; typed confirm only for irreversible or >50 rows (7.4) |
| Ada | "I run three monitors. Split panes in one window are useless to me." | Removed split layouts; added pop-out windows that stay in sync (7.1, 7.2) |
| Dev, Market Data | "Tolerances are my job. Let me set them, and tell me which rule failed." | Tolerance rules screen and failed-rule display (8.4) |
| Dev | "Prior day and second vendor should be columns next to the price, not another screen." | Inline delta columns (7.1) |
| Dev | "Every market holiday floods me with stale prices." | Holiday-aware stale checks and bulk accept (8.4) |
| Cleo, controller | "I own 20 portfolios and a deadline. Start with all of them and the countdown." | Close overview across portfolios (8.3) |
| Cleo | "Sometimes I close with a known issue. A hard block means I call IT." | Controller override of close block with reason and second approver (8.3) |
| Cleo | "Approval isn't a stretch goal. Reopens and overrides need a checker every month." | Approval Queue moved to core (8.5) |
| Cleo | "Auditors ask for the close package. I build it in Excel today." | Sign-off and close package export (8.3) |
| Rafa, Reconciliation | "The same breaks come back every month." | Recurring-break rules that propose, never auto-resolve (8.2) |
| Rafa | "One custodian statement explains 30 breaks." | Bulk evidence attach (8.2) |
| Rafa | "I work oldest first." | Age, SLA and default sort by oldest (8.2) |
| Ben, new user | "I don't know what half these codes and terms mean." | Plain text leads, codes small, glossary tooltips for new users (7.7) |
| Ben | "An empty list of views tells me nothing." | Team default workspaces and views by role (7.2) |
| Eli, external client | "I want my positions, my transactions and my statement. Nothing else." | Client Home (8.6) |

**Removed after review**
- Split-pane workspace layouts (replaced by pop-out windows).
- Entity Picker popover mode (merged into the sheet mode).
- Mandatory preview step for every bulk action.
- Typed confirmation for routine reversible actions.

**Kept despite friction**
- Reason required on every override. Users may push back; auditors will not.
- No hidden filters. Some super users like "sticky" filters; they get saved views instead.
