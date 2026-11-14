# Decisions log

Record judgement calls here. One entry per decision.

| Date | Decision | Why | Alternatives considered | Revisit when |
| --- | --- | --- | --- | --- |
| (spec) | Mock API on SQLite instead of a real engine | No engine access during build | Contract-only stubs | Engine owner agrees API.md |
| (spec) | Stand-in foundation (tokens + Radix) | Enterprise design system not available to the build | Build on a public design system | An enterprise DS is mandated |
| (spec) | AG Grid Community fallback | Enterprise licence may not exist | Build own grid | Licence confirmed |
| (spec) | No AI assistant in this phase; registry is assistant-ready | Governance first | Ship a chat panel early | After Milestone 6 |
| 2026-11-14 | Use shadcn/ui (Radix + Tailwind v4) for primitives. Tailwind is themed only through `--ll-*` token variables | Requested by the product owner. Overrides the original "No Tailwind, CSS Modules" rule. Radix stays underneath, so the "swap the foundation in one package" mitigation still holds | Keep CSS Modules over raw Radix | An enterprise design system is mandated |
| 2026-11-14 | shadcn/ui component source is written by hand in the registry's pattern, not pulled with the CLI | The build environment blocks the shadcn registry. The output is the same kind of owned source file | Wait for registry access | Registry reachable: new components can use `shadcn add`, then swap raw values for tokens |
| 2026-11-14 | React 19, not React 18 | Current shadcn/ui components pass `ref` as a prop, which needs React 19 | Pin older forwardRef-era shadcn source on React 18 | Never, unless a dependency forces 18 |
| 2026-11-14 | Latest majors where the spec named older ones: Storybook 10, Vite 8, Vitest 5, TypeScript 6 | Storybook 8 does not support Vite 8. TypeScript 7 is not yet supported by typescript-eslint | Pin the whole toolchain to 2024 versions | Tooling breaks |
| 2026-11-14 | Ledgerline lives in `ledgerline/` inside the existing `work` repository | The repository already holds other projects; Harbor set the same pattern | A new empty repository, as README assumed | Ledgerline moves to its own repository |
| 2026-11-14 | Seventh seeded user, Rafa (Reconciliation and Control) | SPEC §15 and the Milestone 6 exit gate depend on Rafa, but §3 seeded only six users, so the gate could not run | Give Rafa's steps to Cleo | Never |
| 2026-11-14 | Fay (admin) holds `approval.decide` | Segregation of duties needs a second approver for Cleo's reopen and block-override requests; no seeded user could approve them | Add a second controller | Real approval roles are known |
| 2026-11-14 | Contracts gained `User`, `ExperienceSegment`, `GridQuery`, `GridResponse` | `/me`, `/users` and every `/query` endpoint had no shared type. Additive, so a minor change | Keep them API-local | Never |
| 2026-11-14 | Zod mirror covers data contracts only; `ActionDef` and `ActionContext` have no schema | They hold functions and never cross the wire. Match is proven at compile time in `apps/api/src/schemas/contracts.type-test.ts` | Runtime-only checks | Actions are sent to an assistant (after Milestone 6) |
| 2026-11-14 | Seed uses a fixed "today" of 2026-11-14 and never reads the clock | Determinism: `pnpm db:reset` must give identical data every run. Relative filters ("yesterday") must resolve against the API's as-of date, not the wall clock | Seed relative to the real date | Milestone 2 (relative date filters) |
| 2026-11-14 | Decimals are stored as TEXT in SQLite | Money is never a float. Numeric sort and range filters will need a cast or a scaled-integer shadow column | REAL columns | Milestone 1 task 1.6 (server-side sort on amount) |
| 2026-11-14 | Server-side row model is Enterprise-only; the Community fallback for large grids will be the infinite row model | SPEC 7.1 requires server-side loading above 10,000 rows, and the transactions grid has 250,000. Without this the Milestone 1 gate is unreachable on Community | Block Milestone 1 on a licence | Licence confirmed |
| 2026-11-14 | The financial-number lint rule covers all of `packages/ui/src` and `packages/compositions/src`, not only "financial code" | A path-based rule cannot tell which file is financial; over-blocking is the safe side | A custom type-aware rule | It produces false positives that slow work |
| 2026-11-14 | axe rule `aria-hidden-focus` is skipped only while a modal menu is open | Radix hides the page behind an open menu and traps focus; axe cannot see the trap and reports a false positive | Disable the rule everywhere | axe or Radix changes behaviour |
| 2026-11-14 | Dev ports: web 5310, API 4310, Storybook 6006. E2E runs its own API on 4311 with its own database | Avoids clashing with the other apps in this repository and keeps tests off dev data | Default ports | Never |
