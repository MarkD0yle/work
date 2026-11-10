# Harbor architecture

How the pieces fit, for someone about to change them. The requirements are in [SPEC.md](../SPEC.md); the reasons behind individual choices are in [DECISIONS.md](../DECISIONS.md).

## The shape

```
 shell (one page)
 ├── chrome: top bar, app rail, status bar, command palette, alert centre
 ├── layout: Dockview panels, saved as workspaces
 ├── agent: the interop broker ───────────────┐
 │                                             │ one API, two transports
 ├── widgets and tiles (in-process React) ─────┤ direct (same page)
 └── apps (sandboxed iframes, own origin) ─────┘ postMessage
```

The shell hosts; it does not trade. Every app is a separate build on its own origin. Apps never import each other and never share globals. The only way data moves between them is through the agent.

## The agent

`packages/agent` is plain TypeScript with no UI. `packages/agent-client` is what apps and widgets call. Its method names follow the FDC3 `DesktopAgent` interface (version 3.0), with a few Harbor extras.

| Capability | How it works |
| --- | --- |
| User channels | Eight fixed channels. A panel is on one or none; the panel chrome sets it. |
| Context | `broadcast` reaches listeners on the same channel. A late joiner is replayed the latest context of each type. |
| Intents | Resolved against the App Directory. One handler: routed directly, opening the app if needed. Several: the resolver dialog. None: a toast. |
| App channels | Named private channels, e.g. `harbor.orders` between the orders tile and the blotter. |
| Identity | `getUserInfo()` returns id, name, role and entitlements. No credentials exist. |
| Alerts | `publishAlert` puts an alert in the shell's alert centre. |
| Shell signals | Theme and density, mock connection state, panel visibility, forwarded keyboard shortcuts. |

### Security rules the agent enforces

- **Origin on every message.** An iframe's message is accepted only if it comes from that panel's own window and its origin is in the app's `allowedOrigins`. Anything else is dropped and logged.
- **Frame policy.** The shell's `frame-src` policy is built from the directory, so an origin no record names cannot be framed at all.
- **Entitlements.** Checked in the agent on `open` and `raiseIntent`, not only in the UI. An app the user may not launch is never offered by the launcher, library, palette or resolver.
- **Context validation.** Every context is checked against its Zod schema before it is routed.
- **Sandbox.** Iframes get `allow-scripts allow-same-origin allow-forms` and nothing more.

## Data

There is no backend. `packages/mock-data` builds everything from a seed (`?seed=`), so the same seed on the same day gives the same data in every app. Prices are a pure function of seed, pair and time, which is why separate apps agree on a price.

Each iframe app has its own copy of the services. Live changes travel as context: a fill in FX Execution reaches the blotter, Post-Trade, TCA and the tiles only as a `harbor.fxTrade` broadcast. A reload therefore forgets trades made in the session. Payments are the one exception: the Payments app keeps them in its own browser storage, because approval needs a second user.

## Adding an app

1. Build it anywhere. Call `connect()` from `@harbor/agent-client` (or use `mountApp` from `@harbor/app-kit` for the standard loading and error states).
2. Add one record to `apps/shell/public/directory.json`: its URL, `allowedOrigins`, the entitlement it needs, and the intents it handles.

Nothing in the shell changes. "Partner News" is the proof: it uses the agent client and nothing else of Harbor's.

Two directory options worth knowing:

- `runsInBackground: true` loads the app even while its panel is behind another tab. Without it an iframe is not loaded until first shown. Use it for apps that must keep up with their channel while hidden.
- `kind: "tile"` entries are added to the workspace's tile group rather than opened as panels.

## Where state lives

| State | Where | Lifetime |
| --- | --- | --- |
| Workspaces (layout, panels, channels, per-panel config) | IndexedDB, behind the async `WorkspaceStore` interface | Persistent, per user |
| Signed-in user, theme, density | localStorage | Persistent |
| Alerts | Shell memory | Session; cleared on user switch |
| Interop log, alert history, shell audit trail | Shell memory, append-only | Session; exportable as JSON from the dev panel |
| Orders, trades, settlement, cash holdings | Each app's memory | Until reload |
| Payments | Payments app's localStorage | Persistent |

## Measured against the non-functional requirements

Figures are from the end-to-end suite on the dev servers (unbundled modules, React in development mode), so a production build should do better.

| Requirement | Result | Checked by |
| --- | --- | --- |
| Shell interactive in under 2s, warm cache | About 1.4s | `e2e/hardening.spec.ts` |
| 12 panels with live prices at 55+ fps | 60 fps | `e2e/hardening.spec.ts` |
| Price updates batched per animation frame | Rates tile, Mock Data widget and FX Execution quotes | Code review |
| Background tabs lazy-loaded, streams paused | Yes, except apps marked `runsInBackground` | `e2e/hardening.spec.ts`, unit tests |
| WCAG 2.1 A and AA | No violations found by an automated scan of the shell, its overlays and every app, in both themes | `e2e/hardening.spec.ts` |
| Contrast 4.5:1 text, 3:1 UI | Checked on the tokens for both themes | `packages/tokens/src/contrast.test.ts` |
| Buy/sell distinct under colour blindness | Simulated protanopia, deuteranopia and tritanopia | `packages/tokens/src/contrast.test.ts` |
| Targets at least 24px | Every control in the shell and every app, both densities | `e2e/hardening.spec.ts` |
| Keyboard: shortcut map, F6, Ctrl-Alt-arrows | Work from the shell and from inside apps | `e2e/hardening.spec.ts` |
| Fills and critical alerts announced | Polite live region, at most one every two seconds | Unit and end-to-end tests |
| An app crash never takes down the shell | Error boundary per panel; agent unaffected | `e2e/hardening.spec.ts` |
| Corrupt workspace falls back and is kept | Yes | `e2e/hardening.spec.ts`, unit tests |
| No leaks on panel close | Agent tables, iframes and DOM return to baseline after repeated open and close | `e2e/hardening.spec.ts`, unit tests |
| Logs append-only and exportable | Interop log, alert history, audit trail, settlement activity | Unit and end-to-end tests |
| 90% line coverage on agent and schemas | 99% | `pnpm test` |

An automated scan finds only part of what WCAG covers. It has not been tested with a screen reader by a person.
