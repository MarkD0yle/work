# Fund Connect — modernization prototype

Prototype screen: [`src/pages/fund-connect.tsx`](../../src/pages/fund-connect.tsx)
(sidebar: **Forms & Flows → Fund Connect**).

## What it replaces

One long page of sectioned forms, filled in by retyping values out of Excel —
including radio buttons and dropdowns. A hand-typed entry error was the
confirmed root cause of a significant loss. There was no management review
before submission, no save-to-draft, weak warnings on missing data, and a
habit of entering placeholder values to get past required fields and then
never coming back.

## Build sequence

Ordered by leverage against that cost driver, not by UI polish. Cutting from
the bottom is safe; cutting from the top ships something that looks
modernized while the actual risk is still live.

| # | Step | Status in the prototype | Where |
|---|------|------------------------|-------|
| 1 | Import + column mapping + preview | Built — paste or file, auto-mapped by header, mapping editable, first 5 rows previewed against the target fields before anything is written | `lib/fundConnect/importer.ts`, `components/fund-connect/ImportWizard.tsx` |
| 2 | Draft / review state machine, segregation of duties | Built — draft → submitted → in review → approved → amendment, with permission checks that refuse an account that both submits and approves the same version | `lib/fundConnect/engine.ts` |
| 3 | Field-level audit trail | Built — every write logs old value, new value, actor, timestamp and source | `lib/fundConnect/engine.ts`, `components/fund-connect/ActivityPanel.tsx` |
| 4 | Section status rail + condensing sections | Built — persistent rail, always-visible progress header, one section open at a time, completed sections condense to a summary row that stays on the page | `components/fund-connect/StatusRail.tsx`, `ProgressHeader.tsx`, `SectionCard.tsx` |
| 5 | Field-level rejection | Built — a reviewer attaches a note to a specific field; the submitter lands on the field, not on a paragraph | `components/fund-connect/FieldRow.tsx` |
| 6 | Re-flagging manual overrides after import | Built — a hand edit on top of an imported value flips its badge to "modified · verify" | `components/fund-connect/SourceBadge.tsx` |
| 7 | Amendment flow for approved records | Built — approved records are immutable; an amendment forks a new version linked to the original | `beginAmendment` in `engine.ts` |
| 8 | Validation against source-of-truth systems | Built against mock masters — fund, counterparty, custodian and instrument lookups resolve the code and show the resolved name back, plus a transposition-twin warning | `lib/fundConnect/reference.ts`, `schema.ts` |
| 9 | Reviewer queue / SLA, abandoned drafts | Built — waiting time against a target/breach threshold, assignee, and drafts untouched for 5+ days | `components/fund-connect/ReviewerQueue.tsx` |

## Two-tier validation

- **Draft-valid** — fund code and counterparty ID. Enough to save and find the
  record again. This is what removes the incentive to type placeholder data.
- **Submit-valid** — the full required-field check, shown as a running
  checklist in the rail and the progress header rather than a wall of errors
  at the end.

## Design / engineering split

- **Design scope** (`src/components/fund-connect/`) — status rail, condensing
  sections, progress header, source badges, field-level rejection UI. Pure
  components driven by props, no business logic.
- **Engineering scope** (`src/lib/fundConnect/`) — state machine, permissions,
  audit log, import parsing, reference lookups. No React, no Tailwind.
- Status colours reuse the ccymgmt severity tokens
  (`src/lib/severity-tokens.ts`) via `lib/fundConnect/tone.ts`: error → red
  (benchmark), reviewer flag → amber (required), warning → cream (typical).
  Record *state* is structural rather than severity, so state pills stay in
  ink — a draft is not a mild error.
- Generalizable as a Tier 2 Gallery pattern candidate: "task list shell" —
  status rail plus condensing sections, useful for any long form in Global
  Markets.

## What is mocked

Everything behind the props contract is in-memory: reference masters are
static maps with the shape a service call would return, records are seeded
in `lib/fundConnect/seed.ts`, and the clock is pinned to a fixed "now" so the
seeded history reads the same on any day. Nothing persists across a reload.

Three users are provided so the permission rules can be exercised: Priya
Raman (submitter), Daniel Osei (approver), and Marie Laurent (both — she can
approve other people's records but not her own).

## Open questions still to resolve

- **Simultaneous cross-section visibility.** The design assumes users do not
  need several sections open at once. The prototype carries an "Open all
  sections" toggle specifically so this can be tested with real Fund Connect
  users before the condensing behaviour is committed to.
- **Excel import feasibility** — data source and format variability, and
  whether compliance is happy with a pasted range as an input.
- **Risk threshold for review** — notional size, counterparty type,
  first-time setup. The prototype reviews everything; the threshold needs a
  business owner.
- **RBAC** — whether an existing role system can be hooked into for
  submitter/approver, or whether this needs new role infrastructure.
