# Decisions

Every choice the spec did not make, with one line of reasoning. Newest phase last.

## Repo and tooling

- **Harbor lives in `harbor/`, as its own pnpm workspace.** The repo root is an existing npm prototype gallery; a monorepo at the root would have collided with it. "Repo root" in SPEC.md means `harbor/`.
- **pnpm runs through `npx -y pnpm@10`.** pnpm is not installed on this machine and installing it globally was not asked for. `packageManager` pins the version.
- **One root `tsconfig.json` type-checks everything; packages export TypeScript source.** No build step between packages, so a change in `schemas` is seen by the shell immediately.
- **Tool versions match the gallery app** (TypeScript 6.0, Vite 8, ESLint 10) so the two halves of the repo do not drift. Zod stays on 3.x, which the code was written against.
- **`react-refresh` lint plugin is not used.** Files here mix components and helpers on purpose; the rule would only add noise.

## Phase 0 — tokens and UI

- **Border radius is 0 everywhere.** Repo-wide rule. `--radius-*` tokens exist so components still read a token, but they resolve to 0.
- **Buy/sell are teal and orange, not green and red.** That pair stays distinct under red-green colour blindness, and a text label is always shown as well. Green and red are kept for positive/critical state.
- **No Tailwind.** Plain CSS with custom properties was simpler than proving every utility maps to a token.
- **A unit test enforces the token rules:** no colour literal outside `tokens.css`, and no component reads a primitive token.
- **Component dimensions that are not spacing (switch track, glyph size, toast width) are literal pixel values.** The spec bans hard-coded colours, spacing and font sizes; promoting every one-off dimension to a token would bloat the token set.
- **Dialog and Drawer use the native `<dialog>` element.** Focus trap, Escape and background inertness come free and correct.
- **Phase 0–4 ships the UI components those phases use.** NumberInput, Combobox, Radio, Tooltip, StatusPill, DataGrid, PriceCell, AmountCell, Sparkline, Ticket, KeyValueList and Countdown arrive with the apps that need them (Phases 6–8). There is no story/demo page yet.

## Phase 1 — layout

- **Panel chrome is the Dockview tab.** Icon, title, channel picker and overflow menu sit in the tab itself rather than in a second header row, which would cost a row of height on every panel.
- **Panels use Dockview's `always` renderer.** It keeps iframes alive when a tab is hidden or a panel moves, so apps do not reload and lose state. The cost is no lazy loading of background tabs; that is a Phase 9 performance item.
- **Keyboard layout control is through the tab menu** (Split right, Split down, Move to next group, Float, Pop out, Close) plus `Ctrl-Alt-arrows` and `F6`. Dockview has no built-in keyboard drag.
- **"Split" is disabled for a panel that is alone in its group.** There is nothing to split away from.
- **Dev builds add "Dev: show loading / empty / error" to the panel menu** so every panel state can be seen and tested without a failing backend.
- **An iframe that has not connected within 8 seconds shows the error state with Reload.**

## Phase 2 — workspaces

- **A user sees their own role's template only.** Other roles' defaults would mostly be "No access" panels.
- **A fork hides the template it came from.** Otherwise the switcher would list "FX Trading" twice. "Reset to default" on the fork restores the original.
- **Focus changes are not edits.** Clicking inside a panel changes Dockview's active group; that alone never forks a template or triggers a save.
- **Window resizes are not edits either.** Layout events within 400 ms of a resize are ignored.
- **Save as, Duplicate and Import drop `templateOf`.** They create workspaces in their own right, so they never hide a template.
- **Import gives the file a new id and the importing user as owner.** Panel ids are kept, which is what makes the exported layout reload unchanged.
- **"Move to workspace" appends the panel record to the target file.** The target's layout is opaque to us, so the panel is placed in the best free slot the next time that workspace opens.
- **"Best free slot" = split the largest group along its longer side.**
- **Corrupt files are quarantined, not deleted.** They move to a second store and can be exported from the dev panel; the role template loads instead.
- **Per-panel `state` is in the schema but nothing writes it yet.** No Phase 0–4 app has state worth restoring.
- **Dockview's layout includes popout windows.** A workspace saved with a popped-out panel will try to reopen that window, which a browser may block.

## Phase 3 — directory, library, entitlements

- **Entitlements are `{ apps: string[], intents: string[] }` on the user.** `canLaunch` matches a record's `requiredEntitlement`; `canRaise` matches the intent name, with `*` for any.
- **The Widget Library is a non-modal side sheet, not a full-screen modal.** A modal makes the layout inert, and then a card could not be dragged onto it.
- **The rail pins every entitled app of kind `app`.** There is no pin/unpin UI yet.
- **`Cmd/Ctrl-K` opens the Widget Library.** The command palette proper is Phase 8.
- **The frame-src policy is injected at runtime from the directory.** A static policy would have to be edited for each new app, breaking "directory record only".
- **Directory records carry an optional `glyph`.** A two-letter fallback icon, so no image assets are needed.
- **Mock auth keeps the signed-in user id in localStorage.** The user switcher is in the profile menu in dev builds only.

## Phase 4 — agent

- **FDC3 3.0 is the current standard, not 2.x** (checked on fdc3.finos.org, November 2026). Method names follow the 3.0 `DesktopAgent`: `getUserChannels`, `joinUserChannel`, `raiseIntent`, `getOrCreateChannel`, and so on.
- **This is an FDC3-shaped agent, not a conformant one.** The wire format is Harbor's own (`harbor/1`), not the FDC3 Desktop Agent Communication Protocol, and apps connect with `connect()` from `@harbor/agent-client`, not `getAgent()` from `@finos/fdc3`. Conformance would let unmodified third-party FDC3 apps connect; it is a separate piece of work.
- **Not implemented from the standard:** private channels, intent results, `raiseIntentForContext`, `findIntentsByContext`, `findInstances`, `addEventListener`, context metadata.
- **Iframes use plain `postMessage`, not a `MessagePort`.** The spec requires the origin to be checked on every message; a port only proves origin once, at the handshake.
- **A popped-out app accepts shell messages from its host window's opener.** The agent lives in the main shell window, so that is where replies come from.
- **User channel ids are `fdc3.channel.1`–`8`,** named Red, Orange, Yellow, Green, Cyan, Blue, Magenta, Purple.
- **Broadcasting with no channel joined is a silent no-op,** as in FDC3.
- **A late joiner is not sent its own broadcasts back.**
- **Unknown `harbor.*` context types are rejected; unknown types in other namespaces only need a valid `type`.** The `harbor.` namespace is ours, so an unknown one is a bug, while third-party apps may bring their own types.
- **An intent is routed to an existing panel of the chosen app if there is one; otherwise the app is opened.** The raise resolves once the app has received it, and fails with `IntentDeliveryFailed` after 10 seconds.
- **`open()` focuses an existing instance rather than always creating one,** matching the rail's click behaviour.
- **"Remember my choice" lasts for the session, per user and intent.** It is not persisted.
- **An unentitled app and a missing app give different errors (`AccessDenied`, `AppNotFound`) to the caller,** and both are logged.
- **The interop log also records channel joins, refusals and dropped messages,** not only broadcasts and intents.
- **Every directory app except the Context Inspector is the same placeholder build** (`apps/placeholder`, served on two ports so Partner News has its own origin). The real apps are Phases 6–8. The Context Inspector widget stands in for the Order Blotter and tiles in the role templates.

## Phase 5 — mock data

- **The price at any moment is a pure function of (seed, pair, time).** Each pair's ticks for a UTC day are a fixed seeded sequence that is replayed up to "now". Every app runs in its own iframe with its own copy of the stream, and this is what makes them all show the same price at the same time. Replaying a full day for all 12 pairs takes about 40 ms.
- **The dataset depends on the seed and the date.** "90 days of history" and "open orders" only make sense relative to today, so the data is identical across reloads on the same UTC day and rolls forward at midnight UTC. Tests pin the date.
- **Each app builds the dataset itself from the seed.** There is no shared backend. Live changes (a new trade, an order filled) travel between apps as context through the agent, not through shared service state.
- **The shell passes its `?seed=` on to iframe apps** by adding it to their URL. This is the one shell change in this phase.
- **Generators use independent seeded streams per entity type,** so adding a field to one generator does not change another's data.
- **The first three orders are pinned to EURUSD, GBPUSD and USDJPY spot,** so every seed has a EURUSD order for the golden path.
- **All fund, bank, LP and company names are invented.**
- **Dates are UTC and skip weekends only,** as the spec says. There is no holiday calendar. Forward tenors run from spot and roll forward off weekends.
- **Prices tick with a small pull back towards the day's open,** so no pair drifts far over a session.
- **Live RFQ quotes re-price on every tick until they expire.** The spec asks for streaming bid/offer; the expiry stays fixed at 10 seconds after the LP's first reply.
- **A resent exception always matches.** Otherwise a demo could loop on the same trade.
- **Six historical trades are seeded as exceptions** (five mismatched, one failed) so the Post-Trade queue is never empty.
- **The services' disconnect switch is `prices.setConnected()`.** The shell's "Simulate disconnect" toggle does not reach it yet, because apps only learn of it once they consume the stream (Phase 6).
- **A "Mock Data" dev widget shows the seed, a fingerprint of the dataset and the live prices.** It is how "same seed, same data" can be seen and tested; the interop probe prints the same fingerprint from inside each iframe.
- **Coverage threshold now includes `mock-data`.**

## Phase 6 — core loop apps

- **"FX Trading restores with five panels" is read as five groups.** The loop needs six things on screen (tiles, blotter, Pre-Trade, FX Execution, Post-Trade, TCA), so Post-Trade and TCA share one group as tabs: six panels in five groups.
- **Each app is its own Vite app on its own port** (Pre-Trade 5176, FX Execution 5177, Post-Trade 5178, TCA 5179), so each has its own origin, bundle and JavaScript realm. `pnpm dev` now starts seven servers.
- **Apps share nothing but context.** Each iframe has its own copy of the mock services. A fill made in FX Execution reaches the blotter, Post-Trade and TCA only as a `harbor.fxTrade` broadcast. A reload therefore loses trades made in the session; there is no backend to hold them.
- **In-process widgets and tiles share one services instance,** the way they would share one backend connection. That is how the tile's count follows the blotter.
- **`FxOrderContext` gained an optional `execution` field** (`{ method, estimate }`). The spec says the estimate is "attached" to `harbor.ExecuteOrder`, and an intent carries one context, so the method and estimate ride on the order.
- **New context type `harbor.orderFilter`,** sent on a named app channel (`harbor.orders`). It is how the tile asks the blotter to filter without the two knowing about each other.
- **Pre-Trade also broadcasts its `harbor.preTradeEstimate`** on the channel, so any other panel can use it.
- **FX Execution starts working the order as soon as it arrives when the sender chose a method** (RFQ or algo from Pre-Trade). From the blotter's plain Execute, the ticket waits for the trader to pick counterparties and press Send.
- **The buyer pays the offer, the seller receives the bid;** "best" is the lowest offer or highest bid among live quotes.
- **Large-trade confirmation is at 50 million of the dealt currency,** changeable per deployment with `?confirmOver=` on the app URL. The rate used is the live quote at the moment of confirming.
- **The fill toast appears inside FX Execution,** not in the shell. Shell-level alerts are Phase 7.
- **The algo stub takes three equal slices at the prevailing mid, five seconds apart,** and books one trade at the average with the first suggested counterparty.
- **A manual ticket is possible** (pair, side, amount with shorthand, account) for trades with no order behind them. It is always spot and dealt in the base currency.
- **The blotter fills an order when it sees a `harbor.fxTrade` for it on its channel.**
- **Arrow keys in the blotter select the row they land on,** so keyboard users broadcast context the same way a click does. Enter executes.
- **TCA records incoming trades as already matched.** Matching is Post-Trade's job; TCA only needs to count them.
- **Post-Trade does not raise alerts yet.** There is no alert service until Phase 7. It does broadcast `harbor.settlement` on every status change.
- **Charts use uPlot.** It is small, canvas-based and fast. Canvas cannot read CSS variables, so the chart reads token values at draw time and redraws when the theme changes.
- **Every chart has a text summary or table beside it,** because a canvas is invisible to assistive technology and to tests.
- **A counterparty is selected from the table under the chart,** not by clicking a bar: a button is reachable by keyboard and a canvas bar is not.
- **The tile group lays tiles out with a CSS grid.** react-grid-layout comes with the remaining tiles in Phase 8, when there is more than one tile to arrange.
- **Tiles inside a group share the group's entitlement.** Per-tile entitlement checks inside a group come with Phase 8.
- **New package `@harbor/app-kit`:** the bootstrap every app repeats (connect, loading and error states, session, connection state, listener hooks).
- **The shell's "Simulate disconnect" now reaches apps** through a new agent event; they pause their price streams and disable dealing.
- **Listener hooks register one tick late.** In React StrictMode a mount is torn down and repeated; registering immediately let the agent hand a queued intent to the discarded listener, so an app launched by an intent could miss it.
- **After a layout is rebuilt in place the shell forces a re-measure.** Dockview's always-on renderer left panel contents at their old positions after "Reset to default".
- **Escape closes the Widget Library wherever focus is.**
- **The Admin role template is the interop bench** (Context Inspector plus placeholder apps on two origins). The Phase 3–5 acceptance tests moved there, since the Trader's panels are now real apps.
- **The Portfolio Manager template now opens with the blotter, Pre-Trade, TCA and Research.**

## Phase 7 — alerts

- **Apps publish alerts through the agent** (`publishAlert`), never directly. The agent checks the shape and length limits, checks the attached context is a valid context, stamps the source app itself, and logs it.
- **An alert with an action must carry a context,** since the action is "raise this intent with that context".
- **Alerts have an optional `key`.** Publishing again with the same source app and key updates the open alert instead of adding another, so two Post-Trade panels do not raise the same break twice.
- **"Open" means unread or seen.** The bell counts unread alerts; the alerts tile counts open alerts per severity.
- **Closing a critical toast marks the alert seen; it does not dismiss it.** The alert stays in the drawer until acted on or dismissed.
- **Closing the drawer marks everything that was shown as seen.**
- **At most three toasts are on screen. Critical toasts never time out and are the last to make way** for a newer one.
- **An alert's action is raised by the shell as the signed-in user,** so entitlements apply exactly as for any other intent, and the agent opens the target app if it is closed. A successful action marks the alert actioned and closes the drawer.
- **Alerts belong to the session.** They are cleared on sign-out and user switch; the audit trail of changes is kept and can be exported from the drawer.
- **Three client extras for alerts:** `publishAlert`, `getAlertSummary` with `onAlertSummaryChanged`, and `showAlerts(severity)`. The alerts tile uses the last two, so it goes through the agent like everything else.
- **Severity always has its own icon and a text label** (octagon Critical, triangle Warning, circle Info), in toasts, the drawer and the tile.
- **Only Post-Trade raises alerts so far:** critical, for mismatched and failed trades, with a Resolve action that raises `harbor.ViewSettlement`. The six exceptions seeded in the history do not raise alerts on start-up; only new breaks do.
- **"Force a mismatch" is a dev-build button in the dev panel.** It raises a dev-only intent (`harbor.dev.ForceMismatch`, context `harbor.devCommand`) that Post-Trade handles by breaking its most recent healthy trade. The shell cannot reach into an app any other way, by design.
- **Acting on an alert after Post-Trade was closed reopens it on the trade, but without the mismatch detail** when the trade was made in this session. App state is not persisted (see Phase 6), so a reopened Post-Trade has forgotten the break.
- **The Operations template gained a tiles panel with the alerts tile; the Trader's tiles panel shows it beside the orders tile.**
- **The grid wrapper now applies a requested selection once the grid and its rows exist.** An app opened by an intent asked for a selection before its grid had loaded, and it was lost.

## Phase 8 — breadth

- **Cash, Payments and Research are real apps on their own ports** (5182, 5183, 5184). `pnpm dev` now starts eleven servers.
- **Partner News is "Wirefeed", built to behave like a third party.** It uses nothing of Harbor's except the agent client: its own stylesheet, its own invented headlines, its own origin (5175), and it ignores the host theme. It is the one place outside `tokens.css` where raw colours are allowed, and the token test names that exception.
- **The placeholder app became the "Interop Probe" dev tool,** served on two origins (5174 and 5181) as Probe A and Probe B. The Admin workspace uses them with the Context Inspector as the interop bench, and the interop acceptance tests run there.
- **Developer tools are left off the app rail.** They are in the Widget Library.
- **Cash policy: at most 25% of an account's cash in one fund, minimum rating AAm.** An account's cash is taken as 5% of its assets, and all amounts are treated as USD-equivalent. A redemption cannot exceed the holding. A breach disables Submit and names the rule.
- **Cash holdings last for the session only.** There is no backend to hold them.
- **Choosing "Deal" on a fund starts a fresh ticket** (subscribe, no amount), so nothing carries over from the previous fund.
- **Payments are kept in the Payments app's own browser storage,** keyed by seed. Two-step approval needs a second user, and switching user reloads every app, so the payment has to outlive the reload. The shell never sees it.
- **The maker of a payment sees the segregation-of-duties rule in place of the Approve and Reject buttons.**
- **A cross-currency payment needs an FX rate locked for 30 seconds before it can be submitted.** The rate comes from the price stream: the direct pair, its inverse, or through USD.
- **The tile group now uses react-grid-layout** (its v1-compatible API, as the installed version is 2.x). Tiles are moved by a small handle in their corner, so a click on the tile still does the tile's own job. The arrangement is saved per placement in the workspace file.
- **Adding a tile puts it in the workspace's tile group;** if there is none, a group is created for it. A tile is never its own panel.
- **A tile group hides tiles the user is not entitled to,** so each tile's own entitlement applies inside a group as well as in the library.
- **The unmatched-trades tile counts unmatched and mismatched trades.** It starts from the seeded history and follows `harbor.fxTrade` and `harbor.settlement` on its channel.
- **The cut-offs tile shows the next three distinct cut-offs** (one per currency and time), computed in each fund's own time zone, skipping weekends.
- **Cmd/Ctrl-K now opens the command palette;** the Widget Library opens from the rail or from the palette.
- **The palette only offers what the user may do.** An intent action appears only if the user may raise it and may launch an app that handles it; the agent enforces the same rules again when it is run.
- **"Recent orders" in the palette are the open orders,** from the same services the blotter uses. Palette actions on them need the blotter entitlement.
- **Fuzzy matching:** every word of the query must appear as a subsequence; whole words and word starts rank highest.
- **Apps forward shell shortcuts to the shell.** A key press inside an iframe never reaches the host page, so the agent client passes Cmd/Ctrl-K, F6 and Ctrl-Alt-arrows up. Without this the palette could not be opened while working in an app.
- **The directory is loaded once per page.** In dev mode it was loaded twice, which added the frame policy twice.
- **Treasury's workspace gained a tiles panel** (cut-offs and alerts); the Trader's and Operations' tiles panels gained the new tiles.

## Phase 9 — hardening

- **An iframe is not loaded until its panel is first shown.** The layout engine already defers a hidden tab's content; the shell builds on that and tells apps when they are shown or hidden.
- **Apps can opt out with `runsInBackground` in their directory record.** Post-Trade and TCA do: with no backend they only know about a fill if they were running when it was broadcast. The shell shows each such panel for an instant when a workspace loads so the layout engine mounts it.
- **A hidden app's price stream is paused, not its context.** It still receives broadcasts and intents; it just stops receiving ticks nobody can see. In-process widgets share one stream, so they are not paused individually.
- **FX Execution hands quotes to React at most once per animation frame,** like the rates tile.
- **Accessibility is checked three ways:** unit tests on the tokens (contrast, colour-blind simulation), an automated WCAG 2.1 A/AA scan of the shell and every app in the browser, and a browser check that every control is at least 24px. None of this replaces testing with a screen reader, which has not been done.
- **Contrast fixes from those tests:** stronger control borders in both themes, slightly darker buy and sell in the light theme, a darker magenta channel, and a text colour per channel (dark on six, white on two) instead of white on all.
- **Buttons whose visible text differs from an `aria-label` now take their name from their own content** (rail buttons, the bell, the profile menu), so what a speech user says matches what they see.
- **Scrollable areas in apps are focusable regions,** so they can be scrolled by keyboard.
- **The status bar draws its top line as an inset shadow,** which gives its controls the full 24px.
- **`?` opens the shortcut map,** except while typing in a field. Like the other shell shortcuts it is forwarded from inside apps.
- **Fills and critical alerts are announced through one polite live region in the shell,** at most one every two seconds; a burst is folded into "and N more". The shell learns of fills from the interop log.
- **A shell audit trail records every state-changing action the shell performs** (session start and end, workspace create, copy, rename, reset, import, delete, fork; panel add, close, channel and config changes; theme, density and the disconnect switch) with user, time, before and after. It is exported from the dev panel. Autosaves of layout are not recorded individually.
- **The interop log now shows the user for each entry.**
- **The agent drops queued intents and contexts after the delivery timeout and removes empty queues,** so an app that never listens leaves nothing behind. `agent.stats()` exposes the table sizes for leak tests.
- **Dev builds expose `window.__harbor.stats()`** for the browser leak test. It is not present in production builds.
- **The four components missing since Phase 0 are built** (RadioGroup, Tooltip, Popover, Combobox). "PanelChrome" is the panel tab in the shell rather than a separate shared component, because only the shell draws panels.
- **A Component Gallery dev widget is the demo page** for the shared components.
- **The golden path is one spec covering all twelve steps.** The per-phase tests are kept beside it because they check more detail.
- **Performance figures are measured on the dev servers.** There is no production-build performance test.
- **No CI workflow file was added.** The gates are `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm e2e`; wiring them into a pipeline affects the shared repository and was not asked for.

## Hosting

- **The hosted build serves every app from one host under `/harbor/<app>/`** (`scripts/build-hosted.mjs`). Static hosting gives one origin, so apps share it there; origin checks still run, and per-port origins remain the development and test setup.
- **A hosted directory uses relative URLs and the origin `"self"`,** which the shell resolves against the page when it loads the directory. The build script writes it from the dev directory, so there is still one source of truth.
- **The shell reads `directory.json` and `popout.html` relative to its base path,** so it works at `/` in development and under a path when hosted.
