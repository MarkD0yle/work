import { expect, test, type Page } from '@playwright/test';

/** Grid toolbar controls and the transaction detail panel: edit, override, conflict, read-only reasons. */

interface Row {
  id: string;
  version: number;
  quantity: { value: string | null };
  price: { value: string | null };
  amount: { value: string; provenance: { origin: string } };
}

const signIn = (page: Page, userId: string) =>
  page.addInitScript(
    (id) =>
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: id, theme: 'light', density: null, railCollapsed: false },
          version: 0,
        }),
      ),
    userId,
  );

/** Tests share one database and run in parallel, so each takes its own transaction by index. */
async function pick(page: Page, status: 'unposted' | 'posted', index: number): Promise<Row> {
  const res = await page.request.post('/api/v1/transactions/query', {
    headers: { 'X-LL-User': 'u-ada' },
    data: {
      startRow: 0,
      endRow: 200,
      sort: [{ field: 'id', dir: 'asc' }],
      filters: [
        { field: 'status', op: 'eq', value: status },
        { field: 'type', op: 'in', value: ['buy', 'sell'] },
      ],
    },
  });
  const rows = ((await res.json()) as { rows: Row[] }).rows.filter(
    (r) => r.amount.provenance.origin === 'calculated',
  );
  return rows[index] as Row;
}

async function openPanel(page: Page, userId: string, id: string) {
  await signIn(page, userId);
  await page.goto('/transactions');
  await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill(id);
  await expect(page.locator('[data-slot="status-bar"]')).toContainText('1 row');
  await page.locator(`.ag-row[row-id="${id}"] [col-id="type"]`).first().click();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Transaction detail' });
  await expect(panel.getByRole('heading', { name: `Transaction ${id}` })).toBeFocused();
  return panel;
}

const gridCell = (page: Page, id: string, col: string) =>
  page.locator(`.ag-row[row-id="${id}"] [col-id="${col}"] [data-slot="financial-cell"]`).first();

test.describe('grid toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'u-ada');
    await page.goto('/transactions');
    await expect(page.locator('[data-slot="status-bar"]')).toContainText('5,000 rows');
  });

  test('every active condition shows as a removable tag', async ({ page }) => {
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('TREASURY');
    const tags = page.getByRole('list', { name: 'Active filters' });
    await expect(tags.getByText('Search: TREASURY')).toBeVisible();
    await expect(page.locator('[data-slot="status-bar"]')).not.toContainText('5,000 rows');

    await tags.getByRole('button', { name: 'Remove filter: Search: TREASURY' }).click();
    await expect(page.getByRole('searchbox', { name: 'Quick search transactions' })).toHaveValue('');
    await expect(page.locator('[data-slot="status-bar"]')).toContainText('5,000 rows');
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
  });

  test('columns can be hidden and shown, and the toolbar says how many are hidden', async ({ page }) => {
    await expect(page.locator('.ag-header-cell[col-id="price"]')).toBeVisible();
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Price' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Portfolio' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ag-header-cell[col-id="price"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Columns.*2 hidden/ })).toBeVisible();

    await page.getByRole('button', { name: /Columns/ }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Price' })).not.toBeChecked();
    await page.getByRole('menuitemcheckbox', { name: 'Price' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ag-header-cell[col-id="price"]')).toBeVisible();
  });

  test('changing density from the toolbar keeps the selection and hidden columns', async ({ page }) => {
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Portfolio' }).click();
    await page.keyboard.press('Escape');
    await page.locator('.ag-row[row-index="2"] [col-id="type"]').first().click();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(page.locator('[data-slot="selection-bar"]')).toContainText('2 selected');
    const ids = [
      await page.locator('.ag-row[row-index="2"]').first().getAttribute('row-id'),
      await page.locator('.ag-row[row-index="3"]').first().getAttribute('row-id'),
    ];

    await page.getByRole('button', { name: 'Density' }).click();
    await page.getByRole('menuitemradio', { name: 'Comfortable' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
    await expect
      .poll(() =>
        page
          .locator('.ag-row[row-index="0"]')
          .first()
          .evaluate((el) => el.getBoundingClientRect().height),
      )
      .toBe(40);
    await expect(page.locator('[data-slot="selection-bar"]')).toContainText('2 selected');
    for (const id of ids)
      await expect(page.locator(`.ag-row[row-id="${id}"]`).first()).toHaveClass(/ag-row-selected/);
    await expect(page.locator('.ag-header-cell[col-id="portfolio"]')).toHaveCount(0);
  });

  test('copy confirms with a toast that goes away by itself', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.ag-row[row-index="0"] [col-id="tradeDate"]').first().click();
    await page.keyboard.press('Control+c');
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Copied 1 cell' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 8_000 });
  });
});

test.describe('transaction detail panel', () => {
  // Wide enough that the financial columns stay on screen beside the open panel (the grid only renders visible columns).
  test.use({ viewport: { width: 1920, height: 900 } });

  test('editing a price saves, confirms with a toast, and the grid shows the new values', async ({
    page,
  }) => {
    const row = await pick(page, 'unposted', 0);
    const panel = await openPanel(page, 'u-ada', row.id);
    const price = panel.getByLabel('Price');
    await price.fill('55.5');
    await price.blur();
    await expect(panel.locator('[data-slot="dirty-marker"]')).toHaveText('Changed, not saved yet.');
    await expect(panel.getByRole('status').filter({ hasText: 'unsaved' })).toHaveText('1 unsaved change');
    // Nothing commits silently: the grid still shows the old price.
    await expect(gridCell(page, row.id, 'price')).not.toContainText('55.500000');

    await panel.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(panel.getByRole('status').filter({ hasText: 'unsaved' })).toHaveText('No unsaved changes');
    await expect(gridCell(page, row.id, 'price')).toContainText('55.500000');
    // The calculated amount followed the price.
    await expect(gridCell(page, row.id, 'amount')).toHaveAttribute('data-origin', 'calculated');
    await expect(gridCell(page, row.id, 'amount').locator('.truncate')).not.toHaveText(
      new RegExp(`^${row.amount.value}$`),
    );
  });

  test('overriding a calculated amount needs a reason, then shows as overridden with its provenance', async ({
    page,
  }) => {
    const row = await pick(page, 'unposted', 1);
    const panel = await openPanel(page, 'u-ada', row.id);
    const amount = panel.getByLabel('Amount', { exact: true });
    await amount.fill('1.5m');
    await amount.blur();
    await expect(panel.getByText('Will save as')).toContainText('1,500,000');

    // No reason, no override: nothing is staged and Save stays disabled.
    await panel.getByRole('button', { name: 'Apply override' }).click();
    await expect(panel.getByText('Enter a reason. An override cannot be saved without one.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Save' })).toBeDisabled();

    await panel.getByLabel('Reason for override (required)').fill('Agreed net amount with broker');
    await panel.getByRole('button', { name: 'Apply override' }).click();
    await expect(panel.locator('[data-slot="dirty-marker"]')).toHaveText(
      'Changed, not saved yet (override).',
    );
    await panel.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Saved' })).toBeVisible();

    const cell = gridCell(page, row.id, 'amount');
    await expect(cell).toHaveAttribute('data-origin', 'overridden');
    await cell.click();
    const provenance = page.getByRole('dialog', { name: 'Provenance' });
    await expect(provenance).toContainText('Agreed net amount with broker');
    await expect(provenance).toContainText('Ada');
    await expect(provenance).toContainText('Original value');
  });

  test('Ben can edit a price but not override; the amount field says why', async ({ page }) => {
    const row = await pick(page, 'unposted', 2);
    const panel = await openPanel(page, 'u-ben', row.id);
    await expect(panel.getByLabel('Price')).toBeEnabled();
    await expect(panel.getByLabel('Amount', { exact: true })).toBeDisabled();
    await expect(
      panel.getByText('Overriding calculated values needs full access on transactions.'),
    ).toBeVisible();
  });

  test('Cleo is view-only on transaction entry and is told why', async ({ page }) => {
    const row = await pick(page, 'unposted', 3);
    const panel = await openPanel(page, 'u-cleo', row.id);
    await expect(panel.locator('[data-slot="read-only-reason"]')).toContainText(
      'Your role can view transactions but not change them.',
    );
    await expect(panel.getByLabel('Price')).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });

  test('a posted transaction is read-only and says what to do instead', async ({ page }) => {
    const row = await pick(page, 'posted', 0);
    const panel = await openPanel(page, 'u-ada', row.id);
    await expect(panel.locator('[data-slot="read-only-reason"]')).toContainText(
      'Reverse it, then enter a corrected transaction.',
    );
    await expect(panel.getByLabel('Quantity')).toBeDisabled();
  });

  test('a conflicting change is shown, never overwritten silently; the user chooses', async ({ page }) => {
    const row = await pick(page, 'unposted', 4);
    const panel = await openPanel(page, 'u-ada', row.id);
    await panel.getByLabel('Price').fill('61');
    await panel.getByLabel('Price').blur();

    // Someone else saves first.
    const other = await page.request.patch(`/api/v1/transactions/${row.id}`, {
      headers: { 'X-LL-User': 'u-ada', 'If-Match': String(row.version) },
      data: { changes: { quantity: '1000' } },
    });
    expect(other.status()).toBe(200);

    await panel.getByRole('button', { name: 'Save' }).click();
    const conflict = panel.getByRole('alert').filter({ hasText: 'changed this record' });
    await expect(conflict).toContainText('Your unsaved edits are kept.');
    await expect(panel.getByLabel('Price')).toHaveValue('61.000000');
    await expect(panel.getByRole('button', { name: 'Save' })).toBeDisabled();

    await conflict.getByRole('button', { name: 'Keep my edits' }).click();
    await panel.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(gridCell(page, row.id, 'price')).toContainText('61.000000');
    // Their quantity change survived my save.
    await expect(gridCell(page, row.id, 'quantity')).toContainText('1,000.0000');
  });

  test('Escape closes the panel and focus returns to the row', async ({ page }) => {
    const row = await pick(page, 'unposted', 5);
    const panel = await openPanel(page, 'u-ada', row.id);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('.ag-row')?.getAttribute('row-id')))
      .toBe(row.id);
  });
});
