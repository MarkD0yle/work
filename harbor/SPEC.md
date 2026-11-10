# SPEC: "Harbor" — an interoperable smart desktop for institutional trading

> Working title only. "Harbor" is a placeholder. Do not use State Street, LINK,
> GlobalLINK, FX Connect, BestX, TradeNeXus or any other real product name, logo
> or branding anywhere in code, copy or assets.

**Status:** draft v1
**Audience:** Claude Code (builder), Mark (owner)
**Basis:** public marketing material only (see section 19). Anything marked
**[Assumed]** is my inference, not a documented fact about the real product.

---

## 0. How to use this file with Claude Code

- Save as `SPEC.md` in the repo root.
- Build **one phase at a time** (section 16). Do not start a phase until the
  previous phase passes its acceptance criteria.
- Before each phase: read this file, then write a short plan and wait for approval.
- After each phase: run `pnpm typecheck && pnpm lint && pnpm test`, then list
  what was built, what was skipped, and any spec ambiguity found.
- If the spec is silent, pick the simplest option and log it in `DECISIONS.md`.
- Never invent real-world connectivity. All data is mock (section 11).

---

## 1. What this product is

One sentence: **a container that hosts many separate trading apps in one
screen, signs the user in once, and lets those apps share context so nobody
re-keys data.**

It is not a trading app. It is the shell around trading apps.

What the real product does, per public material:

- Hosts first-party apps, third-party apps and client in-house apps in one place.
- Single sign-on across all of them.
- Apps talk to each other using the open FDC3 standard.
- Users arrange apps into saved **workspaces**. Workspaces restore, sync, import
  and export.
- Small **widgets and tiles** surface key information and can sit in more than
  one workspace. They are picked from a **Widget Library**.
- A monitoring layer raises **alerts** and lets users act on them from the shell.
- Ships as a desktop install and as a browser version.
- A design system lets teams add features without heavy integration work.

Why it matters to users: the trade lifecycle is spread over 6–10 tools. The
value is the join between them, not any one screen.

---

## 2. The core loop (the thing the demo must prove)

```
 MEASURE  ->  DECIDE  ->  EXECUTE  ->  SETTLE  ->  MEASURE again
 (TCA)       (pre-trade)  (RFQ/algo)   (match)     (TCA updates)
```

Every leg is a **separate app**. The shell passes context between them.
If a user has to type the same order twice, the build has failed.

---

## 3. Goals and non-goals

### Goals
1. A working shell: layout, workspaces, app launcher, widget library.
2. A real interop layer: FDC3-style channels, context and intents between
   sandboxed apps.
3. Enough mock apps to run the core loop end to end.
4. An alert centre that can deep-link into any app with context.
5. A token-driven design system that every app and tile uses.

### Non-goals (do not build)
- Real trading, pricing, FIX, SWIFT, CLS or bank connectivity.
- Real identity provider. Auth is mocked behind an interface.
- A native desktop container (Electron, OpenFin, etc.). Web only for v1.
- Mobile layouts below 1024px wide.
- Multi-tenant admin, billing, onboarding flows.

---

## 4. Users and entitlements

| Role | Main job | Default workspace |
|---|---|---|
| Trader | Execute FX orders at best cost | FX Trading |
| Portfolio Manager | Watch exposure, hand orders to desk | Overview |
| Operations | Match, confirm, settle, fix exceptions | Post-Trade |
| Treasury | Place cash, send payments | Cash & Payments |
| Admin | Manage app directory and entitlements | Admin |

Rules:
- Entitlements are per app and per intent (`canLaunch`, `canRaise`).
- An app the user is not entitled to never appears in the launcher, library,
  intent resolver or restored workspace. A restored workspace shows a
  "No access" placeholder panel in its slot instead.
- Seed five mock users, one per role. A user switcher sits in the profile menu
  (dev builds only).

---

## 5. Vocabulary (use these terms exactly)

| Term | Meaning |
|---|---|
| **Shell** | The host page. Owns chrome, layout, auth, agent, alerts. |
| **App** | A full application in a sandboxed iframe. Has its own route and bundle. |
| **Widget** | A small interactive panel. In-process React. E.g. order blotter. **[Assumed]** |
| **Tile** | A glanceable, mostly read-only card. One number or one list. **[Assumed]** |
| **Panel** | Any docked unit in the layout. Hosts one app, widget or tile group. |
| **Workspace** | A named, saved arrangement of panels plus their channel links. |
| **Widget Library** | The catalogue of apps, widgets, tiles and saved workspaces. |
| **Agent** | The interop broker inside the shell (FDC3 "desktop agent"). |
| **Context** | A typed data object shared between apps. E.g. an order. |
| **Channel** | A named bus. Panels on the same channel share context. |
| **Intent** | A verb an app asks the agent to fulfil. E.g. "execute this order". |
| **App Directory** | JSON registry describing every app and what it can handle. |

The public material names widgets, tiles, workspaces and the Widget Library but
does not define the difference between a widget and a tile. The split above is mine.

---

## 6. Tech stack

- **Language:** TypeScript, `strict: true`. No `any` without a comment.
- **Framework:** React 19 + Vite. One Vite entry per app.
- **Repo:** pnpm workspaces.
- **Layout engine:** Dockview (tabs, splits, floating groups, popout windows,
  JSON serialisation). If it blocks, fall back to FlexLayout and log why.
- **Tile grid inside a panel:** react-grid-layout.
- **Data grids:** AG Grid Community.
- **Charts:** Lightweight, canvas-based. One library only. Pick and log it.
- **State:** Zustand in the shell. Apps own their own state.
- **Schemas:** Zod. Every context, workspace file and directory entry is validated.
- **Styling:** CSS custom properties for tokens. Tailwind is allowed only if
  every colour, space and radius maps to a token. No hard-coded hex values.
- **Tests:** Vitest (unit), Playwright (end to end).
- **Interop standard:** FDC3 2.x. **Check the current FINOS FDC3 docs before
  writing the agent.** Recent versions define a browser-based agent and a
  `getAgent()` entry point; follow the current API names, not the ones in this file,
  where they differ.

### Repo layout
```
/apps
  /shell            host page, chrome, layout, agent bootstrap
  /fx-exec          multi-dealer RFQ execution
  /pretrade         pre-trade decision support
  /tca              transaction cost analysis
  /post-trade       matching, confirmation, settlement
  /cash             money-market fund portal
  /payments         cross-border payments
  /research         research and commentary reader
  /partner-news     third-party style app (proves external integration)
/packages
  /agent            the interop broker (runs in shell)
  /agent-client     tiny client apps import to reach the agent
  /schemas          Zod schemas + TS types for contexts, workspace, directory
  /tokens           design tokens (CSS vars + TS export)
  /ui               shared components built on tokens
  /mock-data        seeded generators, price stream, fake services
  /widgets          in-process widgets and tiles
/e2e                Playwright specs
SPEC.md  DECISIONS.md  CLAUDE.md
```

---

## 7. Shell layout

```
+----------------------------------------------------------------------------+
| [=] Harbor   [ FX Trading v ] [+]      [ Search / Cmd-K ]   (o) Bell  User |  top bar 44px
+----+-----------------------------------------------------------------------+
| A  |  +---------------------------+ +----------------------------------+   |
| p  |  | Order Blotter  (widget) B | | Pre-Trade            (app)     B |   |
| p  |  |                           | |                                  |   |
|    |  +---------------------------+ +----------------------------------+   |
| r  |  +---------------------------+ +----------------------------------+   |
| a  |  | FX Execution   (app)    B | | Tiles: Alerts | Rates | Unmatched|   |
| i  |  |                           | |                                  |   |
| l  |  +---------------------------+ +----------------------------------+   |
+----+-----------------------------------------------------------------------+
| Status: connected - 14:02:11 NY - env MOCK                 Channel legend   |  status bar 24px
+----------------------------------------------------------------------------+
  "B" = panel is linked to the Blue channel
```

### 7.1 Top bar
- Product mark, workspace switcher, new-workspace button.
- Command palette trigger (`Cmd/Ctrl-K`).
- Alert bell with unread count. Opens the alert drawer (section 10).
- Profile menu: user, role, theme, density, sign out.

### 7.2 App rail (left, 48px, expands to 220px)
- Pinned apps, then "All apps" which opens the Widget Library.
- Each icon shows a running dot when at least one instance is open.
- Click = focus existing instance or open a new panel. Shift-click = always new.

### 7.3 Panel chrome (every panel, identical)
- Title, app icon, **channel picker** (coloured dot), overflow menu.
- Overflow: Pop out, Duplicate, Reload, Move to workspace, Close.
- States every panel must render: loading skeleton, ready, empty, error with
  Reload, no-access, disconnected (stale data banner with last-updated time).
- An app crash never takes down the shell. Wrap each panel in an error boundary;
  iframes are isolated by default.

### 7.4 Widget Library
- Full-height overlay, opened from the rail or `Cmd-K`.
- Tabs: Apps, Widgets, Tiles, Workspaces.
- Search, category filter, "entitled only" is always on.
- Card: icon, name, publisher (First-party / Partner / In-house), one-line
  description, intents it handles, Add button.
- Add = drop into the active workspace at the best free slot. Drag = place manually.

### 7.5 Command palette
- Fuzzy search across apps, widgets, workspaces, open panels, recent orders.
- Actions: open, focus, switch workspace, raise intent on a selected entity
  ("Execute order 10432", "View TCA for EURUSD").
- Fully keyboard driven.

---

## 8. Workspaces

### 8.1 Behaviour
- A user has many workspaces. One is active.
- Autosave on every layout or channel change, debounced 500ms.
- Explicit "Save as", "Rename", "Duplicate", "Delete", "Reset to default".
- Restore on sign-in: last active workspace, same panels, same sizes, same
  channel links, same per-panel state where the app supports it.
- **Export** downloads a `.harbor.json` file. **Import** validates with Zod,
  shows a preview (name, panel count, missing or unentitled apps), then adds it.
- The same tile or widget definition can be placed in many workspaces. Config
  (e.g. which currency pair) is stored per placement, not globally.
- Role default workspaces ship as read-only templates. Editing one forks it.

### 8.2 Persistence
- Define `WorkspaceStore` interface: `list`, `get`, `save`, `delete`, `export`, `import`.
- v1 implementation: IndexedDB, keyed by user id.
- Keep the interface async so a server-backed store can replace it with no
  shell changes. That is how cross-device sync would be added later.

### 8.3 File schema (versioned)
```ts
interface WorkspaceFile {
  schemaVersion: 1;
  id: string;                 // uuid
  name: string;
  ownerId: string;
  templateOf?: string;        // id of role template, if forked
  updatedAt: string;          // ISO 8601
  layout: unknown;            // Dockview serialised layout, opaque to us
  panels: PanelRecord[];
}

interface PanelRecord {
  panelId: string;            // matches ids inside `layout`
  kind: 'app' | 'widget' | 'tileGroup';
  appId: string;              // App Directory id
  channelId: string | null;   // user channel link
  config: Record<string, unknown>;   // per-placement settings
  state?: Record<string, unknown>;   // app-supplied restorable state
}
```
- Write a migration function per schema version. Unknown versions are rejected
  with a clear message, never silently loaded.

---

## 9. Interop layer (the hard part — build it properly)

### 9.1 Model
- The shell runs one **Agent**.
- Apps (iframes) reach it through `@harbor/agent-client`, which exposes an
  FDC3-shaped API over `postMessage` / `MessageChannel`.
- Widgets and tiles (in-process) use the same client API through a direct
  transport. One API, two transports.
- The agent validates message origin against the App Directory on every message.

### 9.2 Capabilities to implement
1. **User channels.** Eight fixed, colour-named channels. A panel joins one, or none.
2. **Broadcast / listen.** `broadcast(context)`, `addContextListener(type, handler)`.
   A late joiner receives the channel's most recent context of each type.
3. **Intents.** `raiseIntent(intent, context)`, `addIntentListener(intent, handler)`.
   - 0 handlers: toast "Nothing can handle this".
   - 1 handler: route directly. Open the app if not running.
   - 2+ handlers: show the **intent resolver** dialog. Offer "remember my choice".
4. **App channels.** Named private channels for app-to-app streams.
5. **Open.** `open(appId, context?)`.
6. **Identity.** `getUserInfo()` returns id, display name, role, entitlements.
   Apps never see or store credentials.
7. **Metadata.** `getInfo()` returns agent version and the calling app's identity.

### 9.3 Context types
Use standard FDC3 types where one fits. Check the current standard first.
Custom types are namespaced `harbor.*`.

```ts
type Side = 'BUY' | 'SELL';

interface FxOrderContext {
  type: 'harbor.fxOrder';
  id: { orderId: string };
  pair: string;               // 'EURUSD'
  side: Side;                 // of the base currency
  dealtCurrency: string;      // 'EUR'
  amount: number;             // in dealt currency
  tenor: 'SPOT' | 'TOM' | '1W' | '1M' | '3M' | 'BROKEN';
  valueDate: string;          // ISO date
  account: string;            // fund / portfolio code
  status: 'NEW' | 'WORKING' | 'PARTIAL' | 'FILLED' | 'CANCELLED';
  benchmark?: 'ARRIVAL' | 'WMR_4PM' | 'TWAP';
}

interface FxTradeContext {
  type: 'harbor.fxTrade';
  id: { tradeId: string; orderId: string };
  pair: string; side: Side; amount: number;
  rate: number; counterparty: string;
  method: 'RFQ' | 'RFS' | 'ALGO';
  executedAt: string; valueDate: string; account: string;
  arrivalMid: number;         // mid when the order reached the desk
}

interface PreTradeEstimateContext {
  type: 'harbor.preTradeEstimate';
  id: { orderId: string };
  expectedCostBps: number;
  recommendedMethod: 'RFQ' | 'ALGO';
  suggestedCounterparties: string[];
  liquidityScore: 1 | 2 | 3 | 4 | 5;
}

interface SettlementContext {
  type: 'harbor.settlement';
  id: { tradeId: string };
  matchStatus: 'UNMATCHED' | 'MATCHED' | 'MISMATCHED' | 'CONFIRMED' | 'SETTLED' | 'FAILED';
  exceptionReason?: string;
}
```
Also use standard `fdc3.instrument` (pair selection), `fdc3.portfolio`,
`fdc3.organization` (counterparty), `fdc3.timeRange`.

### 9.4 Intents
| Intent | Context | Handled by |
|---|---|---|
| `harbor.ExecuteOrder` | fxOrder | fx-exec |
| `harbor.AnalyseOrder` | fxOrder | pretrade |
| `ViewAnalysis` | fxTrade, instrument | tca |
| `harbor.ViewSettlement` | fxTrade | post-trade |
| `ViewNews` | instrument | research, partner-news (two handlers: proves the resolver) |
| `harbor.PlaceCash` | portfolio | cash |
| `harbor.SendPayment` | organization | payments |

### 9.5 App Directory
- Static JSON served by the shell. Follow the FDC3 App Directory record shape.
- Each record: `appId`, `title`, `publisher`, `category`, `type` (`web`),
  `details.url`, `icons`, `interop.intents.listensFor`, `interop.userChannels`,
  plus Harbor extensions: `kind` (`app | widget | tile`), `allowedOrigins`,
  `requiredEntitlement`, `defaultSize`.
- Adding a new app must be: add one directory record + deploy the app. No shell
  code change. **This is a hard acceptance test.**

### 9.6 Security rules
- Iframes: `sandbox="allow-scripts allow-same-origin allow-forms"`. Nothing more.
- Agent drops any message whose origin is not in `allowedOrigins` for that app.
- Agent enforces entitlements on `open` and `raiseIntent`, not just the UI.
- Every broadcast and intent is written to an in-memory **interop log**
  (time, from, to, type, id). Expose it in a dev panel. It doubles as an audit trail.
- CSP on the shell: `frame-src` limited to directory origins.

---

## 10. Alerts and monitoring

- A shell-level `AlertService`. Apps publish alerts through the agent client.
- Alert shape:
```ts
interface Alert {
  id: string; createdAt: string;
  severity: 'info' | 'warning' | 'critical';
  sourceAppId: string;
  title: string;              // max 60 chars
  body?: string;              // max 140 chars
  context?: unknown;          // any context object
  action?: { label: string; intent: string };   // e.g. "Resolve" -> harbor.ViewSettlement
  status: 'unread' | 'read' | 'actioned' | 'dismissed';
}
```
- **Bell + drawer:** grouped by severity, then time. Filter by app. Bulk dismiss.
- **Toasts:** critical only. Max three on screen. Never auto-dismiss critical.
- **Action button** raises the intent with the alert's context. This is the main
  "see it, act on it" path. It must work even if the target app is closed.
- **Alert tile:** live counts per severity. Click a count to open the drawer filtered.
- Severity is never shown by colour alone. Pair with an icon and a text label.

---

## 11. Mock data

- All generators are **seeded**. Same seed, same data. Seed comes from `?seed=`.
- 12 pairs: EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD, EURGBP,
  EURJPY, USDMXN, USDSGD, USDZAR.
- **Price stream:** mid follows a small random walk, ticking every 250–1000ms.
  Each of 8 mock liquidity providers quotes mid ± its own spread and skew.
- **Precision:** 5 dp for most pairs, 3 dp for JPY pairs. Show the pip digits larger.
- **Value dates:** spot is T+2 business days; USDCAD is T+1. Skip weekends only.
- **Seed entities:** 6 funds, 40 open orders, 400 historical trades over 90 days,
  8 LPs, 30 money-market funds, 20 payment beneficiaries, 25 research notes.
- **Services** live behind interfaces (`OrderService`, `QuoteService`,
  `TradeService`, `SettlementService`, `TcaService`) so a real backend or another
  mock source can be swapped in.
- **Simulated behaviour:**
  - RFQ: each LP replies in 200–1500ms. One in ten declines. Quotes expire after 10s.
  - Matching: a new trade is UNMATCHED, then MATCHED after 3–8s. One in six
    becomes MISMATCHED and raises a critical alert.
  - Disconnect toggle in the dev panel to test stale-data states.
- A persistent **MOCK** badge sits in the status bar. Never removable.

---

## 12. The apps (v1 scope for each)

Keep each app thin. The point is the join between them.

### 12.1 Order Blotter (widget)
- AG Grid of open orders. Columns: order id, account, pair, side, amount, tenor,
  value date, status, age.
- Row select broadcasts `harbor.fxOrder` on the panel's channel.
- Row actions: Analyse, Execute (raise intents).
- Quick filters: mine, pair, status. Keyboard: arrows, Enter = Execute.

### 12.2 Pre-Trade (app) — the DECIDE leg
- Listens for `harbor.fxOrder`.
- Shows: expected cost in bps, liquidity score, recommended method with a
  one-line reason, top five suggested counterparties with historical hit rate.
- Buttons: "Execute via RFQ", "Execute via Algo" → `harbor.ExecuteOrder` with the
  estimate attached.
- Empty state: "Select an order to see an estimate."

### 12.3 FX Execution (app) — the EXECUTE leg
- Handles `harbor.ExecuteOrder`. Ticket arrives **pre-filled and locked** to the
  order's fields. Counterparties pre-ticked from the estimate.
- RFQ panel: one row per LP, streaming bid/offer, best price highlighted,
  countdown ring, Accept on click or `Enter` on best.
- Amount entry accepts shorthand: `25m`, `500k`, `1.5b`.
- Confirm step for trades over a configurable size. Shows amount in words.
- On fill: create trade, broadcast `harbor.fxTrade`, update order status.
- Algo path: v1 is a stub that fills in three slices over 15s with a progress bar.

### 12.4 Post-Trade (app) — the SETTLE leg
- Listens for `harbor.fxTrade`. Grid of trades by match status.
- Exception queue on top. Each exception shows both sides of the mismatch
  field by field, with the differing field highlighted.
- Actions: Accept theirs, Resend, Escalate. Each writes to an activity log.
- Raises alerts for MISMATCHED and FAILED.

### 12.5 TCA (app) — the MEASURE leg
- Listens for `harbor.fxTrade`, `fdc3.instrument`, `fdc3.timeRange`.
- Views: slippage vs arrival (bps) over time, cost by counterparty, cost by
  method, cost by time of day. Table of worst ten trades.
- A new trade appears in the charts within 2s of execution.
- Selecting a counterparty broadcasts `fdc3.organization`.

### 12.6 Cash (app)
- Fund list with yield, AUM, rating, cut-off time. Compare up to four.
- Subscribe / redeem ticket with a policy check (max % per fund, min rating).
  A breach blocks submit and names the rule.

### 12.7 Payments (app)
- Beneficiary list, new payment form, FX rate lock, two-step approve.
- Maker cannot approve own payment (segregation of duties).

### 12.8 Research (app) and Partner News (app)
- Both handle `ViewNews`. Research is a reader with pair tags.
- Partner News has a deliberately different look and a different origin in the
  directory. It proves a non-native app can be hosted and still join channels.

### 12.9 Tiles (in-process)
- **Alerts:** counts by severity.
- **Rates:** up to 6 pairs, live mid, day change, tiny sparkline. Click = broadcast instrument.
- **Unmatched trades:** count + oldest age.
- **Orders awaiting execution:** count + total notional by currency.
- **Cut-offs:** next three fund or currency cut-offs with countdown.
- **Day cost:** today's average slippage in bps vs 30-day average.

---

## 13. Design system

### 13.1 Principles
1. **Clarity over decoration.** Data is the interface. Chrome stays quiet.
2. **Deference.** The shell never competes with the app inside it.
3. **Consistency.** One panel chrome, one ticket pattern, one grid style.
4. **Density with air.** Tight rows, clear grouping, real hierarchy.
5. **Colour means something.** Reserve colour for state, side and channel.

### 13.2 Tokens — three tiers
```
primitive   --blue-500, --gray-900, --space-2          raw values
semantic    --color-text-primary, --color-surface-1    meaning
component   --panel-header-height, --grid-row-height   one component's knobs
```
- Components read semantic or component tokens only. Never primitives.
- Themes (light, dark) remap semantic tokens. Density (compact, comfortable)
  remaps component tokens. No component code changes for either.
- Export tokens as CSS variables and as a typed TS object.
- Apps load tokens from the shell at start-up and re-theme live on change.

### 13.3 Specifics
- Type: one sans family, plus tabular numerals for every number.
  Scale: 11, 12, 13, 15, 18, 24. Body is 13.
- Spacing: 4px base. 2, 4, 8, 12, 16, 24, 32.
- Grid row height: 24 compact, 32 comfortable.
- Numbers right-aligned. Thousand separators. Fixed decimals per pair.
- Buy/sell: two colours **and** a text label. Pass a colour-blind simulation check.
- Channel colours: eight hues, each with a letter fallback (B, G, O, ...).
- Motion: 120–200ms, ease-out. Price flashes 300ms. Respect `prefers-reduced-motion`.
- Focus ring: 2px, always visible, never removed.

### 13.4 Shared components (`/packages/ui`)
Button, IconButton, Input, NumberInput (with shorthand), Select, Combobox,
Checkbox, Radio, Switch, Tabs, Tooltip, Popover, Dialog, Drawer, Toast, Badge,
StatusPill, Skeleton, EmptyState, ErrorState, DataGrid wrapper, PriceCell,
AmountCell, Sparkline, PanelChrome, ChannelPicker, Ticket, KeyValueList,
Countdown, Kbd.

Each component: typed props, all states, keyboard support, a story or demo page.

---

## 14. Non-functional requirements

### Performance
- Shell interactive in under 2s on a warm cache.
- 12 open panels with live prices hold 55+ fps.
- Batch price updates per animation frame. Never set state per tick.
- Lazy-load iframes for panels in background tabs. Suspend their streams.

### Accessibility (WCAG 2.1 AA)
- Every action reachable by keyboard. Documented shortcut map (`?` opens it).
- `F6` cycles shell regions. `Ctrl-Alt-arrows` moves focus between panels.
- Each panel is a labelled landmark. Iframes have titles.
- Live regions announce fills and critical alerts, politely throttled.
- Contrast 4.5:1 text, 3:1 UI. Target size 24px minimum.

### Resilience
- Error boundary per panel. Agent survives any app crash.
- Corrupt workspace falls back to the role template and keeps the bad file for export.
- All timers and listeners cleaned up on panel close. Test for leaks.

### Auditability
- Interop log and alert actions are append-only, exportable as JSON.
- Every state-changing action records user, time, before and after.

### Quality gates
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e` all pass before a phase closes.
- Unit coverage on `/packages/agent` and `/packages/schemas`: 90% lines.

---

## 15. Golden path (the end-to-end test)

Write this as one Playwright spec. It is the definition of done.

1. Sign in as the Trader. "FX Trading" workspace restores with five panels.
2. "Orders awaiting execution" tile shows a count. Click it. Blotter filters.
3. Select a EURUSD order. Pre-Trade updates within 300ms with an estimate.
4. Click "Execute via RFQ". FX Execution takes focus. Ticket is pre-filled.
   Assert no field needed typing.
5. Quotes stream. Accept the best. A fill toast appears.
6. Post-Trade shows the trade as UNMATCHED, then MATCHED.
7. TCA shows the new trade in "slippage vs arrival" within 2s.
8. Force a mismatch (dev panel). A critical alert appears. Click its action.
   Post-Trade opens on that exception.
9. Raise `ViewNews` for EURUSD. Resolver shows two handlers. Pick Partner News.
10. Move a panel, change a channel, export the workspace, reset, import.
    Assert layout and channels are identical.
11. Switch to the Operations user. FX Execution is absent from the launcher,
    library and resolver.
12. Open the interop log. Assert steps 3–9 each produced an entry.

---

## 16. Build phases

| # | Phase | Delivers | Acceptance |
|---|---|---|---|
| 0 | Scaffold | Repo, tooling, tokens, `ui` basics, empty shell chrome | Theme and density switch live. CI gates pass. |
| 1 | Layout | Dockview panels, panel chrome, all panel states, popout | Add, move, split, tab, pop out, close with keyboard and mouse. |
| 2 | Workspaces | Store, autosave, templates, import/export, migrations | Golden path step 10 passes with placeholder panels. |
| 3 | Directory + Library | App Directory, launcher rail, Widget Library, entitlements, mock auth | A new placeholder app appears from a directory record alone. Step 11 passes. |
| 4 | Agent | Channels, broadcast, intents, resolver, identity, interop log, security rules | Two test iframes exchange context and intents. Bad origin is dropped. 90% coverage. |
| 5 | Mock data | Seeded generators, price stream, services | Same seed gives identical data across reloads. |
| 6 | Core loop apps | Blotter, Pre-Trade, FX Execution, Post-Trade, TCA | Golden path steps 1–7 pass. |
| 7 | Alerts | AlertService, bell, drawer, toasts, alert tile, actions | Step 8 passes. |
| 8 | Breadth | Cash, Payments, Research, Partner News, remaining tiles, command palette | Step 9 passes. Each app has all panel states. |
| 9 | Hardening | Accessibility pass, performance pass, leak tests, docs | Full golden path green. NFR targets met. |

Stop after Phase 4 and demo. If the agent is not solid, nothing after it matters.

---

## 17. CLAUDE.md starter (copy into the repo)

```
- Read SPEC.md before any task. Build only the current phase.
- TypeScript strict. No `any`. No hard-coded colours, spacing or font sizes.
- All data is mock and seeded. Never call external services.
- Never use real company or product names or logos.
- Every cross-app data flow goes through the agent. No shared globals, no
  direct imports between apps.
- New app = directory record + app folder. If the shell needs editing, stop and ask.
- Every panel implements: loading, ready, empty, error, no-access, disconnected.
- Run typecheck, lint, test before saying a task is done.
- Log every unprompted decision in DECISIONS.md with one line of reasoning.
```

---

## 18. Open questions for the owner

1. **Purpose.** Design reference, pitch demo, or a seed for real work? It
   changes how far Phases 8–9 go.
2. **Desktop container.** Web only assumed. A native container adds multi-window,
   multi-monitor and hosting of non-web apps. That is a separate project.
3. **Design tokens.** Neutral tokens assumed. Swap in a house token set at Phase 0
   if this is for work.
4. **Mock data source.** Local generators assumed. An external mock data service
   could sit behind the same service interfaces.
5. **Asset classes.** FX, cash and payments only. Fixed income, equities and
   financing are out of v1.

---

## 19. Public sources this spec is based on

- LINK product sheet — https://www.statestreet.com/web/solutions/documents/link-product-sheet.pdf
- LINK / State Street Markets brochure — https://www.statestreet.com/web/solutions/documents/brochure.pdf
- Electronic trading platforms page — https://www.statestreet.com/ca/en/solutions/markets/electronic-trading-platforms
- SDP integration use case — https://www.statestreet.com/web/solutions/documents/redefining-fx-trading-through-integration-sdp-use-case.pdf
- The Full FX, rebrand coverage — https://thefullfx.com/state-street-rebrands-globallink-digital/
- The TRADE, first third-party integration — https://www.thetradenews.com/state-streets-link-integrates-emalpha-multilingual-ai-co-pilot/

Not publicly documented, so designed from scratch here: the widget/tile split,
the alert model, the context and intent catalogue, the workspace file format,
the entitlement model, and every screen layout.
