import { expect, test, type Page } from '@playwright/test';

/** Milestone 1: SPEC 7.1 (grid), 7.5 (financial cells) and 7.7 (states) on the live transactions grid. */

const signIn = (page: Page, userId: string, extra: Record<string, unknown> = {}) =>
  page.addInitScript(
    ([id, more]) =>
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: id, theme: 'light', density: null, railCollapsed: false, ...more },
          version: 0,
        }),
      ),
    [userId, extra] as const,
  );

async function openGrid(page: Page, userId = 'u-ada') {
  await signIn(page, userId);
  await page.goto('/transactions?view=V-transactions-default');
  await expect(page.locator('.ag-row[row-index="0"]').first()).toBeVisible();
  await expect(page.locator('[data-slot="status-bar"]')).toContainText('5,000 rows');
}

const cell = (page: Page, rowIndex: number, colId: string) =>
  page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`).first();
const rowIdAt = (page: Page, rowIndex: number) =>
  page.locator(`.ag-row[row-index="${rowIndex}"]`).first().getAttribute('row-id');

test.describe('transactions grid', () => {
  test('first paint of the server-driven grid is fast and shows the server total', async ({ page }) => {
    await signIn(page, 'u-ada');
    const started = Date.now();
    await page.goto('/transactions?view=V-transactions-default');
    await expect(page.locator('.ag-row[row-index="0"]').first()).toBeVisible();
    expect(Date.now() - started).toBeLessThan(5_000);
    await expect(page.locator('[data-slot="status-bar"]')).toContainText('5,000 rows');
  });

  test('row and column counts are announced, including the server total', async ({ page }) => {
    await openGrid(page);
    await expect(page.locator('[data-slot="grid-count-announcer"]')).toHaveText(
      'Transactions: 5,000 rows, 10 columns.',
    );
    await expect(page.getByRole('region', { name: 'Transactions grid' })).toBeVisible();
    await expect(page.locator('[data-slot="grid-count-announcer"]')).toHaveAttribute('aria-live', 'polite');
  });

  test('Enterprise: the server-side row model exposes the server total to assistive technology', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'e2e', 'Community cannot know the total up front');
    await openGrid(page);
    // Header row + 5,000 data rows.
    await expect(page.locator('[role="grid"], [role="treegrid"]').first()).toHaveAttribute(
      'aria-rowcount',
      '5001',
    );
    await expect(page.locator('.ag-watermark')).toHaveCount(1);
  });

  test('a financial column never shows more or fewer decimals than its registry entry', async ({ page }) => {
    await openGrid(page);
    const checked = await page.evaluate(() => {
      const out: { col: string; text: string; ccy: string }[] = [];
      for (const row of document.querySelectorAll('.ag-row')) {
        for (const col of ['quantity', 'price', 'amount']) {
          const el = row.querySelector(`[col-id="${col}"] [data-slot="financial-cell"]`);
          if (!el || el.getAttribute('data-display') !== 'value') continue;
          out.push({
            col,
            text: el.querySelector('.truncate')?.textContent ?? '',
            ccy: el.getAttribute('data-currency') ?? '',
          });
        }
      }
      return out;
    });
    expect(checked.length).toBeGreaterThan(30);
    for (const { col, text, ccy } of checked) {
      const decimals = (text.split('.')[1] ?? '').length;
      const expected = col === 'quantity' ? 4 : col === 'price' ? 6 : ccy === 'JPY' ? 0 : 2;
      expect(decimals, `${col} ${text} ${ccy}`).toBe(expected);
    }
    expect(checked.some((c) => c.col === 'amount' && c.ccy !== '')).toBe(true);
  });

  test('financial cells right-align in tabular figures', async ({ page }) => {
    await openGrid(page);
    const style = await cell(page, 0, 'amount')
      .locator('[data-slot="financial-cell"]')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        const cellBox = el.closest('.ag-cell')!.getBoundingClientRect();
        const last = el.lastElementChild!.getBoundingClientRect();
        return { numeric: cs.fontVariantNumeric, gap: cellBox.right - last.right };
      });
    expect(style.numeric).toContain('tabular-nums');
    expect(style.gap).toBeLessThan(20);
  });

  test('not applicable, missing dates and zero render differently, with spoken labels', async ({ page }) => {
    await openGrid(page);
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('T-0000077');
    await expect(page.locator('[data-slot="status-bar"]')).toContainText('1 row');
    // A fee has no quantity or price (not applicable: blank with a label) and no settle date (dash, "No date").
    const quantity = cell(page, 0, 'quantity').locator('[data-slot="financial-cell"]');
    await expect(quantity).toHaveAttribute('data-display', 'notApplicable');
    await expect(quantity).toHaveAccessibleName(/^Not applicable/);
    await expect(cell(page, 0, 'settleDate').getByLabel('No date')).toHaveText('—');
    await expect(cell(page, 0, 'amount').locator('[data-slot="financial-cell"]')).toHaveAttribute(
      'data-display',
      'value',
    );
  });

  test('every keyboard interaction works with no mouse', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openGrid(page);
    const announcer = page.locator('[data-slot="grid-announcer"]');

    // Reach the grid by keyboard, then move with arrows.
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).focus();
    // Tab reaches the grid header; ArrowDown enters the rows.
    for (let i = 0; i < 6; i += 1) {
      if (await page.evaluate(() => Boolean(document.activeElement?.closest('.ag-header-cell')))) break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.ag-row'))))
      .toBe(true);
    const start = await page.evaluate(() =>
      document.activeElement?.closest('.ag-row')?.getAttribute('row-index'),
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    const moved = await page.evaluate(() => ({
      row: document.activeElement?.closest('.ag-row')?.getAttribute('row-index'),
      col: document.activeElement?.closest('[col-id]')?.getAttribute('col-id'),
    }));
    expect(Number(moved.row)).toBe(Number(start) + 2);

    // Space selects; Shift extends.
    await page.keyboard.press('Space');
    await expect(page.locator('[data-slot="selection-bar"]')).toContainText('1 selected');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Shift+Space');
    await expect(page.locator('[data-slot="selection-bar"]')).toContainText('3 selected');

    // Ctrl+C copies the selected rows at displayed precision; Ctrl+Shift+C copies raw values.
    await page.keyboard.press('Control+c');
    await expect(announcer).toContainText('Copied 3 rows.');
    const displayed = await page.evaluate(() => navigator.clipboard.readText());
    expect(displayed.split('\n')).toHaveLength(3);
    expect(displayed).toMatch(/\d{2} [A-Z][a-z]{2} 2026/);
    await page.keyboard.press('Control+Shift+c');
    await expect(announcer).toContainText('as raw values');
    const raw = await page.evaluate(() => navigator.clipboard.readText());
    expect(raw).toMatch(/2026-\d{2}-\d{2}/);
    expect(raw).not.toMatch(/\d,\d{3}/);

    // Escape clears the selection.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Ctrl+A selects the rows in view, not all 5,000 server rows.
    await page.keyboard.press('Control+a');
    await expect(announcer).toContainText('rows in view selected');
    const selectedText = await page.locator('[data-slot="selection-bar"]').innerText();
    const selectedCount = Number(/(\d+) selected/.exec(selectedText)?.[1]);
    expect(selectedCount).toBeGreaterThan(5);
    expect(selectedCount).toBeLessThan(200);
    await page.keyboard.press('Escape');

    // Shift+F10 opens the row actions; they are also on the toolbar, so right-click is never the only path.
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: /^Copy raw values/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.ag-cell'))))
      .toBe(true);

    // Provenance is one keystroke away from a financial cell.
    for (let i = 0; i < 12; i += 1) {
      if (
        (await page.evaluate(() => document.activeElement?.closest('[col-id]')?.getAttribute('col-id'))) ===
        'amount'
      )
        break;
      await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('Control+i');
    await expect(page.getByRole('dialog', { name: 'Provenance' })).toContainText('Origin');
    await page.keyboard.press('Escape');
  });

  test('copying a single cell copies only that cell', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openGrid(page);
    await cell(page, 0, 'tradeDate').click();
    await page.keyboard.press('Control+c');
    await expect(page.locator('[data-slot="grid-announcer"]')).toContainText('Copied 1 cell.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
  });

  test('refresh keeps focus, selection and scroll', async ({ page }) => {
    await openGrid(page);
    // Scroll well into the data, then select two rows and focus a cell.
    await page.locator('.ag-grid-viewport').evaluate((el) => el.scrollTo(0, 3000));
    await expect(page.locator('.ag-row[row-index="130"]').first()).toBeVisible();
    await cell(page, 130, 'tradeDate').click();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(page.locator('[data-slot="selection-bar"]')).toContainText('2 selected');
    const before = {
      scroll: await page.locator('.ag-grid-viewport').evaluate((el) => el.scrollTop),
      ids: [await rowIdAt(page, 130), await rowIdAt(page, 131)],
    };

    const reloaded = page.waitForResponse(
      (r) => r.url().endsWith('/transactions/query') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    await reloaded;
    await page.waitForTimeout(300);

    expect(await page.locator('.ag-grid-viewport').evaluate((el) => el.scrollTop)).toBe(before.scroll);
    await expect(page.locator('[data-slot="selection-bar"]')).toContainText('2 selected');
    for (const id of before.ids)
      await expect(page.locator(`.ag-row[row-id="${id}"]`).first()).toHaveClass(/ag-row-selected/);
    await expect(page.locator(`.ag-row[row-id="${before.ids[1]}"] [col-id="tradeDate"]`)).toHaveClass(
      /ag-cell-focus/,
    );
  });

  test('sorting and quick search are done by the server', async ({ page }) => {
    await openGrid(page);
    const sorted = page.waitForRequest(
      (r) =>
        r.url().endsWith('/transactions/query') &&
        (r.postDataJSON() as { sort?: unknown[] }).sort !== undefined,
    );
    await page.locator('.ag-header-cell[col-id="amount"]').click();
    expect(((await sorted).postDataJSON() as { sort: unknown[] }).sort).toEqual([
      { field: 'amount', dir: 'asc' },
    ]);

    const searched = page.waitForRequest(
      (r) =>
        r.url().endsWith('/transactions/query') &&
        (r.postDataJSON() as { quickSearch?: string }).quickSearch === 'TREASURY',
    );
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('TREASURY');
    await searched;
    await expect(page.locator('[data-slot="status-bar"]')).not.toContainText('5,000 rows');
    await expect(cell(page, 0, 'security')).toContainText('TREASURY');
  });

  test('no matches is a designed state that says how to recover', async ({ page }) => {
    await openGrid(page);
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('zzzz-no-such-thing');
    const state = page.getByRole('status').filter({ hasText: 'No records match' });
    await expect(state).toContainText('1 filter applied');
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('');
    await expect(page.locator('[data-slot="status-bar"]')).toContainText('5,000 rows');
  });

  test('a load failure is announced assertively, recorded in notifications, and recoverable', async ({
    page,
  }) => {
    await signIn(page, 'u-ada');
    await page.route('**/api/v1/transactions/query', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              code: 'LL-API-0500',
              severity: 'error',
              level: 'operation',
              text: 'The server hit an unexpected problem.',
              fix: 'Try again.',
            },
          ],
        }),
      }),
    );
    await page.goto('/transactions?view=V-transactions-default');
    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'The server hit an unexpected problem.' })
      .first();
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    await expect(page.locator('[data-slot="live-assertive"]')).toContainText(
      'The server hit an unexpected problem.',
    );

    // Critical information is never only a toast: it is in the session history.
    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect(page.getByRole('complementary', { name: 'Notifications' })).toContainText('LL-API-0500');

    await page.unroute('**/api/v1/transactions/query');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('[data-slot="status-bar"]')).toContainText('5,000 rows');
  });

  test('rows with warnings carry a marker that explains the warning', async ({ page }) => {
    await openGrid(page);
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('T-00000');
    // Narrow to one warned row, so the marker is certainly in view (the grid also renders rows off screen).
    await expect(page.locator('[data-slot="row-marker"]').first()).toBeAttached();
    const warnedId = await page
      .locator('[data-slot="row-marker"]')
      .first()
      .locator('xpath=ancestor::*[@row-id][1]')
      .getAttribute('row-id');
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill(warnedId as string);
    await expect(page.locator('[data-slot="status-bar"]')).toContainText('1 row');
    const marker = page.locator('[data-slot="row-marker"]').first();
    await expect(marker).toHaveAccessibleName(/^Warning: /);
    // The grid may redraw the row once more after the search lands, so hover until the tooltip holds.
    await expect(async () => {
      await page.mouse.move(0, 0);
      await marker.hover();
      await expect(page.getByRole('tooltip')).toContainText(/LL-VAL-\d{4}/, { timeout: 1500 });
    }).toPass();
  });

  test('density changes row height from tokens', async ({ page }) => {
    await openGrid(page); // Ada: compact
    expect(
      await page
        .locator('.ag-row[row-index="0"]')
        .first()
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBe(24);
    await page.getByRole('button', { name: 'Display preferences' }).click();
    await page.getByRole('menuitemradio', { name: 'Comfortable' }).click();
    await expect
      .poll(() =>
        page
          .locator('.ag-row[row-index="0"]')
          .first()
          .evaluate((el) => el.getBoundingClientRect().height),
      )
      .toBe(40);
  });

  test('a client sees only their portfolios, with no selection, and is told why', async ({ page }) => {
    // Wide enough that the last column (portfolio) is on screen: the grid only renders visible columns.
    await page.setViewportSize({ width: 1920, height: 900 });
    await signIn(page, 'u-eli');
    await page.goto('/transactions?view=V-transactions-default');
    await expect(page.getByText('outside your account scope')).toBeVisible();
    await expect(page.locator('.ag-row[row-index="0"]').first()).toBeVisible();
    await expect(page.locator('.ag-selection-checkbox')).toHaveCount(0);
    const portfolios = await page.locator('.ag-row [col-id="portfolio"]').allInnerTexts();
    expect(portfolios.length).toBeGreaterThan(0);
    for (const text of portfolios) expect(text).toMatch(/P-0007|P-0019/);
  });
});
