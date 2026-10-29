# Handoff: AI Assistant (floating · docked · full screen) → rebuild in OneDS

> **The one rule: this is a port, not a redesign.**
>
> The files in `reference/` *are* the screen. Copy them, keep every logic file
> exactly as it is, and replace only the **visual layer** of the view files
> (Tailwind classes, hex colours, lucide icons, Highcharts styling) with OneDS
> components and tokens. Structure, order, copy, data, state and interactions
> stay the same.
>
> If you catch yourself picking a "better" pattern (a chat SDK's message list,
> a toast for "Copied", a modal for the context panel, a stepper for the
> reasoning trace, a drawer library for the docked pane) **stop**. That is the
> reimagining this spec exists to prevent. §3 lists what is forbidden here.

---

## 0. How to use this folder

```
ai-assistant-oneds/
  README.md                      ← this spec. Read all of it before writing code.
  ai-assistant-oneds.prompt.md   ← paste-ready Copilot prompts, one per run
  screenshots/                   ← what "same screen" means. 20 states. Compare against these.
  reference/src/                 ← the original code. Read-only. Same folder layout as the source repo.
    components/ai-chat/
      data.ts                    ← LOGIC: types, client scope, scripted answers, number formats
      blotterScope.ts            ← LOGIC: blotter scope — answers computed from the blotter's rows
      useChat.ts                 ← LOGIC: the one conversation (messages, streaming, scope, sources)
      blocks.tsx                 ← VIEW: text, KPI, chart, table, callout blocks + IconButton
      Thread.tsx                 ← VIEW: thread, empty state, message, composer, mode toggle
      ContextPanel.tsx           ← VIEW: right panel (Context / Workspace / Sources)
      FloatingChat.tsx           ← VIEW: launcher, floating window, shared WidgetHeader
      DockedChat.tsx             ← VIEW: docked pane, resize handle, collapsed strip
      HostPage.tsx               ← VIEW (prototype only): sample client overview page
    components/highcharts/       ← chart wrapper used by ChartBlock (see §6.4)
    lib/highcharts.ts            ← Highcharts bootstrap + global theme
    hooks/useLocalStorage.ts     ← LOGIC: persisted state
    pages/ai-assistant.tsx       ← VIEW: the page — layout switch, full-screen layout, host frame
    pages/blotter.tsx            ← HOST ONLY. Not part of this port (§1.3)
    ai-assistant.css             ← the screen's CSS rules (animations, host-frame fix)
```

### 0.1 Two kinds of file. Treat them differently.

This is the most important instruction in the spec.

| Kind | Files | What you do |
|---|---|---|
| **Logic — copy unchanged** | `components/ai-chat/data.ts`, `useChat.ts`, `hooks/useLocalStorage.ts` | Copy byte for byte. **Do not edit, rename, reformat or "tidy" them.** They hold every answer, number, rule and flow. If they are unchanged, behaviour is unchanged. |
| **Logic with one fix** | `components/ai-chat/blotterScope.ts` | Change **only** its first import so `INITIAL_ROWS` and `OrderRow` come from wherever the target's blotter keeps its data. Nothing else. |
| **View — convert** | `blocks.tsx`, `Thread.tsx`, `ContextPanel.tsx`, `FloatingChat.tsx`, `DockedChat.tsx`, `HostPage.tsx`, `pages/ai-assistant.tsx`, `ai-assistant.css` | Keep the JSX tree, props, hooks, handlers, ARIA and copy. Swap the styling for OneDS (§4–§6). |

Every view gets its state from **one** hook: `const chat = useChat(host)` in the
page, passed down as `chat`. A view never decides an answer, a format or a
streaming step itself. If a view needs a value, it is already on `chat`.

`useChat.ts` imports the `Artifact` **type** from `ContextPanel.tsx`. Keep that
type exported, with the same shape, from the converted `ContextPanel`.

### 0.2 Order of work (one run each — see the prompt file)

1. **Run 1 — Logic + blocks.** Copy the logic files. Convert `blocks.tsx`
   (all five blocks and `IconButton`) and the chart wrapper. Build a throwaway
   test page that renders every block in every tone. Stop.
2. **Run 2 — Thread + full screen.** Convert `Thread.tsx`, `ContextPanel.tsx`
   and the full-screen branch of `pages/ai-assistant.tsx`.
3. **Run 3 — Floating.** Convert `FloatingChat.tsx` and the floating branch.
4. **Run 4 — Docked + host.** Convert `DockedChat.tsx`, the docked branch,
   `HostFrame` and `HostPage.tsx`, and wire the blotter scope to the target's
   blotter.

Never convert more than one run's files in a run. Never start a layout before
the blocks are done.

### 0.3 Precedence

- `reference/` decides content, structure, copy, data, logic and behaviour.
- `screenshots/` decides layout, grouping, hierarchy and density.
- OneDS decides colour, type, spacing, radius, borders, shadows, icons, motion
  and control styling.
- This spec decides which OneDS thing replaces which source element.

### 0.4 Source stack

React 19, TypeScript, Tailwind v4 (including **container queries**:
`@container`, `@md:`, `@xl:`, `@3xl:`), `lucide-react`, Highcharts 13 (via
`components/highcharts/HighchartsView.tsx`). No chat, drawer or resize library —
everything is hand-built. The page exports `title = "AI Assistant"`,
`section = "patterns"`, `fullWidth = true` and the default export
`AiAssistant`. Keep those.

The model is **mocked**: a prompt is matched by keyword to a scripted answer
(`data.ts`, `blotterScope.ts`). Wiring a real model is **out of scope** for this
port. Keep `scope.answer(prompt)` as the single seam where it will plug in later.

---

## 1. What the screen is

One AI chat for a wealth / markets desk, in **three layouts that share one
conversation**. Switching layout keeps the thread, the draft and a streaming
answer exactly where they were.

| Layout | Use it for | Screenshots |
|---|---|---|
| **Full screen** | Deep work on a question: history rail, thread, right panel | `01`–`07`, `18` |
| **Floating** | A quick question over any page: launcher → 420px window | `08`–`10`, `17`, `19` |
| **Docked** | Working beside a dense screen: a pane that pushes the page over | `11`–`16`, `20` |

A **Floating | Docked | Full screen** toggle (`ModeToggle`) switches layout. The
choice, the dock width and the host page are remembered in `localStorage`
(`ai-assistant.mode`, `ai-assistant.dockWidth`, `ai-assistant.host`).

### 1.1 Full screen (`01`–`07`)

```
┌ RAIL 256px ──────┬ HEADER  chat title · scope chip · ModeToggle · (show panel) ┬ PANEL 400px ──────────┐
│ Assistant  [⇤]   │                                                              │ Context│Workspace│Sources [⇥]
│ [+ New chat]     │ THREAD  max 768px, centred                                   │                        │
│ [Search chats]   │   empty state: greeting + 6 prompt cards (grid)              │ tab body (scrolls)     │
│ Today / Yesterday│   or messages                                                │                        │
│ / Last 7 days    │                                                              │                        │
│ user card        │ COMPOSER  textarea · attach · @scope chip · send/stop        │                        │
│                  │ disclaimer line                                              │                        │
└──────────────────┴──────────────────────────────────────────────────────────────┴────────────────────────┘
```

- Rail hides below `md`. The panel is in flow at `xl` and up, and an overlay
  below `xl`. It starts closed below 1280px.
- **Context tab:** scope card (kind, name, as-of, facts), data-source
  checkboxes, entitlements notice.
- **Workspace tab:** a picker of every chart/table opened from the thread, and
  the chosen one at panel size (`05`). Empty state when none are open.
- **Sources tab:** numbered sources cited by the latest answer (`06`).

### 1.2 Floating (`08`–`10`) and docked (`11`–`16`)

Both use `compact` thread and composer, and the same `WidgetHeader`:
**icon · title + scope · New chat · Expand to full screen · close**.

- **Floating:** launcher button bottom-right ("Ask Assistant"). Window
  420 × min(680, 100vh−48), bottom-right. Full screen below `sm`. Esc minimises
  and returns focus to the launcher.
- **Docked:** pane on the right that **pushes the page**, never overlays it (at
  `lg`+). Width 320–640px, default 400. Drag the left edge or use the
  keyboard (§5.4). Closing leaves a 44px "Assistant" strip (`12`). Below
  `lg` it overlays at full width and closes to a corner button (`20`).
- **The rule:** the widgets hold the conversation only. Anything that needs the
  side panel (open a chart or table large, click a source chip, click the
  composer's scope chip) **switches to full screen with that tab open**. Never
  squeeze a second panel into a widget.
- A pulsing dot on the launcher or strip shows that an answer is still
  streaming while the chat is closed.

### 1.3 Host pages and scope (`13`–`17`)

- In floating and docked mode, a dark **Prototype** bar sits above the host
  page. It holds the host picker (Client overview | Order blotter) and the
  `ModeToggle`. See §10.1 — this bar is a prototype harness.
- **The assistant follows the page it sits on.** `Scope` (`client` or
  `blotter`) drives the chip, greeting, prompts, Context facts, data sources
  and answers. Switching host keeps the thread and adds a note:
  "Now looking at …" (`16`).
- Blotter answers are computed from the blotter's own seeded rows, so order IDs
  in the chat exist in the grid. They read the book **at the open** and say so.
- `pages/blotter.tsx` is in `reference/` only so you can see the host and the
  data source. **Do not port the blotter in this handoff.** In the target, dock
  the assistant beside the target's own blotter screen.
- `HostFrame` sets `transform: translateZ(0)`. That makes it the containing
  block for `position: fixed` inside the host, so the blotter's own new-order
  drawer opens inside the blotter column, not over the docked pane (`15`).
  Keep that behaviour with whatever OneDS layout you use.

---

## 2. Non-negotiables (check before opening the PR)

1. **Same regions, same order, same copy.** Word for word, including `·`
   separators, `—` dashes, `…`, `@` on the chip, `±`, `£`, `−` (true minus).
   Do not add, drop, merge, rename or reorder anything.
2. **Logic files are untouched** (§0.1). `git diff` against `reference/` must
   be empty, except the one import in `blotterScope.ts`.
3. **One conversation across all layouts.** Switching layout or host never
   clears messages, the draft or a streaming answer.
4. **Answers are structured, not markdown blobs.** Each answer renders as its
   typed blocks in order: reasoning trace → blocks → source chips → actions →
   follow-ups (latest answer only).
5. **Streaming stays block by block** (650ms per block, in `useChat`). The
   "Working — …" line shows before the first block. Stop ends it and shows
   "Stopped. Regenerate to see the full answer."
6. **Sign and colour on numbers.** Signed formats (`spct`, `bps`, `money`) are
   green when positive and red when negative, with `+`/`−` in the text.
   Colour supports the sign; it never replaces it. `pct` and `num` are never
   coloured.
7. **Scope is always visible.** The scope name is in the header (full screen),
   the widget header and the composer chip. The as-of time is on the Context
   card and on every source.
8. **Turned-off sources are honest.** If an answer needs a source the user
   switched off, the answer starts with the warning callout (`07`). Keep it.
9. **The disclaimer stays** under every composer: full text in full screen, the
   short text in widgets.
10. **Numbers use tabular figures** everywhere a number can change.
11. **Radius, elevation and shadows are OneDS's.** The source is square-cornered
    because of *its* rules. Do not copy that.
12. **No hardcoded colour, size or font.** Everything comes from OneDS tokens.

---

## 3. What reimagining looks like here (do not do these)

- Swapping the thread for a chat-SDK message list, or bubbles for both sides.
  (User messages are a shaded block on the right. Assistant answers are
  full-width, with an avatar in full screen only.)
- Rendering answers as markdown, or merging blocks into one card.
- Turning the reasoning trace into a stepper, timeline or accordion group.
- Making the context panel a modal or a drawer in full screen at `xl`+.
- Replacing "expand to full screen" with an in-widget second panel.
- Making the docked pane overlay the page at `lg`+, or dropping the resize.
- Adding toasts ("Copied"), avatars on user messages, timestamps on user
  messages, typing dots, emoji reactions, or a model picker.
- Changing the prompt cards into chips, or the follow-ups into a menu.
- Hiding blocked actions. Send is **disabled** when the draft is empty; it is
  never removed.

---

## 4. The blocks (Run 1)

`blocks.tsx` renders one `Block` (`data.ts`) each. Contracts:

| Component | Props | Must keep |
|---|---|---|
| `TextBlock` | `md` | Only `**bold**`, numbered lists (`1. `) and paragraphs. No other markdown. |
| `KpiBlock` | `items: Kpi[]` | 3 items → 3 columns always. 4 items → 2 columns, 4 from `@xl`. Cells separated by 1px dividers. `tone` colours the delta only. |
| `ChartBlock` | `id, spec, onOpen?, size` | Card header: title + Copy data (TSV) + Open in side panel. Heights: `compact` 200, `inline` 240, `panel` 360. Legend only when >1 series. A single signed series colours each bar by sign. Zero line drawn. |
| `TableBlock` | `id, spec, onOpen?` | Same card header. `<table>` with `scope="col"` headers, right-aligned mono numbers, horizontal scroll inside the card. Copy = TSV of the formatted values. |
| `CalloutBlock` | `tone: info \| warn, text` | `role="note"`, leading icon, left accent border. |
| `IconButton` | `label, onClick, children` | 28×28, `aria-label` **and** `title` = label. Used everywhere. |

Copy buttons swap to a check and the label "Copied" for 1.4s. That is the only
feedback. No toast.

---

## 5. The views

### 5.1 Thread — `Thread.tsx` · state from `chat`

- `ThreadView` is the scroll container and the **`@container`**. It
  auto-scrolls to the bottom on every message change.
- **Empty state, full** (`01`): icon tile, "Good morning/afternoon/evening,
  James", "Ask about <scope.name>. <scope.intro>", then every
  `scope.prompts` card: group (uppercase) / title / prompt. 1, 2 (`@lg`) or 3
  (`@3xl`) columns.
- **Empty state, compact** (`09`, `13`): smaller greeting, "Try asking", the
  first 4 prompts as a bordered list: group label (72px) + prompt.
- **Note message** (`16`): centred small text between two rules, `role="status"`.
- **Assistant message:** avatar (full only) · trace toggle ("Used N steps ·
  M sources", `aria-expanded`) · blocks · source chips (numbered; click →
  Sources tab) · actions (Copy answer, Regenerate, Good, Bad, time) ·
  follow-ups. Follow-ups wrap in full screen and stack in compact.
- **Composer:** auto-growing textarea (max 200px full / 120px compact).
  **Enter sends, Shift+Enter is a new line**, IME composition does not send.
  Attach (no-op in the prototype), `@scope.chip` button (→ Context tab), then
  Send (disabled when empty) or Stop (while streaming).
- **`ModeToggle`**: `role="radiogroup"` of three `role="radio"` buttons, each
  with an `aria-label`. Labels are visible from `sm`, icons only below.

**State matrix — thread**

| State | How to reach it | Expect |
|---|---|---|
| Empty | New chat | Greeting + prompts for the current scope |
| Streaming, no blocks | Send | "Working — <first step>…" with a pulsing square |
| Streaming | ~1s after send (`02`) | Blocks fade in one by one, cursor block below |
| Done | Wait | Chips, actions, follow-ups (latest answer only) |
| Trace open | Click "Used …" (`04`) | Steps listed with checks |
| Stopped | Stop while streaming | Partial blocks + "Stopped…" line |
| Regenerate | Click regenerate | Same answer streams again from block 0 |
| Fallback | Ask "what's the weather" | "I can't answer that…" + follow-ups |
| Source off | Untick a source, ask (`07`) | Warning callout first |

### 5.2 Full screen — `pages/ai-assistant.tsx` (bottom branch) + `ContextPanel.tsx`

- Header left padding `pl-32` exists only to clear the source gallery's floating
  Home button. **Drop it** (allowed deviation, §8).
- Rail: history is grouped Today / Yesterday / Last 7 days; the selected item
  has `aria-current="page"`. History clicks only select (no loading). Keep that.
- Panel tabs: `role="tablist"` / `role="tab"` / `aria-selected`. The Workspace
  tab shows a count badge when items exist.
- Context tab checkboxes each have `aria-label="Use <source label>"`.

### 5.3 Floating — `FloatingChat.tsx`

- Launcher: "Ask Assistant", 56px tall, bottom-right 24px. It gets focus back
  after Esc or Minimise (`focusOnMount`).
- Window: `role="dialog"`, `aria-label="Assistant"`. It focuses the textarea
  **once** on open (not on every render). Esc minimises. The open animation
  grows from the bottom-right (§6.5).
- Below `sm`: full screen, and the close icon is `X` instead of `Minus`.

### 5.4 Docked — `DockedChat.tsx`

- `aside` with `aria-label="Assistant"`. At `lg`+ it is in the flex row, so the
  host shrinks. Width comes from `--dock-w`.
- **Resize handle:** `role="separator"`, `aria-orientation="vertical"`,
  `aria-label="Resize assistant"`, `aria-valuemin/max/now`, `tabIndex=0`. A 6px
  hit area over the border, with the grip visible on hover/focus. Pointer
  capture while dragging. Keys: ←/→ ±16px, Home = 640, End = 320.
  Clamped 320–640.
- **Collapsed strip** (`12`): 44px column, icon tile + vertical "Assistant" label.
  Below `lg`: a 56px corner button instead.

**State matrix — docked** (verified in the source with Playwright)

| Action | Expect |
|---|---|
| Drag the edge 150px left from 400 | ≈ 550px |
| Focus the handle, End | 320 |
| Then ← | 336 |
| Close, then reopen | Same thread |
| Reload | Same mode and width |
| Blotter host, "+ New order" | Drawer's right edge = pane's left edge (`15`) |

### 5.5 Host — `HostFrame` (in the page) + `HostPage.tsx`

- `HostFrame`: Prototype bar (48px, dark) → frame (`ai-host-frame`,
  transform, `overflow: hidden`). The CSS rule `.ai-host-frame .h-screen
  { height: 100% }` makes full-height host pages fit under the bar.
- `HostPage` uses container queries (`@xl`, `@3xl`, `@4xl`) so it reflows to
  **its own** width when the pane docks. Keep container-based breakpoints, not
  viewport ones.

---

## 6. Token, colour and library mapping

Look every OneDS name up in OneDS. Don't guess them. Map by **role**.

### 6.1 Roles

| Source | Role | OneDS |
|---|---|---|
| `bg-white`, page `bg-neutral-50` | surface / canvas | `<fill in>` |
| `bg-neutral-50` rail, table head, user message `bg-neutral-100` | subtle / sunken surface | |
| `border-neutral-200` / `100` | border default / subtle | |
| `text-neutral-950/900/800` · `600/500` · `400` | text primary · secondary · tertiary | |
| `bg-neutral-900` (New chat, Send, avatar, number badges) | **primary action / brand mark** | |
| `bg-neutral-900` Prototype bar | inverse surface (prototype chrome only) | |
| `emerald-700` text, `emerald-50/200` notice | positive / success | |
| `red-700` text | negative / danger | |
| `amber-500` border, `amber-50` fill, `amber-900` text | warning | |
| `sky-600` border, `sky-50` fill, `sky-900` text | info | |
| `emerald-500` dot (scope chip, streaming dot `emerald-400`) | status: live / connected | |

### 6.2 Type roles

| Source | Use | OneDS |
|---|---|---|
| 24px semibold | full-screen greeting | heading large |
| 18px semibold | compact greeting, host H1 | heading medium |
| 14px semibold | header title, prompt card title | title / heading small |
| 14px, `leading-relaxed` | message text, composer | body |
| 12–13px | chips, follow-ups, table cells, panel text | body small |
| 10–11px uppercase tracking | group labels, section labels | overline / caption |
| 20px semibold tabular | KPI value | numeric / display small |
| mono tabular | table numbers, number badges | mono numeric |

### 6.3 Chart colours (`blocks.tsx` → `chartOptions`)

| Literal | Role | OneDS |
|---|---|---|
| `#047857` (`POS`) | positive data | data-vis positive |
| `#b91c1c` (`NEG`) | negative data | data-vis negative |
| `#111827` | primary series | data-vis categorical 1 |
| `#9ca3af` | benchmark series | data-vis categorical neutral |
| `#e5e5e5`, `#f0f0f0`, `#a3a3a3` | axis line, grid line, zero line | chart axis / gridline tokens |
| `#525252`, `#737373` | axis label text | text secondary / tertiary |

`POS` and `NEG` are exported from `data.ts` (a logic file). **Do not edit
`data.ts`.** Map them in the chart view: read token values and ignore the
constants.

### 6.4 Charts

Keep the chart **types and options** (line / bar / column, signed colouring,
legend rule, heights, zero plot line, `{value}<unit>` axis labels, shared
tooltip with unit suffix and one decimal). Whether Highcharts stays is decision
§10.2. If OneDS has a chart component, rebuild `ChartBlock` on it with the same
behaviour. If not, keep Highcharts and theme it from tokens only.

### 6.5 Libraries and motion

| Source | Replace with | Notes |
|---|---|---|
| `lucide-react` | OneDS icons | 27 icons: `AlertTriangle ArrowUp Check ChevronDown Copy Database FileText Info Maximize2 Minus PanelLeftClose PanelLeftOpen PanelRight PanelRightClose PanelRightOpen Paperclip PictureInPicture2 Plus RotateCcw Search ShieldCheck Sparkles Square SquarePen ThumbsDown ThumbsUp X`. Pick the closest by meaning; log any without a match. `Sparkles` is the assistant's mark everywhere — use one OneDS AI icon consistently. |
| Highcharts | see §6.4 | |
| Tailwind classes | OneDS props/tokens | All of them, including container queries (use OneDS's container/responsive API, or CSS `@container` with OneDS breakpoint tokens) |
| `ai-block-in` (0.3s fade + 4px rise) | OneDS motion token | each streamed block |
| `ai-float-in` (0.2s fade + 12px rise + scale .98, origin bottom-right) | OneDS motion token | floating window open |
| `animate-pulse` | OneDS motion / status | Working square, streaming dot, cursor |
| `style={{ … }}` (2 places) | keep | `--dock-w` and the host bar widths are computed. Keep them. |

Honour `prefers-reduced-motion` for every animation (the source turns both
keyframes off).

---

## 7. Accessibility (keep what the source does)

- Exactly one `<h1>` per layout (the chat title in full screen, the host's in
  widgets). The empty-state greeting and the host cards are `<h2>`. Context
  panel section labels are plain text, not headings — keep them that way
  (don't add headings).
- Thread `<ol aria-live="polite">`; note messages `role="status"`; callouts
  `role="note"`.
- `IconButton`s always have `aria-label` + `title`. Copy changes its label to
  "Copied".
- Tabs, radiogroup, separator, dialog and checkbox semantics as listed in §5.
- Focus: the floating window focuses the input once on open; Esc returns focus
  to the launcher. Docked focuses the input on open.
- Keyboard: every control reachable. Enter / Shift+Enter in the composer.
  Resize with the arrow keys, Home and End.
- WCAG 2.1 AA contrast, including signed numbers in tables, chip text, and the
  Prototype bar.

---

## 8. When OneDS doesn't fit

1. Use the closest OneDS component or token.
2. If none exists, compose it from OneDS primitives and tokens.
3. Never fall back to Tailwind, hex values or lucide "to keep it working".
4. List every substitution in the PR:

| Element | What OneDS may lack | What you build instead |
|---|---|---|
| Docked resize handle | maybe no splitter | `role="separator"` on OneDS tokens, same keys and clamps |
| Collapsed vertical strip | maybe no vertical label | `writing-mode: vertical-rl` on OneDS type tokens |
| Container queries | maybe viewport-only breakpoints | CSS `@container` with OneDS breakpoint values |
| Fixed-position containment (`HostFrame`) | n/a — CSS | keep `transform` (or `contain: layout` if it gives the same result) |
| Chart theme | maybe no chart tokens | map §6.3 to data-vis tokens |
| (add any others) | | |

**Allowed deviations (only these):** OneDS radius, elevation and shadows; OneDS
focus and hover styles; OneDS icon shapes where the meaning is the same;
dropping the `pl-32` / `pt-16` padding that clears the source gallery's Home
button. Anything else that changes how the screen looks needs sign-off. Ask
first.

---

## 9. Acceptance checklist

**Per run (copy into the PR)**
- [ ] Side by side with the run's screenshots: same regions, order, copy and numbers.
- [ ] Every row of the relevant state matrix (§5.1, §5.4) passes.
- [ ] Keyboard only: every control reachable; Enter / Shift+Enter; Esc in floating; resize keys in docked.
- [ ] Nothing added: no toasts, avatars, menus, model pickers or states that aren't in `reference/`.

**Logic untouched**
- [ ] `diff` of `data.ts`, `useChat.ts`, `useLocalStorage.ts` against `reference/` is empty.
- [ ] `blotterScope.ts` differs only in its first import line.
- [ ] Views still get all state from `chat`; no answer, format or streaming rule re-implemented in a view.

**One conversation**
- [ ] Ask in full screen → switch to Floating → Docked → back: same thread, same draft.
- [ ] Switch layout mid-stream: the answer keeps streaming.
- [ ] Switch host: the thread is kept and the "Now looking at …" note appears.

**Only OneDS** — run in the converted folder; every command must print nothing:
```
grep -rnE 'className="[^"]*\b(flex|grid|p[xytrbl]?-|m[xytrbl]?-|text-|bg-|border-|rounded|shadow)' .
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' .
grep -rnE '\b(neutral|emerald|red|amber|sky)-[0-9]{2,3}\b' .
grep -rnE 'from "lucide-react"' .
```
(Exceptions only where §8 logged them. `data.ts` keeps `POS`/`NEG` — logic file, §6.3.)

**Quality**
- [ ] Typecheck, lint and build pass.
- [ ] WCAG 2.1 AA contrast.
- [ ] The PR description lists OneDS gaps and any deviation.

---

## 10. Open decisions (answer before Run 1)

1. **The Prototype bar and host picker.** They exist so reviewers can try the
   assistant on two pages. In the product, the assistant should dock on real
   pages and take its scope from the route. Default: port `HostFrame` as a
   **demo route only**, and keep `useChat(scope)` so product pages can pass
   their own scope.
2. **Charts.** OneDS chart component, or keep Highcharts themed from tokens?
3. **Which layouts ship.** Floating and docked solve nearly the same problem.
   Port all three (default — this is a port), but flag whether the product will
   keep both widgets.
4. **Where the blotter data comes from** in the target, for the one import in
   `blotterScope.ts`.
5. **Live vs snapshot.** Blotter answers read the book at the open while the
   grid ticks live, so the chat's P&L and the grid's P&L tile differ on screen
   (`14`). The port keeps the snapshot (logic unchanged). A real build should
   answer from live data — log it as follow-up work, not part of this port.
