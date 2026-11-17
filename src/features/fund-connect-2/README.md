# Fund Connect 2

Primary-market ETF register with the creation flow (upload → validate →
review → approve → activate) hanging off it.

This folder is self-contained: the only import that leaves it is `react`.
To move it into another app, copy the folder and route to the default export.

## Requirements

- React 18+
- Tailwind CSS v4 (every component is styled with utility classes; the app
  must scan this folder for class names)

## Using it

```tsx
import FundConnect2Page from "./features/fund-connect-2";

<FundConnect2Page />;
```

`index.ts` also exports `title`, `section` and `fullWidth` — page metadata
for the host shell. Ignore them if your app routes differently.

The page fills its parent (`h-full`), so give it a sized container.

## Layout

```
fund-connect-2/
  index.ts              public entry point
  FundConnect2Page.tsx  the page: register grid, details view, editor
  ete/                  ETE Fund Configuration workspace (see below)
  fund-connect-2.css    scoped dark mode (.fc2-dark), imported by the page
  components/           feature UI — grid panels, wizard, tables, details
    form/               form building blocks — field row, section card, rail
  ui/                   generic UI (Modal, ConfirmDialog)
  lib/                  pure logic, no React — engine, schema, seed, importer
    core/               base form schema, validation, reference masters
```

Rules that keep it portable:

- `lib/` never imports React; components never hold business rules.
- Nothing imports from outside this folder. `lib/core` and
  `components/form` started as a copy of the Fund Connect base and are now
  owned here — change them freely, Fund Connect is unaffected.
- `ui/` is the swap point for a host design system: replace `Modal.tsx`
  with a wrapper around the host's dialog and nothing else changes.

## ETE Fund Configuration (`ete/`)

A second workspace on the same page, reached from the Register / ETE Fund
Configuration switch in the header (or directly with
`<FundConnect2Page initialArea="configuration" />`). It shares the header,
the acting user and the dark mode, and keeps its own model and mock data.

It is organised around the real hierarchy, with Order Types first:

```
ETE Fund
└─ Order Type
   └─ Settlement Period (T+0 … T+5)
```

```
ete/
  EteWorkspace.tsx    entry: fund list, overview, tabs
  EteProvider.tsx     state and workflow rules (draft → awaiting → active)
  ete-context.ts      useEte hook
  model.ts            types, reference lists, Fund Details field definitions
  engine.ts           validation and pending-vs-active comparison, no React
  mock-data.ts        seven mock funds, one per workflow state
  OrderTypes.tsx      Order Type list and the docked editor with periods
  FundDetailsTab.tsx  collapsible fund-level sections
  DistributionTab.tsx countries, institutions, co-brand
  ReviewTab.tsx       errors, warnings, modified fields, Order Type changes
  FundOverview.tsx    always-visible summary, workflow steps and actions
  ui.tsx, styles.ts   small controls and class strings
```

Rules it demonstrates:

- Every edit goes straight into the fund's draft, so opening an Order Type
  from another tab never discards work.
- Whoever submits a change cannot approve it, whatever their role.
- Changing an active fund creates a separate pending version. The active
  version stays in use, unchanged, until the pending one is approved.
