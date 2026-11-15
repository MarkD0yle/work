import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const STORYBOOK = 'http://localhost:6310';
const THEMES = ['light', 'dark'] as const;

/** Definition of done: zero serious or critical violations against WCAG 2.2 AA. */
async function expectNoSeriousViolations(page: Page) {
  let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  // An open modal menu hides the rest of the page with aria-hidden and traps focus inside itself.
  // axe cannot see the focus trap, so it reports the hidden trigger as focusable. Only skipped while a menu is open.
  if (await page.getByRole('menu').count()) axe = axe.disableRules(['aria-hidden-focus']);
  const results = await axe.analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
}

const routes = [
  '/',
  '/portfolios',
  '/securities',
  '/transactions',
  '/market-data',
  '/cash',
  '/accounting',
  '/reports',
  '/admin',
  '/unknown',
];

for (const theme of THEMES) {
  test.describe(`routes, ${theme}`, () => {
    for (const route of routes) {
      test(route, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem(
            'll-session',
            JSON.stringify({
              state: { userId: 'u-ben', theme: t, density: null, railCollapsed: false },
              version: 0,
            }),
          );
        }, theme);
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        if (route === '/') await expect(page.getByRole('table')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expectNoSeriousViolations(page);
      });
    }
  });
}

for (const theme of THEMES) {
  test(`transactions with the detail panel and filter tags open, ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: 'u-ada', theme: t, density: null, railCollapsed: false },
          version: 0,
        }),
      );
    }, theme);
    await page.goto('/transactions');
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('TREASURY');
    await expect(page.getByRole('list', { name: 'Active filters' })).toBeVisible();
    await page.locator('.ag-row[row-index="0"] [col-id="type"]').first().dblclick();
    const panel = page.getByRole('complementary', { name: 'Transaction detail' });
    await expect(panel.getByLabel('Amount', { exact: true })).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

interface StoryIndex {
  entries: Record<string, { id: string; title: string; name: string; type: string }>;
}

// `a11y.manual` stops Storybook's own addon running axe in the page at the same time as this test.
// The story list comes from the built Storybook, so a new story is covered without touching this file.
const index = JSON.parse(
  readFileSync(new URL('../storybook-static/index.json', import.meta.url), 'utf8'),
) as StoryIndex;
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');

test('the built Storybook contains stories', () => {
  expect(stories.length).toBeGreaterThan(10);
});

for (const theme of THEMES) {
  test.describe(`stories, ${theme}`, () => {
    for (const story of stories) {
      test(`${story.title} / ${story.name}`, async ({ page }) => {
        await page.goto(
          `${STORYBOOK}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme};a11y.manual:!true`,
        );
        await page.locator('#storybook-root > *, [data-radix-popper-content-wrapper]').first().waitFor();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expectNoSeriousViolations(page);
      });
    }
  });
}
