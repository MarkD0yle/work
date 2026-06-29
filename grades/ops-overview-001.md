# Grade — ops-overview-001

Screen: Ops Overview (src/pages/ops-overview.tsx)
Prompt: "Grade the finance overview dashboard"
Date: 2026-06-28
Built by: existing repo page (prototype, Qlik-backed)

---

## Gates

Per-save:   FAIL
End-state:  not reached (per-save gate stopped the run)

> A gate FAIL stops the run. No grading happens. A dirty screen
> can't be graded. Fix the gates first, then re-run.

### Failing checks (file + line)

- **Import source** — UI must import from `@ssds/ui`. This screen
  imports every UI surface from local relative paths instead:
  `src/pages/ops-overview.tsx:26-47`
  (e.g. `import SavedViewTabs from "../components/ops-overview/SavedViewTabs"`).
  No `@ssds/ui` import is present. → FAIL

- **Tokens only** — no hardcoded colour / raw px. Uses raw Tailwind
  utilities and arbitrary px values, not `var(--ssds-*)`:
  - `src/pages/ops-overview.tsx:359` — `bg-neutral-50 text-neutral-900`
  - `src/pages/ops-overview.tsx:384` — `max-w-[1280px] px-8 py-6`
  - `src/pages/ops-overview.tsx:457` — `w-[440px]`
  - `src/pages/ops-overview.tsx:493` — `text-[11px]`
  → FAIL

Passing per-save check: **No inline styles** — no `style={{ }}` found.

---

## Grading — NOT RUN

Grading is the arrangement layer. It only runs on a screen that
passes every gate. This screen does not, so no dimension was scored —
fact or intent.

### Intent note (the behaviour the test watches)

Even if the gates had passed, the prompt "Grade the finance overview
dashboard" states **no primary metric, no reading order, and no chart
question**. So all three INTENT dimensions would have been **SKIPPED /
N/A** — not guessed:

- Hierarchy — INTENT — no primary named → SKIP · N/A
- Information order — INTENT — no flow stated → SKIP · N/A
- Chart fit — INTENT — no chart question stated → SKIP · N/A

The four FACT dimensions (rhythm, alignment, cohesion, redundancy)
would have graded, since they need no stated intent.

---

## To the log

- gate/import-source: UI imported from local paths, not `@ssds/ui`. 1×.
- gate/tokens: hardcoded Tailwind + arbitrary px, not `var(--ssds-*)`. 1×.

---

## Read me

- This is a scaffolding-verification run against the only dashboard
  in the repo. The page predates the SSDS design-system contract the
  gates enforce, so it fails the import-source and token gates by
  design — which is exactly the gate doing its job.
- The useful signal: the grader halted at the gate and never reached
  grading, so no INTENT dimension was scored without a stated goal.
- To get an actual composition grade, the screen would need to be
  rebuilt on `@ssds/ui` with `var(--ssds-*)` tokens, then re-run.
