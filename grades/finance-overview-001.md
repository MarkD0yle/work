# Grade — finance-overview-001

Screen: Finance Overview Dashboard
Prompt: "Ops finance overview. Exposure is the headline metric.
         Alerts first, then balances, then detail. All SSDS."
Date: 2026-06-27
Built by: manual (Copilot-assisted)

---

## Gates

Per-save:   PASS
End-state:  PASS

All components from @ssds/ui. Tokens only. No inline styles.
Charts labelled. All regions populated.

> Gates passed, so grading runs. Any gate fail would stop here.

---

## Grade — arrangement only

| Dimension   | Tag    | Checks | Band | Score |
|-------------|--------|--------|------|-------|
| Rhythm      | FACT   | 3 / 3  | High | 5     |
| Alignment   | FACT   | 3 / 3  | High | 5     |
| Cohesion    | FACT   | 2 / 3  | Mid  | 3     |
| Redundancy  | FACT   | 3 / 3  | High | 5     |
| Hierarchy   | INTENT | 3 / 3  | High | 5     |
| Order       | INTENT | 2 / 3  | Mid  | 3     |
| Chart fit   | INTENT | 1 / 3  | Low  | 1     |

Intent dimensions all ran — the prompt stated a headline,
an order, and what the charts answer. None skipped.

**Composition score: 3.7 / 5**

---

## What dropped the score (the useful part)

**Chart fit — Low (1/3)**
- Prompt asked the balances chart to show a *trend over time*.
  It's rendered as a bar chart. Trend → should be line/area.
- This is the real miss. A bar chart hides the movement you
  said you wanted to see.

**Order — Mid (2/3)**
- Stated order: alerts → balances → detail.
- Alerts sit top-left (correct). Balances and detail are
  swapped in the lower region.

**Cohesion — Mid (2/3)**
- Two spacing scales in the chart region — tighter than the
  card region above it. Reads as two stitched zones, not one.

---

## To the log

Each line below is logged with a count. 3× promotes it to the
knowledge file as a standing rule.

- chart-fit: trend question rendered as bar, not line. 1×.
- order: stated sequence not followed in lower region. 1×.
- cohesion: mixed spacing scale across regions. 1×.

---

## Read me

- The score is not the point. The three notes above are.
- A "3.7" you'll never ship means nothing on its own.
- The value is: you now know the chart type is wrong and the
  order is off — two things "I like it" was hiding.
- Fix, re-run, and watch whether the same notes recur. If
  chart-fit fails on the next dashboard too, that's a pattern,
  and the knowledge file should start enforcing it up front.
