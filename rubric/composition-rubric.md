# Composition Rubric — Dashboards

Grades the **arrangement of the whole screen**.
The components are already gated. This never re-checks them.

---

## How to read this file

- Gates run first. Any fail stops the run. No grade happens.
- Grades run only on what passes the gates.
- Every grade dimension is tagged **FACT** or **INTENT**.
- **FACT** dimensions always grade.
- **INTENT** dimensions grade *only if* the prompt stated that goal.
  No goal stated → skip it. Score N/A. Do not guess.
- Checks are yes/no. They roll up into a band. Bands make the score.

Band rollup (same for every dimension):

- 3 of 3 yes → **High · 5**
- 2 of 3 yes → **Mid · 3**
- 0–1 yes   → **Low · 1**

---

## STEP 1 — GATES  (binary · must pass first)

- [ ] Every component imported from SSDS, unmodified
- [ ] Container + grid are SSDS, not rebuilt
- [ ] No hardcoded values (tokens only)
- [ ] No inline styles
- [ ] Charts: SSDS chart, with title + axis labels + accessible series

Any **no** → STOP. Return the failing item. No grading.

---

## STEP 2 — GRADE: the arrangement

### Rhythm  · FACT  (always grades)
Is the spacing consistent across the screen?

1. Are gaps between cards equal?
2. Is the gap between regions consistent?
3. Is padding inside regions consistent?

Anchor → anchors/rhythm/{low,mid,high}.png

---

### Alignment  · FACT  (always grades)
Does everything sit on a shared grid?

1. Do card edges line up to one grid?
2. Do regions share consistent margins?
3. Are there zero half-pixel / off-grid elements?

Anchor → anchors/alignment/{low,mid,high}.png

---

### Cohesion  · FACT  (always grades)
Does it read as one screen, not bolted-together parts?

1. Is one type scale used throughout?
2. Is one spacing scale used throughout?
3. Do regions feel related, not stitched?

Anchor → anchors/cohesion/{low,mid,high}.png

---

### Redundancy  · FACT  (always grades)
Is anything said twice?

1. Does a card title avoid repeating a chart title?
2. Is each metric shown once, not in two places?
3. Are labels free of duplicate wording?

Anchor → anchors/redundancy/{low,mid,high}.png

---

### Hierarchy  · INTENT  (grades only if prompt names a primary)
> Runs ONLY if the prompt names a primary metric or region.
> No primary stated → SKIP. Score N/A. Equal weight is valid.

1. Is the named primary the most dominant element?
2. Does emphasis match the stated priority order?
3. Are non-primary elements visually equal to each other?

Anchor → anchors/hierarchy/{low,mid,high}.png

---

### Information order  · INTENT  (grades only if prompt states a flow)
> Runs ONLY if the prompt states a reading order or priority.
> e.g. "alerts first, then balances, then detail."
> Nothing stated → SKIP. Score N/A.

1. Does top-left hold the stated first item?
2. Does the flow match the stated order?
3. Is the stated last item actually last?

Anchor → anchors/order/{low,mid,high}.png

---

### Chart fit  · INTENT  (grades only if prompt states the question)
> Runs ONLY if the prompt states what question each chart answers.
> e.g. "show the trend" / "show the breakdown."
> Nothing stated → SKIP. Score N/A. Do not judge chart type blind.

1. Trend question → is it a line/area chart?
2. Breakdown question → is it a bar/stacked chart?
3. Does each chart show the metric its label claims?

Anchor → anchors/chartfit/{low,mid,high}.png

---

## STEP 3 — OUTPUT  (what the grader writes)

Saved to `grades/<screen>-<NNN>.md`. See `grades/finance-overview-001.md`
for a worked example. Lead with the failures. The score is secondary.

---

## The rule the log follows

- One failure → stays in the log. A fluke.
- Same failure 3× across runs → promote to the knowledge file.
- Anchors never change here. Only the watch-list grows.
