---
mode: agent
description: Port the five FI Studio screens into OneDS exactly as they are — one run at a time.
---

# FI Studio → OneDS

You are porting existing screens, not designing new ones. The spec is
`README.md` in this folder. Read **all** of it before you write code. When
this prompt and the spec disagree, the spec wins.

**Setup (once):** copy this whole `fi-studio-oneds/` folder into the target
repo (for example `docs/handoffs/fi-studio-oneds/`). Answer the three open
decisions in README §10 at the top of your first PR.

Run **one** of the prompts below per session, in order. Do not start the next
run until the previous PR is merged.

---

## Run 1 — logic and kit

> Follow `README.md` §0.1, §0.4 and §4. Copy every **logic** file from
> `reference/src` into `<target path>` byte for byte, keeping the folder
> layout. Replace `components/fi-terminal/tokens.ts` with only
> `export type Side = "Buy" | "Sell";`. Rewire only the body of
> `lib/navigation.ts` to our router. Then convert `components/fi-studio/tokens.ts`,
> `ui.tsx` and `StudioShell.tsx` to OneDS using §4 and §6. Keep every export
> name, prop and behaviour. Add a temporary test page that renders every kit
> component in every tone and state. Do **not** convert any screen. Finish
> with typecheck, lint, build, and the "Only OneDS" greps in §9 on the kit
> files. List gaps in the PR as in §8.

## Run 2 — Credit map

> Follow `README.md` §2, §3, §5.1 and §9. Copy
> `reference/src/pages/fi-studio-credit-map.tsx`, point its imports at the
> converted kit and logic, register the route, and convert its visual layer to
> OneDS. Keep the `<table>` heat map (no data grid). Compare against
> `screenshots/01-credit-map.png` and `01b-credit-map-how-unusual.png`. Pass
> every §5.1 state check and the §9 checklist before opening the PR.

## Run 3 — Place an order

> Same method for `fi-studio-ticket.tsx`, using §5.3. The three linked
> price/yield/spread inputs stay side by side and stay wired to `onField`,
> `nudge`, `focusField` and `blurField` from `useTicket()`. Compare against
> `screenshots/03-ticket.png`, `03b-ticket-review.png` and
> `03c-ticket-blocked.png`. Run the §5.3 state matrix.

## Run 4 — Get quotes

> Same method for `fi-studio-rfq.tsx`, using §5.2. All three cards stay
> visible (not a wizard). Quote rows stay cards that animate in. Compare against
> `screenshots/02-rfq-draft.png`, `02b-rfq-live.png` and `02c-rfq-done.png`.
> Run the §5.2 state matrix, including Esc to cancel and the timer running out.

## Run 5 — Sell a list

> Same method for `fi-studio-bwic.tsx`, using §5.4. Keep the bid grid as a
> `<table>`, keep the star + outline for best and second best, and keep the
> `role="switch"` Sell / Keep control with the `*` override marker. Compare
> against `screenshots/04-bwic.png` and `04b-bwic-confirm.png`. Run the §5.4
> state matrix.

## Run 6 — Curve ideas

> Same method for `fi-studio-rv.tsx`, using §5.5 and §6.4. Keep the hand-drawn
> SVG curve and its maths; recolour it with tokens only. Click sets the sell
> leg, Shift-click the buy leg. Compare against `screenshots/05-rv.png` and
> `05b-rv-confirm.png`. Run the §5.5 state matrix. Then delete the Run 1 test
> page.

---

## Rules for every run

- The reference decides content and behaviour. OneDS decides how it looks.
- Never edit a logic file. If a change seems to need one, stop and ask.
- Never add anything that is not in `reference/`. Never drop anything that is.
- If OneDS has no match, compose from OneDS parts and log it. Never fall back
  to Tailwind, hex/rgba colours, `lucide-react` or `framer-motion`.
- If you are unsure, ask. Do not guess and move on.
