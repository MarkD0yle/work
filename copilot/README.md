# Copilot

Everything GitHub Copilot uses to rebuild, check and grade the screens in this
repo, in one place. Nothing here is part of the running app.

```
copilot/
  handoffs/   specs that tell Copilot how to rebuild screens in OneDS exactly as they are
  rubric/     the rules screens are checked and graded against
  grades/     finished grade reports
  anchors/    reference examples for each grading dimension (empty for now)
  specs/      design specs written before a build
```

## Handoffs — rebuild a screen in OneDS

Start here when you want Copilot to port a screen. Each package holds a spec
(`README.md`), the original code (`reference/`) and, where present, a ready
prompt file and screenshots. Copy the whole package folder into the target repo.

| Package | Covers | Prompt file | Screenshots |
|---|---|---|---|
| [`handoffs/fi-studio-oneds/`](handoffs/fi-studio-oneds/README.md) | The five FI Studio screens (credit map, get quotes, order ticket, BWIC, curve ideas) | Yes — 6 runs | Yes — 13 |
| [`handoffs/pre-trade-checks-oneds/`](handoffs/pre-trade-checks-oneds/README.md) | Pre-Trade Checks screen | No | No |
| [`handoffs/right-panels-oneds/`](handoffs/right-panels-oneds/README.md) | 11 contextual right panels | No | No |
| [`handoffs/rebuild-all-designs.prompt.md`](handoffs/rebuild-all-designs.prompt.md) | Every screen, in batches | Is the prompt | No |

## Rubric — check and grade a screen

1. [`rubric/gates.md`](rubric/gates.md) — yes/no checks. Any failure stops the screen.
2. [`rubric/composition-rubric.md`](rubric/composition-rubric.md) — graded dimensions, run only after every gate passes.

The `grade-screen` skill runs both and writes a report to `grades/`. The skill
itself stays in [`.github/skills/grade-screen/`](../.github/skills/grade-screen/SKILL.md),
because GitHub only finds skills there.

## Specs

| Spec | About |
|---|---|
| [`specs/fund-connect-modernization.md`](specs/fund-connect-modernization.md) | Fund Connect modernization |
| [`specs/2026-07-05-loading-splash-design.md`](specs/2026-07-05-loading-splash-design.md) | Loading splash |

## Adding something new

- New handoff → `handoffs/<screen>-oneds/` with `README.md`, `reference/`,
  a `.prompt.md` and `screenshots/`. Use `fi-studio-oneds` as the template.
- New grade → `grades/<screen>-<NNN>.md`.
- New spec → `specs/`.
