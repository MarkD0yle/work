import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Visual regression (PLAN 7.5): one baseline image per story, light theme, compared on every run.
 * A change that moves pixels has to be looked at and accepted on purpose: `pnpm test:visual --update-snapshots`.
 * Baselines are rendered in the CI container's fonts; refresh them there, not on a laptop.
 */
const STORYBOOK = 'http://localhost:6310';
interface StoryIndex {
  entries: Record<string, { id: string; title: string; name: string; type: string }>;
}
const index = JSON.parse(
  readFileSync(new URL('../storybook-static/index.json', import.meta.url), 'utf8'),
) as StoryIndex;
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');

test('the built Storybook contains stories to compare', () => {
  expect(stories.length).toBeGreaterThan(40);
});

for (const story of stories) {
  test(`${story.title} / ${story.name}`, async ({ page }) => {
    await page.goto(`${STORYBOOK}/iframe.html?id=${story.id}&viewMode=story&globals=a11y.manual:!true`);
    // A dialog story renders outside the root, in a portal.
    await page.locator('#storybook-root > *, [role="dialog"]').first().waitFor({ state: 'attached' });
    await page.evaluate(() => document.fonts.ready);
    // Grids draw their rows a moment after mounting.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`${story.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    });
  });
}
