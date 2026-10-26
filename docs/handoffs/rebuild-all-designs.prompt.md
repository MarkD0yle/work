---
mode: agent
description: Review every prototype design and rebuild it from scratch on the target design system. Nothing is moved or copied.
---

# Rebuild all designs on the design system

## Read this first: this is a rebuild, not a migration

- **Do not move, copy, or port any file** from the source designs into the target repo.
- **Do not carry across** components, CSS, Tailwind classes, hex/rgba values, icons, chart configs, or package choices.
- The source designs are a **visual and behavioural spec only**. Read them, understand them, then **write new code** using only the target design system.
- If the design system has no equivalent for something, **do not invent a custom version silently**. Log it as a gap (see §6) and use the closest system component.

If you catch yourself pasting source code into the target repo, stop. Rewrite it.

---

## 0. Configuration (fill in before running)

| Setting | Value |
| --- | --- |
| Design system | `OneDS` <!-- change if different --> |
| Design system docs / package | `<path, npm package or Storybook URL>` |
| Source designs location | `<path to source, e.g. ./reference/src/pages>` (read-only) |
| Target location for rebuilt screens | `<e.g. src/features/prototypes/>` |
| Screens to rebuild | `ALL` <!-- or a list of slugs --> |
| Batch size | `5` screens per run |

The source is a React 19 + TypeScript + Tailwind v4 prototype gallery. About 90 pages live in `src/pages/*.tsx`, one per screen. Shared pieces are in `src/components/**`, `src/components/patterns/**`, `src/hooks/**`, and `src/lib/**`.

---

## 1. Phase 1: Review everything (no code written)

Read every source page and its local components. Produce **one file**: `REBUILD-PLAN.md`. Write no screen code in this phase.

### 1a. Learn the target first

Before reviewing the designs, read the target repo and the design system. Record:

- Package manager, framework and version, router, state approach, test setup.
- **Styling approach.** Does the system use Tailwind, CSS modules, CSS-in-JS, or its own tokens? Is Tailwind installed at all? Which version?
- Available components, layout primitives, tokens (colour, type, spacing, elevation, radius), and icon set.
- Chart and data-grid libraries already approved in the target repo.
- Lint, format and accessibility rules the target enforces.

### 1b. Inventory the source

For **each** source page, record one row:

| Field | What to capture |
| --- | --- |
| Slug / title / section | From the filename and the `title` / `section` exports |
| Purpose | One sentence: what job does this screen do? |
| Layout | Regions and their order (header, rail, filters, main, side panel, footer) |
| Components used | Every distinct UI element (table, card, chart, modal, tabs, form, etc.) |
| Patterns | Named patterns it uses (e.g. master/detail, side panel, filter bar, KPI strip) |
| States | Loading, empty, error, selected, hover, focus, disabled, dark mode |
| Behaviour | Sorting, filtering, drill-in, inline edit, keyboard shortcuts, live updates |
| Data | Where the mock data lives; whether it is pure data (safe to reuse) |
| Third-party deps | AG Grid, DevExtreme, Highcharts, framer-motion, lucide-react, etc. |

### 1c. Map the source onto the design system

Create these tables in `REBUILD-PLAN.md`:

1. **Component map.** Source element → design system component. Mark each: `exact`, `compose` (build from several), or `GAP`.
2. **Pattern map.** Source pattern → design system pattern or layout. Same marks.
3. **Token map.** Source colour/type/spacing/radius use → design system token. Source classes and hex values are **intent only**. Never copy them.
4. **Dependency map.** See §3.
5. **Duplicates.** Screens that share a pattern. Build the shared piece once, then reuse it.
6. **Gaps.** Everything marked `GAP`, with the closest system substitute proposed.

### 1d. Propose the build order

- Group screens into batches of the configured size.
- Order: shared patterns and shells first, then the simplest screens, then complex ones (multi-screen shells, dashboards, data-heavy grids).
- Flag screens that are **not worth rebuilding** (demo-only pages such as cheat sheets, resource directories, animation guides, or gallery pages) and ask for a decision.

**Stop after Phase 1. Wait for approval of `REBUILD-PLAN.md` before writing any screen.**

---

## 2. Phase 2: Rebuild (one batch per run)

For each screen in the approved batch:

1. Re-read the source page and note exactly what it shows and does.
2. Build the screen **new** in the target location, using only design system components, tokens, and approved dependencies.
3. Build shared pieces once. Compose screens from them. A screen must never restyle a shared piece locally.
4. Add a short `<slug>.rebuild.md` next to the screen using the report format in §7.
5. Run lint, typecheck, and tests. Fix everything before moving to the next screen.

### Fidelity rules

Keep these the same as the source:

- Layout structure and region order.
- Content, labels, copy, units, and number formats.
- Mock data values and fixtures. Pure data and pure logic files **may be recreated verbatim**, as long as they hold no styling.
- Behaviour, states, interactions, and keyboard support.
- Information hierarchy and density.

Change these to match the design system:

- All colour, typography, spacing, borders, radius, shadows, and elevation.
- Icons (use the system's icon set).
- Controls (use the system's inputs, buttons, tabs, menus, dialogs).
- Motion (use the system's tokens; honour `prefers-reduced-motion`).

Do **not**:

- Redesign, simplify, merge, or "improve" a screen.
- Add features that are not in the source.
- Drop features because they are hard. Log them as gaps.
- Hardcode any colour, font size, or spacing value. If no token exists, use the nearest semantic token and log a gap.
- Keep the source's `--radius: 0` rule unless the design system says the same. The system decides radius.

---

## 3. Dependencies and Tailwind: assume they differ

The source stack may not match the target. Handle each case like this.

### Tailwind

| Target situation | What to do |
| --- | --- |
| Tailwind installed, same major version, system provides a preset | Use utilities **only** for layout (flex, grid, gap, sizing). Take colour, type, and spacing from the system's theme tokens. |
| Tailwind installed, different major version | Check the syntax of the target version. Do not assume v4 features (`@theme`, `@import "tailwindcss"`). |
| Tailwind **not** installed | **Do not add it.** Use the design system's layout primitives and styling method. |
| System uses its own CSS/tokens | Follow the system. No Tailwind classes at all. |

Never copy a Tailwind class string from the source. Decide each style from the design system.

### Other packages

For every third-party dependency in the source, decide one of:

- **Use the design system's equivalent** (preferred). Examples: system data table instead of AG Grid or DevExtreme; system icons instead of `lucide-react`; system motion instead of `framer-motion`.
- **Use the target repo's approved library.** Examples: its chart library instead of Highcharts, if one exists.
- **Add a new dependency** only if nothing else works. Ask first, and list it in the PR with a reason.

If you need to swap a library, keep the **same data and behaviour**. Only the rendering changes.

Also check and adapt:

- React version and any APIs that differ.
- TypeScript strictness settings.
- Router or navigation. The source has none (pages are auto-discovered). Use the target's routing.
- State and storage. The source uses `localStorage` hooks. Use the target's approach.
- Path aliases, file naming, and folder conventions.

---

## 4. Non-negotiables (check before opening a PR)

1. **No source code copied** except pure data/logic files with no styling.
2. **No hardcoded colour, font size, spacing, or radius.** Tokens only.
3. **No custom components that duplicate a system component.**
4. **One shared build for each repeated pattern.**
5. **Accessibility.** Semantic landmarks, labelled controls, visible focus, full keyboard access, WCAG 2.1 AA contrast, and no colour-only meaning.
6. **Tabular figures** for any number that changes or is compared.
7. **Live or changing data stays stable.** Row counts fixed, values update in place, motion stops under reduced-motion.
8. **All states present.** Loading, empty, and error states exist where the source has them or implies them.
9. **Lint, typecheck, tests, and build all pass.**

---

## 5. Verification per screen

Before marking a screen done:

- Open the source and the rebuild side by side. Check layout, copy, data, and behaviour.
- Check every state listed in the Phase 1 inventory.
- Check keyboard-only use and a screen-reader pass of the landmarks.
- Check narrow and wide widths.
- Check dark mode if the system supports it.
- Confirm there are zero hardcoded style values (search for `#`, `rgb(`, `rgba(`, `px` literals in styles).

---

## 6. Gaps register

Keep one running list, `GAPS.md`:

| Screen | Source element | What the system lacks | Closest substitute used | Proposed action |
| --- | --- | --- | --- | --- |

Every substitute must appear here. Nothing is substituted silently.

---

## 7. Per-screen report format (`<slug>.rebuild.md`)

```
# <Screen title>
Source: <path>        Rebuilt: <path>

## Mapped
- <source element> → <system component>

## Substituted (also in GAPS.md)
- <source element> → <substitute>, because <reason>

## Dependencies
- Removed: <list>   Added: <list>   Swapped: <list>

## Behaviour check
- [x] States   [x] Keyboard   [x] Data matches   [x] Tokens only

## Open questions
- <anything a person must decide>
```

---

## 8. Definition of done (whole project)

- Every approved screen is rebuilt, with a rebuild report.
- `GAPS.md` is complete and reviewed.
- No source files, styles, or class strings exist in the target repo.
- Lint, typecheck, tests, and build pass.
- A summary lists screens done, screens skipped (and why), new dependencies, and open gaps.

## Working rules

- Work in batches. Never try to rebuild all screens in one run.
- If the source and the design system conflict, **the design system wins on visuals; the source wins on content and behaviour.** Raise real conflicts in the PR description.
- Ask when unsure. Do not guess and move on.
