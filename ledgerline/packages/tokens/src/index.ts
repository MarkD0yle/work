/**
 * @ledgerline/tokens
 * Design tokens. This file is the source; `tokens.css` is generated from it
 * (`pnpm --filter @ledgerline/tokens build`) and a test keeps the two in step.
 * Imports nothing.
 */

export const themes = ['light', 'dark'] as const;
export type Theme = (typeof themes)[number];

export const densities = ['compact', 'standard', 'comfortable'] as const;
export type DensityName = (typeof densities)[number];

type ColourTokens = Record<
  | 'bg'
  | 'surface'
  | 'surface-raised'
  | 'surface-sunken'
  | 'border'
  | 'border-strong'
  | 'text'
  | 'text-muted'
  | 'accent'
  | 'accent-contrast'
  | 'focus'
  | 'status-good'
  | 'status-warning'
  | 'status-critical'
  | 'status-info'
  | 'status-neutral',
  string
>;

/** Text and status colours meet WCAG AA (4.5:1) on bg, surface and surface-raised. */
export const colour: Record<Theme, ColourTokens> = {
  light: {
    bg: '#f6f7f9',
    surface: '#ffffff',
    'surface-raised': '#ffffff',
    'surface-sunken': '#eceef2',
    border: '#d6dae1',
    'border-strong': '#7d8798',
    text: '#161a22',
    'text-muted': '#535d6e',
    accent: '#1d58b3',
    'accent-contrast': '#ffffff',
    focus: '#1d58b3',
    'status-good': '#17703f',
    'status-warning': '#8a5300',
    'status-critical': '#b3261e',
    'status-info': '#0b6394',
    'status-neutral': '#535d6e',
  },
  dark: {
    bg: '#0f1217',
    surface: '#161a21',
    'surface-raised': '#1d222b',
    'surface-sunken': '#0b0d11',
    border: '#2d3440',
    'border-strong': '#6b7687',
    text: '#e7eaf0',
    'text-muted': '#a0aabb',
    accent: '#86b4ff',
    'accent-contrast': '#0f1217',
    focus: '#86b4ff',
    'status-good': '#5fce8d',
    'status-warning': '#f0b84a',
    'status-critical': '#ff8f85',
    'status-info': '#6cc4f5',
    'status-neutral': '#a0aabb',
  },
};

export const font = {
  ui: "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

/** px */
export const fontSize = [11, 12, 13, 14, 16, 20, 24] as const;
/** px */
export const space = [2, 4, 8, 12, 16, 24, 32, 48] as const;
/** px */
export const radius = [2, 4, 8] as const;
/** ms */
export const motion = { fast: 120, base: 200 } as const;

export interface DensityTokens {
  /** Grid row height, px. */
  rowHeight: number;
  /** Button, input and select height, px. Matches the row height. */
  controlHeight: number;
  /** Body font size, px. */
  fontSize: number;
  /** Horizontal cell and control padding, px. */
  paddingX: number;
}

export const density: Record<DensityName, DensityTokens> = {
  compact: { rowHeight: 24, controlHeight: 24, fontSize: 12, paddingX: 8 },
  standard: { rowHeight: 32, controlHeight: 32, fontSize: 13, paddingX: 12 },
  comfortable: { rowHeight: 40, controlHeight: 40, fontSize: 14, paddingX: 16 },
};

export const defaultTheme: Theme = 'light';
export const defaultDensity: DensityName = 'standard';

const px = (n: number) => `${n}px`;

function block(selector: string, vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `  --ll-${k}: ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

const densityVars = (d: DensityTokens) => ({
  'row-height': px(d.rowHeight),
  'control-height': px(d.controlHeight),
  'font-size-body': px(d.fontSize),
  'padding-x': px(d.paddingX),
});

/** Renders every token as CSS variables. Theme switches on `data-theme`, density on `data-density`. */
export function renderCss(): string {
  const staticVars: Record<string, string> = {
    'font-ui': font.ui,
    'font-mono': font.mono,
    ...Object.fromEntries(fontSize.map((s) => [`font-size-${s}`, px(s)])),
    ...Object.fromEntries(space.map((s) => [`space-${s}`, px(s)])),
    ...Object.fromEntries(radius.map((r) => [`radius-${r}`, px(r)])),
    'motion-fast': `${motion.fast}ms`,
    'motion-base': `${motion.base}ms`,
  };
  return [
    '/* Generated from src/index.ts by scripts/build-css.ts. Do not edit by hand. */',
    block(':root', { ...staticVars, ...colour[defaultTheme], ...densityVars(density[defaultDensity]) }),
    ...themes.map((t) => block(`[data-theme='${t}']`, colour[t])),
    ...densities.map((d) => block(`[data-density='${d}']`, densityVars(density[d]))),
    `@media (prefers-reduced-motion: reduce) {\n  :root {\n    --ll-motion-fast: 0ms;\n    --ll-motion-base: 0ms;\n  }\n}`,
    '',
  ].join('\n\n');
}
