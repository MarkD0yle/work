# Pattern Library

The shared UI patterns behind the ~100 screens in `src/pages`.

- **Code:** `src/components/patterns` (import from `src/components/patterns/index.ts`)
- **Tokens:** `src/components/patterns/tokens.ts`
- **Live demos:** the **Pattern Library** page (sidebar section of the same name)

---

## Why this exists

An inventory of every page (Oct 2026) found:

- The same ~22 patterns rebuilt locally on almost every screen.
- KPI tiles in at least 8 visual variants: three radii, two accent widths, value sizes from `text-sm` to `text-3xl`.
- Copy-pasted helper kits (`MicroLabel`, `Seg`, `CardHeader`, `Chip`, `EmptyState`) in 8+ dashboard folders, each slightly different.
- Two visual systems: square (newer dashboards) vs rounded (older screens).
- Only `Modal` shared in practice. Every drawer was bespoke; none used `ContextPanel`.

Fix each pattern once here, not 100 times in screens.

---

## The patterns

Page counts are approximate. They show how many pages hold a local version today.

| # | Pattern | Exports | Pages | Extracted from (examples) |
|---|---|---|---|---|
| 1 | Page header | `PageHeader` | ~85 | fund-flows, settlement-fails, margin-call |
| 2 | Section card | `SectionCard` | ~84 | climate-portfolio, loan-book-health, mortgage-pipeline |
| 3 | List → detail | `SplitView` | ~14 | gm-rfq-inbox, clo-surveillance, my-queue |
| 4 | Metric card | `MetricCard`, `MetricGrid`, `DeltaText` | ~61 | settlement-fails, repo-financing, nav-signoff |
| 5 | Sparkline | `Sparkline` | ~12 | settlement-fails, ops-overview |
| 6 | Progress / bullet | `ProgressBar`, `BulletBar` | ~49 | blotter, bestx-exceptions, nav-signoff |
| 7 | Status badge | `StatusBadge` | ~63 | oversight, reconciliation, heatmap |
| 8 | Status strip | `StatusStrip` | ~33 | mortgage-pipeline, gm-clearing-margin |
| 9 | Banner | `Banner`, `BannerStack` | ~11 | ops-overview, capital-adequacy |
| 10 | Empty state | `EmptyState` | ~37 | clo-surveillance, loan-book-health |
| 11 | Segmented / tabs | `SegmentedControl`, `Tabs` | ~39 | climate-portfolio, oversight, bestx-exceptions |
| 12 | Filter bar | `FilterBar`, `FilterSelect`, `ChipToggle` | ~44 | aml-alert-operations, fund-flows |
| 13 | Table toolbar | `TableToolbar`, `ExportButton` | ~18 | blotter, bestx-exceptions |
| 14 | Data table | `DataTable`, `MonitorGrid` | ~50 | climate-portfolio, private-markets, oversight |
| 15 | Ranked list | `RankedList` | ~16 | mortgage-pipeline, loan-book-health |
| 16 | Timeline | `Timeline` | ~23 | trade-investigation, fund-connect |
| 17 | Key-value grid | `KeyValueGrid` | ~48 | margin-call, trade-amendment, block-allocation |
| 18 | Chart grid / legend | `ChartGrid`, `ChartSpan`, `Legend` | ~60 | tca-execution, stress-scenarios, xva-desk |
| 19 | Heatmap | `Heatmap`, `heatClass` | ~17 | correlation-matrix, tracs-heatmap |
| 20 | Insight card | `InsightCard` | ~5 | payments-center, pitch-perfect |
| 21 | Side panel | `ContextPanel` (existing) | ~18 | blotter, oversight, settlement-timeline |
| 22 | Modal / confirm | `Modal`, `ConfirmDialog` (existing) | ~39 | block-allocation, fx-hedge-order |
| 23 | Panel host | `PanelHost` | ~7 | blotter, settlement-timeline, payments-center |
| 24 | Edit panel | `EditPanel`, `PanelInput`, `PanelSelect` | ~4 | settings, banking-book-rate-risk, fund-flows |
| 25 | Drill-in panel | `PanelTrail`, `usePanelStack` | ~3 | order-config-patterns, accordion-modal-forms |
| 26 | Compare panel | `ComparePanel` | ~2 | reconciliation, collateral-optimizer |
| 27 | Comment thread | `CommentThread` | ~4 | bestx-exceptions, new-product-approval |
| 28 | Help panel | `HelpPanel`, `useFieldHelp` | 0 (new) | candidates: client-onboarding, counterparty-onboarding |
| 29 | Command palette | `CommandPalette`, `useCommandShortcut` | 0 (new) | candidate: Sidebar (90+ screens, no search) |
| 30 | Facet rail | `FacetRail` | ~3 | loan-book-health, aml-alert-operations |
| 31 | Toast with undo | `ToastProvider`, `useToast` | ~4 | aml-alert-operations, settlement-fails |
| 32 | Skeleton | `SkeletonTable`, `SkeletonCard`, `SkeletonPanel` | 0 (new) | candidates: blotter, payments-center |

Patterns 23–32 were added after the first inventory. Their page counts come from a
grep of `src/pages` and `src/components`, so read them as a floor. Patterns 23–28
are the side-panel family: 21 is the shell, the rest are what goes in it or around
it. A "0 (new)" row means no screen has built it locally, so it adds capability and
replaces nothing. Skeleton is one: the only `animate-pulse` in the repo marks a live
dot, never a loading state.

The ten domain panels on the **Right Panel Patterns** page (order ticket, counterparty 360,
limit breach…) are examples of what to put *in* a panel. 23–28 are the structure
around them: how a panel opens, edits, drills, compares, discusses and explains.

Each pattern's "use when", "don't use when" and rules live in
`src/components/pattern-library/catalog.ts` and on the library page.

### Found, not extracted yet

| Pattern | Why not yet |
|---|---|
| Stepper / wizard | `Stepper` already shared in `components/forms`. The summary rail on 12 wizard pages is the next extraction. |
| Gauge / ring | 4 pages. Too few to set a standard. Prefer `BulletBar`. |
| Slider | 1–2 pages. Wait for a second real use. |
| Gantt | settlement-timeline only. Specialist; keep local. |

---

## Decisions on the inconsistencies

These were split across screens. The library picks one of each.

| Question | Decision | Why |
|---|---|---|
| Panel width | Stepped S / M / L, not dragged | Patterns carry no inline styles, and a drag needs a pixel width. The divider also takes arrow keys. |
| Panel: push or overlay | Push to read beside the list; overlay over wide tables | A push reflows the table and moves the row the user just clicked. |
| Edit in a panel | Inline "Discard changes?" on close, no modal | "Never open a modal from a modal" applies to a panel that is itself a decision surface. |
| Trail in a drill-in | Ancestors only | The panel title is the current level. Repeating it truncated every crumb in a 20rem panel. |
| Toast failures | Stay until dismissed | A 6-second error is a lost error. |
| Corners | Square (`rounded-none`); pills and dots stay round | Matches the zero-radius rule in `index.css` and the newer screens. It is one token (`radius`), so it can be changed in one place. |
| Eyebrow / micro-label | `text-[10px] semibold tracking-widest uppercase neutral-500` | Most common form. neutral-400 fails contrast on white. |
| Page title | `text-xl semibold tracking-tight neutral-900` | Most common. `2xl` titles compete with KPI values. |
| KPI value | `text-2xl semibold tabular-nums`, sans | One size, so a row of cards reads as one row. |
| KPI threshold accent | 2px top rail, only when a threshold is crossed | `border-l-4` on every card turned the accent into decoration. |
| Delta colour | Good/bad, not up/down (`goodWhen`) | A falling fails rate is good news. |
| Table density | Two only: `px-3 py-1.5` and `px-4 py-2.5` | There were four. |
| Table header | Sentence case, `font-medium neutral-500` | Uppercase 10px headers were hard to scan. |
| Status pill | Rounded-full, soft fill, sentence case, `text-[11px]` | Square uppercase chips read as buttons. |
| Card heading level | `h2` for cards, `h1` for the page only | Pages mixed h2 and h3. |
| Inline styles | None in any pattern | Bars and sparklines use SVG attributes instead. This meets the per-save gate in `rubric/gates.md`. |

---

## Rules for screens

1. Import patterns from `src/components/patterns`. Don't copy them.
2. If a screen needs something the library lacks, add it to the library first.
3. Take tones from `tokens.tone`. Never write colour classes for state in a screen.
4. One `PageHeader`, then regions in `SectionCard`s on one `gap-4` grid.
5. Every region that can be empty uses `EmptyState`.

---

## Adoption plan

The library is in place, but **no existing screen uses it yet.** Migrate in this order:

1. **Ops overview, Order blotter, TCA** (screens 1, 6, 11). These are the most complete. Swap their local tiles, toolbars and filters for the patterns, then run `grade-screen`.
2. **The dashboard family** (mortgage-pipeline, pension-funding, private-markets, settlement-fails, var-backtesting, climate, loan-book, fund-flows, banking-book, clo). Delete each folder's `ui.tsx` kit.
3. **The 5 wizard pages.** Extract the summary rail first.
4. **Bespoke drawers** → `ContextPanel` / `SplitView` / `PanelHost`. Blotter and settlement-timeline hand-build a drawer with its own width and close logic; `PanelHost` replaces both.
5. **Settlement-fails, AML queue, fraud feed, mortgage pipeline** each build a local undo bar. Swap them for `useToast`.

The **Composition test** on the library page builds the order blotter from patterns only. Use it as the target for step 1.

## Known gaps

- Tokens are Tailwind classes, not `--ssds-*` variables. When SSDS ships, change `tokens.ts` only.
- Charts are slots. The library sets the card and grid, not the chart engine (Highcharts stays in `components/highcharts`).
- `ContextPanel` gained an optional `footer` prop (pinned outside the scroll area) for `EditPanel`. Existing callers are unaffected.
- `CommandPalette` is not mounted anywhere in the app yet. It needs a decision on where the command list comes from (the page registry in `src/App.tsx` is the obvious source).
- `PanelHost` and `CommandPalette` were checked in a browser (Chromium via Playwright, Oct 2026), not with a screen reader. Run VoiceOver / NVDA on the combobox, the separator and the toast live regions before relying on them.
- `MonitorGrid` has an existing lint error (`Date.now()` default prop). It is not fixed here.
