---
mode: agent
description: Port the AI Assistant (floating, docked, full screen) into OneDS exactly as it is — one run at a time.
---

# AI Assistant → OneDS

You are porting an existing screen, not designing a new one. The spec is
`README.md` in this folder. Read **all** of it before you write code. When
this prompt and the spec disagree, the spec wins.

**Setup (once):** copy this whole `ai-assistant-oneds/` folder into the target
repo (for example `copilot/handoffs/ai-assistant-oneds/`). Answer the five open
decisions in README §10 at the top of your first PR.

Run **one** of the prompts below per session, in order. Do not start the next
run until the previous PR is merged.

---

## Run 1 — logic and blocks

> Follow `README.md` §0.1, §0.4, §4 and §6. Copy `components/ai-chat/data.ts`,
> `useChat.ts` and `hooks/useLocalStorage.ts` from `reference/src` byte for
> byte. Copy `components/ai-chat/blotterScope.ts` and change only its first
> import to point at the target's blotter data (§10.4). Convert
> `components/ai-chat/blocks.tsx` and the chart wrapper to OneDS, keeping every
> export name, prop and behaviour in §4 (decide charts per §10.2). Add a
> temporary test page that renders every block: text with bold and a list, KPI
> rows of 3 and 4, line / bar / column charts (one signed), a table with every
> format, and both callout tones. Do **not** convert any layout. Finish with
> typecheck, lint, build, and the "Only OneDS" greps in §9 on the converted
> files. List gaps in the PR as in §8.

## Run 2 — thread and full screen

> Follow `README.md` §2, §3, §5.1, §5.2 and §9. Convert
> `components/ai-chat/Thread.tsx` and `ContextPanel.tsx`, then copy
> `pages/ai-assistant.tsx` and convert its full-screen branch (rail, header,
> thread, composer, panel). Keep `ThreadView` as the container-query root.
> Register the route. For now, render the floating and docked branches
> unconverted, or stub them behind the mode toggle. Compare against
> `screenshots/01`–`07` and `18`. Pass every row of the §5.1 state matrix.

## Run 3 — floating

> Same method for `components/ai-chat/FloatingChat.tsx` (launcher, window,
> `WidgetHeader`) and the page's floating branch, using §1.2 and §5.3. Esc
> minimises and returns focus to the launcher. The input is focused once on
> open. Below `sm` the window is full screen. Opening a chart, a source chip
> or the scope chip switches to full screen with that tab open. Compare against
> `screenshots/08`–`10` and `19`. Check "One conversation" in §9.

## Run 4 — docked and host

> Same method for `components/ai-chat/DockedChat.tsx`, the page's docked
> branch, `HostFrame` and `HostPage.tsx`, using §1.2, §1.3, §5.4 and §5.5.
> The pane pushes the page at `lg`+ and never overlays it there. Keep the
> `separator` semantics, the keys and the 320–640 clamp. Keep the
> fixed-position containment so the blotter's drawer stays in its column. Dock
> beside the **target's** blotter; do not port the blotter. Compare against
> `screenshots/11`–`17` and `20`. Pass every row of the §5.4 state matrix. Then
> delete the Run 1 test page.

---

## Rules for every run

- The reference decides content and behaviour. OneDS decides how it looks.
- Never edit a logic file. If a change seems to need one, stop and ask.
- Never add anything that is not in `reference/`. Never drop anything that is.
- If OneDS has no match, compose from OneDS parts and log it. Never fall back
  to Tailwind, hex colours or `lucide-react`.
- If you are unsure, ask. Do not guess and move on.
