# Handoff: App Map viewer → build in OneDS

> **The one rule: build the map, not the assistant.**
>
> This app shows a codebase as an interactive map: an overview page that says
> what the app is, cards for its parts, files and endpoints, the lines between
> them, and a details panel. It is modelled on the open-source
> [Floorplan](https://github.com/haydenschmitty/floorplan) viewer (MIT).
>
> **Every AI feature is out of scope.** No Ask bar, no answers, no "Fix with…",
> "Build this" or "Request a new flow" prompts, no model calls of any kind
> (§3 lists them all). The map only reads a JSON file and draws it.
>
> If you catch yourself adding a chat box, a "suggest" button, or a call to any
> AI or LLM API, **stop**. That is the feature this spec removes.

---

## 0. How to use this folder

```
app-map-oneds/
  README.md                  ← this spec. Read all of it before writing code.
  app-map-oneds.prompt.md    ← paste-ready Copilot prompts, one per run
  screenshots/               ← the reference viewer, drawn from harbor.graph.json
  reference/data/
    harbor.graph.json        ← a real map: 12 parts, 142 files, 337 links, 1 flow, a tour, recent work
    fixture.graph.json       ← a small hand-made map that covers what Harbor doesn't:
                               endpoints, screens, health issues, folder chips, a pinned note
```

The screenshots show the reference viewer with its Ask bar hidden. Ignore
anything in them that §3 marks as out of scope, such as **Request a new flow…**
in `07-flows-menu.png`.

### 0.1 Two kinds of thing. Treat them differently.

| Kind | What | What you do |
|---|---|---|
| **Data contract: fixed** | The `graph.json` format in §4 and the two sample files | Read it exactly as specified. **Do not rename, reshape or "normalise" fields** in the files. If you want a friendlier shape, build it in memory at load time (§5.1). |
| **Behaviour: build from this spec** | Views, connections, selection, search, flows, tour, recent work, health, screens, filters, export, URLs, keyboard | Build exactly what §5 describes. §5 gives the rules as pseudo-code where the details matter. Follow it, don't redesign it. |
| **Look: OneDS** | Colour, type, spacing, radius, borders, shadows, icons, motion, control styling | OneDS decides. The screenshots decide layout, grouping, hierarchy and density only. |

### 0.2 Order of work (one run each; see the prompt file)

1. **Run 1: data and model.** Load and validate `graph.json`, build the in-memory model (§5.1) and every pure function in §5 (views, link projection, search, flow framing, recent roll-ups, URL parse and format). Unit tests only, no UI.
2. **Run 2: the board.** Header, breadcrumbs, view title, canvas with cards and lines, layout, pan/zoom, zoom detail levels and outside columns. Overview page first.
3. **Run 3: details panel and search.** Selection, the panel for every item type, the search palette, hover tips and right-click menus.
4. **Run 4: guided features.** Flows, the Start here tour, Recent work, Health, Screens and Filters.
5. **Run 5: export, URLs, phone.** Single-file export, deep links, settings memory and the phone/tablet layout.

Never build more than one run's scope in a run.

### 0.3 Precedence

- §4 decides the data. §5 decides behaviour. §6 decides the words people see.
- `screenshots/` decides layout, grouping, hierarchy and density.
- OneDS decides everything visual.
- When this spec and a screenshot disagree, this spec wins.

### 0.4 Target stack

React 19 and TypeScript in the target repo, with OneDS components and tokens.
For layout, use **elkjs** (`layered` algorithm, left to right). It is the same
engine the reference uses, so the screenshots are reproducible. Draw cards as
HTML (absolutely positioned in a transformed layer) and lines as one SVG
underneath. No other libraries without asking.

---

## 1. What the app is

**App Map** turns a codebase into a map that someone who has never read the
code can understand. It opens on an **overview page**: the app's name, a
two-or-three-sentence summary of what it is, and a board of its main parts
("Desktop shell", "Message broker", "Stripe") joined by lines that show what
uses what. A **details panel** on the right describes the app as a whole:
how big it is, what changed recently, and its parts grouped as *Apps people
use*, *Behind the scenes*, *Outside services* and *Developer tools*.

From there people go **down**: double-click a part to see what's inside it
(smaller parts, then folders, then files, then a file's endpoints). Every view
has the same shape. On the left is **Used by**, the outside things that use this
part. In the middle is **Inside ‹name›**, what it's made of. On the right is
**Uses**, the outside things it relies on. Every card has a plain-English name and one
line on what it does, with the real path in small type.

Around that core:

- **Search** finds any part, file or endpoint by name, path or description.
- **Flows** walk through one of the app's main jobs step by step.
- **Start here** is a one-minute tour for first-time visitors.
- **Recent work** highlights what was just changed, and why.
- **Health** lists problems found in the code (keys left in files, endpoints
  anyone can use, oversized or unused files), each with **Show on map**.
- **Screens** starts from a page of the app people recognise and shows
  everything behind it.
- **Export** saves the whole map as one HTML file to send to anyone.

Who it's for: owners and new joiners first, developers second. Words are plain
by default. **Show technical detail** switches to developer terms.

---

## 2. Non-negotiables (check before opening every PR)

1. **No AI.** No model calls, no prompts, no chat UI, no "ask about this". §3 lists every removed feature.
2. **Read-only.** The app never changes `graph.json` or any code. The only things it writes are local settings (§5.17) and the exported file.
3. **Works offline from one file.** The production build and every export are self-contained: no network requests, fonts and layout engine included.
4. **Plain words by default.** Use the labels in §6 exactly. Technical labels appear only when **Show technical detail** is on.
5. **Never colour alone.** Kinds, severities, HTTP methods and recent-work tags all carry an icon or a text label as well as a colour.
6. **Keyboard complete.** Everything in §5.18 works without a mouse, and focus is always visible.
7. **Settings survive a blocked browser.** Every `localStorage` read and write is wrapped in `try/catch`. If storage is blocked, settings last for the page's lifetime and the map still works (§5.17).
8. **No hardcoded colour, size or font.** Everything comes from OneDS tokens.

---

## 3. Out of scope (do not build these)

| Feature in the reference | Why it's out | What to do instead |
|---|---|---|
| Ask bar, answer boards, follow-up chips, engine label ("Claude Code", "Codex") | AI | Nothing. No input at the bottom of the board. |
| Right-click **Ask about this** / **Ask about this connection** / **Ask about this view** | AI | Leave those items out of the menus (§5.16). |
| Health **Fix with Claude / Codex** button and its prompt text (`fix` field) | AI | Show the issue, its detail, locations and **Show on map** only. Ignore `fix` if a file has one. |
| Flows → **Request a new flow…**, flows marked "yours", deleting flows | AI | Flows come only from `graph.json`. |
| Blueprint mode: **Review**, **Resolve on the map**, **Build this with…**, the Ask/Change switch | AI and planning | Not supported. If a file has `meta.blueprint`, show the map normally and ignore the plan fields. |
| Report a false positive by GitHub issue | Sends data out | **Not a problem** stays (local only), but without the "tell the developer" box. |
| Floorplan Cloud waitlist card | Marketing | Nothing. |
| `CLAUDE.local.md`, `query.mjs`, the local server, auto-reload | Agent tooling | The app loads a file (§5.2). |
| Scanning code to produce `graph.json` | Separate tool | Out of scope here. See §10.1. |

---

## 4. The data contract: `graph.json`

One JSON object. Every id used by the viewer is a **ref string** with a prefix:

| Prefix | Means | Example |
|---|---|---|
| `n:` | a part (node) | `n:broker.agent` |
| `f:` | a file | `f:packages/agent/src/agent.ts` |
| `r:` | an endpoint, by its index in `routes` | `r:0` |
| `d:` | a folder chip (made by the viewer, §5.3) | `d:api.reports\|api/src/reports/daily` |
| `m:` | a file shown as a card *inside its own view* (made by the viewer) | `m:api/src/routes/orders.ts` |
| `s:` | an exported function or class (technical detail only) | `s:api/src/routes/orders.ts#0` |
| `x:in:` / `x:out:` | an outside pill in the Used by / Uses column (made by the viewer) | `x:out:n:stripe` |

### 4.1 Top level

| Field | Type | Meaning |
|---|---|---|
| `schema` | string | `"floorplan/graph@1"`. Reject anything else with a clear message. |
| `meta` | object | `rootName`, `generatedAt` (ISO), `audience` (`"everyone"` \| `"developers"`), `repos[]` (`path`, `name`, `branch`), `counts` (`files`, `loc`, `unassigned`). Ignore unknown fields. |
| `project` | object | `name`, `summary` (1–3 sentences, the overview description), `entrypoints[]` (file paths). |
| `nodes[]` | array | Parts. §4.2. |
| `files[]` | array | Files. §4.3. |
| `routes[]` | array | Endpoints. §4.4. May be empty. |
| `links[]` | array | Connections. §4.5. |
| `flows[]` | array | Guided walkthroughs. §4.6. May be empty. |
| `tour[]` | array | Start here stops. §4.6. May be empty. |
| `recent` | object | Recent work. §4.7. May be absent. |
| `health` | object | `summary` (`high`, `medium`, `low` counts) and `issues[]`. §4.8. |
| `screens[]` | array | Detected pages. §4.9. May be empty. |

### 4.2 `nodes[]`

| Field | Meaning |
|---|---|
| `id` | Unique. Referenced as `n:<id>`. |
| `parent` | Parent node id, or `null` for top level. |
| `label` | Card title. |
| `kind` | `ui` `service` `worker` `library` `feature` `data` `config` `test` `script` `infra` `external`. Decides icon, colour and panel group. `external` nodes have no files and draw as outside services. |
| `summary` | One line under the title. |
| `details` | Optional longer text for the panel. Blank lines separate paragraphs. |
| `tags[]` | Shown as chips in the panel. |
| `paths[]`, `packages[]`, `hosts[]` | Shown in the panel's path box. The first path is shown, then `+N` for the rest. External nodes show their first host or package. |
| `stats` | `files`, `loc`, `langs` (language → lines), `repos[]`. |

### 4.3 `files[]`

| Field | Meaning |
|---|---|
| `p` | Path. Referenced as `f:<p>`. |
| `n` | Owning node id. |
| `r` | Repo path. |
| `l` | Language. |
| `loc` | Lines. |
| `name`, `d` | Plain name and one-line description. If `d` is empty, the card says **No description yet**. |
| `s[]` | Optional exports: `[name, kind, line, isDefault (0/1), doc]`. Shown only with technical detail. |
| `note`, `tags[]` | Optional pinned note (amber dot on the card, amber box in the panel). |

### 4.4 `routes[]`

`{ f, m, p, l, h, name, d }`: file, HTTP method, URL path, line, handler export
name (or `null`), plain name and description. Optional `access` / `who`
describe who may call it; show them as a line in the panel when present.

### 4.5 `links[]`

`{ a, b, k, w, names?, labels?, desc?, calls? }`

- `a` uses `b`. Both are `n:` or `f:` refs.
- `k` is the connection kind: `import` `http` `call` `rpc` `event` `queue` `data` `config`.
- `w` is the weight (how many uses).
- `names[]` are the imported names (show on hover with technical detail).
- `labels[]` and `desc` are human labels for hand-added links.
- `calls[]` is `[routeIndex, line]` pairs for `http` links that hit a specific endpoint.

### 4.6 `flows[]` and `tour[]`

- Flow: `{ id, title, description, steps: [{ ref, note }] }`, with at least two steps.
- Tour stop: `{ ref, title, note }`.

### 4.7 `recent`

`{ updatedAt, tasks: [{ title, request, summary }], items: [{ id, task, change, note }] }`.
`items[].id` is a ref, `task` indexes `tasks`, and `change` is `"new"` or `"changed"`.
Drop items whose ref isn't on the map.

### 4.8 `health.issues[]`

`{ id, kind, severity, title, detail, items[], notes{}, locations[] }`.
`severity` is `high` \| `medium` \| `low`. `items` are refs to highlight,
`notes` maps a ref to a short note shown on that card during **Show on map**,
and `locations` are `{ file, line }`. Never display anything that looks like a
secret value. The data never contains one, so don't invent one.

### 4.9 `screens[]`

`{ id, url, file, app, fw, name, description, behind: [{ id, note, kind }] }`.
`behind[].kind` is `screen` \| `part` \| `request` \| `server` \| `data` \| `outside`, already in display order.

---

## 5. Behaviour

### 5.1 The model (Run 1)

Build once at load:

```
parentOf: Map<ref, ref|'root'>      kids: Map<ref, ref[]>
for node in nodes: addChild(node.parent ? 'n:'+node.parent : 'root', 'n:'+node.id)
group files by owning node (§5.3 decides whether each file is a direct child or sits in a folder chip)
for each file: its routes become children 'r:<i>' of 'f:<p>',
               then its exports that aren't route handlers become 's:<p>#<i>'
chain(ref) = [ref, parent, grandparent, …, 'root']           (memoised)
```

`visibleKids(ref)` is `kids(ref)` minus `s:` items unless technical detail is on.
An item is **drillable** when it is `n:`, `d:` or `f:` and has visible kids.

### 5.2 Loading a map

- **Dev/test:** pick one of the two sample files from a small chooser.
- **Production:** the build embeds a `graph.json` (an inline `<script type="application/json" id="graph">`). If that tag is missing, show **Open a map file**, which takes a `.json` file or a dropped file.
- On a bad file, show what's wrong (missing field or wrong `schema`) and the open button again. Never show a blank board.

### 5.3 Folder chips

If a node owns **more than 24 files**, group them:

```
common = longest shared directory prefix of the node's files
for each file: key = common + next path segment after common (or '' if the file sits in common itself)
a key with ≥2 files becomes folder chip 'd:<nodeId>|<key>', and its files become its children
files with key '' or alone in their key stay direct children of the node
```

A folder chip's card shows the folder path as its title. Its description lists
the names of its four biggest files by lines, then `, …` if there are more.

### 5.4 Building a view (the core rule)

A view is a container: `'root'`, `n:`, `d:` or `f:`. Inputs: the container, the
enabled link kinds (§5.15) and the technical-detail switch.

```
visible = visibleKids(container)
if container is a file: put 'm:<path>' first (the file itself as a card)
ctx = { vis: Set(visible), cchain: Set(chain(container)) }

project(ref):                         // where does this end of a link land in this view?
  for x in chain(ref):
    if x in ctx.vis:          return { item: x }     // inside the view: that card
    if x == container:        return null            // inside, but hidden (shouldn't happen)
  if ref in ctx.cchain:       return null            // it's the container or one of its parents
  i = index in chain(ref) of the first element that is in ctx.cchain
  return { outside: chain(ref)[i-1] }                 // the outside thing, at the highest level
                                                      // below the shared ancestor

for link in links where link.k is enabled:
  pa = project(link.a); pb = project(link.b)
  both items, different        → edge pa.item → pb.item
  item → outside               → edge pa.item → pill 'x:out:'+pb.outside   (goes in the Uses column)
  outside → item               → edge pill 'x:in:'+pa.outside → pb.item    (goes in the Used by column)
  anything else                → skip
edges are merged by (from, to, kind): weight = sum of w, keep the list of source links
```

**Inside a file view**, only links touching that file count:

- An incoming link with `calls` lands on the endpoint card `r:<i>` it names, or on the file card if that endpoint isn't shown.
- An incoming import with `names` lands on the matching export card (technical detail only), otherwise on the file card.
- An outgoing link with `calls` leaves from the export whose line most closely precedes each call line, otherwise from the file card.
- If the file view has more than 22 cards, keep only cards with at least one edge, plus the file card. Show "N more hidden" under the title.

### 5.5 Layout and drawing

- Three columns: **Used by** (`x:in:` pills), **Inside ‹container name›** (the cards, laid out by ELK layered, left to right), and **Uses** (`x:out:` pills). Each column has a thin bracket and label above it (`03-inside-part.png`). On the overview there are no pills, so the brackets are hidden.
- Card sizes (width × minimum height): part 300×128, folder 272×110, file 284×110, file-as-card 284×110, endpoint 300×128, export 260×100. Add 30 for a footer and 10 for a title that wraps.
- Lines are rounded orthogonal paths. Stroke colour comes from the link kind. Line width grows with weight on a capped scale.
- A card shows: kind icon and title, a 2–3 line description, then a footer. On the left of the footer is a count: `N modules` if it has child parts, otherwise `N files`, `N endpoints` for a file with endpoints, or `this file` for the file-as-card. On the right is the recent-work tag (§5.12).
- Endpoint cards show a method badge (`POST`) and the URL above the name. Method colours come from OneDS roles, with the text badge always shown.
- External nodes and outside pills are pill-shaped and smaller.
- A pinned note adds an amber dot after the title.

### 5.6 Pan, zoom and detail levels

- Drag the background to pan. Scroll or **+**/**−** to zoom. **F** or the frame button fits everything.
- Detail by zoom factor `k`:
  - `k ≥ 0.65`: full cards.
  - `0.42 ≤ k < 0.65`: descriptions clamp to one line.
  - `k < 0.42`: descriptions, counts and notes hidden. Titles grow to 22px and may wrap, so the map stays readable from far away.
- On entering a view, fit it to the free area (the canvas minus the panel and any open bar).

### 5.7 Navigation

- **Into:** double-click a drillable card, or select it and press **Enter**. Double-clicking an outside pill jumps to that thing's view and selects it.
- **Up:** **Backspace**, the back arrow, or a breadcrumb. Breadcrumbs run `‹Project› / Overview / … / current`, truncating middle labels on narrow screens.
- **Reveal(ref):** open the container that holds `ref` (its parent), select it and centre it. Search, the panel's lists, flows, health and recent all use this.

### 5.8 Selection and the details panel

Click a card or a line to select it. The selected card gets a ring. Cards and
lines not connected to it are dimmed (`02-overview-selected.png`). **Esc**
clears the selection. The panel is resizable from its left edge, toggled with
**P** or the panel button, and it remembers its width and open state.

With **nothing selected**, the panel describes the current view. At the
overview it's the **Codebase** panel (`01-overview.png`):

```
[icon] Codebase
‹project.name›
‹project.summary›
[ N files ] [ N lines ] [ N endpoints ]
Recent work  N                        (only if recent has items)
Updated ‹relative time›
  ● ‹task title›   ‹task summary›   [Show N cards]
Systems  N
  Apps people use      what users and staff open          → kinds: ui
  Behind the scenes    servers, background work, shared code → service worker library feature data config
  Outside services     other companies your app relies on → external
  Developer tools      scripts, tests, deployment         → script test infra
    each row: ● label  summary (2 lines)        N files   → click reveals it
```

Panel for a **part** (`02`, `03`):

```
[kind icon] ‹Kind›                      e.g. Library
‹label›
‹summary›  (then details paragraphs, then tags)
[ paths … ] [copy]
[ › Open ]                              (if drillable)
Recent work inside  N                   (list of changed cards beneath, with notes)
[ N files ] [ N lines ] [ N endpoints ]
[language bar]  ● typescript 92%  ● css 8%
Inside  N        (child parts / folders / files: name, summary, click to reveal)
Used by  N       (name, summary, "Uses · weight" on the right)
Depends on  N
Files  N         (name, lines)
```

Panel for a **file** (`04`): kind "File", name, description, amber note box
(if any), path box with copy, `[ N lines ] [ N endpoints ] [ N used by ]`,
owning part, **Used by**, **Depends on**, its endpoints, and its exports when
technical detail is on. **Open in editor** is optional (§10.3).

Panel for an **endpoint**: method and URL, name, description, who may call it
(if present), the file it lives in, and what calls it.

Panel for a **line**: `from → to`, the plain kind label, the summed weight,
`labels`/`desc` if present, and with technical detail the imported `names`.
For merged edges, list each underlying file-to-file link.

### 5.9 Search (`06-search.png`)

Open with **/**, **Ctrl/⌘ K** or the header search box. It's a centred
dialog with an input, up to 40 results, and a key hint footer
(`↑↓ navigate · ↵ open · esc close`).

Index every node, folder chip, file, endpoint and (technical detail only) export, as `{ id, kind, name, desc, path, w }`.

```
empty query  → the top-level parts
terms = query lowercased, split on spaces
for each item, for each term:
  name == term 30 | name startsWith 20 | name includes 12 | path includes 6 | desc includes 4 | else → item fails
score = sum + w*2 − name.length*0.02          (w = weight: how many links touch the item)
sort descending, take 40
```

Each row shows an icon (a method badge for endpoints), the name, the
description (or path) and the kind on the right. **Enter** or a click
reveals the item.

### 5.10 Flows (`07`, `08`, `09`)

The **Flows** button opens a menu listing each flow: its title, then
`N steps · description`. Picking one plays it:

```
step i shows refs a = steps[i].ref and b = steps[i+1]?.ref
view = b ? lowestCommonContainer(a, b) : parent(a)
lowestCommonContainer(a, b): the first element of chain(a) that is also in chain(b);
  if that element is a or b itself, use its parent instead
```

- Open that view, highlight `a` and `b` and the edge between them, dim the rest, and animate a dot along the edge from `a` to `b`.
- A **flow bar** at the top of the canvas shows `‹title› · step i of N`, then `‹name a› → ‹name b›`, the step note, progress dots, and **‹ › ✕** buttons.
- **←/→** step through and **Esc** stops. On the last step, the next button becomes ✕.

### 5.11 Start here tour (`13-tour.png`)

- A card in the bottom-left: `Start here · i of N`, title, note, progress dots, **Skip** and **Next** (the last stop says **Done**).
- Each stop reveals its `ref` and selects it, so the panel describes it.
- If `tour` is empty, build stops from the top-level parts' summaries (at most 6).
- After the last tour stop, if there is at least one flow, add a final stop: "Watch a real request", which plays the first flow.
- It runs automatically on the **first visit only** (remembered in settings), but not when the URL already points somewhere or contains `tour=0`, and not when storage is blocked. The **Start here** button always runs it.

### 5.12 Recent work (`10-recent-work.png`)

- Header button **Recent work** with a count badge (number of items). Hidden when there are none.
- Changed cards get a green ring and a footer tag, **New** or **Changed** (**New** if any of its items is new).
- Every ancestor of a changed card shows a soft tag **N changed**, so people can follow the green down from the overview (`01`: "Build setup · 1 changed").
- The button and **Show N cards** open a **board**: a view of just those cards, in a grid, each with a numbered note box under its description. The panel shows `Recent work`, the task title, `You asked: ‹request›` (if not empty), the summary, **Back to map**, and **On this board N** with numbered rows (name, note, path).
- The breadcrumb reads `Overview / Recent work: ‹task title›`.
- **Highlight recent work** in Filters turns all green off.

### 5.13 Health (`11-health.png`)

- Header button **Health**: a check icon when there are no high or medium issues, otherwise a warning icon and a count of high + medium.
- Opens in the panel. With no issues: **No problems found**, the explanation in §6, a green box saying "Nothing stood out. This is a quick automatic check, not a full security review.", and **Back**.
- With issues: grouped by severity (High, Medium, Low). Each row has a severity icon and label, the title, the detail, its locations as `path:line`, and two buttons: **Show on map** and **Not a problem**.
- **Show on map** opens a board of the issue's `items` (like Recent work), with `notes[ref]` shown on each card.
- **Not a problem** asks for an optional reason, moves the issue to a collapsed "Set aside" list at the bottom, removes it from the count and remembers it by issue `id` in settings. **Show again** undoes it.

### 5.14 Screens

- Header button **Screens**, shown only when `screens` isn't empty.
- Opens a list: name, URL, description. Picking one opens a board of its `behind` items in order (screen → part → request → server → data → outside), as columns left to right, with each item's note on its card and the real links between them.
- Use `fixture.graph.json` to build and test this. Harbor has no screens.

### 5.15 Filters (`12-filters.png`)

A popover from the filter icon:

- **Show connections:** one switch per link kind present in the map. Each has its plain label (§6), its line colour swatch and its count. Turning a kind off rebuilds the current view.
- **Show technical detail:** switches kind labels to the technical set, shows exports in files and in search, shows `N loc` instead of `N files` in the overview lists, and shows line `names`.
- **Highlight recent work.**

All three are remembered.

### 5.16 Right-click menus and hover tips

| On | Items |
|---|---|
| a card | Open · Show on the map · Show details · Copy name · Copy path (or endpoint) |
| a line | Show details |
| the background | Up one level · Back to overview · Fit to screen · Search |

Hover a card for about half a second to see a tip: kind, path and size. Hover a
line to see `from → to`, the kind label, the weight and up to five imported
names or endpoints. Copy actions say **Copied** only when the clipboard write
succeeded. If it fails, select the text and say "Press ⌘C to copy".

### 5.17 URLs and settings

The hash follows the board, so links and the browser's Back/Forward work:

| Hash | Opens |
|---|---|
| *(empty)* | the overview |
| `#v=<ref>` | that container's view (URL-encoded) |
| `#v=<ref>&s=<ref>` | the view, with an item selected |
| `#s=<ref>` | the overview with an item selected |
| `…&tour=0` | as above, and the tour won't auto-start. Keep `tour=0` while navigating. |

A ref the map doesn't have opens the overview. Settings (panel width, panel
open, link-kind switches, technical detail, recent highlights, the folded
description, tour seen, health set-asides) are kept in `localStorage` under one
namespaced key per map (`appmap:<rootName>:<setting>`). Every access is in
`try/catch`. If storage fails, keep settings in memory instead.

### 5.18 Keyboard

| Key | Does |
|---|---|
| **/**, **Ctrl/⌘ K** | search |
| **Enter** | open the selected card |
| **Backspace** | up one level |
| **F** | fit to screen |
| **+** / **−** | zoom |
| **P** | toggle panel |
| **← / →** | previous / next flow step (while a flow plays) |
| **Esc** | close menu or dialog → stop flow → clear selection, in that order |
| **Tab** / arrows | move between cards in reading order; the focused card has a visible ring |

No shortcut fires while focus is in a text field.

### 5.19 Export

**Export** opens a dialog: "Export a copy", and one sentence: "One HTML file
that opens in any browser. It shows how the app fits together, but not the
source code." Three checkboxes follow:

- **Flows and the tour**, on by default.
- **Recent work**, off by default.
- **Health check**, off by default. When ticked, show the warning: "Health lists the endpoints anyone can use and where secrets sit in the code. Only send it to people you trust."

**Download** writes `‹rootName›-map.html` in the browser. It is the app's own
built HTML with the chosen subset of `graph.json` inlined (§5.2). Drop
`flows` and `tour`, `recent` or `health` according to the boxes, and always
drop `meta.repos[].remote` and any absolute paths. An exported map shows an
**Exported ‹date›** label beside the project name and hides the Export button.

### 5.20 Phone and tablet (`14-phone-overview.png`)

Below 1000 px wide:

- The header wraps to two rows, and its buttons show icons only (with accessible names). On phones the zoom buttons move into the top row.
- The view description folds to one line with **More**.
- One finger pans and two fingers pinch-zoom. Tapping a card opens its panel as a **bottom sheet** with an **Open** button. Tapping empty space, navigating, or **Esc** closes the sheet.
- No horizontal page scroll, and a 16px side gutter.

---

## 6. Words (use exactly)

**Link kind labels**

| `k` | Plain (default) | Technical |
|---|---|---|
| `import` | Uses | Imports |
| `http` | Web requests | HTTP |
| `call` | Calls | Calls |
| `rpc` | Calls | RPC |
| `event` | Events | Events |
| `queue` | Background jobs | Queues |
| `data` | Reads & writes data | Data |
| `config` | Settings | Config |

**Node kind labels in the panel:** UI, Service, Background work, Library,
Feature, Data, Settings, Tests, Script, Deployment, Outside service. The
reference shows raw words such as "Ui". Use these instead.

**Columns:** `Used by` · `Inside ‹name›` · `Uses`. **Panel sections:**
`Inside`, `Used by`, `Depends on`, `Files`, `Endpoints`, `Recent work`,
`Recent work inside`, `Systems`.

**Header:** `Search files, endpoints, parts` (placeholder) · `Health` ·
`Recent work` · `Screens` · `Start here` · `Export` · `Flows`.

**Health, empty:** title `No problems found`. Body: "We looked for keys left
in the code or sent to the browser, data and parts of your app anyone on the
internet can reach, leftover files and files too big to edit safely. It's a
quick check, not a security audit."

**Empty description:** `No description yet`.

---

## 7. Wireframes

### 7.1 Overview page (desktop): `01-overview.png`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [logo] Harbor  Overview        [ 🔍 Search files, endpoints, parts   / ]  ◐  ✓Health  ✦Recent work③  │
│                                                              ◎Start here  ⇪Export  ▷Flows  ≡  ▯  │
├───────────────────────────────────────────────────────────────────────┬──────────────────────────┤
│ Overview                                                              │ ◇ Codebase               │
│ Harbor                                                                │ Harbor                   │
│ One screen that hosts many separate trading apps side by side, …      │ One screen that hosts …  │
│                                                                       │ ┌─────┐┌─────┐┌─────┐    │
│   ┌──────────┐                                                        │ │ 142 ││ 15k ││  0  │    │
│   │Build setup│                                                       │ │files││lines││endp.│    │
│   │ •1 changed│                                                       │ └─────┘└─────┘└─────┘    │
│   └──────────┘                                                        │ Recent work 3            │
│   ┌─────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐ ┌───┤ ┌──────────────────────┐ │
│   │Tests│──│Desktop    │──│Trading   │──│Tiles and│──│Message   │─│Mes│ │● Host Harbor on Fire…│ │
│   └─────┘  │shell      │  │apps      │  │blotter  │  │broker    │ │sag│ │  Every Harbor app …  │ │
│            │ •2 changed│  └──────────┘  └─────────┘  └──────────┘ └───┤ │  [✦ Show 3 cards]    │ │
│            └───────────┘          ╲               ┌──────────┐  (AG Grid)│ └──────────────────────┘ │
│                                    ╲──────────────│Design    │  (Browser │ Systems 12               │
│                                                   │system    │   storage)│ Apps people use  …       │
│                                                   └──────────┘  (Dockview)│  ● Desktop shell 33 files│
│ [−][⛶][+]                                                             │  ● Trading apps  27 files│
└───────────────────────────────────────────────────────────────────────┴──────────────────────────┘
```

### 7.2 Inside a part: `03-inside-part.png`

```
│ Overview / Message broker                                                                       │
│ ◇ Library                                                                                       │
│ Message broker                                                                                  │
│ The only way apps share anything: …                                                             │
│                                                                                                 │
│ ─ Used by ─      ───────────── Inside Message broker ─────────────          ─── Uses ───         │
│ (Tiles & blotter)──┐  ┌──────────────┐                                 ┌──(Pretend market data)  │
│ (Trading apps)─────┼──│App starter kit│──┐  ┌────────────┐              ├──(Design system)        │
│ (Desktop shell)────┤  └──────────────┘  └──│App connector│──┐ ┌───────┐ └──(Message rules)        │
│ (Tests)────────────┘                       └────────────┘  └─│Broker │──┘                        │
│                                                               └───────┘                         │
```

### 7.3 Inside a file

```
│ ─ Used by ─        ─────────── Inside Order requests ───────────           ─── Uses ───          │
│ (Shop website)─────┬─▶┌─POST /api/orders──┐   ┌─GET /api/orders──┐                              │
│                    │  │ Place an order    │   │ List my orders   │                              │
│                    └─▶└───────────────────┘   └──────────────────┘                              │
│                       ┌──────────────────┐                                                      │
│ (Stripe)─────────────▶│ Order requests    │ (the file itself: m:)────────────(Card payments)      │
│                       │ 3 endpoints       │                                                     │
│                       └──────────────────┘   ┌─DELETE /api/orders/:id─┐                         │
│                                              │ Cancel an order  [New] │  (no lines: not called) │
│                                              └────────────────────────┘                         │

From `fixture.graph.json`. "Shop website" is the outside pill because the
caller (`web/src/lib/api.ts`) rolls up to the highest part below the shared
ancestor (§5.4). The database link is part-to-part, so it doesn't appear
inside a single file.
```

### 7.4 Flow bar: `08-flow-step-1.png`

```
          ┌──────────────────────────────────────────────────────────────────────┐
          │ From order to trade · step 1 of 7                          ‹   ›   ✕ │
          │ Orders awaiting tile → Order blotter                                 │
          │ The trader clicks the 'Orders awaiting execution' tile.              │
          │ ▬ ─ ─ ─ ─ ─ ─                                                        │
          └──────────────────────────────────────────────────────────────────────┘
   (board: the two cards bright, the rest dimmed, a dot travelling along the line between them)
```

### 7.5 Health with issues (from `fixture.graph.json`)

```
│ ♥ Health check                       │
│ 1 important issue                    │
│ ── High ─────────────────────────────│
│ ▲ Anyone can cancel any order        │
│   Cancel an order has no sign-in …   │
│   api/src/routes/orders.ts:120       │
│   [Show on map]  [Not a problem]     │
│ ── Low ──────────────────────────────│
│ ○ Order requests is 1,240 lines long │
│   …                                  │
│ ○ Nothing uses Old helpers           │
│   …                                  │
│ ▸ Set aside (0)                      │
│ [‹ Back]                             │
```

### 7.6 Tour card: `13-tour.png`

```
┌─────────────────────────────────────────┐
│ Start here · 1 of 7                   ✕ │
│ What Harbor is                          │
│ One screen that holds many trading apps │
│ at once. You sign in once and every app │
│ knows who you are.                      │
│ ▬ ─ ─ ─ ─ ─ ─            Skip   [Next]  │
└─────────────────────────────────────────┘
```

### 7.7 Phone overview: `14-phone-overview.png`

```
┌────────────────────────────┐
│ [logo] Overview  [− ⛶ +] 🔍│
│ ◐  ✓  ✦③  ◎  ⇪  ▷  ≡  ▯   │
│ Overview                   │
│ Harbor                     │
│ One screen that hosts …    │
│ More                       │
│                            │
│   (board, pinch to zoom)   │
│                            │
├────────────────────────────┤
│ ▔▔ bottom sheet on tap ▔▔  │
│ Desktop shell   [Open]     │
└────────────────────────────┘
```

---

## 8. Test matrix (pass every row before the PR)

Use `harbor.graph.json` unless the row says fixture.

| # | Do | Expect |
|---|---|---|
| 1 | Load Harbor | Overview: 9 top-level parts + 3 outside services, title "Harbor", summary text, Codebase panel with 142 files / 15k lines / 0 endpoints |
| 2 | Click Message broker | It and its neighbours stay bright, others dim. Panel shows Library, 14 files, Inside 3, Used by 4 |
| 3 | Double-click Message broker | Breadcrumb `Overview / Message broker`. Three cards. Used by: Tiles and blotter, Trading apps, Desktop shell, Tests. Uses: Pretend market data, Design system, Message rules |
| 4 | Open Broker, select `agent.ts` | Panel shows amber note, 522 lines, used by 4. URL hash is `#v=n%3Abroker.agent&s=f%3Apackages%2Fagent%2Fsrc%2Fagent.ts` |
| 5 | Reload with that URL | Same view and selection. Tour does not start |
| 6 | Search `blotter` | Top results: Tiles and blotter (feature), Order blotter, Widget styles, Orders awaiting tile |
| 7 | Play "From order to trade" | 7 steps. Step 1 opens Tiles and blotter with Orders awaiting tile and Order blotter highlighted. ← → Esc work |
| 8 | Recent work | Badge 3. Overview shows "1 changed" on Build setup and "2 changed" on Desktop shell. Board shows 3 numbered cards |
| 9 | Health (Harbor) | "No problems found" |
| 10 | Fixture: Health | 1 high, 2 low. Show on map highlights Cancel an order with its note. Not a problem moves it to Set aside and the count drops to 0. Reload: still set aside |
| 11 | Fixture: open Sales reports | Two folder chips (`…/daily`, `…/monthly`), 13 files each |
| 12 | Fixture: open the Order requests file | File card + 3 endpoint cards. Used by: Shop website (lines to Place an order and List my orders) and Stripe (line to the file card). Uses: Card payments only. Cancel an order tagged New with no lines |
| 13 | Fixture: Screens → Cart | Board in order: Cart page, Server requests, Place an order, Card payments, Database, Stripe |
| 14 | Filters: turn off Uses | Import lines disappear from the current view. The setting survives reload |
| 15 | Show technical detail | Labels switch (Uses → Imports). Inside Harbor's `agent.ts`, 7 export cards appear (AGENT_VERSION … Agent) and they appear in search. In the fixture's orders file, no exports appear, because both are endpoint handlers |
| 16 | Export with defaults | Downloaded file opens offline and shows the map with flows and tour, no Recent work button, no Health button, an "Exported ‹date›" label, and no Export button |
| 17 | Open in a private window, or a `sandbox="allow-scripts"` iframe | Map works. Tour doesn't auto-start. Settings last for the page only. No console errors |
| 18 | Phone width (390 px) | Two-row icon header, folded description, bottom sheet on tap, no horizontal scroll |
| 19 | Keyboard only | Reach every card, open, go up, search, play a flow and stop it, with focus always visible |
| 20 | Load a file with `schema: "x"` | Clear error and the open button. No blank board |

---

## 9. Acceptance checklist

- [ ] No AI: no input at the bottom of the board, no prompts, nothing from §3, and a search of the code for `openai|anthropic|claude|codex|llm|chat` finds nothing in shipped code.
- [ ] No network requests at runtime (check the browser's network tab after load).
- [ ] Every row of §8 passes.
- [ ] Pure functions from Run 1 have unit tests, covering at least: folder chips, `project()`, edge merging, file-view rules, search scoring, `lowestCommonContainer`, recent roll-ups, hash parse/format.
- [ ] Only OneDS: no hex/rgb colours, no hardcoded font sizes or families outside OneDS tokens.
- [ ] Typecheck, lint and build pass.
- [ ] The PR lists any OneDS gaps and what was composed instead.

---

## 10. Open decisions (answer at the top of the Run 1 PR)

1. **Where `graph.json` comes from.** This build only *reads* it. Options: (a) generate it with Floorplan's own scripts (`scan.mjs` + `build.mjs`, plain Node, no AI needed for the scan, but names and descriptions must then be written by hand in `floorplan/descriptions/`); (b) hand-write it; (c) a scanner built later as its own handoff. **Default: (a) for now, (c) later.**
2. **Design system.** This spec assumes OneDS, like the other handoffs. If the target is this repo's gallery instead, use its Tailwind tokens and keep `--radius: 0rem`.
3. **Open in editor** (`vscode://file/<abs path>:<line>`) needs absolute paths, which the sample data deliberately leaves out. **Default: leave it out.**
4. **Theme switch** (the ◐ button). The reference has light and dark. **Default: follow OneDS themes and keep the switch.**
