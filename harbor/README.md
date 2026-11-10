# Harbor

An interoperable desktop shell for institutional trading apps: one screen, one sign-in, and shared context between separate apps. Working title; all data is mock. The full specification is in [SPEC.md](SPEC.md) and every unprompted choice is in [DECISIONS.md](DECISIONS.md).

**All ten phases of the spec are built.** Every app in the directory is real, and the golden path (SPEC section 15) passes as one end-to-end spec. How it fits together and how it measures against the non-functional requirements is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run it

pnpm is required. If it is not installed, prefix commands with `npx -y pnpm@10`.

```bash
pnpm install
pnpm dev
```

Open http://localhost:5180 and pick a mock user. `pnpm dev` starts eleven servers:

| Port | App |
| --- | --- |
| 5180 | Shell |
| 5176 | Pre-Trade |
| 5177 | FX Execution |
| 5178 | Post-Trade |
| 5179 | TCA |
| 5182 | Cash |
| 5183 | Payments |
| 5184 | Research |
| 5175 | Partner News (plays a third party) |
| 5174, 5181 | Interop Probe dev tool, on two origins |

| Command | Does |
| --- | --- |
| `pnpm typecheck` | Type-check every package and app |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests with coverage (90% line threshold on `agent` and `schemas`) |
| `pnpm e2e` | Playwright acceptance tests (run `pnpm exec playwright install chromium` once) |
| `pnpm build` | Production builds of the apps |

## Layout

```
apps/shell          host page: chrome, Dockview layout, workspaces, agent bootstrap
apps/pretrade       pre-trade estimate: expected cost, liquidity, recommended method
apps/fx-exec        RFQ and algo execution
apps/post-trade     matching, exception queue, activity log
apps/tca            transaction cost analysis
apps/cash           money-market fund portal with an investment policy check
apps/payments       cross-border payments with rate lock and two-step approval
apps/research       research reader, tagged by pair
apps/partner-news   "Wirefeed": plays a third-party app, own look, agent client only
apps/placeholder    the Interop Probe dev tool, served on two origins
packages/agent      the interop broker, iframe bridge and interop log
packages/agent-client  FDC3-shaped client that apps and widgets use
packages/app-kit    bootstrap shared by every app: connect, session, listener hooks
packages/schemas    Zod schemas and types: contexts, directory, workspace file, wire protocol
packages/mock-data  seeded generators, price stream and the five mock services
packages/tokens     design tokens (CSS variables and a typed TS object)
packages/ui         shared components
packages/widgets    in-process widgets and tiles (Order Blotter, six tiles, dev tools)
docs                architecture notes and measured results
e2e                 Playwright specs
```

## Adding an app

Add one record to `apps/shell/public/directory.json` and deploy the app. Nothing in the shell changes: the rail, Widget Library, intent resolver, entitlement checks, origin checks and frame policy all read the directory. In the app, call `connect()` from `@harbor/agent-client`.

## The core loop

Sign in as the **Trader**. The FX Trading workspace runs the whole loop without typing an order twice:

1. Click the **Orders awaiting execution** tile: the blotter filters to those orders.
2. Select an order: **Pre-Trade** shows its expected cost, liquidity and a recommended method.
3. **Execute via RFQ**: **FX Execution** opens the ticket filled in and locked, and quotes stream from the suggested counterparties. Accept the best.
4. **TCA** shows the new trade at once; **Post-Trade** (the tab beside it) shows it unmatched, then matched a few seconds later.

## Keyboard

Press **?** anywhere for the full list. The main ones: **Cmd/Ctrl-K** command palette, **F6** next region, **Ctrl-Alt-arrows** next or previous panel, **Esc** close. They work from inside apps as well as from the shell.

## Command palette

Press **Cmd/Ctrl-K** anywhere, including inside an app. Type to search apps, open panels, workspaces, open orders and actions, for example `order 10401`, `news eurusd`, `tca gbpusd` or `send payment`. Arrow keys move, Enter runs. It only offers what the signed-in user is entitled to do.

## Alerts

Post-Trade raises a critical alert when a trade mismatches or fails. It appears as a toast, on the bell, in the alert drawer and on the alerts tile; **Resolve** opens Post-Trade on that exception. To trigger one, open **Interop log** in the status bar and press **Force a mismatch** (dev builds).

## Trying the interop layer

Sign in as the **Admin**. Each panel there is an interop probe:

- **Broadcast new order** in one panel appears in every other panel on the same channel. Change a panel's channel with the coloured square in its tab.
- **Execute order** routes to FX Execution. **View news** has two handlers, so the resolver asks.
- **Interop log** in the status bar shows everything the agent routed or refused, and has the disconnect switch.
- Switch user from the profile menu to see entitlements: Operations cannot see or reach FX Execution.

## Mock data

All data is generated from a seed, taken from `?seed=` in the address bar (default `harbor`). The same seed on the same day always gives the same funds, orders, trades and prices, in the shell and in every app. Add the **Mock Data** widget from the Widget Library to see the seed, a fingerprint of the dataset and the live price stream.
