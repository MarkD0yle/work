import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const STORYBOOK = 'http://localhost:6310';
const THEMES = ['light', 'dark'] as const;

/** Definition of done: zero serious or critical violations against WCAG 2.2 AA. */
async function expectNoSeriousViolations(page: Page) {
  let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  // An open modal menu or dialog hides the rest of the page with aria-hidden and traps focus inside itself.
  // axe cannot see the focus trap, so it reports the hidden trigger as focusable. Only skipped while a menu is open.
  if ((await page.getByRole('menu').count()) || (await page.getByRole('dialog').count()))
    axe = axe.disableRules(['aria-hidden-focus']);
  const results = await axe.analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
}

const routes = [
  '/profile',
  '/portfolios',
  '/securities',
  '/transactions?view=V-transactions-default',
  '/market-data',
  '/cash',
  '/accounting',
  '/reports',
  '/jobs',
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
        if (route === '/profile') await expect(page.getByRole('table')).toBeVisible();
        if (route === '/jobs' || route === '/accounting' || route === '/market-data') {
          // Rows fade in as they load; wait for them to settle before measuring contrast.
          await expect(page.locator('.ag-row').first()).toBeVisible();
          await page.waitForTimeout(500);
        }
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
    await page.goto('/transactions?view=V-transactions-default');
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('TREASURY');
    await expect(page.getByRole('list', { name: 'Active filters' })).toBeVisible();
    // The transaction id column is pinned, so it is on screen wherever the grid has scrolled to.
    await page.locator('.ag-row[row-index="0"] [col-id="id"]').first().click();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Transaction detail' });
    await expect(panel.getByLabel('Amount', { exact: true })).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

for (const theme of THEMES) {
  test(`workspace with tabs, and its edit dialog, ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: 'u-ada', theme: t, density: null, railCollapsed: false },
          version: 0,
        }),
      );
    }, theme);
    await page.goto('/w/W-txn-ops');
    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(page.locator('[data-slot="status-bar"]')).toContainText('rows');
    await expectNoSeriousViolations(page);
    await page.getByRole('button', { name: 'Edit workspace' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit workspace' })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test(`transactions with the Entity Picker open on restricted records, ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: 'u-eli', theme: t, density: null, railCollapsed: false },
          version: 0,
        }),
      );
    }, theme);
    await page.goto('/transactions?view=V-transactions-default');
    await page.getByRole('combobox', { name: 'Portfolio', exact: true }).fill('P-00');
    await expect(page.getByRole('option').first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

for (const theme of THEMES) {
  test(`actions: selection bar, context menu, confirm step, palette and shortcut sheet, ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: 'u-ben', theme: t, density: null, railCollapsed: false },
          version: 0,
        }),
      );
    }, theme);
    await page.goto('/transactions?view=V-transactions-default');
    const cell = page.locator('.ag-row[row-index="0"] [col-id="type"]').first();
    await cell.click();
    await page.keyboard.press('Space');
    await expect(page.getByRole('group', { name: 'Actions for selected transactions' })).toBeVisible();
    await expectNoSeriousViolations(page);

    await cell.click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('listbox', { name: 'Commands' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test(`entry: form with errors and a warning, import grid with errors, history tab, delta column, ${theme}`, async ({
    page,
  }) => {
    // Ben is flagged as a new user, so the glossary terms are on screen too.
    await page.addInitScript((t) => {
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: 'u-ben', theme: t, density: null, railCollapsed: false },
          version: 0,
        }),
      );
    }, theme);
    await page.goto('/transactions?view=V-transactions-default');
    await expect(page.locator('[data-slot="status-bar"]')).toContainText(/\d rows/);

    // Delta column on.
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Price vs vendor' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="delta-cell"]').first()).toBeVisible();
    await expectNoSeriousViolations(page);

    // Entry form: field errors, then a field that cannot be read.
    await page.locator('button[data-action-id="transaction.new"]').click();
    const form = page.getByRole('dialog', { name: 'New transaction' });
    await form.getByRole('button', { name: 'Save as unposted' }).click();
    await expect(form.getByText('Portfolio is required.')).toBeVisible();
    await expectNoSeriousViolations(page);
    await form.getByRole('textbox', { name: /^Quantity/ }).fill('lots');
    await form.getByRole('button', { name: 'Save as unposted' }).click();
    await expect(form.getByText('A field holds something that could not be read.')).toBeVisible();
    await expectNoSeriousViolations(page);
    await form.getByRole('button', { name: 'Cancel' }).click();

    // Import: the paste step, then the grid with an error, a warning and an excluded row.
    await page.locator('button[data-action-id="transaction.import"]').click();
    const dialog = page.getByRole('dialog', { name: 'Paste or import transactions' });
    await expect(dialog.getByLabel('Paste rows here')).toBeVisible();
    await expectNoSeriousViolations(page);
    const res = await page.request.post('/api/v1/transactions/query', {
      headers: { 'X-LL-User': 'u-ben' },
      data: {
        startRow: 0,
        endRow: 4,
        sort: [{ field: 'id', dir: 'desc' }],
        filters: [
          { field: 'status', op: 'eq', value: 'unposted' },
          { field: 'type', op: 'eq', value: 'sell' },
        ],
      },
    });
    const rows = ((await res.json()) as { rows: { id: string }[] }).rows;
    const text = [
      'Transaction\tQuantity\tSettle date',
      ...rows.map((r, i) => `${r.id}\t${i === 1 ? 'lots' : 100 + i}\t${i === 2 ? '2026-12-20' : ''}`),
    ].join('\n');
    await dialog.getByLabel('Paste rows here').fill(text);
    await dialog.getByRole('button', { name: 'Read rows' }).click();
    await expect(dialog.locator('[data-slot="batch-summary"]')).toContainText('1 error');
    await dialog.getByRole('checkbox', { name: 'Include row 4' }).uncheck();
    await expect(dialog.locator('[data-slot="batch-summary"]')).toContainText('1 excluded');
    await expectNoSeriousViolations(page);
    await dialog.getByRole('button', { name: 'Discard and close' }).click();

    // Detail panel: glossary term on the status, then the history tab.
    // The transaction id column is pinned, so it is on screen wherever the grid has scrolled to.
    await page.locator('.ag-row[row-index="0"] [col-id="id"]').first().click();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Transaction detail' });
    await expect(panel.getByRole('tab', { name: 'History' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await panel.getByRole('tab', { name: 'History' }).click();
    await expect(panel.getByRole('tabpanel')).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test(`jobs and bulk: tray, job detail, typed confirm with preview, ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: 'u-ada', theme: t, density: null, railCollapsed: false },
          version: 0,
        }),
      );
    }, theme);
    await page.goto('/transactions?view=V-transactions-default');
    await expect(page.locator('[data-slot="status-bar"]')).toContainText(/\d rows/);

    // Job tray with a finished, unopened job; then that job in full.
    await page.locator('[data-slot="job-tray-button"]').click();
    const tray = page.locator('[data-slot="job-tray"]');
    await expect(tray.locator('[data-job-id]').first()).toBeVisible();
    await expectNoSeriousViolations(page);
    await tray.locator('[data-job-id="J-000002"]').click();
    await expect(page.locator('[data-slot="job-detail"]').getByRole('region', { name: 'Log' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press('Escape');

    // An irreversible action: typed confirmation, with the preview opened.
    await page.getByRole('button', { name: 'Warnings only' }).click();
    await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Warning');
    await page.locator('.ag-row[row-index="0"] [col-id="id"]').first().click();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: /^Select all [\d,]+ matching$/ }).click();
    await expect(page.locator('[data-slot="selection-count"]')).toContainText(
      'matching transactions selected',
    );
    await expectNoSeriousViolations(page);
    await page
      .getByRole('group', { name: 'Actions for selected transactions' })
      .getByRole('button', { name: 'Post' })
      .click();
    const confirm = page.getByRole('dialog', { name: /^Post [\d,]+ transactions?\?$/ });
    // Rows with warnings open the preview by themselves.
    await expect(confirm.getByRole('table', { name: 'Preview of changes' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await confirm.getByRole('button', { name: 'Cancel' }).click();
  });

  test(`close, exceptions, approvals, audit and price review, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.addInitScript((t) => {
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: 'u-cleo', theme: t, density: null, railCollapsed: false },
          version: 0,
        }),
      );
    }, theme);
    const settle = async () => {
      await expect(page.locator('.ag-row').first()).toBeVisible();
      await page.waitForTimeout(500);
    };
    const openFirst = async (column: string, label: string) => {
      await page.locator(`.ag-row[row-index="0"] [col-id="${column}"]`).first().click();
      await page.keyboard.press('Enter');
      const detail = page.getByRole('complementary', { name: label });
      await expect(detail).toBeVisible();
      return detail;
    };

    // Close console: overview, then a blocked portfolio's checklist, books and history.
    await page.goto('/accounting');
    await page.getByRole('button', { name: /^Blocked only/ }).click();
    await settle();
    await expectNoSeriousViolations(page);
    const close = await openFirst('cutoff', 'Close detail');
    await expect(close.getByRole('table', { name: 'Close checklist' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await close.getByRole('tab', { name: 'Books' }).click();
    await expect(close.locator('[data-slot="comparison"]')).toBeVisible();
    await expectNoSeriousViolations(page);

    // Exception queue: the list, one exception, the resolve form and the rules.
    await page.goto('/accounting/exceptions');
    await settle();
    const exception = await openFirst('type', 'Exception detail');
    await expect(exception.getByRole('region', { name: 'Thread' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await exception.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.locator('[data-slot="exception-action"]')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Recurring-break rules' }).click();
    await expect(page.locator('[data-slot="break-rules"]')).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press('Escape');

    // Approvals: a decided request, with what changed.
    await page.goto('/accounting/approvals');
    await page.getByRole('button', { name: 'Waiting', exact: true }).click();
    await settle();
    await openFirst('reason', 'Approval detail');
    await expectNoSeriousViolations(page);

    // Audit history: the list and one event.
    await page.goto('/accounting/audit');
    await settle();
    await openFirst('action', 'Audit event');
    await expectNoSeriousViolations(page);

    // Price review: prices with the prior-day column, and the tolerance rules.
    await page.goto('/market-data');
    await settle();
    await page.getByRole('tab', { name: 'Prices' }).click();
    await expect(page.locator('[data-slot="delta-cell"]').first()).toBeVisible();
    await page.waitForTimeout(500);
    await expectNoSeriousViolations(page);
    await page.getByRole('tab', { name: 'Tolerance rules' }).click();
    await expect(page.getByRole('table', { name: 'Tolerance rules' })).toBeVisible();
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
        await page
          .locator('#storybook-root > *, [data-radix-popper-content-wrapper], [role="dialog"]')
          .first()
          .waitFor();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expectNoSeriousViolations(page);
      });
    }
  });
}
