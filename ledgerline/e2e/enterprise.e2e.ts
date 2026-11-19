import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * AG Grid Enterprise features, as Ledgerline adopts them (docs/AG-GRID-ENTERPRISE.md).
 * Runs on the `e2e` project only: every feature here needs Enterprise.
 */

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

async function openTransactions(page: Page) {
  await signIn(page, 'u-ada');
  await page.goto('/transactions?view=V-transactions-default');
  await expect(page.locator('.ag-row[row-index="0"]').first()).toBeVisible();
  await expect(page.locator('[data-slot="status-bar"]')).toContainText(/[45],\d{3} rows/);
}

/**
 * Drags from one cell to another in small steps, the way a hand moves a mouse: AG Grid starts a range only
 * after the pointer has travelled a few pixels. Wide grids put Amount past the right edge, so scroll it in first.
 */
async function dragRange(page: Page, from: ReturnType<typeof cell>, to: ReturnType<typeof cell>) {
  await from.scrollIntoViewIfNeeded();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('Cells are not on screen.');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

const cell = (page: Page, rowIndex: number, colId: string) =>
  page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`).first();

test.describe('AG Grid Enterprise in Ledgerline', () => {
  test.skip(({ baseURL }) => baseURL?.includes('5311') ?? false, 'Enterprise only');

  test('a dragged cell range is summed in decimals in the status bar, and Escape clears it', async ({
    page,
  }) => {
    await openTransactions(page);
    await dragRange(page, cell(page, 0, 'amount'), cell(page, 3, 'amount'));
    const summary = page.locator('[data-slot="range-summary"]');
    await expect(summary).toContainText('4 cells');
    // Either one currency, summed, or a refusal to add currencies together: never a float sum across them.
    await expect(summary).toContainText(
      /Sum of amount: [\d,.()-]+ [A-Z]{3}|Amount: mixed currencies, not summed/,
    );
    await page.keyboard.press('Escape');
    await expect(summary).toHaveCount(0);
  });

  test('Copy takes exactly the cell range', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openTransactions(page);
    await dragRange(page, cell(page, 0, 'amount'), cell(page, 1, 'amount'));
    await page.keyboard.press('ControlOrMeta+c');
    await expect(page.locator('[data-slot="grid-announcer"]')).toHaveText(/Copied 2 cells\./);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.split('\n')).toHaveLength(2);
  });

  test('the column menu offers sort, pin and autosize, but never copy, paste or filters', async ({
    page,
  }) => {
    await openTransactions(page);
    const header = page.locator('.ag-header-cell[col-id="amount"]');
    await header.hover();
    await header.locator('.ag-header-cell-menu-button').click();
    const menu = page.locator('.ag-menu');
    await expect(menu).toContainText('Pin Column');
    await expect(menu).toContainText('Autosize This Column');
    await expect(menu).not.toContainText('Copy');
    await expect(menu).not.toContainText('Paste');
    await expect(menu).not.toContainText('Filter');
    await page.keyboard.press('Escape');
  });

  test('the Columns menu opens the column panel and turns on row numbers', async ({ page }) => {
    await openTransactions(page);
    await page.getByRole('button', { name: /^Columns/ }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Row numbers' }).click();
    await page.keyboard.press('Escape');
    await expect(
      page.locator('.ag-row[row-index="0"] [col-id="ag-Grid-RowNumbersColumn"]').first(),
    ).toHaveText('1');
    await page.getByRole('button', { name: /^Columns/ }).click();
    await page.getByRole('menuitem', { name: /Column panel/ }).click();
    const panel = page.locator('.ag-column-panel');
    await expect(panel).toBeVisible();
    // Pivot and values are switched off: their maths is not decimal.
    await expect(page.locator('.ag-pivot-mode-panel')).toHaveCount(0);
  });

  test('Export to Excel explains why it is unavailable, then downloads the selected rows as .xlsx', async ({
    page,
  }) => {
    await openTransactions(page);
    const exportButton = page.locator('[data-action-id="grid.exportExcel"]');
    await expect(exportButton).toHaveAttribute('aria-disabled', 'true');
    await expect(exportButton).toHaveAttribute('title', /Select the transactions to export/);
    await page.locator('.ag-row[row-index="0"] .ag-selection-checkbox input').first().check();
    await page.locator('.ag-row[row-index="1"] .ag-selection-checkbox input').first().check();
    await expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
    expect(download.suggestedFilename()).toMatch(/^transactions-\d{4}-\d{2}-\d{2}T\d{4}\.xlsx$/);
    const file = readFileSync((await download.path()) as string);
    // An .xlsx is a zip: "PK" header.
    expect(file.subarray(0, 2).toString()).toBe('PK');
    await expect(page.locator('[data-slot="grid-announcer"]')).toHaveText(
      /Exported 2 transactions to Excel\./,
    );
  });

  test('an exception row expands in place with its values and thread, from the keyboard', async ({
    page,
  }) => {
    await signIn(page, 'u-cleo');
    await page.goto('/accounting/exceptions');
    await expect(page.locator('.ag-row[row-index="0"]').first()).toBeVisible();
    await cell(page, 0, 'type').click();
    await page.keyboard.press('Alt+ArrowDown');
    const detail = page.locator('[data-slot="exception-summary"]').first();
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Root cause');
    await expect(detail).toContainText('Latest comment');
    // AG Grid redraws the master row when it expands and puts focus back on the cell a moment later.
    // A key pressed in between goes to the page, not the grid, so wait for the cell as a person would.
    await expect(cell(page, 0, 'type')).toBeFocused();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.locator('[data-slot="exception-summary"]')).toHaveCount(0);
  });

  test('server grouping shows the drag-to-group panel', async ({ page }) => {
    await openTransactions(page);
    await page.getByRole('button', { name: /^Group/ }).click();
    await page.getByRole('menuitemcheckbox').first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ag-column-drop-horizontal-rowgroup')).toBeVisible();
  });
});
