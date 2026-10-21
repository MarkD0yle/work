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
