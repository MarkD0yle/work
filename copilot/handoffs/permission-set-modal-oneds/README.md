# Handoff: "New permission set" modal → rebuild in OneDS

> **The one rule: this is a port, not a redesign.**
>
> The files in `reference/` *are* the modal and the form that opens it. Copy
> them, keep the data file and every piece of state logic exactly as it is,
> and replace only the **visual layer** (Tailwind classes, colour utilities,
> inline SVG icons, the hand-built modal shell) with OneDS components and
> tokens. Structure, order, copy, data, state and interactions stay the same.
>
> If you catch yourself picking a "better" pattern (a data grid for the 54
> market rows, a wizard that pages through regions, dropdowns instead of the
> radio rows, a toast on save) **stop**. That is the reimagining this spec
> exists to prevent. §3 lists what is forbidden here.

---

## 0. How to use this folder

```
permission-set-modal-oneds/
  README.md                          ← this spec. Read all of it before writing code.
  permission-set-modal-oneds.prompt.md ← paste-ready Copilot prompts, one per run
  screenshots/                       ← what "same modal" means. Compare against these.
  reference/src/                     ← the original code. Read-only. Same folder layout as the source repo.
    components/accordion-modal-forms/
      data.ts                        ← LOGIC: the 54 markets, regions, access options, desks
      styles.ts                      ← class strings + two helpers (nextId, todayIso) + Tone type
      kit.tsx                        ← VIEW KIT: AccordionItem, InlineEntry, RadioPills, Chip, …
      MarketAccessExample.tsx        ← VIEW + STATE: the onboarding accordion, the entry row, the modal
    components/patterns/Modal.tsx    ← VIEW: the dialog shell the modal sits in
    lib/severity-tokens.ts           ← only imported by Modal.tsx for its unused `severity` prop
```

The source page (`src/pages/accordion-modal-forms.tsx`) shows three examples.
This package is **Example A · Market access** only, and within it the
`PermissionModal` component — titled **New permission set** when adding and
**Edit · {name}** when editing. The modal is meaningless without the section
that opens it and receives its result, so the host form is in scope too (Run 3).

### 0.1 Three kinds of code. Treat them differently.

This is the most important instruction in the spec.

| Kind | What | What you do |
|---|---|---|
| **Logic — copy unchanged** | `data.ts` | Copy byte for byte. **Do not edit, rename, reformat or "tidy" it.** It holds every market, region, label and desk. It also holds data for Examples B and C; leave that in. |
| **Logic with one fix** | `styles.ts` | Keep `nextId`, `todayIso` and the `Tone` type exactly. Delete every class-string constant (`btn*`, `inputClass`, `labelClass`, `TONE`, `TONE_DOT`) once nothing imports them. Write `Tone` as `export type Tone = "good" \| "warn" \| "bad" \| "info" \| "muted";` so `data.ts` still compiles. |
| **State inside view files — keep verbatim** | In `MarketAccessExample.tsx`: the `PermissionSet`, `Entity`, `Contacts`, `SectionId` types; `SEED`; every `useState`; `entityDone`, `accessDone`, `status`, `requiredDone`; `toggle`, `newSet`, `saveSet`; `countAccess`. In `PermissionModal`: `d`, `query`, `region`, `unsetOnly`; `setCount`, `complete`, `canSave`; the `visible` memo; `setAccess`; `applyToRegion`; the `isNew` and `key={draft.id}` wiring | Copy these lines unchanged. Only the JSX they feed is converted. Never move a rule into a different place or re-derive it. |
| **View — convert** | `kit.tsx`, `Modal.tsx`, the JSX of `MarketAccessExample.tsx` | Keep the JSX tree, props, handlers, ids, `aria-*` and copy. Swap the styling for OneDS (§4–§6). |

### 0.2 Order of work (one run each — see the prompt file)

1. **Run 1 — Kit.** Copy `data.ts`, apply the `styles.ts` fix, convert `kit.tsx`
   and map `Modal.tsx` onto the OneDS dialog. Build a throwaway test page that
   renders every kit component in every state. Stop.
2. **Run 2 — The modal.** Convert `PermissionModal` only, opened from a test
   button with a blank draft and with `SEED`. Run the §5.2 state matrix.
3. **Run 3 — The host form.** Convert the rest of `MarketAccessExample.tsx`
   (four accordion sections, the permission entry row, the footer) and wire it
   to the Run 2 modal. Run the §5.1 and §5.3 matrices. Delete the test pages.

Never convert more than one run's scope in a run.

### 0.3 Precedence

- `reference/` decides content, structure, copy, data, logic and behaviour.
- `screenshots/` decides layout, grouping, hierarchy and density — except the
  one known source defect in §10.1.
- OneDS decides colour, type, spacing, radius, borders, shadows, icons, motion
  and control styling.
- This spec decides which OneDS thing replaces which source element.

### 0.4 Source stack

React 19, TypeScript, Tailwind v4. No component library, no icon package
(three inline SVGs: close ✕, chevron, check, plus `PlusIcon`), no animation
library (the modal uses one CSS keyframe, `forensic-slide-up`, 240ms). The
source default export is `MarketAccessExample`; keep that name.

---

## 1. What it is

A client-onboarding form built as a four-section accordion. Section 3, **Market
access**, holds *permission sets*. Each set is authored in a wide modal that
rates all **54 markets** (Americas 8 · EMEA 32 · APAC 14) as **Full /
Restricted / Blocked**. Saving drops the set back into the section as an inline
entry that can be expanded, edited or removed. A client can carry several sets,
one per desk.

| # | State | Screenshot |
|---|---|---|
| 1 | Host form, Market access open, seeded entry expanded | `01-accordion-section.png` |
| 2 | New permission set, nothing rated | `02-new-empty.png` |
| 3 | Americas filled by region shortcut, Brazil restricted with a note | `03-new-region-filled.png` |
| 4 | Filtered: APAC · Unset only · `in` | `04-new-filtered.png` |
| 5 | 54 of 54 rated, no name → save disabled (scrolled to bottom) | `05-new-complete-no-name.png` |
| 6 | Name entered → `Add to form` enabled | `06-new-ready.png` |
| 7 | Saved: two entries in the section | `07-saved-entries.png` |
| 8 | Edit mode on the seeded set | `08-edit.png` |

The modal, top to bottom:

```
┌ HEADER   Title · description                                         ✕ ┐
├ BODY (scrolls)                                                          ┤
│   Set name* (2 cols) · Desk · Effective                                 │
│   ── STICKY FILTER BAR ── Filter markets… · All|Americas|EMEA|APAC · ☐ Unset only
│   AMERICAS 0/8 ……………………………… Set all to [Full] [Restricted] [Blocked]   │
│     US  United States                         [Full|Restricted|Blocked] │
│     … one row per market (restricted rows add a note input)             │
│   EMEA 0/32 …   APAC 0/14 …                                             │
│   ── divider ── Max notional / order · Notes (2 cols)                   │
├ FOOTER   N of 54 markets set · name required          [Cancel] [Add to form] ┤
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Non-negotiables (check before opening the PR)

1. **Same regions, same order, same copy.** Word for word, including `·`
   separators, `—` dashes, `…` in `Filter markets…`, `e.g. EM derivatives`, and
   `Edit · {name}`. Do not add, drop, merge, rename or reorder anything. Full
   copy inventory in §5.4.
2. **`data.ts` is untouched** and the state lines listed in §0.1 are verbatim.
3. **Every market is a real radio group.** One group per market, three real
   radio inputs, labelled `Access for {market name}`. Arrow keys move within a
   row. No dropdowns, no checkboxes, no single "status" button that cycles.
4. **All 54 rows are on one scrolling list,** grouped by region in
   `<fieldset>`s with the region name as `<legend>`. No pagination, no wizard,
   no virtualisation.
5. **Save is blocked, not hidden.** `Add to form` / `Save changes` stays visible
   and disabled until all 54 markets are set **and** the name is not blank. The
   footer text says why (`· name required`).
6. **Region shortcuts write the whole region,** regardless of the current
   filter or `Unset only`. `Set all to Restricted` on EMEA sets all 32.
7. **Unset rows are visibly marked** (source: faint warning tint on the row).
   Keep a subtle warning surface on rows with no value.
8. **The filter bar is sticky** to the top of the modal body while the market
   list scrolls under it.
9. **Cancel discards.** ✕, `Cancel`, Esc and backdrop click all close without
   saving. Edits happen on a draft copy (`structuredClone`); the saved entry
   only changes on `Save changes`.
10. **Tone means the same everywhere.** Full = success, Restricted = warning,
    Blocked = danger — on the radio pills, the entry chips and the distribution
    bar. Colour supports the word; the word is always shown.
11. **Numbers use tabular figures** — the `N of 54` footer, `done/total` region
    counts, chips, `Max notional / order`.
12. **Radius, elevation and shadows are OneDS's.** The source is square-cornered
    because of *its* rules. Do not copy that.
13. **No hardcoded colour, size or font.** Everything from OneDS tokens.

---

## 3. What reimagining looks like here (do not do these)

| Don't | Do |
|---|---|
| Put the 54 markets in a **data grid / AG Grid / OneDS DataTable** | Keep `<fieldset>` → `<ul>` → `<li>` rows, styled with OneDS tokens |
| Page or step through regions (**wizard**, tabs that unmount other regions) | One list. The region buttons are a **filter**, not navigation |
| Swap `RadioPills` for a **select**, checkbox set, or toggle | OneDS segmented control / radio button group, three options, real radios |
| Turn the region buttons into OneDS **Tabs** | They are `aria-pressed` toggle buttons. Use OneDS segmented/toggle button group |
| Put the restriction note in a popover or second modal | Inline input in the row, only while that row is `Restricted` |
| Show a **toast** after save | The modal closes and the entry appears in the section. Nothing else |
| Add select-all, import, copy-from-set, export, sort or extra columns | Nothing that is not in `reference/` |
| Rename buttons to OneDS defaults (`Add to form`→`Save`, `Cancel`→`Discard`) | Keep the exact words |
| Make the footer count a progress bar | Plain text, as in the source |
| Move Max notional / Notes to the top | They stay below the market list, behind a divider |
| Add a confirm to `Remove` on an entry | The source removes immediately. Keep it |

---

## 4. The shared kit (Run 1)

Convert these once. The modal and host form reuse them; never restyle a kit
component at a call site.

### 4.1 `kit.tsx` — component contracts

Keep every component's **name, props and behaviour**. Only its rendering changes.

| Component | Contract to keep | Use the OneDS… |
|---|---|---|
| `AccordionItem` | `index`, `title`, `summary` (one truncated line), `status` (`complete`/`incomplete`/`optional`), `open`, `onToggle`. `<h3>` wrapping a `<button aria-expanded aria-controls>`; panel is `role="region"` labelled by the header. Step badge: number in a box, or a filled success square with a check (`aria-label="Complete"`) when complete. `Optional` caption on the right when optional. Chevron rotates when open. Open section gets a stronger border | accordion / disclosure item with a leading slot |
| `InlineEntry` | `title`, `meta`, `badges`, `details`, `muted`, `onEdit`, `onRemove`. Left accent border. Caret button (`Show details` / `Hide details`, `aria-expanded`) reveals `details` on a subtle surface. `Edit` and `Remove` are ghost buttons; `Remove` hovers to danger | list item / card row with expandable detail |
| `RadioPills` | `name`, `label` (→ `aria-label` on `role="radiogroup"`), `value` (may be `undefined` = nothing checked), `options` with `tone`, `onChange`, `disabled`, `size` (`xs`/`sm`). Visually hidden real `<input type="radio">`s. Checked option takes its tone's soft fill + text colour; unchecked is neutral. Focus ring on the focused option | segmented control or radio button group, **with tone per option**. If OneDS segmented has no tone, compose from OneDS radio + tone tokens and log it (§8) |
| `Chip` | `tone` (`good warn bad info muted`), children, tabular figures | tag / badge with tone |
| `DistributionBar` | Stacked thin bar, segment widths `count/total`, zero-count segments omitted; legend of dot + label + count below | compose: OneDS stacked progress if it exists, otherwise divs on tone tokens. Keep the `style={{ width }}` |
| `Progress` | Thin bar + `done/total`; success colour when complete, otherwise neutral strong | progress bar |
| `FieldBlock` | `label`, `htmlFor`, `hint`, `required` (red `*`), `className` passthrough for grid spans | form field (label + control + helper text). Keep the uppercase-label look only if OneDS has that label style; otherwise use OneDS's label |
| `EmptyEntries` | Dashed-border centred caption | empty state, text only (no illustration) |
| `FormFooter` | `done`, `total`, `onSubmit`, `submitLabel`, `submitted`. Progress + message (`Submitted for review.` / `All required sections complete.` / `N required section(s) left.`), primary button disabled until complete, label becomes `Submitted` | bar with progress + primary button |
| `PlusIcon` | 14px plus, `aria-hidden` | OneDS add/plus icon |

### 4.2 `Modal.tsx` → OneDS dialog

Map the source `Modal` onto the OneDS modal/dialog. You may keep a thin
`Modal` wrapper with the same props so call sites don't change.

| Source behaviour | Keep |
|---|---|
| `open`, `onClose`, `title`, `description`, `size`, `footer`, `children` | Yes — same props |
| `role="dialog"`, `aria-modal`, `aria-labelledby` (title), `aria-describedby` (description) | Yes |
| Esc closes; backdrop click closes; ✕ button (`aria-label="Close dialog"`) closes | Yes |
| Focus moves into the dialog on open, is trapped while open, returns to the opener on close | Yes (OneDS's own trap is fine) |
| `size="2xl"` = max-width 1040px; max-height 85vh; header and footer fixed, body scrolls | Use OneDS's widest dialog size closest to 1040px. Body must be the scroll container (the sticky filter bar depends on it) |
| Footer: right-aligned actions on a subtle surface; a left-aligned caption pushed with `mr-auto` | Yes |
| 4px neutral accent bar across the top; `severity` prop | Drop both unless OneDS dialogs have an accent. `severity` is unused by this modal; `severity-tokens.ts` is not needed in the target |
| 240ms slide-up entrance | OneDS dialog motion; honour reduced motion |

Kit acceptance: a test page renders every kit component in every tone and
state; Tab reaches every control; arrow keys move inside a `RadioPills`; Esc
closes the dialog and focus returns to the button that opened it.

---

## 5. The screens

Layout is for ≥1280px. Copy, headings and data come from the reference file.
This section lists **regions in order** and the **behaviours you must not lose**.

### 5.1 Host form — `MarketAccessExample` (Run 3)

Four `AccordionItem`s, then `FormFooter`. Only `access` is open on load.
Several sections can be open at once (`Set<SectionId>`).

| Section | Must keep |
|---|---|
| 1 Entity details | 2-col grid: Legal name*, LEI* (uppercased, `maxLength 20`, mono, hint `N/20 characters`), Client classification select (`Retail / Professional / Eligible counterparty`), Domicile select (54 markets). Complete when name non-blank and LEI is 20 chars |
| 2 Trading contacts | 3-col grid: Name, Email (`type="email"`), Phone. Status `complete` when email set, else `optional` |
| 3 Market access | Helper line. `EmptyEntries` `No permission sets yet.` when none. One `PermissionEntry` per set. Dashed full-width `+ Add permission set` button → `newSet()`. Summary: `N permission set(s) · {desks joined by ", "}` or `Which of 54 markets this client may trade` |
| `PermissionEntry` | `InlineEntry`: title = set name; meta `{desk} · effective {date}` + ` · max {n} / order` when set; chips `N full` (good) `N restricted` (warn) `N blocked` (bad); details = `DistributionBar`, `Restricted:` list with notes in parentheses, `Blocked:` codes joined by ` · `, italic notes. `Edit` opens the modal on a `structuredClone`; `Remove` deletes at once |
| 4 Attestation | One checkbox with the full sentence |
| Footer | `done` of 3 required (entity, access, attestation); submit `Submit onboarding` |

### 5.2 The modal — `PermissionModal` (Run 2)

Opened when `draft !== null`. `isNew` = the draft's id is not in `sets`.

| Region | Must keep |
|---|---|
| Header | Title `New permission set` (new) or `Edit · {initial.name}` (edit — uses the name at open time, does not change while typing). Description sentence |
| Top fields | 4-col grid: `Set name`* spans 2 (placeholder `e.g. EM derivatives`), `Desk` select (5 desks; new default `Cash Equities`), `Effective` date (new default today) |
| Filter bar | Sticky at the top of the scrolling body, full-bleed with top/bottom borders and a near-opaque surface. Search input (`aria-label="Filter markets"`, matches name **or** code, case-insensitive). Region toggle group `All / Americas / EMEA / APAC` with `aria-pressed`, one selected. `Unset only` checkbox pushed right |
| Region fieldset ×3 | Only the selected region (or all three). Header row: uppercase `<legend>`, `done/total` count (counts the whole region, ignores filters), right-aligned `Set all to` + three small buttons `Full` `Restricted` `Blocked` → `applyToRegion`. When filters hide every row in the region: `No markets match.` |
| Market row | In order: 2-letter code (mono, muted), market name (fills), restriction-note input **only when the row is Restricted** (`aria-label="Restriction note for {name}"`, placeholder `Restriction note`), then `RadioPills size="xs"`. Unset rows carry the warning tint. With `Unset only` on, a row disappears as soon as it is set |
| Bottom fields | Divider, 3-col grid: `Max notional / order` (`inputMode="numeric"`, placeholder `0`, tabular), `Notes` spans 2 |
| Footer | Left: `{setCount} of 54 markets set` + ` · name required` when name is blank. Right: `Cancel` (secondary) and `Add to form` (new) / `Save changes` (edit), primary, disabled until `canSave` |

State matrix (verify each):

| Scenario | Expected |
|---|---|
| `+ Add permission set` | `New permission set`, desk `Cash Equities`, effective today, `0 of 54 markets set · name required`, `Add to form` disabled, region counts `0/8`, `0/32`, `0/14`, every row tinted (`02`) |
| Americas · `Set all to` `Full` | Americas `8/8`, footer `8 of 54`, tints cleared on those rows |
| Brazil → `Restricted` | Note input appears in the Brazil row; typing fills `restrictionNotes.BR` (`03`) |
| `APAC` + `Unset only` + type `in` | Only APAC shown; rows CN, SG, IN, ID, PH (`04`). Setting one makes it vanish |
| Filter `zzz` | `No markets match.` under each visible region |
| EMEA `Blocked`, APAC `Restricted` with no name | `54 of 54 markets set · name required`, still disabled (`05`) |
| Type a name | ` · name required` disappears, `Add to form` enabled (`06`) |
| `Add to form` | Modal closes, new entry appended below the seed, summary `2 permission sets · Cash Equities, Cash Equities` (`07`) |
| `Edit` on the seed | `Edit · Developed markets — cash`, fields filled, `54 of 54 markets set`, `Save changes` enabled (`08`) |
| Edit → change a row → `Save changes` | Entry replaced in place (same position), chips update |
| Edit → change a row → Esc / ✕ / backdrop / `Cancel` | Modal closes, entry unchanged |
| Close by any route | Focus returns to the button that opened the modal |

### 5.3 Host form state matrix (Run 3)

| Scenario | Expected |
|---|---|
| Load | Only Market access open; Entity details complete (check); Contacts `Optional`; one entry with chips `23 full`, `5 restricted`, `26 blocked`; footer `2/3 · 1 required section left.` |
| Expand the seed entry | Distribution bar; `Restricted: Poland, Czechia, Israel, South Korea (Pre-funding required), Taiwan (Pre-funding required)` in market order; `Blocked:` codes; italic note (`01`) |
| `Remove` every entry | `No permission sets yet.`, section badge back to `3`, summary back to the default line |
| Tick attestation with ≥1 set | `All required sections complete.`, `Submit onboarding` enabled → `Submitted` + `Submitted for review.` |
| Clear the LEI | Entity details loses its check; submit disables |

### 5.4 Copy inventory (modal)

`New permission set` · `Edit · {name}` · `Rate every market. Use the region shortcuts to fill a block at once, then adjust individual rows.` · `Set name` · `e.g. EM derivatives` · `Desk` · `Effective` · `Filter markets…` · `All` · `Americas` · `EMEA` · `APAC` · `Unset only` · `Set all to` · `Full` · `Restricted` · `Blocked` · `Restriction note` · `No markets match.` · `Max notional / order` · `Notes` · `{n} of 54 markets set` · ` · name required` · `Cancel` · `Add to form` · `Save changes`

Market names come from `data.ts` — including `China (Connect)`, `Türkiye`,
`Czechia`.

---

## 6. Token, colour and library mapping

Look every OneDS name up in OneDS. Don't guess them. Map by **role**.

### 6.1 Roles

| Source | Role | OneDS |
|---|---|---|
| page `neutral-100` | page/canvas surface | `<fill in>` |
| white panels, `neutral-200` borders | card / dialog surface, subtle border | |
| `neutral-50` (footer, details, dashed button) | subtle/sunken surface | |
| `neutral-400` border (open accordion) | strong border | |
| `neutral-900` / `800` / `600` / `500` / `400` text | text primary / primary / secondary / muted / tertiary | |
| `neutral-900` fill (primary button, selected region, entry accent) | **primary action / selected** | |
| `neutral-900/40` backdrop | modal scrim | |
| `emerald` 50/200/800, dot 500, step badge 600 | **success** (Full, complete) | |
| `amber` 50/200/800, dot 500; unset row `amber-50/40` | **warning** (Restricted, unset row tint) | |
| `red` 50/200/700, dot 500; required `*` 500 | **danger** (Blocked, required marker, Remove hover) | |
| `sky` 50/200/800 | info (default `RadioPills` tone; unused in this modal) | |
| `Chip` / `RadioPills` tones `good warn bad info muted` | success, warning, danger, info, neutral | |

### 6.2 Type roles

| Source | Use | OneDS |
|---|---|---|
| 16px semibold | dialog title | dialog title |
| 14px semibold | accordion section title | heading small |
| 14px | market names, inputs, body | body |
| 11px semibold, wide tracking, uppercase | field labels, region legends | label (overline if OneDS has one) |
| 11–12px | hints, footer caption, chips, pills | caption / small |
| 11px mono semibold | market code, LEI | monospace / code style |
| `tabular-nums` | every count | tabular-figures setting |

### 6.3 Libraries

| Source | Replace with | Notes |
|---|---|---|
| Inline SVG icons (close ✕, chevron down, chevron right, check, plus) | OneDS icons | Keep `aria-hidden` / `aria-label` exactly as the source sets them |
| `animate-[forensic-slide-up_240ms_ease-out]` | OneDS dialog motion | Honour reduced motion |
| Tailwind classes | OneDS props/tokens | All of them |
| `style={{ … }}` (3 places: modal max-width/height, sticky `top: -16`, bar segment widths) | keep | Width/height may become the OneDS dialog size. Re-derive the sticky offset from OneDS's dialog body padding so the bar sits flush with the body top |

---

## 7. Accessibility (keep what the source does)

- Dialog: `aria-modal`, labelled by its title, described by its description;
  focus trapped; Esc closes; focus restored to the opener.
- Each market row: `role="radiogroup"` with `aria-label="Access for {name}"`
  over real radio inputs sharing `name="access-{code}"`.
- Region filters: `<button aria-pressed>`. Search: `aria-label="Filter markets"`.
- Each region: `<fieldset>` + `<legend>`.
- Restriction note: `aria-label="Restriction note for {name}"`.
- Accordion: `<h3><button aria-expanded aria-controls>`; panel `role="region"`
  `aria-labelledby` the button. Entry caret: `aria-expanded`, `aria-controls`,
  `aria-label` `Show details` / `Hide details`.
- Every field has a `<label htmlFor>`; keep the ids (`ps-name`, `ps-desk`,
  `ps-eff`, `ps-max`, `ps-notes`, `a-legal`, `a-lei`, `a-type`, `a-dom`, `a-cn`,
  `a-ce`, `a-cp`).
- WCAG 2.1 AA contrast, including tone text on tone fills in the pills and
  chips, and text on the unset-row tint.

---

## 8. When OneDS doesn't fit

1. Use the closest OneDS component or token.
2. If none exists, compose it from OneDS primitives and tokens.
3. Never fall back to Tailwind, hex/rgba values or inline SVG icons "to keep it
   working".
4. List every substitution in the PR:

| Element | What OneDS lacks | What you built instead |
|---|---|---|
| Toned segmented control (`RadioPills`) | maybe no per-option tone | OneDS radios styled with tone tokens |
| `DistributionBar` | likely no stacked bar | divs on tone tokens |
| Sticky bar inside dialog body | maybe body isn't the scroll container | (describe) |
| (add any others) | | |

**Allowed deviations (only these):** OneDS radius, elevation and shadows;
OneDS focus and hover styles; OneDS icon shapes where meaning is the same;
OneDS dialog chrome (dropping the 4px accent bar); the §10.1 width fix.
Anything else that changes how the modal looks needs sign-off. Ask first.

---

## 9. Acceptance checklist

**Per run (copy into the PR)**
- [ ] Side by side with the screenshot(s): same regions, order, columns, copy and numbers.
- [ ] Every row of the run's state matrix (§5.2 / §5.3) passes.
- [ ] Keyboard only: every control reachable; arrows move inside each market's radios; Esc closes the dialog; focus returns to the opener.
- [ ] Nothing added: no icons, columns, buttons, toasts, filters or states that aren't in `reference/`.

**Logic untouched**
- [ ] `diff reference/src/components/accordion-modal-forms/data.ts <target>/…/data.ts` is empty.
- [ ] `nextId`, `todayIso` unchanged; the §0.1 state lines are verbatim.

**Only OneDS** — run in the converted folder; every command must print nothing:
```
grep -rnE 'className="[^"]*\b(flex|grid|p[xytrbl]?-|m[xytrbl]?-|text-|bg-|border-|rounded|shadow|divide-|space-)' .
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' .
grep -rnE '\b(neutral|emerald|amber|red|sky)-[0-9]{2,3}\b' .
grep -rnE '<svg|<path' .
```
(Exceptions only where §8 logged them.)

**Quality**
- [ ] Typecheck, lint and build pass.
- [ ] WCAG 2.1 AA contrast, including toned pills, chips and the unset tint.
- [ ] PR description lists OneDS gaps and any deviation.

---

## 10. Open decisions (answer before Run 1)

1. **Known source defect — inline widths.** In the source, `inputClass`
   includes `w-full`, and the filter input (`w-48`) and restriction-note input
   (`w-44`) add a second width. `w-full` wins, so in the screenshots the filter
   box spans the whole bar and every restricted row wraps: the note input takes
   a full line and the radios drop below it (`05`). The intent is a 192px filter
   box and a 176px note input sitting inline before the radios. **Default: build
   the intended widths** and note it in the PR. Say if you want the screenshots
   matched instead.
2. **Where the modal lives** in the target, and whether the host form (Run 3)
   is wanted or the modal will be opened from an existing screen.
3. **Field label style.** Source labels are 11px uppercase with wide tracking.
   Keep (default, if OneDS has an overline style) or use OneDS's standard label?
