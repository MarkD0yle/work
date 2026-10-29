---
mode: agent
description: Bring every prototype screen into the target repo as is, then convert it in place until it uses only OneDS. Same screens, same content and behaviour, built entirely from OneDS.
---

# Convert all designs to OneDS, as is

## The one rule: same screen, only OneDS

The end result is every screen built **only** from OneDS: OneDS components, layout primitives, tokens, icons and approved OneDS-compatible libraries. Nothing from the source's styling or UI libraries is left.

To keep each screen exactly as it is, you **start from the source code** and convert it in place:

1. **Copy** the source page and the code it uses into the target. This keeps the structure, regions, copy, data, logic and behaviour exactly the same.
2. **Convert** every visual element in that copied code to its OneDS equivalent, one element at a time.
3. **Finish** only when no source styling, Tailwind classes, raw colours or non-OneDS UI libraries remain (§5).

The copy is a scaffold. It is not the result. A screen that still has a Tailwind class, a hex value, an AG Grid import or a lucide icon is **not done**.

### What stays exactly the same

- Every screen, region, panel, tab, column, card and control. Same order, same nesting.
- All copy, labels, units, number formats and mock data values.
- All behaviour: sorting, filtering, selection, drill-in, inline edit, keyboard shortcuts, live updates and every state (loading, empty, error, hover, focus, selected, disabled).
- Information density and hierarchy. A dense blotter stays dense. Use OneDS's compact or dense variants where they exist.

### What OneDS decides

- All colour, typography, spacing, radius, borders, shadows and elevation.
- All controls: buttons, inputs, selects, tabs, menus, dialogs, drawers, tooltips, toasts and tables.
- Icons and motion.
- The source's `--radius: 0` rule does **not** carry over. OneDS decides radius.

### Do not

- Redesign, simplify, merge, split or "improve" a screen.
- Drop a feature because OneDS makes it hard. Compose it from OneDS primitives, and log it (§4).
- Add features that are not in the source.
- Leave a screen half-converted and move on.

---

## 0. Configuration (fill in before running)

| Setting | Value |
| --- | --- |
| Design system | `OneDS` |
| OneDS docs / package | `<path, npm package or Storybook URL>` |
| Source repo location | `<path to source, e.g. ./reference>` (read-only) |
| Target location for screens | `<e.g. src/features/prototypes/>` |
| Screens to convert | `ALL` <!-- or a list of slugs --> |
| Batch size | `5` screens per run |

The source is a React 19 + TypeScript 6 + Vite 8 + Tailwind v4 prototype gallery.

- Pages: about 100 files in `src/pages/*.tsx`, one per screen, each exporting `title` and `section`. `src/App.tsx` finds them with `import.meta.glob`.
- Shared code: `src/components/**`, `src/components/patterns/**`, `src/hooks/**`, `src/lib/**`.
- Styling: Tailwind v4 utility classes everywhere, plus tokens in `src/index.css`.
- UI libraries to replace: `ag-grid-*`, `devextreme*`, `highcharts`, `framer-motion`, `lucide-react`, `clsx` (only if OneDS has its own class helper).

`copilot/handoffs/right-panels-oneds/README.md` in the source repo is a worked example of the same conversion for 11 panels. Read it first and follow its mappings.

---

## 1. Phase 1: Map the source onto OneDS (no screens yet)

Produce one file, `ONEDS-PLAN.md`. Do not convert any screen in this phase.

### 1a. Learn OneDS and the target

Record:

- The target's package manager, React version, TypeScript settings, router, lint rules and path aliases.
- How OneDS is styled (its own CSS, tokens, CSS-in-JS, or a Tailwind preset), and whether Tailwind is allowed in the target at all.
- The OneDS components, layout primitives, tokens, text styles, icon set and data table.
- The chart and grid libraries the target allows alongside OneDS.

### 1b. Build the conversion maps

These maps are the rules every screen follows. Build them once from the whole source, so that every screen converts the same way.

1. **Token map.** Every colour, text size and weight, spacing step, radius, border and shadow used in the source, mapped to its OneDS token. Map by **role** (surface, muted text, border, positive, negative, warning, accent), not by literal value.
2. **Component map.** Every source component and pattern in `src/components/**`, mapped to a OneDS component. Mark each `exact`, `compose` (built from several OneDS parts), or `GAP`.
3. **Library map.**

   | Source | Replace with |
   | --- | --- |
   | `ag-grid-*`, `devextreme` grids | OneDS data table, or the OneDS-approved grid |
   | `highcharts` | OneDS charts, or the target's approved chart library themed with OneDS tokens |
   | `lucide-react` | OneDS icon set |
   | `framer-motion` | OneDS motion tokens and transitions |
   | `devextreme` editors, pickers, popups | OneDS inputs, date pickers, dialogs |

   Keep the same data and behaviour when you swap a library. Only the rendering changes.
4. **Gaps.** Everything marked `GAP`, with the OneDS primitives you will compose it from.

### 1c. Plan the order

- Convert the shared code first: the patterns and components used by many screens. Every screen then reuses one OneDS version of each.
- Then the simplest screens, then the complex ones (multi-screen shells, dashboards, data-heavy grids).
- List any demo-only pages (cheat sheets, resource directories, animation guides, gallery pages) and ask whether to convert them.

**Stop after Phase 1. Wait for approval of `ONEDS-PLAN.md` before converting screens.**

---

## 2. Phase 2: Convert the shared code

For each shared component or pattern in the approved order:

1. Copy it into the target.
2. Replace its markup and styling with the OneDS components and tokens from the maps. Keep its props, data and behaviour the same, so the screens that use it do not need to change.
3. Remove every Tailwind class, raw colour and non-OneDS import from it.
4. Run typecheck, lint and tests.

Pure data and pure logic files (`src/lib/**` mock data, formatters, calculations, and hooks with no styling) may be copied unchanged.

---

## 3. Phase 3: Convert the screens (one batch per run)

For each screen in the batch:

1. **Copy** `src/pages/<slug>.tsx` into the target. Point its imports at the converted shared code.
2. **Register** it in the target's router. Use the page's `title` and `section` exports for the route and nav entry.
3. **Convert** the page top to bottom, using the maps:
   - Layout wrappers → OneDS layout primitives (stack, grid, page, panel, toolbar).
   - Every element → its mapped OneDS component.
   - Every class string → OneDS props and tokens. Delete the class string.
   - Every icon, chart, grid and animation → its OneDS replacement.
4. **Replace `localStorage` hooks** with the target's state approach, if it has one. Keep the same keys and behaviour.
5. **Check** the screen against §5. Do not move on until it passes.
6. **Write** `<slug>.oneds.md` using the format in §6.

If OneDS has no equivalent for an element:

1. Use the closest OneDS component.
2. If there is none, compose it from OneDS primitives and tokens.
3. Never fall back to the source's Tailwind classes or library to "keep it working".
4. Log it in `GAPS.md` (§4).

---

## 4. Gaps register

Keep one running list, `GAPS.md`:

| Screen | Source element | What OneDS lacks | What was built instead (from OneDS parts) | Proposed action |
| --- | --- | --- | --- | --- |

Every composed or substituted element is listed. Nothing is substituted silently.

---

## 5. Done check per screen

A screen is done only when **all** of these pass.

**It is the same screen**

- [ ] Source and OneDS version side by side: same regions, order, content, copy, data and number formats.
- [ ] Every interaction and state from the source works.
- [ ] Keyboard-only use works. Landmarks, labels and focus are correct. WCAG 2.1 AA contrast.
- [ ] It works at narrow and wide widths, and in dark mode if OneDS supports it.

**It is only OneDS.** Search the screen and every file it imports:

- [ ] No Tailwind classes. No `className` strings with utilities such as `flex`, `px-`, `text-`, `bg-`, `border-`, `rounded`.
- [ ] No raw colours: `#`, `rgb(`, `rgba(`, `hsl(`, or Tailwind palette names such as `slate-`, `emerald-`, `rose-`.
- [ ] No hardcoded sizes in styles: `px`, `rem` or `em` literals for spacing, font size or radius.
- [ ] No imports from `ag-grid-*`, `devextreme*`, `highcharts`, `framer-motion` or `lucide-react`, unless the plan approved one as OneDS-compatible.
- [ ] No imports of unconverted source components.
- [ ] Typecheck, lint, tests and build pass.

---

## 6. Per-screen report format (`<slug>.oneds.md`)

```
# <Screen title>
Source: <path>        OneDS version: <path>

## Converted
- <source element> → <OneDS component>

## Composed from OneDS parts (also in GAPS.md)
- <source element> → <OneDS parts used>, because <reason>

## Libraries
- Removed: <list>   Replaced with: <list>

## Done check
- [x] Same screen   [x] Interactions and states   [x] Only OneDS   [x] Build passes

## Open questions
- <anything a person must decide>
```

---

## 7. Definition of done (whole project)

- Every approved screen is converted, with a report.
- No Tailwind, source CSS, raw colours or source UI libraries remain anywhere in the converted code.
- The source dependencies listed in §0 are not in the target's `package.json`, unless the plan approved them.
- `GAPS.md` is complete and reviewed.
- Typecheck, lint, tests and build pass.
- A summary lists screens converted, screens skipped (and why), and open gaps.

## Working rules

- Work in batches. Never try to convert every screen in one run.
- **The source wins on content, structure and behaviour. OneDS wins on everything visual.**
- If keeping the source behaviour means leaving OneDS, stop and ask.
- Ask when unsure. Do not guess and move on.
