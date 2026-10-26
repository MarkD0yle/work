# Handoff: Contextual Right Panels → rebuild in OneDS

> **The one rule: rebuild it as it is, but in OneDS.**
>
> Keep the structure, content, copy, data, behaviour, widths and state logic
> exactly as they are in `reference/`. Change only the visual layer: every
> colour, type style, spacing value, border, radius, shadow, icon and control
> comes from OneDS. Don't redesign, simplify, merge or "improve" anything that
> this spec doesn't explicitly allow.

---

## 0. How to use this folder

```
right-panels-oneds/
  README.md          ← this spec (what to build, and the rules)
  reference/         ← the original source. Read-only. Not to be imported.
    pages/right-panel-patterns.tsx         demo page shell
    lib/rightPanels.ts                     catalogue + host table fixtures (pure data)
    components/right-panels/
      PanelKit.tsx                         shared panel chrome
      panel-tokens.ts                      tone map (to be replaced by OneDS)
      useTick.ts                           live price simulation (pure logic)
      HostSurface.tsx                      the work surface left of each panel
      <Name>Panel.tsx × 10                 the ten panels
```

- **This spec decides:** what each panel contains, in what order, and how it behaves.
- **`reference/` decides:** exact copy, fixture values, formulas and any detail
  the spec doesn't mention. Where they conflict, the spec wins. Raise the
  conflict in the PR description.
- **Source stack:** React 19 + TypeScript + Tailwind v4. **Don't carry Tailwind
  classes, hex values or `rgba()` literals across.** They're there only to show
  intent. Each one maps to a OneDS token or component (see §2).

### What you can lift verbatim

These files contain no styling, so copy them across as they are:

- `reference/lib/rightPanels.ts`: the `PANEL_EXAMPLES` catalogue, the
  `HOST_TABLES` fixtures and the types.
- `reference/components/right-panels/useTick.ts`: the seeded price walk. It is
  pure logic and respects reduced motion.
- All in-component fixture arrays (`CONTRIBUTORS`, `ESCALATION`, `EXPOSURES`,
  `DOCUMENTS`, `CONTACTS`, `STEPS`, `MISMATCH`, `INITIAL`, `FACET_GROUPS`,
  `SAVED_VIEWS`, `THREAD`, `SEED`, `CANNED`, `SUGGESTIONS`, `RATINGS`).

Everything else gets rebuilt on OneDS.

---

## 1. Non-negotiables (check these before you open the PR)

1. **Ten panels, same order and names.** Use the same headers, sections,
   footers and copy, word for word, including the `·` separators and the
   en/em dashes.
2. **Same widths.** Use the `width` from `PANEL_EXAMPLES` (340–400px). The width
   differences are deliberate. Don't normalise them.
3. **One shared chrome.** Build the frame, header, body, footer and section
   once (see §3) and compose all ten panels from them. A panel must never
   restyle its own header or padding.
4. **A panel is a region, not a modal.** It docks inside a sized column, has
   `role="region"` and an `aria-label`, never traps focus and never overlays
   the host.
5. **The footer is pinned.** Header and footer sit outside the scroll area, and
   only the body scrolls. The primary action is always reachable.
6. **Numbers use tabular figures** everywhere a value can change or be
   compared. Use OneDS's tabular/monospace numeric style, or
   `font-variant-numeric: tabular-nums` on the OneDS text style.
7. **Live data stays stable** (panels 1 and 5). The row count stays fixed, values
   update in place, nothing reorders, and motion stops under
   `prefers-reduced-motion`.
8. **No hardcoded colour.** If OneDS has no token for something, use the closest
   semantic token and list it under "OneDS gaps" in the PR (see §6).

---

## 2. Mapping the source's visual language onto OneDS

The source uses a small, consistent vocabulary. Map each *role* to its OneDS
equivalent, not the literal value. Look the equivalents up in OneDS. Don't
guess component names.

### 2.1 Tones (semantic status)

`panel-tokens.ts` defines five tones with `bg / text / border / dot / solid`
variants. Replace the whole file with a mapping onto OneDS status tokens:

| Source tone | Meaning here | OneDS role |
|---|---|---|
| `positive` | buy side, done, OK, live | success |
| `negative` | sell side, breach, failed | danger / error / critical |
| `warn` | watchlist, near limit, needs attention | warning |
| `info` | staged, batch, beta, AI, citations | info / accent |
| `neutral` | read-only, default | neutral |

Each tone needs five slots: subtle background, foreground text, subtle border,
dot/indicator and solid fill. If OneDS has trading-specific **buy/sell** tokens,
use them for the ticket's side toggle, primary button, bid/ask text and depth
bars instead of success/danger.

The sparkline stroke (`SPARK_STROKE`) and the vol-surface heat ramp use the
same tones, or a OneDS **data-viz** sequential ramp for the heatmap.

### 2.2 Type roles

| Source style | Used for | OneDS role |
|---|---|---|
| 10px, semibold, uppercase, wide tracking | eyebrows, section titles, metric labels, field labels | overline / label-small |
| 11px regular | subtitles, hints, metadata, timestamps | caption |
| 12px (`text-xs`) | body copy, list items, table cells | body-small |
| 14px semibold | metric values, buttons | body / label-medium |
| 16px semibold, tight | panel title | heading-small |
| 18px / 24px / 30px semibold | hero numbers: ticket mid, depth last, breach % | display / numeric-large (smallest step that fits) |
| mono | identifiers (ISIN, CUSIP, fill IDs) | code / mono |

### 2.3 Components

| Source primitive | Use the OneDS… |
|---|---|
| `PanelFrame` + accent left edge | side panel / drawer **in docked (non-modal) mode**, or a plain surface. The 2px left edge in the tone's border colour must survive (see §3.1). |
| `PanelHeader` close button | icon button, "close" icon, `aria-label="Close panel"` |
| `Pill` | badge / tag / status chip (tone-aware) |
| `PanelTabs` | tabs (underline / secondary style, **not** page-level nav), with an optional count badge |
| `PrimaryButton` | primary button. `tone` maps to OneDS success/danger button variants for buy/sell. |
| `GhostButton` | secondary / outline button |
| `Field` + `inputCls` | form field with label and hint slot, text input, select |
| textarea | textarea |
| radio cards (bulk allocation) | radio group (card/tile variant if available) |
| checkbox list with counts (filters) | checkbox |
| range slider (filters) | slider |
| suggestion/saved-view chips | chip / filter chip (selectable) |
| removable active-filter chips | dismissible chip / tag |
| `KeyValueRows` | description list / key-value list, if OneDS has one; otherwise compose |
| `MetaGrid` | stat / metric tiles, flush in a bordered grid |
| `MeterBar` | progress / meter, with an optional threshold marker |
| `MiniSpark` | sparkline, if OneDS has one; otherwise an SVG on OneDS tokens |
| initials avatar | avatar |
| surveillance banner | inline alert / banner (warning), non-dismissible |
| host table | data table / grid (compact density, selected row) |
| icons (close, chevron, lock, file, thumbs) | OneDS icon set equivalents |

If OneDS has no component for a row above, compose it from OneDS tokens and
list it under "OneDS gaps".

**Radius, elevation and spacing:** use OneDS values only. Don't recreate the
source's `rounded-*`, `shadow-*` or pixel paddings. Keep the **relative
rhythm**: header and section horizontal padding are equal, "dense" sections
have about 25% less vertical padding than normal ones, and sections are
separated by a 1px divider (the last section has none).

---

## 3. Shared chrome (build once)

Compose every panel as:

```
PanelFrame(accent, label)
  PanelHeader(eyebrow?, title, subtitle?, tone?, badge?, onClose?, children?)
  [optional fixed strip, e.g. the banner in panel 10]
  PanelBody            ← the only scrolling region
    MetaGrid | PanelSection …
  PanelFooter(note?)   ← optional, pinned
```

### 3.1 PanelFrame
- Fills its column (`height: 100%`), flex column, clips overflow, surface background.
- **2px left border** in the accent tone's *border* colour. Neutral uses the
  standard divider colour. This edge is the panel's loudest severity signal.
- `role="region"`, `aria-label={label}`.

### 3.2 PanelHeader
- Bottom divider. Top padding; the bottom padding comes from the content.
- Left column: eyebrow (overline), then a row of [status dot if `tone`] + title
  (truncates) + badge, then the subtitle (caption).
- Right: close icon button, if `onClose` is provided.
- `children` render below the title block, flush to the divider. This is where
  the tabs go in panel 3.

### 3.3 PanelBody
- `flex: 1; min-height: 0; overflow-y: auto`. No padding by default; sections
  pad themselves.

### 3.4 PanelFooter
- Top divider, surface background, never scrolls.
- Optional `note` line (caption) above a horizontal row of actions.
- Buttons marked `full` share the row equally.

### 3.5 PanelSection
- Horizontal padding matches the header. Vertical padding is normal, or dense.
- Optional title row: overline title on the left, `trailing` (caption, or a
  node such as "Clear all") on the right.
- Bottom divider unless `last`.

### 3.6 MetaGrid
- A 2- or 3-column grid of label/value cells with internal 1px dividers and a
  bottom divider. Label is an overline; value is semibold, tabular and
  optionally tone-coloured.

### 3.7 KeyValueRows
- Label on the left (fixed width of about 128px, muted). Value on the right,
  right-aligned, medium weight, tabular unless `mono: false`. Hairline
  dividers between rows.

### 3.8 MeterBar
- Thin track (about 6px). The fill is the tone's solid colour, clamped to
  0–100. An optional `marker` draws a 1px strong-colour tick at that
  percentage. It is decorative (`aria-hidden`).

### 3.9 MiniSpark
- A single-stroke polyline, normalised to min/max, with no fill, axes or
  labels. `aria-hidden`.

### 3.10 PanelEmpty (exists in the kit, unused by the ten panels)
- Centred icon in a circle, title and detail. Build it so a host can show it
  when nothing is selected.

---

## 4. The ten panels

Each entry gives the frame settings, then the regions top to bottom. Copy and
fixture values are in the matching `reference/` file.

### 1 · FX Order Ticket. *Transactional*, 380px
`OrderTicketPanel.tsx`

- **Frame:** accent follows side: buy → positive, sell → negative.
- **Header:** eyebrow "New order", title "EUR/USD", subtitle "Spot · value date 19 Aug 26 · Desk FXG10", badge info "Staged", close.
- **Body:**
  1. MetaGrid (2): Bid, Ask. Live, 5dp.
  2. Section (dense, untitled): "Mid" overline with the live mid (18px, coloured by tick direction: up = positive, down = negative, flat = default), then a caption row "Spread 0.16 pips" / "Prev close 1.0819".
  3. Section "Side" (dense): two equal toggle buttons, BUY / SELL, `aria-pressed`. The selected button takes its tone (subtle bg + strong border + tone text); the unselected one is neutral.
  4. Section "Order": Notional field (digits only; hint "EUR", or "over soft limit" with a warning border when above 50,000,000), then a 2-up Type (Market/Limit/Stop) and TIF (GTC/IOC/FOK/Day), then a Limit price or Stop price field shown only when the type isn't market (hint = distance from mid in pips, 1dp), then Account select.
  5. Section "Pre-trade checks" (last): three check rows (dot + label + detail). The third, "Desk soft limit", turns to warning with the supervisor message when over the limit.
- **Footer:** note = "Counter value … USD" (notional × ask for buy, × bid for sell, no decimals, en-GB grouping). After submit it reads "Order routed to EBS · ack 08:41:22" in success. Primary (tone = side): "Buy EUR 25.0m" / "Sell EUR 25.0m" (shows `x.xm` when ≥ 1m), disabled when notional ≤ 0. Secondary: "Cancel", which closes the panel.
- **Live:** `useTickingPrice(1.0842, { volatility: 0.0004 })`; bid = mid − 0.00008, ask = mid + 0.00008.

### 2 · Instrument Reference. *Informational*, 360px
`InstrumentReferencePanel.tsx`

- **Frame:** neutral.
- **Header:** "Security master" / "SIEGR 3.25% 02/31" / "Siemens AG · Senior unsecured · EUR", badge neutral "Read-only".
- **Body:** MetaGrid (2×2: Mid price, Yield, Z-spread, Mod. duration), then "Terms" (8 key/value rows), then "Identifiers" (4 copy rows), then "Ratings" (trailing "as of 12 Aug 26"; 3 bordered rows of agency, grade and an outlook badge, with Negative as warning), then "Classification" (last; 6 neutral tags).
- **Copy rows:** the whole value is a button. Mono value on the right with a "copy" affordance that turns into "copied" (success) for 1.2s after it writes to the clipboard.
- **Footer:** note "Source: internal security master · synced 06:15 CET"; two equal secondary buttons, "Open in terminal" and "Export". **No primary action. That's deliberate.**

### 3 · Counterparty 360. *Tabbed*, 400px
`Counterparty360Panel.tsx`

- **Frame:** neutral. **Header:** "Counterparty" / "Nordea Bank Abp" / LEI subtitle, status dot warning, badge warning "Watchlist". Header children: tabs Overview, Exposure, Docs (4), Contacts (3).
- **Body:** MetaGrid (2: Current 412.6m, Utilisation 69% in warning) **sits above the tab content and is visible on every tab**.
  - *Overview:* "Standing" (6 key/value rows), then "Why watchlisted" (last; a paragraph plus badges "Since 04 Aug" in warning and "Owner: T. Lindqvist" in neutral).
  - *Exposure:* "By product", trailing "EUR · EOD 16 Aug". 4 rows of product, `used/limit` and a meter. Tone is negative when ≥ 90%, warning when ≥ 75%, otherwise info. Marker at 90. Caption: "Marker at 90% — the escalation threshold, not the limit."
  - *Docs:* "Agreements". 4 rows of name, `ref · date` and a status badge (Executed = positive, Expiring = warning, In negotiation = info).
  - *Contacts:* "Coverage". 3 rows of initials avatar, name, `role · desk` and a small secondary "Message" button.
- **Footer:** primary "Request limit review", secondary "Full profile". The same on every tab.
- Tab content swaps in place. The header and MetaGrid don't move.

### 4 · Limit Breach Triage. *Triage*, 380px
`LimitBreachPanel.tsx`

- **Frame:** negative. **Header:** "Hard limit breach" / "EUR Rates DV01" / "Book RATES-EUR · breached 09:11 CET · 34 min ago", status dot negative, badge negative "Level 2".
- **Body:**
  1. Section (dense): "Utilisation" overline, then **108%** as the largest number in the panel (30px, negative). On the right: Limit 370k / Current 400k / **Excess 30k** (negative). A meter at 100 (clamped) in negative, with a marker at 92 and a scale row below it: "0 · Warning 92% · Limit".
  2. MetaGrid (2): Peak today 112% (negative), Breaches MTD 3.
  3. "What is driving it", trailing "DV01 by book". 4 contributors: book name and DV01, then a negative meter (share %) and the "moved" caption.
  4. "Escalation path": an ordered list of 3 numbered steps. Notified steps use negative-subtle numbering; the pending CRO step is neutral and hides its name.
  5. "Audit note", trailing "required" (last): textarea, 3 rows, with the placeholder from the source. Below it: "Retained for 7 years" and a `n/500` counter.
- **Footer:** note "Acknowledging does not clear the breach — it records that the desk has seen it." After acknowledging it becomes "Acknowledged 09:45 · risk notified" in success. **Actions are ranked:** a full-width primary "Acknowledge" on its own row, **disabled until the note has non-whitespace content**, then "Acknowledged" and disabled afterwards. Below it, two equal secondaries: "Escalate" and "Request increase".

### 5 · Market Depth. *Live data*, 340px
`MarketDepthPanel.tsx`

- **Frame:** info. **Header:** "Order book" / "AZN LN" / "AstraZeneca · LSE · GBX", badge positive "Live" with a pulsing dot (the pulse stops under reduced motion).
- **Body:**
  1. Section (dense): last price (24px, 0dp, coloured by tick direction) over "+110 (+0.94%)" in positive. A sparkline on the right (110×30, positive, from the tape `trail`).
  2. "Depth", trailing "Spread {n}". Header row: Bid | Px | Ask. **Exactly 6 rows**, each a 3-column grid: bid size (right-aligned) with a positive-subtle bar growing **right-to-left** behind it; a centre column of `bidPx · askPx` (bid in positive text, ask in negative); ask size with a negative-subtle bar growing **left-to-right**. Bar width = size / max size. Below: "{n} bid orders" / "{n} ask orders".
  3. "Session" (last): 6 key/value rows.
- **Footer:** note "Level 2 · delayed 15 min for display purposes", body caption "Read-only — route orders from the ticket." **No buttons.**
- **Live:** `useTickingPrice(11842, { volatility: 0.0006, intervalMs: 1100 })`. Derive the ladder from the live mid on every tick: tick = 2, `bidPx = mid − 2(i+1)`, `askPx = mid + 2(i+1)`. Sizes and order counts use the modular formulas in the source. Never re-sort; key rows by level index.

### 6 · Research Copilot. *AI assist*, 400px
`ResearchCopilotPanel.tsx`

- **Frame:** info. **Header:** "Copilot" / "Ask this note" / "EUR Rates Weekly · 14 pages · indexed 15 Aug", badge info "Beta".
- **Body:**
  1. "Suggested" (dense): 3 selectable chips. Clicking one asks that question.
  2. Message list (padded, vertical gap):
     - *User:* right-aligned bubble, max 85% wide, inverse/strong surface.
     - *Assistant:* plain text, then **citation chips** (info tone: `¶n` + label), then a row with a thumbs-up "Helpful" icon button, a thumbs-down "Not helpful" icon button, and on the right the caption "Generated · verify before acting".
     - *Thinking:* three bouncing dots plus "Reading §9–§12 of the note…". The bounce stops under reduced motion; the text stays.
  - Auto-scroll to the end when messages or the thinking state change.
- **Footer:** note "Answers are drawn only from this note. Not investment advice." A row with a text input ("Ask about this note…", aria-label to match; Enter submits) and a primary-small "Ask" button, disabled when the input is empty or while thinking.
- **Behaviour:** seeded with the 2-message `SEED`. Asking appends the user message, clears the input and shows thinking for 1.1s, then appends the `CANNED` answer. Ignore input while thinking. This is a pattern demo: **don't wire up a real model.**

### 7 · Trade Lifecycle. *Timeline*, 380px
`TradeLifecyclePanel.tsx`

- **Frame:** negative, or positive once repaired. **Header:** "Settlement exception" / "TRD-88412" / "Nordea Bank Abp · EUR 12.4m · Bund 2.60% 34". The status dot and badge follow state: "Failing" (negative), then "Resubmitted" (positive).
- **Body:**
  1. MetaGrid (2): Value date 15 Aug 26, Time to cutoff 2h 14m (warning).
  2. "Lifecycle", trailing "6 steps". A vertical stepper with a connector line between dots. Dot colours: done is positive, failed is negative, blocked is neutral. Each step shows its label and a right-aligned timestamp, with the detail below. A blocked step's label is muted. **The failed step expands in place** into a negative-subtle box titled "Mismatched fields", containing a 3-column table (Field / Ours / Theirs). Rows that differ are medium weight in negative text; rows that match are muted.
  3. "Trade" (last): 6 key/value rows; Trader and Ops owner use `mono: false`.
- **Footer:** note "Repairing sends a corrected SWIFT MT541 and re-triggers matching." Primary "Repair instruction", secondary "Chase counterparty".
- **On repair:** the failed step's dot turns positive, its detail becomes "Instruction corrected · awaiting re-match", the mismatch box disappears, the blocked step un-mutes, the frame and header go positive, the primary reads "Repair sent" and is disabled, and the note becomes "Corrected instruction sent 13:02 · re-match expected within 20 min".

### 8 · Bulk Allocation. *Bulk action*, 380px
`BulkAllocationPanel.tsx`

- **Frame:** info. **Header:** "Selection" / "{n} fills selected" (live count) / "Program 4417 · Bund 2.60% 34 · 16 Aug", badge info "Batch".
- **Body:**
  1. MetaGrid (**3**): Quantity (grouped), VWAP (3dp), Notional (`x.xxm`). All recompute as fills are removed.
  2. "Needs attention", trailing "{k} of {n}". Shown only when flagged fills remain. Warning-subtle rows of account and flag reason, each with a small "Exclude" button that removes the fill.
  3. "Allocation method": 3 radio cards (Pro-rata by order size "Default"; Average price across accounts; Manual override "Requires sign-off"). The first is checked. The checked card gets a strong border.
  4. "In this batch", trailing "{n} fills" (last): rows of mono fill ID, account, qty and px (2dp), plus a remove icon button (`aria-label="Remove F-xxxx"`). It's revealed on row hover **and must also be visible on keyboard focus** (the source only does hover; fix this).
- **Footer:** three states.
  - *Idle:* note "{accounts} accounts · {k} flagged". Primary "Allocate {n}" (disabled at 0); secondary "Reset" (restores `INITIAL`).
  - *Confirming (inline, no modal):* note in strong text, "Allocate {n} fills across {accounts} accounts? This cannot be undone after confirmations go out." Primary "Yes, allocate", secondary "Back".
  - *Done:* note "{n} fills allocated · confirmations queued" in success. Primary "Allocated", disabled.

### 9 · Screen Filters. *Filter*, 340px
`ScreenFiltersPanel.tsx`

- **Frame:** neutral. **Header:** "Filters" / "Cross-asset screen" / "{count} of 8,730 instruments match" (live).
- **Body:**
  1. "Saved views" (dense): 3 single-select chips. The selected one uses the strong/inverse fill. Selection is visual only.
  2. "Active" (dense, only when something is selected), trailing a text-link button "Clear all". Dismissible chips for each selected option; clicking one toggles it off.
  3. One dense section per facet group (Asset class, Currency, Rating band): checkbox rows of label and a right-aligned count. **Options with a count of 0 stay in the list, disabled and dimmed. Don't hide them.**
  4. "Modified duration" (dense, last): a 1–15 slider (aria-label "Maximum modified duration") with the scale row "1.0 · up to {v.1} · 15.0".
- **Count formula (keep it):** `narrowed = Σ counts of selected options`; `count = max(12, round(maxDuration/15 × (narrowed || 8730)))`.
- **Applied state:** any change sets `applied = false`.
  - *Footer note:* applied → "Grid is in sync with these filters."; otherwise "{count} rows pending — apply to update the grid."
  - *Primary:* "Apply ({count})", or "Applied" and disabled once applied.
  - *Secondary:* "Reset" restores `{eur, credit}` and duration 8, and sets applied.
- Initial state: selected `{eur, credit}`, duration 8, saved view "EUR IG core", applied.

### 10 · Desk Commentary. *Collaboration*, 380px
`DeskCommentaryPanel.tsx`

- **Frame:** warning. **Header:** "Discussion" / "Vega concentration" / "Position EQD-SX5E-DEC26 · 5 participants", badge warning "Open review".
- **Fixed strip between the header and the body (doesn't scroll):** a warning banner with a lock icon: "Recorded communication. Retained 7 years and subject to trade surveillance." Not dismissible.
- **Body:**
  1. Thread, oldest first:
     - *System messages:* neutral-subtle row with a dot, the body and a muted timestamp.
     - *People:* avatar (initials on an inverse fill), then a row of name (semibold), role (caption) and right-aligned timestamp, then the body, then optional info-tone `@mention` tags.
  2. "Attached" (dense, last): 2 bordered file rows with a file icon, name and `author · size`.
  - Auto-scroll to the end when the thread changes.
- **Footer:** a column: textarea (2 rows, placeholder "Reply — use @ to mention someone…", aria-label "Reply to thread"), then a row with a small secondary "Attach", the caption "Visible to EQD desk & risk", and a right-aligned primary-small "Post", disabled when the draft is empty.
- **Post:** appends `{ author: "You", initials: "YO", role: "Structuring", at: "16 Aug 14:02", body }` and clears the draft.

---

## 5. Demo page and host surfaces

Rebuild `reference/pages/right-panel-patterns.tsx` so the panels are shown
**docked beside their host**, not as standalone swatches.

### 5.1 Page layout
- Full viewport height, column layout, page background.
- **Header:**
  - *Text:* eyebrow "Global markets · UI patterns", H1 "Contextual Right Panels", and the caption "Ten panels, one chrome — transact, inspect, triage, filter and discuss, each shown against the surface it docks beside."
  - *Buttons, on the right:* secondary "Hide notes"/"Show notes", then primary "Collapse panel"/"Open panel".
  - The source's `pl-36` only clears a floating "Home" pill in the source app. Drop it unless your shell needs the same.
- **Example rail** (256px, hidden below the md breakpoint): a list of all ten entries showing the number, name and `pattern · desk`. The active entry has a strong left indicator, `aria-current`. Selecting an entry swaps both host and panel **and re-opens the panel**.
- **Main area** (padded): a bordered card split into host (flex: 1) and panel column.
  - The panel column is `example.width` wide, or **56px collapsed**.
  - The collapsed state is a full-height button: a chevron plus the pattern name in **vertical** text, `aria-label="Open {name} panel"`. It's the panel's resting state, not its absence.
  - Below the **lg** breakpoint the split stacks, with the panel full width and 440px tall under the host. The collapsed rail goes horizontal.
  - **Render the panel exactly once** at all breakpoints. Don't render responsive duplicates; they double the state, intervals and landmarks.
- **Notes card** (toggleable, below the split): a strong badge with the pattern name, H3 name, caption `{desk} · {width}px wide`, the summary, then the rationale (muted).

### 5.2 Host surfaces (`HostSurface.tsx`)
Keep the host deliberately quiet: muted, static, and one level less detailed
than the panel. It has a header bar with the title, subtitle and a small
neutral "Host surface" tag, then one of:

- **`blotter` / `ladder`:** a compact OneDS data table from `HOST_TABLES[id]`.
  - *Header:* overline-style column headers.
  - *Cells:* right-aligned where `align: "right"`, muted where `muted`, tabular.
  - *Rows:* **row 1 is selected** (selected background, `aria-selected`, medium weight). That's the record the panel shows. Rows with a `tone` get a 2px left stripe in that tone on the first cell. Use the OneDS row-status indicator if one exists.
- **`board`** (panel 4): a 2/3-column grid of 6 limit tiles (book name, util %, mini meter). Tile tone: breach → danger-subtle, warn → warning-subtle, ok → default. Tile 1 (EUR Rates DV01, 108%) is outlined as selected in danger.
- **`doc`** (panel 6): an article with H3 "Two cuts, not one — staying in the EUR steepener", the meta caption, and 12 numbered paragraphs (copy in source). **¶9 is highlighted** in info-subtle with an info-coloured number, because the copilot's citations point at it.
- **`chart`** (panel 10): the "Implied vol surface" heatmap. Strikes 4600–5600 by tenors 1m–2y, with `vol = 16 + |si − 2.5| × 1.6 + ti × 0.9` (1dp). Fill intensity = `min(1, (vol − 15)/12)` mapped onto a OneDS sequential data-viz ramp. The 1y × 5200 cell gets a warning-coloured inset outline. The caption is in the source.

---

## 6. When OneDS doesn't fit

Follow this order:

1. Use the OneDS component that fits.
2. If there isn't one, compose from OneDS primitives and tokens.
3. If there's no token, use the nearest semantic token. **Never** use a raw
   hex value, `rgba()` or a Tailwind palette class.
4. Record every case from steps 2–3 in the PR description under **"OneDS gaps"**:
   what you needed, what you used, and the file.

Things likely to need step 2: the depth ladder's mirrored bars, the timeline
stepper with an inline expansion, the meter's threshold marker, the
sparkline, the vol heatmap, the vertical-text collapsed rail, and the radio
*cards*.

### Allowed deviations (only these)
- If a OneDS component supplies stronger accessibility semantics than the
  source, take them. For example, OneDS tabs with `role="tablist"`/`tab` in
  place of the source's `nav` + `aria-current`.
- The bulk-allocation remove button must also appear on keyboard focus (§4.8).
- Every animation (pulse, bounce, smooth scroll, tick updates) must respect
  `prefers-reduced-motion`.

Anything else that looks wrong in the source should be **flagged in the PR,
not fixed**. That includes the "Live" badge sitting next to "delayed 15 min"
in panel 5, which is intentional demo copy.

---

## 7. Acceptance checklist

- [ ] All ten panels render in order, with names, copy and fixture values matching `reference/`.
- [ ] Each panel's width matches `PANEL_EXAMPLES[n].width`. The collapsed rail is 56px.
- [ ] One shared frame/header/body/footer/section implementation. No per-panel restyling.
- [ ] Header and footer stay fixed while the body scrolls, in every panel.
- [ ] Panel 10's surveillance banner stays fixed while the thread scrolls.
- [ ] Accent edges: ticket follows side; breach is negative; lifecycle goes negative → positive; commentary is warning; depth, copilot and bulk are info; the rest are neutral.
- [ ] Zero raw colour values in the new code. Grep for `#`, `rgb`, `rgba` and Tailwind palette names; every hit is either removed or listed in "OneDS gaps".
- [ ] All typography uses OneDS text styles. Numbers are tabular.
- [ ] Live panels (1, 5) tick. The depth ladder never changes row count or order. Under reduced motion, nothing moves.
- [ ] Interactive states work as specified:
  - [ ] ticket submit and soft limit
  - [ ] copy → copied
  - [ ] tab swap with the MetaGrid kept
  - [ ] breach acknowledge gated on the note
  - [ ] copilot ask → thinking → answer
  - [ ] lifecycle repair
  - [ ] bulk exclude / remove / confirm / done / reset
  - [ ] filter toggle / clear / slider / apply / reset with live count
  - [ ] commentary post
- [ ] Demo page: selecting from the rail swaps host and panel and re-opens the panel; collapse/open works; notes toggle; below lg the layout stacks with the panel rendered once.
- [ ] Every panel is a labelled region. Close buttons and icon buttons have aria-labels. Everything is keyboard-reachable.
- [ ] The PR description includes the "OneDS gaps" list.
