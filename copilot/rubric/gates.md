# UX Factory — Gate File

Binary checks. Facts, not taste. Every check is yes/no.
Gates check a **rule**, never a list of components.
The canonical component list lives in `@ssds/ui` — owned by the DS team.
This file points at that source. It never copies it.

---

## Source of truth (referenced, never copied here)

- Allowed UI import source: `@ssds/ui`
- Allowed token namespace: `--ssds-*`
- Component roster: whatever `@ssds/ui` currently exports (DS team owns it)

If a new SSDS component ships, nothing in this file changes.
The rule already covers it.

---

## A · PER-SAVE GATES  (run on every `.tsx` save, all build long)

Wrong the instant they happen. Finished or not, they fail.

- [ ] **Import source** — every UI element imports from `@ssds/ui`.
      Relative path to a local copy → FAIL. Other library → FAIL.
- [ ] **No detached components** — no SSDS component source pasted
      and edited inline. Import it, don't fork it.
- [ ] **Tokens only** — no hardcoded colour (`#hex`, `rgb()`),
      no raw `px` for spacing. Use `var(--ssds-*)`.
- [ ] **No inline styles** — no `style={{ }}`. Styling comes from
      SSDS or the theme layer.

Any FAIL → report the exact file + line. Keep building.

---

## B · END-STATE GATES  (run ONCE, at the end / before the Gallery)

Half-built isn't failed. These only judge a finished screen.

- [ ] **Completeness** — every region populated. No empty slots,
      no placeholder / lorem text.
- [ ] **Accessibility props** — every interactive SSDS component
      has its required a11y props set (labels, roles).
- [ ] **Charts** — title present, axes labelled, series accessible.
      (Sourced from `chart.skill.md` — charts carry extra checks.)

Any FAIL → STOP. Screen does not enter the Gallery.

---

## What this file does NOT do

- Does **not** list SSDS components. It checks import origin instead.
- Does **not** judge arrangement. That's `composition-rubric.md` (grading).
- Does **not** re-implement the compiler. TypeScript already fails a
  non-existent import. Don't rebuild that here.

---

## Honest limit (read this)

Copilot can't see installed `node_modules`. So this gate reads the
**import string**, not the resolved package. It catches:

- detached copies, custom components, wrong libraries, hardcoded values

It can NOT catch a typo'd import of an SSDS component that doesn't
exist — that's a TypeScript / build error, and that's the right place
for it. The gate is a design-rule check, not a compiler.

---

## Order in the pipeline

1. **A · per-save gates** run continuously while you build.
2. **B · end-state gates** run when you call the screen done.
3. Only after ALL gates pass → `composition-rubric.md` grades the arrangement.

Gates check the parts are clean. Grading checks they belong together.
