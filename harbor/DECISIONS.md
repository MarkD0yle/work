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
