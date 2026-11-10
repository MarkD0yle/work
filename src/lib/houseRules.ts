/* House rules — what every screen in this repo is expected to follow.
 *
 * Brief Builder prints the selected rules into the prompt it assembles, and
 * Drift Radar's fix prompt quotes the three it can measure. Keep each rule to
 * one instruction an AI assistant can act on without more context. */

export type HouseRule = {
  id: string;
  label: string;
  /** The sentence that goes into the prompt. */
  instruction: string;
  /** On by default in Brief Builder. */
  core: boolean;
};

export const HOUSE_RULES: HouseRule[] = [
  {
    id: "radius",
    label: "Square corners",
    instruction:
      "Use square corners everywhere. Only `rounded-none` is allowed on containers and controls; `rounded-full` is allowed for pills and dots.",
    core: true,
  },
  {
    id: "colour",
    label: "No raw hex colours",
    instruction:
      "Do not write hex colours. Use Tailwind colour classes, or the tone and surface tokens in `src/components/patterns/tokens.ts`.",
    core: true,
  },
  {
    id: "inline-style",
    label: "No inline styles",
    instruction:
      "Do not use the `style` prop. Express layout and colour with Tailwind classes.",
    core: true,
  },
  {
    id: "patterns",
    label: "Pattern library first",
    instruction:
      "Before building a new component, check `src/components/patterns/index.ts` and reuse what exists. Import patterns from `../components/patterns`.",
    core: true,
  },
  {
    id: "single-file",
    label: "One file per screen",
    instruction:
      "A screen is one file in `src/pages`. It is picked up automatically; do not edit `src/App.tsx` or add a router.",
    core: true,
  },
  {
    id: "mock-data",
    label: "Mock data only",
    instruction:
      "There is no backend. Use realistic mock data defined in the file, with deterministic values (no `Math.random` during render).",
    core: true,
  },
  {
    id: "english",
    label: "English only",
    instruction:
      "Write all UI copy, comments and commit messages in English.",
    core: true,
  },
  {
    id: "a11y",
    label: "Keyboard and screen reader",
    instruction:
      "Every control must be reachable by keyboard, show a visible focus state, and have an accessible name.",
    core: false,
  },
  {
    id: "responsive",
    label: "Works at 390px wide",
    instruction:
      "The layout must work from 390px wide upwards with no horizontal page scroll.",
    core: false,
  },
  {
    id: "motion",
    label: "Respect reduced motion",
    instruction:
      "Any animation must stop under `prefers-reduced-motion: reduce`.",
    core: false,
  },
];
