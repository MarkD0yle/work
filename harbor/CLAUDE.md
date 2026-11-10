# Harbor — builder rules

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
- Border radius is 0 everywhere (repo-wide rule). Keep `--radius-*` tokens at 0.
