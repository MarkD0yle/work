# Handoff: Pre-Trade Checks → rebuild in OneDS

> **The one rule: this is a port, not a redesign.**
>
> `reference/pages/gm-pretrade-checks.tsx` is the screen. Copy it, then replace
> its *visual layer only* (Tailwind classes, hex/palette colours) with OneDS
> components and tokens. The structure, order, copy, data, state logic and
> interactions stay exactly as they are.
>
> If you catch yourself choosing a "better" component for the layout (an
> accordion, a stepper, a data table, a card grid, a timeline component) **stop**.
> That is the reimagining this spec exists to prevent. See §3 for what is
> forbidden and why.

---

## 0. How to use this folder

```
pre-trade-checks-oneds/
  README.md                         ← this spec
  reference/pages/gm-pretrade-checks.tsx   ← the original. Read-only.
```

- **Method:** copy `gm-pretrade-checks.tsx` into the target, keep the JSX tree,
  then swap each element's styling for OneDS as listed in §5. Do not rewrite
  the component from the description.
- **Precedence:** the reference file decides content, structure, copy, data and
  logic. OneDS decides colour, type, spacing, radius, borders, shadows and
  control styling. This spec decides which OneDS thing replaces which element.
- **Source stack:** React 19, TypeScript, Tailwind v4. Do not carry Tailwind
  classes, `bg-*`/`text-*` palette names or hex values across. They only show
  intent.
- **Exports:** keep `export const title = "Pre-Trade Checks"` and
  `export const section = "dashboards"`, and the default export
  `GmPretradeChecks`. The gallery shell discovers the page through them.
- **Nothing to import.** The page has no shared components, hooks or libs. All
  data is in the file. Keep it that way: all of `ORDER`, `GATES`, `STATE_META`'s
  keys and labels, and the `HeadroomBar` maths copy over unchanged.

---

## 1. What the screen is

One vertical page, max width 48rem (`max-w-3xl`), centred, with 24px (`space-y-6`)
between four blocks:

```
┌──────────────────────────────────────────────┐
│ 1  HEADER        eyebrow / H1 / subtitle     │
├──────────────────────────────────────────────┤
│ 2  ORDER CARD    ref, description, meta   [status pill]
├──────────────────────────────────────────────┤
│ 3  GATE RAIL     5 gates, vertical rail with │
│    ●─┌ gate row ─────────────────── Status ┐ │
│    │ └ (expanded detail, headroom, actions)┘ │
│    ●─┌ gate row ─────────────────── Status ┐ │
│    ⋮                                         │
├──────────────────────────────────────────────┤
│ 4  RELEASE BAR   message               [Release order]
└──────────────────────────────────────────────┘
```

It answers one question: *can this order release?* The answer is **no while any
gate is `blocked`**. Everything on the page serves that.

---

## 2. Non-negotiables (check before opening the PR)

1. **Same four blocks, same order, same copy.** Word for word, including the
   `·` separators and the `—` dashes. Do not add, remove, merge or reorder.
2. **The gate rail stays a rail.** A vertical line plus one square marker per
   gate, with a bordered gate row to the right (§4.3). Not an accordion, not a
   stepper, not a table, not a card grid.
3. **One gate open at a time, and it is `credit` on load.** `expanded` is
   `string | null`. Clicking the open gate closes it. Clicking another opens
   that one and closes the previous. Initial value is `"credit"`.
4. **Passed gates are quiet, the blocking gate is loud.** The visual weight
   difference comes from the state colours in §5.1. Keep the contrast between
   states. Do not give all gates equal emphasis.
5. **Release is derived, never stored.** `blockedCount` and `canRelease` are
   computed from `GATES` on every render. Only `state === "blocked"` blocks.
   `waiver` and `pending` do **not** block.
6. **Release is locked, not hidden.** When blocked, the button is present and
   `disabled`. Same for the wording change in the footer message and the pill.
7. **Square corners are not a rule here.** The source is zero-radius because of
   *its* design rules. Do **not** copy that: use OneDS's radius everywhere.
8. **No hardcoded colour, size or font.** Everything comes from OneDS tokens.
   If a token is missing, use the closest semantic one and log it (§8).
9. **Numbers use tabular/mono figures** in the order ref and in the headroom
   readout.

---

## 3. What reimagining looks like (do not do these)

These are the specific mistakes to avoid on this screen.

| Don't | Do |
|---|---|
| Replace the gate rail with an **accordion** component | Keep a list of bordered rows with a rail and markers beside it, and your own `expanded` state |
| Use a **stepper / timeline / wizard** for the rail | The rail is a decorative line + markers. The gates are not sequential steps the user advances through |
| Turn the order card into a page-header block, hero or summary stat tiles | One bordered card: ref, description, meta line, status pill |
| Turn the five gates into a **table** | They are rows with variable-height expansion |
| Show every gate's detail expanded, or add extra detail | Only one is open. Collapsed gates show name, owner and status only |
| Add icons per gate or per state | There are none in the source. The coloured marker and the status word are the signal |
| Add a "Re-run checks", "Export", progress ring, counts, tabs, filters or toasts | Nothing that isn't in the file |
| Rename states (`Cleared`, `Blocked`, `Waiver`, `Queued`) to `Passed`/`Failed`/etc. | Keep the exact labels |
| Hide the actions on non-blocked gates by restructuring | Actions render **only** on the `blocked` gate. Keep that rule exactly |
| Make the release bar sticky/fixed, or move it into the header | It is the last block in normal flow |
| Re-centre the layout full-width | Keep `max-w-3xl` (48rem) centred. Use the OneDS layout equivalent of a 48rem content column |

---

## 4. Anatomy and behaviour

### 4.1 Header
- Eyebrow, accent colour, uppercase, wide tracking, semibold, small:
  `Global markets · Lifecycle 02 — Pre-trade controls`
- `<h1>`: `Pre-Trade Checks`
- Subtitle, muted: `Every gate must clear before the order releases to the desk.`
- Spacing: H1 4px below the eyebrow, subtitle 4px below H1.

### 4.2 Order card
- Bordered surface, padding 20px horizontal / 16px vertical.
- Flex row, wraps, `justify-between`, `items-start`, 12px gap. Left text stack,
  right status pill.
- Left stack, top to bottom:
  1. `ORDER.ref` → `ORD-2026-33871`: **mono**, small, tertiary text
  2. `ORDER.desc` → `Sell $180M USD 10Y Treasury vs. receive fixed IRS overlay`: body, semibold, primary text
  3. `{book} · {trader} · {client}` → `Rates Flow — NY · D. Okafor · Meridian Capital (Platinum)`: small, muted
- Right pill: uppercase, semibold, small, wide tracking, filled background.
  - `canRelease` → `Ready to release`, success tone
  - otherwise → `{blockedCount} gate blocking`, danger tone
  - Note the literal copy: it is `1 gate blocking`, with no plural handling. Keep
    it as is.

### 4.3 Gate rail
An ordered list (`<ol>`), 12px between items. Each `<li>` is `position: relative`
with 32px left padding (`pl-8`) to leave room for the rail.

Per gate, three layers:

| Layer | Position | Description |
|---|---|---|
| **Rail line** | Absolute, left 7px, top 24px, 1px wide, full item height, neutral divider colour | Rendered for **every gate except the last**. It runs down to the next marker. `aria-hidden` |
| **Marker** | Absolute, left 0, top 10px, 16×16 square, 2px border in the *surface* colour (so it reads as a notch cut from the rail), small shadow, filled with the gate's **state colour** | `aria-hidden`. Square in the source. Use OneDS's marker/indicator shape, but keep it a filled 16px dot/square sitting on the rail |
| **Gate row** | Normal flow | Bordered surface. Border colour comes from the state (§5.1) |

**Gate row, collapsed (always visible):**
- A full-width `<button type="button">`: flex, `justify-between`, `items-center`,
  12px gap, 16px horizontal / 12px vertical padding, left-aligned text.
- Left: gate `name` (body, semibold, primary) over `owner` (small, tertiary).
- Right: the state label (`Cleared` / `Blocked` / `Waiver` / `Queued`), small,
  semibold, uppercase, wide tracking, in the state's text colour.
- Click toggles `expanded` as in §2.3. The button needs `aria-expanded` and
  `aria-controls` pointing at the detail region (the source omits these, so
  this is an allowed accessibility addition).

**Gate row, expanded (only when `expanded === gate.id`):**
- Separated from the button by a 1px top divider (a lighter one than the row
  border). Padding 16px horizontal / 12px vertical.
- `gate.detail` paragraph: body, secondary text.
- If `gate.headroom` exists → `HeadroomBar` (§4.4), 12px above it.
- If `gate.state === "blocked"` → an action row, 12px above, 8px gap:
  - **`Request line uplift`**: primary/solid button, small
  - **`Split the order`**: secondary/outline button, small
  - Both are `type="button"` with no handler in the source. Keep them
    handler-less (no navigation, no dialogs, no toasts).

### 4.4 HeadroomBar
Props: `{ label, used, limit, unit }`.

```
pct  = min(used / limit * 100, 130)
over = used > limit
```

- Top row: label (small, muted) on the left; on the right
  `{used} / {limit} {unit}` in **mono**, small, semibold. Danger text if `over`,
  otherwise primary text. Baseline-aligned, `justify-between`.
- Track: full width, 8px high, 6px below the row, subtle fill, `position: relative`.
- Fill: 8px high, width `min(pct, 100)%`. Danger colour if `over`, success
  colour otherwise.
- **Overflow marker** (only when `over`): an absolutely-positioned 8px-high
  segment in a **40% opacity danger** colour, `left: 100%`, `width: (pct − 100)%`,
  shifted `translateX(-100%)`. This is deliberate: it draws the overshoot as a
  lighter band at the right end of the bar. Reproduce it with a OneDS danger
  token at reduced opacity (or its "subtle" variant), not by dropping it.

If OneDS has a `Progress` / `Meter` component, you may use it **only if** it can
render both the capped fill and the overshoot band. Otherwise compose from a
div on OneDS tokens. Don't use a bare progress that clips at 100% and loses the
overshoot.

Data that exercises it:

| Gate | used / limit | pct | over | Result |
|---|---|---|---|---|
| `credit` | 226.6 / 220 `$M` | 103.0 | yes | fill 100%, overshoot band 3.0% wide |
| `market` | 312 / 300 `k$/bp` | 104.0 | yes | fill 100%, overshoot band 4.0% wide |

### 4.5 Release bar
- Bordered surface using the **subtle/secondary** background (a step off the
  page surface), padding 20px / 16px, flex row, `justify-between`, `items-center`.
- Left message, small/body, muted:
  - `canRelease` → `All gates clear — the order can go to the desk.`
  - otherwise → `Release stays locked while any gate is blocked.`
- Right button `Release order`, `type="button"`, `disabled={!canRelease}`:
  - enabled → success/primary-positive solid
  - disabled → OneDS disabled style (not-allowed cursor)
  - No `onClick` in the source. Keep it handler-less.

---

## 5. Token and component mapping

Look the OneDS names up in OneDS. Don't guess them.

### 5.1 State map (`STATE_META`)

Keep the `Record<GateState, …>` shape and the four keys and labels. Replace the
Tailwind strings with OneDS roles. Each state needs: **marker fill**, **label
text colour**, **row border colour**.

| State | Label (exact) | Marker fill | Label text | Row border | Role |
|---|---|---|---|---|---|
| `pass` | `Cleared` | success | success (text) | success, **subtle** | success |
| `blocked` | `Blocked` | danger | danger (text) | danger, **stronger** than the others | danger |
| `waiver` | `Waiver` | warning | warning (text) | warning, mid | warning |
| `pending` | `Queued` | neutral (light) | neutral/tertiary (text) | neutral, subtle | neutral |

Source reference for relative strength: `pass` ring is emerald-200 (light),
`blocked` is rose-300, `waiver` is amber-300, `pending` is neutral-200 (light).
So blocked and waiver borders read heavier than cleared and queued. Preserve that.

### 5.2 Other roles

| Source | OneDS role |
|---|---|
| page background | page/canvas surface |
| card surface (`bg-white`) | surface / card |
| release bar (`bg-neutral-50`) | surface-subtle |
| `border-neutral-200` | default border |
| `border-neutral-100` (expanded divider) | subtle divider |
| `text-neutral-900` | text-primary |
| `text-neutral-600` | text-secondary |
| `text-neutral-500` | text-muted |
| `text-neutral-400` | text-tertiary |
| `text-blue-600` (eyebrow) | accent / brand text |
| `bg-neutral-900 text-white` (Request line uplift) | primary button |
| `border-neutral-300 text-neutral-600` (Split the order) | secondary / outline button |
| `bg-emerald-600 text-white` (Release order enabled) | success solid button |
| `bg-neutral-200 text-neutral-400` (disabled) | disabled button |
| `bg-emerald-100 text-emerald-800` (pill ready) | success badge (subtle fill) |
| `bg-rose-100 text-rose-700` (pill blocking) | danger badge (subtle fill) |

### 5.3 Type roles

| Source | Used for | OneDS role |
|---|---|---|
| `text-2xl` semibold | H1 | heading (page title) |
| `text-sm` semibold | order desc, gate name | body, strong |
| `text-sm` | detail, footer message | body |
| `text-xs` | owner, meta line, labels | caption / body-small |
| `text-xs` semibold uppercase tracking-widest | eyebrow | overline |
| `text-xs` semibold uppercase tracking-wide | state label, pill | overline / label-small |
| `font-mono` | order ref, headroom readout | mono / code |

Use OneDS type styles, not px or rem literals.

### 5.4 Components

| Source | Use the OneDS… |
|---|---|
| `<header>` + eyebrow / h1 / subtitle | page header pattern, or text styles in a stack |
| order card `<div>` | card / bordered surface |
| status `<span>` | badge (tone-aware, subtle fill, uppercase label) |
| gate row `<div>` + `<button>` | a bordered surface with a full-width unstyled-row button inside. **Not** an accordion item (see §3) |
| `Request line uplift` / `Split the order` | button (primary, size small) / button (secondary, size small) |
| `Release order` | button (success or primary, size medium) |
| rail line + markers | no component. Compose from OneDS tokens (border colour, a small filled indicator). See §8 |
| `HeadroomBar` track + fill | progress/meter if it supports overshoot; otherwise compose |
| layout wrappers | OneDS stack / layout primitives with the spacing steps below |

### 5.5 Spacing rhythm

Use the nearest OneDS spacing step. Keep these **relationships**:

- Page blocks: one large gap (24px), equal between all four.
- Gate list: a smaller gap (12px) between gates.
- Gate row: 16px/12px padding collapsed; the expanded body uses the same
  horizontal padding as the button, so text lines up.
- Order card and release bar share the same 20px/16px padding.
- Rail geometry: marker 16px, left of the row; rail line centred on the marker
  (7px from the left edge); 32px of left gutter.

---

## 6. Interaction and state matrix

Verify every cell.

| Scenario | Expected |
|---|---|
| First load | `Counterparty credit line` is expanded; others collapsed |
| Click collapsed gate | It expands, `credit` collapses |
| Click the open gate | It collapses; none are open |
| Expand `credit` | Detail text, headroom bar (over, band visible), both action buttons |
| Expand `market` | Detail text, headroom bar (over, band visible), **no** action buttons |
| Expand `kyc`, `restricted`, `bestex` | Detail text only, no headroom, no buttons |
| Order status pill | `1 gate blocking` (danger) |
| Release bar | Message `Release stays locked while any gate is blocked.`, button disabled |
| If `credit.state` is changed to `pass` (temporary check) | Pill `Ready to release` (success), message `All gates clear — the order can go to the desk.`, button enabled |
| If `market.state` is `waiver` and nothing is blocked | Still releasable. Waiver does not block |
| Keyboard | Tab reaches each gate button; Enter/Space toggles; focus ring visible; disabled Release is skipped |
| Narrow width (≈360px) | Order card wraps pill under the text. Gate rows keep rail and markers. Release bar stays on one row or wraps without overlapping |

Run the "if changed" rows by editing `GATES` temporarily, then revert.

---

## 7. Accessibility

- `<h1>` for the title; the rest in logical reading order.
- Gate list is an `<ol>`; markers and rail are `aria-hidden`.
- Gate buttons: `aria-expanded`, `aria-controls`; the detail region has the
  matching `id`. State is conveyed by the **text label** as well as colour, so
  colour-only meaning is not an issue. Keep the labels visible.
- Contrast: WCAG 2.1 AA for all state label and pill text against their
  backgrounds, in light mode (and dark, if OneDS supports it).
- Visible focus on gate buttons, both action buttons and Release.
- Disabled Release uses the `disabled` attribute (not just a style).

---

## 8. When OneDS doesn't fit

1. Use the closest OneDS component or token.
2. If none exists, compose it from OneDS primitives and tokens.
3. Never fall back to Tailwind classes, hex values or the source styling "to
   keep it working".
4. List every substitution under **OneDS gaps** in the PR:

| Element | What OneDS lacks | What you built instead |
|---|---|---|
| Rail line + markers | likely no rail/marker primitive | token-coloured divider + indicator |
| Headroom overshoot band | likely no meter with overflow | composed track/fill/band |
| (add any others) | | |

Allowed deviations (only these):
- OneDS radius, elevation and shadow in place of the source's square corners
  and `shadow-sm`.
- The marker's shape (square vs round) if OneDS indicators have a fixed shape.
- `aria-expanded` / `aria-controls` / `id` additions.
- OneDS focus and hover states in place of the source's `hover:bg-*`.

Anything else that changes the look of the layout needs sign-off. Ask first.

---

## 9. Acceptance checklist

**Same screen**
- [ ] Source and OneDS side by side show the same four blocks, order, copy and data.
- [ ] Rail line and one marker per gate; the last gate has no line below it.
- [ ] `credit` is open on load; one gate open at a time; click-open closes it.
- [ ] Buttons appear only on the `blocked` gate; headroom only where defined.
- [ ] Overshoot band renders on both over-limit bars.
- [ ] Pill, footer message and Release button follow `canRelease`.
- [ ] State labels are `Cleared`, `Blocked`, `Waiver`, `Queued` exactly.
- [ ] Nothing was added: no icons, counts, toasts, tabs or extra buttons.

**Only OneDS**
- [ ] No Tailwind classes, no `className` utilities (`flex`, `px-`, `text-`, `bg-`, `border-`, `rounded`).
- [ ] No `#`, `rgb(`, `hsl(` or palette names (`emerald-`, `rose-`, `amber-`, `neutral-`).
- [ ] No `px`/`rem` literals for spacing, size or radius, except where OneDS has no token (and listed in the gaps table).
- [ ] No imports other than React and OneDS.

**Quality**
- [ ] Section 6 matrix passes, including the temporary-state checks.
- [ ] Keyboard-only use works; WCAG 2.1 AA contrast.
- [ ] Typecheck, lint and build pass.
- [ ] PR description lists OneDS gaps and any deviation.
