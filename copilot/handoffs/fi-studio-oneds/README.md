# Handoff: FI Studio (5 screens) → rebuild in OneDS

> **The one rule: this is a port, not a redesign.**
>
> The files in `reference/` *are* the screens. Copy them, keep every logic file
> exactly as it is, and replace only the **visual layer** of the view files
> (Tailwind classes, hex/rgba colours, lucide icons, framer-motion) with OneDS
> components and tokens. Structure, order, copy, data, maths, state and
> interactions stay the same.
>
> If you catch yourself picking a "better" pattern (a data grid for the bid
> grid, a wizard for the RFQ steps, a chart library for the curve, a toast for
> the confirmation) **stop**. That is the reimagining this spec exists to
> prevent. §3 lists what is forbidden on these screens.

---

## 0. How to use this folder

```
fi-studio-oneds/
  README.md                    ← this spec. Read all of it before writing code.
  fi-studio-oneds.prompt.md    ← paste-ready Copilot prompts, one per run
  screenshots/                 ← what "same screen" means. Compare against these.
  reference/src/               ← the original code. Read-only. Same folder layout as the source repo.
    lib/navigation.ts
    components/fi-terminal/    ← LOGIC: data, bond maths, hand-off store, timers
      model/                   ← LOGIC: one hook per screen (state, checks, flows)
    components/fi-studio/      ← VIEW KIT: tokens, glossary, UI pieces, shell
    pages/fi-studio-*.tsx      ← VIEW: the five screens
```

### 0.1 Two kinds of file. Treat them differently.

This is the most important instruction in the spec.

| Kind | Files | What you do |
|---|---|---|
| **Logic — copy unchanged** | `lib/navigation.ts`, `components/fi-terminal/{bonds,format,selection,useTick,screens}.ts`, everything in `components/fi-terminal/model/`, `components/fi-studio/{glossary,screens}.ts` | Copy byte for byte. **Do not edit, rename, reformat or "tidy" them.** They hold every number, rule and flow on the screens. If they are unchanged, behaviour is unchanged. |
| **Logic with one fix** | `components/fi-terminal/tokens.ts` | The models only need its `Side` type. Replace the whole file with `export type Side = "Buy" \| "Sell";` (it is otherwise Tailwind strings). |
| **View — convert** | `components/fi-studio/{tokens.ts,ui.tsx,StudioShell.tsx}`, `pages/fi-studio-*.tsx` | Keep the JSX tree, props, hooks, handlers and copy. Swap the styling for OneDS (§4–§6). |

Each page gets **all** of its state from one hook — for example
`const { ... } = useRfq();`. A page never computes a price, a check or a
countdown itself. Keep it that way: if you need a value, it is already in the
hook's return. Never re-implement a hook's logic in the page.

### 0.2 Order of work (one run each — see the prompt file)

1. **Run 1 — Logic + kit.** Copy the logic files. Convert `fi-studio/tokens.ts`,
   `ui.tsx` and `StudioShell.tsx`. Build a throwaway test page that renders
   every kit component in every state. Stop.
2. **Runs 2–6 — one screen per run**, in this order: Credit map → Place an
   order → Get quotes → Sell a list → Curve ideas. Each run ends with the §9
   checks for that screen.

Never convert more than one screen in a run. Never start a screen before the
kit is done.

### 0.3 Precedence

- `reference/` decides content, structure, copy, data, logic and behaviour.
- `screenshots/` decides layout, grouping, hierarchy and density.
- OneDS decides colour, type, spacing, radius, borders, shadows, icons, motion
  and control styling.
- This spec decides which OneDS thing replaces which source element.

### 0.4 Source stack

React 19, TypeScript, Tailwind v4, `lucide-react`, `framer-motion`. No chart or
grid library — the charts are hand-drawn SVG (keep them SVG, §6.4). Pages
export `title`, `section` and `fullWidth`; keep those exports and the default
export names (`FiStudioCreditMap`, `FiStudioRfq`, `FiStudioTicket`,
`FiStudioBwic`, `FiStudioRv`).

The navigation helper (`lib/navigation.ts`) fires a window event that the
source gallery listens for. In the target, rewire **only its body** to the
target's router (`navigateToPage(slug)` → navigate to that screen). Keep its
signature. Slugs: `fi-studio-credit-map`, `fi-studio-rfq`, `fi-studio-ticket`,
`fi-studio-bwic`, `fi-studio-rv`.

---

## 1. What the screens are

Five linked fixed income trading screens that share one frame (the shell) and
one bond universe. A bond picked on one screen arrives pre-filled on the next
(via `selection.ts`).

| # | Screen | Slug | Job | Screenshots |
|---|---|---|---|---|
| 1 | Credit map | `fi-studio-credit-map` | Where did spreads move today, and is it unusual? | `01`, `01b` |
| 2 | Get quotes | `fi-studio-rfq` | Ask up to 5 dealers for a price, take the best | `02`, `02b`, `02c` |
| 3 | Place an order | `fi-studio-ticket` | Set a limit in price, yield or spread; check; send | `03`, `03b`, `03c` |
| 4 | Sell a list | `fi-studio-bwic` | Award a 14-line bid list to the best bids | `04`, `04b` |
| 5 | Curve ideas | `fi-studio-rv` | Find cheap/rich Treasuries; build a DV01-neutral switch | `05`, `05b` |
| — | Jump to… | (shell) | Command palette | `06` |

Every screen has the same frame, top to bottom:

```
┌ TOP BAR      FI Studio · 5 screen tabs · Jump to… ⌘K · NY/London clocks · user ┐
├ MARKETS NOW  11 live market chips (value + arrow + change)                      ┤
├ PAGE HEADER  H1 + one-line lead                         right: context slot     ┤
│ BODY         (the screen — scrolls)                                             │
└ FOOTER       Live · data source · latency · keyboard help · prototype note      ┘
```

---

## 2. Non-negotiables (all screens — check before opening the PR)

1. **Same regions, same order, same copy.** Word for word, including `·`
   separators, `—` dashes, `≈`, `★`, `¢`, `σ` and the casing of fund names
   (`IG CORE FUND`). Do not add, drop, merge, rename or reorder anything.
2. **Logic files are untouched** (§0.1). `git diff` of them against
   `reference/` must be empty (except `tokens.ts`, which becomes the one type).
3. **Direction is always in words.** `I want to buy`, `You're buying`,
   `SELLING`, `Buy here`, `Sell 9 lines`. Colour supports the word; it never
   replaces it.
4. **Buy and Sell are two distinct, fixed colours**, and neither is the
   error/danger colour. Source: Buy = blue, Sell = orange. Map to OneDS roles
   (§6.1). If OneDS has no non-danger orange-like role, **ask** — do not use
   danger red for Sell.
5. **Market moves use arrow + sign + colour** (`Move` component). Up/down
   meaning flips for spreads (tighter = good). The rule lives in the
   `goodWhenNegative` prop — keep every call site's prop as it is.
6. **Two-step confirms stay two-step.** Ticket, BWIC award and RV switch each
   open a confirm dialog that restates the action as a sentence. The primary
   button in the dialog gets focus. Esc and Back close it. Nothing is sent on
   one click.
7. **Blocked means disabled, not hidden.** E.g. `Fix 1 thing first` stays a
   visible, disabled button; `Send to 0 dealers` is disabled, not removed.
8. **Every jargon term keeps its tooltip** (`Term`, 31 entries in
   `glossary.ts`). Dotted underline, opens on hover **and** keyboard focus.
9. **Numbers use tabular figures** everywhere a number can change.
10. **Radius, elevation and shadows are OneDS's.** The source is square-cornered
    because of *its* rules. Do not copy that. Pills, dots and the countdown ring
    stay round because they are shapes.
11. **No hardcoded colour, size or font.** Everything from OneDS tokens. Where a
    continuous scale is needed (heat maps), see §6.3.
12. **Respect reduced motion.** The source wraps the shell in
    `MotionConfig reducedMotion="user"`; keep equivalent behaviour.

---

## 3. What reimagining looks like here (do not do these)

| Don't | Do |
|---|---|
| Replace the credit heat map or BWIC bid grid with a **data grid / AG Grid / OneDS DataTable** | Keep the semantic `<table>` with buttons in cells, styled with OneDS tokens. The cells are heat-tinted buttons, not grid cells |
| Turn RFQ steps 1–3 into a **wizard** that hides earlier steps | All three cards are visible at once. The `Stepper` in the header only *shows* progress (`current = draft→1, live→2, done/expired→3`) |
| Replace quote cards with a table | Keep one card per dealer, animated in as each dealer answers |
| Replace the confirmation card / sent banners with **toasts** | Keep them inline, where the source puts them |
| Swap the SVG curve, sparkline or price track for a **chart library** | Keep the SVG. Recolour with tokens (§6.4) |
| Swap `Segmented` for tabs or a dropdown | It is a radio group of buttons. Use OneDS segmented control |
| Swap `SideSwitch` for a toggle or radio list | Two large equal buttons, the selected one filled with the side colour plus a check icon |
| Replace the BWIC `Sell / Keep` switch with a checkbox | Keep a `role="switch"` button showing the word `Sell` or `Keep` (and `*` when overridden) |
| Add filters, export, refresh, settings, extra columns, toasts, empty-state art | Nothing that is not in `reference/` |
| Rename labels to OneDS defaults (`Cancel`→`Dismiss`, `Back`→`Cancel`) | Keep the exact words |
| Make the summary sentence (ticket) or headline numbers (BWIC) sticky | Normal flow, where the source puts them |
| Collapse the 3-column layouts into tabs at desktop width | Same columns as the screenshots at ≥1280px |

---

## 4. The shared kit (Run 1)

Convert these once. Screens must reuse them; never restyle a kit component
inside a page.

### 4.1 `fi-studio/tokens.ts`

Keep the **export names and signatures**: `s` (object), `sideText`, `sideBg`,
`sideSoft`, `moveText`, `divergingHeat`, `levelHeat`, `actionHeat`, `onHeat`,
and the re-exported `Side` type. Replace each value with OneDS equivalents:

- `s.*` — the class strings become whatever OneDS uses (token class names,
  CSS-variable style objects, or props). If OneDS is prop-driven rather than
  class-driven, keep `s` as a lookup of OneDS tokens and adapt the call sites
  mechanically. Mapping by role is in §6.1–6.2.
- The heat functions **return a CSS colour string** for a value in a range.
  Keep that contract, but build the colour from OneDS data-visualisation tokens
  (§6.3).

### 4.2 `fi-studio/ui.tsx` — component contracts

Keep every component's **name, props and behaviour**. Only its rendering
changes.

| Component | Contract to keep | Use the OneDS… |
|---|---|---|
| `Card` | Optional `title`, `icon`, `hint` (one line under the title), `actions` (right of title), body. Title row only renders if `title` is set | card / panel with header slot |
| `Term` | Dotted underline on the word. Tooltip text = `GLOSSARY[k]`. Opens on **mouseenter and focus**, closes on leave/blur. Must not be clipped by scrolling containers (source uses `position: fixed` from the trigger's rect) | tooltip (it must support keyboard focus and escape clipping — most portal tooltips do) |
| `InfoTip` | `Term` with an info icon as the trigger | tooltip + info icon |
| `Segmented` | `role="radiogroup"`, each option `role="radio"` + `aria-checked`. `disabled` disables all options | segmented control |
| `SideSwitch` | Two equal buttons, `Buy` / `Sell` labels overridable (`buyLabel`, `sellLabel`). Selected = filled with **side colour** + check icon; other = outline | two buttons, or a segmented control with large size, using the Buy/Sell roles |
| `Stat` | label (may contain a `Term`), value, optional `sub`, `valueClass`, `big` | text styles: label → caption, value → numeric heading, sub → caption muted |
| `Row` | Key left (muted), value right (tabular) | key/value list row |
| `Badge` | Tones `neutral, indigo, good, bad, warn, buy, sell`, optional icon. Pill shape | badge / tag with tone |
| `Move` | Arrow icon (↗ up, ↘ down, — flat) + signed value + optional words; colour by `goodWhenNegative` rule | text + icon; colours from positive/negative roles |
| `Stepper` | Numbered dots with labels; done = filled + check; current = ring; future = muted; connector lines | stepper / progress indicator (display only, not clickable) |
| `Dialog` | Title, close X, body, footer actions right-aligned. **Esc closes.** Modal (`aria-modal`), labelled by its title | modal dialog |
| `Ring` | Circular countdown: track + arc for `fraction` 1→0, centred label, `urgent` switches arc and label to danger | progress ring if OneDS has one; otherwise compose an SVG with tokens |
| `Meter` | Thin bar, `role="meter"`, value 0–100, tones `indigo/good/warn/bad` | progress / meter |
| `Spark` | SVG area sparkline with a dashed start-level line and an end dot | keep SVG, token colours (§6.4) |
| `Takeaway` | Icon + one paragraph on an accent-tinted surface | inline message / callout (info tone) |

### 4.3 `fi-studio/StudioShell.tsx`

Props: `screen`, `title`, `lead`, `context`, `children`. Behaviour to keep
exactly:

| Feature | Rule |
|---|---|
| Screen tabs | Five tabs from `STUDIO_SCREENS` with icon + name; current tab has `aria-current="page"` and an underline indicator; hover title shows the blurb and `Alt+N` |
| Keyboard | `Alt+1…5` jumps to screen N. `⌘K` / `Ctrl+K` opens Jump to. `/` opens Jump to **unless** focus is in an input, select or textarea |
| Jump to | Modal list. Filters on screen code (`RFQ`), aliases (`QUOTE`, `TICKET`, `CURVE`…), name and blurb; strips a trailing `<GO>`. ↑/↓ moves, Enter opens, Esc closes, click-outside closes. Shows `You're here` on the current screen. No match → `Couldn't find “…”. Try HMAP, RFQ, TKT, BWIC, RV.` (curly quotes) |
| Clocks | `New York HH:MM · London HH:MM`, ticking every second |
| User | Initials avatar `MD`, `M. Doyle`, `IG Credit desk` |
| Markets now | 11 chips, values and changes wobble every 1.5s (`useTick` + `wobble`, already in logic files). For rates/spreads, down = good; for FX (`%` unit), up = good. Arrow + number, colour by that rule. Horizontal scroll if it overflows |
| Page header | H1 = `title`, lead under it, `context` right-aligned |
| Footer | `Live` with dot · `Prices from the COMP composite · TRACE trades delayed 15 min` · `4 ms` · right: `Alt+1–5 switch screens · ⌘K or / to jump · Esc cancels` · `Prototype with mock data` |

The source's top bar has a large left padding (`pl-36`) only to clear the
source gallery's floating Home button. Drop that padding in the target.

Kit acceptance: a test page renders every component above in every tone and
state; Tab reaches every control; tooltips open on focus; Esc closes Dialog and
Jump to.

---

## 5. The screens

Columns are for ≥1280px wide. Copy, headings and data come from the reference
file — they are not repeated here. This section lists **regions in order** and
the **behaviours you must not lose**.

### 5.1 Credit map — `fi-studio-credit-map.tsx` · hook `useCreditMap()`

Layout: header context = universe `Segmented`. Body = stacked:
`Takeaway` → 2 columns `[1fr | 400px]` → 3 columns `[1fr 1fr 1.2fr]` → footnote.

| Region | Must keep |
|---|---|
| Takeaway | Sentence built from the widest/tightest mover and the count of `|z| ≥ 2` buckets |
| Heat map card | Metric `Segmented` in card actions; `hint` text changes with metric (`METRIC_HELP`). `<table>`: 12 sector rows × 6 tenor columns + `Average` column + `Average` row. Each cell is a `<button>` with `aria-pressed` and a full `aria-label`; background = heat colour; selected cell has a strong focus-style ring. Hover/focus a cell → readout bar under the table shows that cell's numbers; leaving restores the selected cell. Legend at right of readout (11 swatches + end labels) |
| Bucket card | Title `{sector} · {tenor}`, verdict badge (`Unusual` bad / `Notable` warn / `Normal` neutral). 3 stats, sparkline, 4 rows, explanation paragraph (3 variants by `|z|`) |
| Bonds card | One row per bond in the sector; bonds in the bucket highlighted + `In bucket` badge. Buttons `Buy`, `Sell` → open Get quotes with that bond and side; `Order` → open Place an order. Uses `openWith(studioSlug(...), …)` |
| Movers ×2 | Top 5 widened / tightened; each row is a button that selects that bucket |
| Market mood | 6 stats from `MARKET_TONE`; `bad` tone values in negative colour |

State checks: switching universe recomputes every cell; switching metric changes
colours, numbers and legend; `How unusual` uses the diverging scale (`01b`).

### 5.2 Get quotes — `fi-studio-rfq.tsx` · hook `useRfq()`

Layout: header context = `Stepper` over a request line. Body = 3 columns
`[360px | 1fr | 320px]`.

| Region | Must keep |
|---|---|
| Card 1 `1. What do you want to do?` | `SideSwitch` (`I want to buy` / `I want to sell`), helper line, bond select, 5 size buttons (`$1M`…`$25M`), fund select, settle box, response window `Segmented`. **All disabled once sent** |
| Card 2 `2. Who should quote?` | 8 dealers as checkbox rows: name, code, hit-rate `Term`, optional axe badge (good tone when the dealer wants the other side). Max 5; at 5 the unchecked rows disable. Count badge `N of 5` (warn at 5) |
| Card 3 `3. Compare quotes` | Status strip: `Ring` + title/message per phase + action (`Send to N dealers` primary in draft; `Cancel request` / `New request` secondary otherwise). Quote list (`aria-live="polite"`): draft = dashed placeholders per picked dealer; live/done/expired = one `QuoteRow` per dealer, in `ordered` order, animated in. Live: full-width side-coloured button `{Buy|Sell} {size} at {price} from {dealer} · best price`. Done: inline confirmation card |
| QuoteRow states | `Pricing…` (pulsing) · `Didn't answer in time` · `Passed on this one` · quoted: rank dot, name, `Best price` / `Second best` / `Traded` badge, yield·spread·size·answer time, big price, `x.x¢ better/worse than market` (or `same as market`), `{Side} here` button while live (best = filled side colour, others secondary) |
| Market price card | Bid / Mid / Offer; the side you'd trade near is side-coloured with a `you'd … near` sub. 6 rows |
| Recent trades | 12 TRACE prints from `tracePrints()`, badge `Client bought` (buy tone) / `Client sold` (sell tone) |
| Your position | Holding, after-trade (negative + `would go short` when it would), issuer-limit `Meter` (indigo / warn > 70 / bad > 85), button to open Place an order |

State matrix (verify each):

| Scenario | Expected |
|---|---|
| Load | Phase draft, stepper on step 2, ring full at `0:30`, 5 dealers picked |
| Send | Inputs disable, ring counts down, rows show `Pricing…` then quotes arrive over ~1–10s |
| First quote arrives | Rank 1 = `Best price`, primary button enables |
| `< 6s` left | Ring and title turn danger |
| Click any `{Side} here` or the primary button | Phase done, confirmation card with 5 stats and the vs-market sentence (`02c`) |
| Esc while live / timer reaches 0 | Phase expired, `No trade this time` |
| `New request` | Back to draft, request number +1 |

### 5.3 Place an order — `fi-studio-ticket.tsx` · hook `useTicket()`

Layout: summary bar (full width) above 3 columns `[380px | 1fr | 340px]`. A
`Dialog` for review.

| Region | Must keep |
|---|---|
| Summary bar | Left accent border in side colour, receipt icon, the live sentence (`You're buying/selling … costs/brings in about $X.XXM including accrued.`). Right: `Review buy/sell order` (side colour) **or** disabled `Fix N thing(s) first` when `fails > 0`; after sending: `Sent · ORD-… working` badge + `New order` |
| `1. What` | `SideSwitch`, bond select, size input (digits and `.` only) + 5 presets |
| `2. Price` | Order-type `Segmented` in actions; hint changes with type. Three linked inputs **side by side** with link icons between: Price / Yield / Spread. Editing one updates the other two (`onField`); ↑/↓ nudges (`nudge`); focus/blur via `focusField`/`blurField`; focused field shows the focus border. Market type disables the fieldset |
| `3. How` | TIF `Segmented` + helper (`Live until close` / `Live until you cancel` / `Fill now or cancel`), route select, settle box |
| `4. Which funds` | 3 rows with % inputs; total badge (good at 100%, bad otherwise) and `Meter` |
| What it costs | 6 stats; `You pay/receive` big and side-coloured |
| Your price vs the market | `PriceTrack` (§6.4) + 3 stats incl. fill-chance `Meter` |
| Checks before it goes | Hint states passed count; badge `N blocking` / `N warning` / `All clear`; first failure repeated in a `To fix:` banner; 7–8 rows with pass/warn/block icon (each icon has an aria-label) |
| Working orders | Table, newest first; new orders appear on top after confirm |
| Right column | Effect on each fund (negative `After` in negative colour), Effect on portfolio risk, About this bond with `Get quotes →` and `Sector map →` |
| Review dialog | `Check your order`. Sentence with `BUYING`/`SELLING` in side colour, rows, warnings callout when `warns > 0`. Buttons `Back` and `Confirm buy/sell` (focused) |

State matrix: load Buy 5MM → all clear (`03`). Sell 10MM → `Position
available` blocks, `Fix 1 thing first` disabled, `To fix:` banner (`03c`). Type
yield `5.300` → price `101.274`, spread `128.8`. Allocation 60/30 → `Allocation`
blocks. Confirm → dialog closes, `Sent` badge, new top row in Working orders.

### 5.4 Sell a list — `fi-studio-bwic.tsx` · hook `useBwic()`

Layout: headline strip → 2 columns `[1fr | 360px]` → award `Dialog`.

| Region | Must keep |
|---|---|
| Header context | List description + countdown badge `m:ss left to decide` (warn; bad under 2:00) or `Awarded` |
| Headline strip | 6 stats + action: `Sell N lines` (sell colour) while deciding; `Tickets sent to N dealers` badge when awarded |
| Bid grid card | Two `Segmented` (lines filter, cell view). `<table>`: 14 rows; columns `# · Bond · Size · Our mark · Reserve · 6 dealers · Best · 2nd · vs mark · Decision`. Bid cells: heat colour vs mark; **best** = strong outline + filled star icon; **second best** = thin outline; below reserve = line-through; no bid = `—` with the `DNB` tooltip. Row click focuses the line. Kept lines are muted. Decision = `role="switch"` button: `Sell` (sell colour, knob right) / `Keep` (neutral, knob left) / `No bids` (disabled); `*` when overridden. Legend row under the table |
| Line card | Bars per dealer sorted best first, with mark and reserve markers; 3 rows; `Takeaway` with `focusAdvice` |
| Dealer scorecard | Name, `won N · $XMM`, bar, `bid x/14`, avg ¢ vs mark |
| Award dialog | `Award this list?`, sentence with `SELLING`, 4 rows, `Back` + `Confirm and award` |

State matrix: load → 9 of 14 selling, 5 below reserve. Toggle a `Keep` line
to `Sell` → `*` appears, totals update; toggle back → `*` disappears. Filter
`Selling` / `Keeping` filters rows. Countdown ticks each second and stops on
award. Award → all switches disable.

### 5.5 Curve ideas — `fi-studio-rv.tsx` · hook `useRv()`

Layout: `Takeaway` → 2 columns `[1fr | 400px]`; left column = curve card above
2 columns `[1.2fr | 1fr]` (spreads matrix, butterflies). Right = switch
builder. Confirm `Dialog`.

| Region | Must keep |
|---|---|
| Curve card | `CurveSvg` (§6.4): fitted line; one marker per bond (circle; **diamond** for newest issue) in buy colour if cheap, sell colour if rich; stick from line to marker; residual bars below the zero line; `Sell` / `Buy` labels on the chosen legs. Hover → readout row; **click = sell leg, Shift-click = buy leg** |
| Spreads matrix | Upper triangle 6×6 of buttons (`aria-pressed`), metric `Segmented` (`Level / Δ1D / Z 3M`), legend text changes with metric, explanation box for the selected cell |
| Butterflies | 5 rows; z-bar (buy colour right of centre, sell colour left); `Idea` badge when `|z| ≥ 2` |
| Switch builder | `You sell` leg (sell accent) with select + cheap/rich badge; sell amount input; `Swap` button; `You buy` leg (buy accent) with **computed, read-only** buy amount; 4 stats; 4 rows; same-bond error; negative-RV warning; primary `Review switch · +x.x bp gained`; after send, success box + `Build another` |
| Confirm dialog | `Send this switch?`, sentence with `SELL`/`BUY` in side colours, 5 rows, `Back` + `Send to dealers` |

State matrix: load → sell `T 4.375 08/43`, buy `T 1.125 05/40`, buy amount
`72.6`, net DV01 `−$18`. `Swap` → legs swap and the warning appears (selling
the cheaper bond). Pick the same bond for both → error, review disabled.

---

## 6. Token, colour and library mapping

Look every OneDS name up in OneDS. Don't guess them. Map by **role**.

### 6.1 Roles

| Source | Role | OneDS |
|---|---|---|
| page `#f6f5f1` | page/canvas surface | `<fill in>` |
| card white + faint border + soft shadow | card surface, subtle border, low elevation | `<fill in>` |
| `stone-50` boxes | subtle/sunken surface | |
| `stone-900` / `700` / `500` / `400` text | text primary / secondary / muted / tertiary | |
| indigo (`indigo-600` buttons, selection, focus, links, accent icons) | **accent / primary action** | |
| blue-600 | **Buy** (direction) | |
| orange-600 | **Sell** (direction). Must not be danger (§2.4) | |
| emerald-600 text / emerald-50 fill | positive / success | |
| rose-600 text / rose-50 fill | negative / danger | |
| amber-700 text / amber-50 fill | warning | |
| Badge tones `neutral, indigo, good, bad, warn, buy, sell` | neutral, accent, success, danger, warning, Buy, Sell | |

If Buy/Sell have no OneDS role, create two semantic aliases on existing OneDS
palette tokens (e.g. `--direction-buy`, `--direction-sell`) in one place and
log it in §8. Don't inline them.

### 6.2 Type roles

| Source | Use | OneDS |
|---|---|---|
| 22px semibold | page H1 | page title |
| 13px semibold | card title | heading small / title |
| 13px | body, rows | body |
| 11–12px | labels, hints, captions | caption / label |
| 17px / 22px semibold tabular | stat values | numeric / display small |
| `tabular-nums` | every changing number | tabular-figures setting or mono numeric style |

### 6.3 Heat scales (continuous colour)

Heat cells need a colour for every value, so keep them as functions. Build each
from OneDS **data-visualisation** tokens, interpolating opacity or steps.

| Function | Input | Source ramp | OneDS |
|---|---|---|---|
| `divergingHeat(x)` | −1 … +1 | green (tighter / below) ← neutral → red (wider) | diverging scale, positive↔negative ends |
| `levelHeat(x)` | 0 … 1 | light → strong indigo | sequential scale |
| `actionHeat(x)` | −1 … +1 | orange (rich/sell) ← neutral → blue (cheap/buy) | diverging scale using the Buy/Sell roles |
| `onHeat(x)` | −1 … +1 | text weight/colour that stays readable on the cell | must pass WCAG AA on the strongest cell |

Near zero (`|x| < 0.04`) returns the neutral surface. Keep that threshold.

### 6.4 Hand-drawn SVG (`Spark`, `CurveSvg`, `PriceTrack`)

Keep the geometry and maths exactly (scales, sqrt x-axis, label positions, hit
areas). Replace only `fill` / `stroke` literals with token values (CSS
variables are fine inside SVG) and the font family with OneDS's. `PriceTrack`
puts market marks **above** the bar and your limit **below** it so labels never
collide — keep that.

### 6.5 Libraries

| Source | Replace with | Notes |
|---|---|---|
| `lucide-react` | OneDS icons | 34 icons: `ArrowDownRight ArrowLeftRight ArrowRight ArrowUpRight ChartSpline Check CircleCheck CircleX Clock Command Gavel Hourglass Info Layers Lightbulb Link2 ListChecks Map MessagesSquare Minus ReceiptText RotateCcw Search Send ShieldCheck Sparkles Star TrendingDown TrendingUp TriangleAlert Trophy Users Wallet X`. Pick the closest OneDS icon by meaning; log any without a match |
| `framer-motion` | OneDS motion tokens + CSS transitions | 4 uses: quote rows fade/slide in (`opacity 0→1, y 6→0, 0.2s`), confirmation fades/scales in, `Dialog` fades/scales in (`0.16s`), `MotionConfig reducedMotion="user"`. Keep every animation, honour reduced motion |
| Tailwind classes | OneDS props/tokens | All of them |
| `style={{ … }}` (19 places) | keep | They hold computed widths, positions and heat colours. Keep them; only swap any colour literal for a token |

---

## 7. Accessibility (keep what the source does)

- One `<h1>` per screen; cards use `<section>` with an `<h2>` title.
- Heat cells and matrix cells: `<button>` with `aria-pressed` and a full
  `aria-label` (sector, tenor, metric, value).
- `Segmented` = radiogroup; `SideSwitch` = radiogroup; BWIC decision =
  `role="switch"` + `aria-checked`; `Meter` = `role="meter"` with values.
- Quote list is `aria-live="polite"`; confirmations are `role="status"`.
- Dialogs: `aria-modal`, `aria-labelledby`, Esc closes, focus on the primary
  action.
- Check icons carry `aria-label`s (`Passed`, `Warning`, `Blocking`).
- WCAG 2.1 AA contrast, including text on the strongest heat cells and on the
  Buy/Sell filled buttons.

---

## 8. When OneDS doesn't fit

1. Use the closest OneDS component or token.
2. If none exists, compose it from OneDS primitives and tokens.
3. Never fall back to Tailwind, hex/rgba values, lucide or framer-motion "to
   keep it working".
4. List every substitution in the PR:

| Element | What OneDS lacks | What you built instead |
|---|---|---|
| Buy/Sell direction colours | likely no direction role | two aliases on palette tokens (§6.1) |
| Heat ramps | likely no continuous scale API | functions over data-vis tokens (§6.3) |
| Countdown `Ring` | maybe no progress ring | SVG on tokens |
| Fixed-position tooltip (`Term`) | maybe | OneDS tooltip with portal |
| (add any others) | | |

**Allowed deviations (only these):** OneDS radius, elevation and shadows;
OneDS focus and hover styles; OneDS icon shapes where meaning is the same;
dropping the source's `pl-36` Home-button padding. Anything else that changes
how a screen looks needs sign-off. Ask first.

---

## 9. Acceptance checklist

**Per screen (copy into the PR)**
- [ ] Side by side with its screenshot(s): same regions, order, columns, copy and numbers.
- [ ] Every row of that screen's state matrix (§5) passes.
- [ ] Every `Term` opens on hover and on keyboard focus.
- [ ] Keyboard only: every control reachable; Esc closes dialogs; Alt+1…5 and ⌘K work.
- [ ] Nothing added: no icons, columns, buttons, toasts, filters or states that aren't in `reference/`.

**Logic untouched**
- [ ] `diff -r reference/src/components/fi-terminal/model <target>/…/model` is empty. Same for `bonds.ts`, `format.ts`, `selection.ts`, `useTick.ts`, both `screens.ts`, `glossary.ts`.
- [ ] Pages still get all state from their hook; no maths or rules re-implemented in a page.

**Only OneDS** — run in the converted folder; every command must print nothing:
```
grep -rnE 'className="[^"]*\b(flex|grid|p[xytrbl]?-|m[xytrbl]?-|text-|bg-|border-|rounded|shadow)' .
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' .
grep -rnE '\b(stone|indigo|blue|orange|emerald|rose|amber)-[0-9]{2,3}\b' .
grep -rnE 'from "(lucide-react|framer-motion)"' .
```
(Exceptions only where §8 logged them.)

**Quality**
- [ ] Typecheck, lint and build pass.
- [ ] WCAG 2.1 AA contrast, including heat cells and Buy/Sell buttons.
- [ ] PR description lists OneDS gaps and any deviation.

---

## 10. Open decisions (answer before Run 1)

1. **Sell colour.** Source is orange so it never reads as an error. Which
   OneDS token? (If only red exists, decide explicitly; don't let Copilot pick.)
2. **Where screens live** in the target and which router replaces
   `navigateToPage`.
3. **Fund names** are uppercase in the data (`IG CORE FUND`). Keep (default)
   or title-case in the target? Changing it means editing a logic file — ask.
