# Harbor

An interoperable desktop shell for institutional trading apps: one screen, one sign-in, and shared context between separate apps. Working title; all data is mock. The full specification is in [SPEC.md](SPEC.md) and every unprompted choice is in [DECISIONS.md](DECISIONS.md).

**Built so far: Phases 0–4** (scaffold, layout, workspaces, directory and library, interop agent). The trading apps themselves (Phases 5–9) are placeholders.

## Run it

pnpm is required. If it is not installed, prefix commands with `npx -y pnpm@10`.

```bash
pnpm install
pnpm dev
```

Open http://localhost:5180 and pick a mock user. `pnpm dev` starts three servers: the shell (5180), the placeholder app (5174) and the same app on a second origin for Partner News (5175).

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
apps/placeholder    stand-in for every iframe app until its real build lands
packages/agent      the interop broker, iframe bridge and interop log
packages/agent-client  FDC3-shaped client that apps and widgets use
packages/schemas    Zod schemas and types: contexts, directory, workspace file, wire protocol
packages/tokens     design tokens (CSS variables and a typed TS object)
packages/ui         shared components
packages/widgets    in-process widgets (currently the Context Inspector)
e2e                 Playwright specs
```

## Adding an app

Add one record to `apps/shell/public/directory.json` and deploy the app. Nothing in the shell changes: the rail, Widget Library, intent resolver, entitlement checks, origin checks and frame policy all read the directory. In the app, call `connect()` from `@harbor/agent-client`.

## Trying the interop layer

Sign in as the Trader. Each panel is an interop probe:

- **Broadcast new order** in one panel appears in every other panel on the same channel. Change a panel's channel with the coloured square in its tab.
- **Execute order** routes to FX Execution. **View news** has two handlers, so the resolver asks.
- **Interop log** in the status bar shows everything the agent routed or refused, and has the disconnect switch.
- Switch user from the profile menu to see entitlements: Operations cannot see or reach FX Execution.
