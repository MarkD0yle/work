---
mode: agent
description: Build the App Map viewer (overview page, zoomable map, details panel, flows, tour, health) in OneDS, with no AI features, one run at a time.
---

# App Map viewer → OneDS

You are building a read-only map viewer from a spec. The spec is `README.md`
in this folder. Read **all** of it before you write code. When this prompt and
the spec disagree, the spec wins.

**There is no AI in this app.** Do not add a chat box, an "ask" input, prompt
text, or a call to any AI or LLM API. README §3 lists what is removed.

**Setup (once):** copy this whole `app-map-oneds/` folder into the target repo
(for example `copilot/handoffs/app-map-oneds/`). Answer the four open
decisions in README §10 at the top of your first PR.

Run **one** of the prompts below per session, in order. Do not start the next
run until the previous PR is merged.

---

## Run 1: data and model

> Follow `README.md` §4, §5.1 to §5.4, §5.9 (scoring only), §5.10 (framing
> only), §5.12 (roll-ups only) and §5.17 (hash only). Write TypeScript types
> for `graph.json` exactly as §4 describes, plus a loader that validates it
> and reports the first problem in plain words. Build the in-memory model
> and these pure functions: `chain`, `visibleKids`, folder chips, `buildView`
> (with `project` and edge merging, and the file-view rules), `searchIndex`
> and `search`, `lowestCommonContainer`, `recentTags`, `parseHash` and
> `formatHash`. No UI. Write unit tests against both files in
> `reference/data/`, including the expected results in §8 rows 1, 3, 6, 11
> and 12. Finish with typecheck, lint and tests.

## Run 2: the board

> Follow §5.5 to §5.7 and §7.1 to §7.3. Build the header (search box, with
> the buttons present but inert until later runs), breadcrumbs, the view
> title and description, and the canvas: cards and lines laid out with
> elkjs layered left to right, the Used by / Inside / Uses columns with
> brackets, pan, zoom, fit and the three detail levels. Make the overview
> page match `screenshots/01-overview.png` in layout. Double-click to go
> in, and Backspace or breadcrumbs to go up. Compare against `01`, `03`
> and `05`, and run §8 rows 1 and 3.

## Run 3: details panel and search

> Follow §5.8, §5.9 and §5.16. Build selection with dimming, the resizable
> panel for every item type (Codebase, part, folder, file, endpoint, line),
> the search dialog, hover tips and the right-click menus without any Ask
> items. Compare against `02`, `03`, `04` and `06`. Run §8 rows 2, 4 and 6.

## Run 4: guided features

> Follow §5.10 to §5.15. Build Flows (menu, flow bar, animated step), the
> Start here tour, Recent work (tags, roll-ups, board), Health (empty and
> with issues, Show on map, Not a problem) without any Fix button, Screens,
> and Filters. Use `fixture.graph.json` for Health, Screens and folder chips.
> Compare against `07` to `13`. Run §8 rows 7 to 15.

## Run 5: export, URLs and phone

> Follow §5.17 to §5.20 and §7.7. Wire the hash to the board, with Back and
> Forward working and `tour=0` handling. Add settings memory with try/catch,
> keyboard support, the Export dialog and single-file download, and the
> phone/tablet layout with a bottom sheet. Compare against `14`. Run §8
> rows 5 and 16 to 20, then the whole §9 checklist.

---

## Rules for every run

- `graph.json` is fixed. Never change the sample files or rename their fields.
- Build what §5 says, in the words §6 gives. Never add features §5 doesn't list.
- OneDS decides how it looks. If OneDS has no match, compose one from OneDS
  parts and log it in the PR. Never fall back to hex/rgba colours or
  hand-picked font sizes.
- No network requests at runtime. No AI.
- If you are unsure, ask. Do not guess and move on.
