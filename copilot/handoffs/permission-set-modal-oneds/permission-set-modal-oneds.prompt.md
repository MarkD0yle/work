---
mode: agent
description: Port the "New permission set" modal and its onboarding form into OneDS exactly as they are — one run at a time.
---

# New permission set → OneDS

You are porting an existing modal, not designing a new one. The spec is
`README.md` in this folder. Read **all** of it before you write code. When
this prompt and the spec disagree, the spec wins.

**Setup (once):** copy this whole `permission-set-modal-oneds/` folder into the
target repo (for example `copilot/handoffs/permission-set-modal-oneds/`).
Answer the three open decisions in README §10 at the top of your first PR.

Run **one** of the prompts below per session, in order. Do not start the next
run until the previous PR is merged.

---

## Run 1 — kit

> Follow `README.md` §0.1, §0.4 and §4. Copy
> `reference/src/components/accordion-modal-forms/data.ts` into `<target path>`
> byte for byte. Copy `styles.ts`, keep `nextId`, `todayIso` and the `Tone`
> type exactly, and remove the class-string constants once nothing uses them.
> Convert `kit.tsx` to OneDS using §4.1 and §6, keeping every export name,
> prop and behaviour. Map `components/patterns/Modal.tsx` onto the OneDS
> dialog using §4.2. Add a temporary test page that renders every kit
> component in every tone and state, and a dialog at the widest size. Do
> **not** convert the modal or the form. Finish with typecheck, lint, build,
> and the "Only OneDS" greps in §9 on the kit files. List gaps in the PR as in §8.

## Run 2 — the modal

> Follow `README.md` §2, §3, §5.2, §5.4 and §9. Copy `PermissionModal`,
> `countAccess` and the `PermissionSet` type from
> `reference/src/components/accordion-modal-forms/MarketAccessExample.tsx`
> into the target. Keep every state line listed in §0.1 verbatim and convert
> only the JSX. Keep the 54 rows as `<fieldset>` → `<ul>` → `<li>` with a real
> radio group per market (no data grid, no paging). Keep the filter bar sticky
> inside the dialog body. Apply the §10.1 decision. Open it from the test page
> with a blank draft and with `SEED`. Compare against `screenshots/02` to `06`
> and `08`. Pass every row of the §5.2 state matrix before opening the PR.

## Run 3 — the host form

> Same method for the rest of `MarketAccessExample.tsx`, using §5.1 and §5.3:
> the four accordion sections, `PermissionEntry` and the footer, wired to the
> Run 2 modal through `draft`, `newSet`, `saveSet` and `closeModal` exactly as
> the source does. Compare against `screenshots/01-accordion-section.png` and
> `07-saved-entries.png`. Run the §5.3 matrix and re-run §5.2 end to end from
> the real `+ Add permission set` button. Then delete the Run 1 test page.

---

## Rules for every run

- The reference decides content and behaviour. OneDS decides how it looks.
- Never edit `data.ts` or the state lines in §0.1. If a change seems to need
  one, stop and ask.
- Never add anything that is not in `reference/`. Never drop anything that is.
- If OneDS has no match, compose from OneDS parts and log it. Never fall back
  to Tailwind, hex/rgba colours or inline SVG icons.
- If you are unsure, ask. Do not guess and move on.
