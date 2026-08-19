import { useState } from "react";

export const title = "Hero Animation Guide";
export const section = "patterns";
export const fullWidth = true;

/* Hero Animation Guide — a linear, copy-one-section-at-a-time recipe for
 * rebuilding the "wireframes in, high-fidelity out" looping hero animation
 * (source: ~/Downloads/copilot-package/BRIEF.md + state-street-anim-v3.jsx)
 * via Copilot Chat, without transferring the actual .jsx file. Each step is
 * a self-contained prompt; later prompts assume earlier ones are in place. */

type Step = {
  id: string;
  title: string;
  blurb: string;
  prompt: string;
};

const STEPS: Step[] = [
  {
    id: "objective",
    title: "1. Objective & constraints",
    blurb: "What the animation is, and the rules it has to build within.",
    prompt:
      "Build a looping hero animation in React using Framer Motion. Style it only through our design system: import UI primitives from @ssds/ui, and colors/spacing from --ssds-* CSS custom properties — no hardcoded hex/rgb colors, no raw px spacing, no inline style={{ }} beyond what the theme layer requires. Concept ('wireframes in, high-fidelity out'): a cream honeycomb stage where small wireframe/atomic-element cards drift inward and disappear into a dark hexagon mark (our logo), while labeled outcome pills fly outward from that same point and settle into a column on the right. The scene loops seamlessly every 7 seconds — the very last frame must match the very first frame exactly, with no visible jump or reset.",
  },
  {
    id: "tokens",
    title: "2. Token mapping",
    blurb: "Every color routes through a token — none are final yet.",
    prompt:
      "Define every color used by this animation as a CSS custom property reference, using this hex → token mapping. The real token names aren't confirmed yet, so use these placeholder names and add a `// TODO: verify SSDS token name` comment next to each one so they're easy to find and swap later:\n\n#1b2ff5 (brand primary)      -> --ssds-color-brand-primary\n#0b1f5b (brand navy)         -> --ssds-color-brand-secondary\n#2563eb (info accent)        -> --ssds-color-semantic-info\n#15803d (success accent)     -> --ssds-color-semantic-success\n#b45309 (warning accent)     -> --ssds-color-semantic-warning\n#dc2626 (danger accent)      -> --ssds-color-semantic-danger\n#28303f (primary text)       -> --ssds-color-text-primary\n#8b8577 (secondary text)     -> --ssds-color-text-secondary\n#faf9f6 (stage background)   -> --ssds-color-bg-canvas\n#ffffff (card/pill surface)  -> --ssds-color-bg-surface\nrgba(170,160,145,.35) card border   -> --ssds-color-border-subtle\nrgba(170,160,145,.38) pill border   -> --ssds-color-border-default\nInter (body font)            -> --ssds-font-body\n\nThe neutral skeleton-line fills inside each card (two grays: roughly rgba(148,155,168,*) and rgba(110,118,134,*), used at varying opacity) don't have a token yet either — introduce placeholder names like --ssds-color-skeleton-primary / --ssds-color-skeleton-secondary and flag those the same way. Definition of done for this step: zero hardcoded hex/rgba values remain anywhere in the component — everything routes through one of these variables, even the placeholders.",
  },
  {
    id: "scene-data",
    title: "3. Scene layout data",
    blurb: "Exact positions, sizes and timing offsets — reproduce as-is.",
    prompt:
      "Define the scene's content as typed data (not JSX) on a 1280x720 stage, with the hexagon/logo centered at (632, 360). Render ALL of the foreground items below — this is the production 'busy' density, not a reduced/sampled subset.\n\nForeground tiles (x, y, size, kind, color token, phase offset 0-1):\n148,178, 72, nav,    brand-secondary, 0.00\n330,148, 62, stat,   brand-primary,   0.09\n244,332, 80, table,  semantic-info,   0.18\n122,438, 66, btn,    semantic-warning,0.27\n396,296, 58, chart,  semantic-success,0.36\n206,548, 74, form,   brand-secondary, 0.45\n424,506, 64, layout, brand-primary,   0.55\n82, 300, 58, ui,     semantic-info,   0.64\n470,160, 56, form,   semantic-success,0.73\n320,430, 60, stat,   brand-secondary, 0.82\n168,92,  54, chart,  brand-primary,   0.91\n\nBackground tiles (x, y, size, kind, color token, base opacity, bob-speed k):\n66, 116, 46, ui,     brand-secondary, 0.16, 0.4\n502,168, 52, form,   semantic-success,0.22, 1.2\n84, 602, 48, chart,  brand-primary,   0.14, 2.1\n348,644, 40, btn,    semantic-info,   0.17, 2.8\n528,566, 46, nav,    semantic-warning,0.20, 3.5\n300,64,  42, table,  brand-secondary, 0.15, 4.2\n\nForeground pills (x, y, label, tag, color token, phase offset):\n900, 140, 'Finance Overview Dashboard', DASH,   brand-primary,   0.02\n1066,200, 'Contextual Panel',            PANEL,  semantic-info,   0.13\n872, 254, 'Toolbar System',              UI,     semantic-warning,0.24\n1050,312, 'Client Onboarding Flow',      FLOW,   semantic-success,0.35\n888, 368, 'Filter & Facet System',       FILTER, brand-secondary, 0.46\n1072,424, 'Alpha Trade Ticket',          TICKET, semantic-warning,0.57\n866, 480, 'Conditional Logic Builder',   LOGIC,  semantic-danger, 0.68\n1044,536, 'Research Landing Page',       PAGE,   brand-primary,   0.79\n902, 592, 'Portfolio Risk Report',       REPORT, semantic-danger, 0.90\n\nBackground pills (x, y, label, tag, color token, base opacity, bob-speed k):\n1030,96,  'Fund Fact Sheet',    PAGE,   semantic-info,   0.20, 0.8\n840, 62,  'Risk Alert Modal',   UI,     semantic-warning,0.14, 1.7\n1080,656, 'Settlement Tracker', DASH,   brand-secondary, 0.17, 2.5\n830, 640, 'Client Review Deck', REPORT, semantic-success,0.13, 3.3",
  },
  {
    id: "components",
    title: "4. Card, pill and mark components",
    blurb: "Three small pieces the scene is built from.",
    prompt:
      "Build three presentational components:\n\n1. A wireframe Tile card: a bordered, rounded surface (per SSDS tokens) with a header bar plus a body whose internal composition depends on its `kind`: 'nav' (a row of 3 tab-like bars + a box + 3 lines), 'stat' (2 side-by-side boxes + a large number line + 3 text lines), 'table' (a 3x3 grid of cells, first row styled darker as a header), 'chart' (6 bars of varying height + 2 lines), 'form' (3 label+input row pairs + a button-shaped bar), 'layout' (a narrow 3-box sidebar column + a main column with one large box and 3 lines), 'ui' (a circular avatar + 2 lines, then a large box, then 2 more lines), and 'btn' (a single centered pill-shaped bar). All skeleton content (lines, boxes) uses the neutral skeleton tokens from Step 2 — the tile's assigned color token is NOT used to style the card body itself in the source design; treat it as reserved metadata for now (e.g. a future accent dot or legend color) rather than wiring it into the skeleton fills, unless you have a design reason to use it.\n\n2. A Pill chip: a small rounded surface with a leading logo mark icon and a single line of label text, no wrapping.\n\n3. A pulsing logo mark: our brand mark as an SVG glyph, scaling gently up and down. Name this component for what it actually does (e.g. PulsingLogo) — don't name it after a hexagon shape just because it sits inside a honeycomb-styled stage; it doesn't draw a hexagon, it's the logo with a breathing-scale animation.",
  },
  {
    id: "motion-math",
    title: "5. Motion math — preserve exactly",
    blurb: "Phase-driven formulas, not keyframe percentages.",
    prompt:
      "Drive every animated value from Framer Motion's time-based APIs (e.g. useTime / useAnimationFrame), not fixed keyframe percentages or named CSS easings — the loop only stays seamless if this math runs exactly as written:\n\nGlobal phase: ph = elapsedSeconds / 7 (7-second loop)\n\nFor each foreground TILE with its own phase offset `off`:\n  u = frac(ph + off)                          // frac = fractional part\n  m = u ^ 2.6                                 // inbound easing — keep this exact exponent\n  position = lerp(homePos, hexagonCenter, m)\n  opacity = clamp01(u / 0.07) * (1 - clamp01((m - 0.78) / 0.22))\n  blur = 7px * clamp01((m - 0.45) / 0.55)      // ramps in only in the back half of the approach\n  scale = 1 - 0.4 * m\n  verticalBob = sin(ph * 2π + tileIndex) * 4px * (1 - m)   // bob fades out as the tile approaches\n\nFor each foreground PILL with its own phase offset `off`:\n  u = frac(ph + off)\n  m = 1 - (1 - u) ^ 3                          // outbound easing — keep this exact exponent\n  position = lerp(hexagonCenter, homePos, m)\n  opacity = clamp01(u / 0.05) * (1 - clamp01((u - 0.9) / 0.08))\n  blur = 6px * (1 - m) ^ 2\n  scale = lerp(0.55, 1, m)\n  verticalBob = sin(ph * 2π + pillIndex * 1.4) * 3.5px * m   // bob fades in as the pill settles\n\nLogo pulse (drives the mark's scale, roughly ±4% around its base size):\n  pulse = 0.5 + 0.5 * sin(ph * 2π * 2 - π/2)\n\nBackground tiles/pills don't ease toward the hexagon at all — they just sit at their fixed position with a slow vertical bob: y = baseY + sin(ph * 2π + k) * amplitude, using their own per-item `k` value, at a constant low opacity.\n\nVerify the loop is seamless by rendering at ph=0 and ph≈0.9999 and confirming the two frames match.",
  },
  {
    id: "compositing",
    title: "6. Stage & compositing order",
    blurb: "Layer order, from cream backdrop to logo on top.",
    prompt:
      "Render the stage as a fixed 1280x720 area (scale it responsively with a wrapper, don't change the internal coordinate system) with a solid cream (--ssds-color-bg-canvas) background. Stack layers bottom to top: (1) background tiles — low opacity, a faint blur, gentle bob only, (2) background pills — same treatment with slightly more blur, (3) foreground tiles per Step 5's inbound motion, (4) foreground pills per Step 5's outbound motion, (5) the pulsing logo mark from Step 4, centered at (632, 360), always on top and never faded or blurred.",
  },
  {
    id: "hardening",
    title: "7. Production hardening",
    blurb: "Strip everything that was prototype-only tooling.",
    prompt:
      "Clean up before this ships: (1) hardcode density to render all 11 foreground tiles and all 9 foreground pills from Step 3 — there is no density toggle in production. (2) Hardcode motion blur on — there is no blur toggle in production. (3) Hardcode the loop duration to 7 seconds. (4) Don't port any dev-only tweak/control panel, settings state, or global config object — none of that ships. (5) Don't port any unused/dead code — if you generate a decorative pattern, gradient, or asset that never actually gets rendered anywhere, delete it rather than leaving it defined.",
  },
  {
    id: "a11y",
    title: "8. Reduced-motion support",
    blurb: "A new requirement — not in the original prototype.",
    prompt:
      "Add a prefers-reduced-motion branch: when the user's OS/browser requests reduced motion, skip the animation loop entirely and render the settled end state instead — every tile hidden (as if fully absorbed), every pill at its final resting position and full opacity, no blur, no bob, no pulse on the logo. This wasn't part of the original prototype; treat it as a hard requirement for production.",
  },
  {
    id: "done",
    title: "9. Definition of done",
    blurb: "Checklist to run before this goes near the Markets squad.",
    prompt:
      "Before calling this done, confirm: zero hardcoded hex/rgba colors remain anywhere (everything routes through a --ssds-* token, even placeholders awaiting the real name); the loop is verified seamless at ph=0 vs ph≈0.9999; all 11 tiles and 9 pills render every cycle; there is no tweak panel, dev toggle, or leftover global config dependency; the loop runs at exactly 7 seconds; prefers-reduced-motion renders the fully settled state. Then run it through your team's normal review gate — import-source gate on @ssds/ui only, token-only styling, no inline styles — followed by a composition grade on the FACT dimensions, the same bar as any other design-system deliverable, before it goes anywhere near the Markets squad.",
  },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {
        /* clipboard may be unavailable (e.g. insecure context) — ignore */
      },
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy prompt: ${label}`}
      className="shrink-0 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-700 hover:text-white"
    >
      {copied ? "Copied!" : "Copy prompt"}
    </button>
  );
}

export default function HeroAnimationGuide() {
  return (
    <div className="h-screen overflow-y-auto bg-white text-neutral-900">
      {/* ---------- Hero ---------- */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-4xl px-8 py-16">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Plan B
          </div>
          <h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Rebuild the hero animation with Copilot — no file transfer
            required
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-500">
            The "wireframes in, high-fidelity out" looping hero, from brief
            to finished component, in {STEPS.length} prompts. Paste one into
            Copilot Chat, let it finish and generate the files, review the
            diff, then move to the next — later prompts assume the earlier
            ones are already in place.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-neutral-600">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
              Work through the steps in order — the motion math in Step 5
              depends on the data from Step 3 and the components from Step
              4.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
              Step 2's token names are placeholders — swap in the real
              --ssds-* names once the design system team confirms them.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
              Don't skip Step 9 — the gate/grade review is what clears this
              for the Markets squad.
            </li>
          </ul>
        </div>
      </section>

      {/* ---------- Steps ---------- */}
      <section className="mx-auto max-w-4xl px-8 py-12">
        <div className="space-y-6">
          {STEPS.map((step) => (
            <article
              key={step.id}
              className="border border-neutral-200 bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">
                    {step.title}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                    {step.blurb}
                  </p>
                </div>
                <CopyButton text={step.prompt} label={step.title} />
              </div>
              <pre className="overflow-x-auto bg-neutral-900 px-5 py-4 text-xs leading-relaxed text-neutral-100">
                <code className="whitespace-pre-wrap font-mono">
                  {step.prompt}
                </code>
              </pre>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
