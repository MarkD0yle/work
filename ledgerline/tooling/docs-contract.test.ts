import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The Draft-tier contract (SPEC §13): every asset's page has these fields, in this order. */
const FIELDS = [
  'Purpose',
  'When to use, and when not',
  'Foundations',
  'States',
  'Data contract',
  'Permissions',
  'Accessibility',
  'Code reference',
];
const root = join(import.meta.dirname, '..');
const folders = ['packages/ui/src/docs', 'packages/compositions/src/docs'];
const pages = folders.flatMap((folder) =>
  readdirSync(join(root, folder))
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => join(folder, f)),
);

describe('asset documentation', () => {
  it('covers the eleven capabilities and the compositions', () => {
    expect(pages.filter((p) => p.startsWith('packages/ui'))).toHaveLength(11);
    expect(pages.filter((p) => p.startsWith('packages/compositions')).length).toBeGreaterThanOrEqual(7);
  });

  it.each(pages)('%s has every Draft-tier field, filled in', (page) => {
    const text = readFileSync(join(root, page), 'utf8');
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual(FIELDS);
    for (const section of text.split(/^## .+$/m).slice(1))
      expect(section.trim().length, page).toBeGreaterThan(40);
    // No capability is marked Stable, or Draft, without user evidence.
    expect(text).toMatch(/\*\*Status:\*\* Hypothesis\./);
    expect(text).toMatch(/<Meta title="Docs\//);
  });
});
