import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colour, density, renderCss, themes } from './index';

/** WCAG relative luminance contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('tokens', () => {
  it('tokens.css is in step with the TS source', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    expect(css).toBe(renderCss());
  });

  it('density row heights follow SPEC §5 and control heights match', () => {
    expect([density.compact.rowHeight, density.standard.rowHeight, density.comfortable.rowHeight]).toEqual([
      24, 32, 40,
    ]);
    for (const d of Object.values(density)) expect(d.controlHeight).toBe(d.rowHeight);
  });

  it.each(themes)('%s theme text and status colours meet AA on every surface', (theme) => {
    const c = colour[theme];
    const foregrounds = [
      'text',
      'text-muted',
      'accent',
      'status-good',
      'status-warning',
      'status-critical',
      'status-info',
      'status-neutral',
    ] as const;
    for (const bg of ['bg', 'surface', 'surface-raised', 'surface-sunken'] as const) {
      for (const fg of foregrounds) {
        expect(contrast(c[fg], c[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(c['accent-contrast'], c.accent)).toBeGreaterThanOrEqual(4.5);
    // Non-text UI boundaries (inputs, focus rings) need 3:1.
    expect(contrast(c['border-strong'], c.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.focus, c.surface)).toBeGreaterThanOrEqual(3);
  });
});
