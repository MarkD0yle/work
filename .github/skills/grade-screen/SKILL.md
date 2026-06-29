---
name: grade-screen
description: Grade a built screen's composition before it enters the Gallery. Runs gates first, then grades the arrangement against the composition rubric, then writes one grade file. Use when the user asks to grade, score, or review a screen or dashboard, or when a screen is being prepared for the Gallery. Grades arrangement only — never individual SSDS components.
---

# Grade a screen

Runs gates, then grades how the parts are arranged.
Writes one grade file per screen.
Never grades a component — only how components sit together.

## Inputs — read, never copy

- `gates.md` — the binary checks
- `composition-rubric.md` — dimensions, checks, bands
- `anchors/<dimension>/{low,mid,high}` — reference examples

Do not restate or regenerate these. Read them and apply.

---

## Procedure

### Step 1 — Run gates
Apply `gates.md` (per-save + end-state).
- Any FAIL → STOP. Report the file and line. Do not grade.
- All pass → continue. A dirty screen can't be graded.

### Step 2 — Fact dimensions (always run)
Rhythm, alignment, cohesion, redundancy.
Answer each yes/no check from the rubric. No intent needed.

### Step 3 — Intent dimensions (conditional)
Hierarchy, order, chart fit.
- Read the prompt. Did it state the goal for this dimension?
- **No → SKIP. Mark N/A. Do not guess.**
- Yes → answer the checks against the stated goal.

### Step 4 — Roll up to bands
Per dimension: 3 yes → High/5 · 2 yes → Mid/3 · 0–1 yes → Low/1.
Score = mean of graded dimensions. Skipped ones excluded.

### Step 5 — Write the grade file
Save to `grades/<screen>-<NNN>.md`.
Lead with the failures and why. The score is secondary.

### Step 6 — Log and promote
Each failure → log with a count.
Same failure 3× across runs → flag for the knowledge file.

---

## Rules

- Never grade a single SSDS component. Gate it, or report it upstream.
- Never guess intent. Unstated goal = unscored dimension.
- Never copy the rubric into this file. Reference it.
- The score is not the output. The failure notes are.

## Trigger example

User: "Grade the finance overview dashboard"
→ run Steps 1–6, write `grades/finance-overview-001.md`.
