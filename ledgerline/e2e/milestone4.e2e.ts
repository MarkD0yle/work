import { expect, test, type Page } from '@playwright/test';

/** Milestone 4: transaction entry, quick paste and import (SPEC 8.1), clone, fill-down, delta columns (7.1), glossary (7.7). */

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
const statusBar = (page: Page) => page.locator('[data-slot="status-bar"]');
const ADA = { 'X-LL-User': 'u-ada' };

interface Row {
  id: string;
  type: string;
  status: string;
  quantity: { value: string | null };
  tradeDate: { value: string | null };
  portfolio: { id: string };
  security: { id: string; label: string } | null;
}
interface Audit {
  action: string;
  after?: Record<string, unknown>;
  note?: { kind: string; text: string };
  evidence?: { type: string; label: string }[];
}

/** Unposted trades from the last few days. Other journeys work on income rows and on the oldest trades, so these are ours. */
async function recentTrades(page: Page, types: string[], count: number, offset = 0): Promise<Row[]> {
  const res = await page.request.post('/api/v1/transactions/query', {
    headers: ADA,
    data: {
      startRow: 0,
      endRow: 400,
      sort: [{ field: 'id', dir: 'desc' }],
      filters: [
        { field: 'status', op: 'eq', value: 'unposted' },
        { field: 'type', op: 'in', value: types },
        { field: 'tradeDate', op: 'between', from: '2026-11-02', to: '2026-11-13' },
      ],
    },
  });
  return ((await res.json()) as { rows: Row[] }).rows.slice(offset, offset + count);
}
const getRow = async (page: Page, id: string) =>
  (await (await page.request.get(`/api/v1/transactions/${id}`, { headers: ADA })).json()) as Row;
const auditOf = async (page: Page, id: string) =>
  (await (
    await page.request.get(`/api/v1/audit/record/transaction/${id}`, { headers: ADA })
  ).json()) as Audit[];

async function openBlotter(page: Page, userId: string, query = '?view=V-transactions-default') {
  await signIn(page, userId);
  await page.goto(`/transactions${query}`);
  await expect(statusBar(page)).toContainText(/\d rows/);
}
async function searchFor(page: Page, id: string) {
  await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill(id);
  await expect(statusBar(page)).toContainText('1 row');
}
const focusRow = (page: Page, id: string) =>
  page.locator(`.ag-row[row-id="${id}"] [col-id="type"]`).first().click();
const toolbarAction = (page: Page, id: string) =>
  page.locator(`[data-slot="grid-toolbar"] [data-action-id="${id}"], button[data-action-id="${id}"]`).first();

/** Pastes text the way a real clipboard paste arrives. */
const paste = (page: Page, selector: string, text: string) =>
  page.locator(selector).evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    (el as HTMLElement).focus();
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
const importDialog = (page: Page) => page.getByRole('dialog', { name: 'Paste or import transactions' });
const batchCell = (page: Page, name: string) =>
  importDialog(page).getByRole('textbox', { name, exact: true });
const summary = (page: Page) => importDialog(page).locator('[data-slot="batch-summary"]');
const importStatus = (page: Page) => importDialog(page).locator('[data-slot="import-status"]');
const confirmImport = async (page: Page) => {
  const confirm = page.locator('[data-slot="import-confirm"]');
  await confirm.getByRole('button', { name: /^Import( with \d+ warnings?)?$/ }).click();
  await expect(importDialog(page)).toBeHidden();
};

test.describe('exit gate', () => {
  test('Ada finds yesterday’s trades, quick-pastes 50 corrections, fixes 2 errors, clones, fills down and posts; Ben cannot reverse', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    // 1. The team's saved view opens by default: yesterday's unposted trades, with its filters showing.
    await openBlotter(page, 'u-ada', '');
    await expect(page.locator('[data-slot="view-selector"]')).toContainText("Yesterday's unposted trades");
    await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Trade date is yesterday');

    // 2. Quick paste: 50 corrections straight from a spreadsheet, two of them wrong.
    // Only trades that are valid as they stand, so the two errors below are the only ones.
    const candidates = await recentTrades(page, ['buy', 'sell', 'repo'], 120);
    const checked = (await (
      await page.request.post('/api/v1/imports/validate', {
        headers: ADA,
        data: {
          mapping: { targetType: 'transaction', columns: [{ sourceHeader: 'Id', targetField: 'id' }] },
          rows: candidates.map((c) => ({ Id: c.id })),
        },
      })
    ).json()) as { status: string }[];
    const valid = candidates.filter((_, i) => checked[i]?.status === 'valid');
    // The first one is a buy from yesterday: it is the trade Ada clones and posts later, from the same view.
    const first = valid.find((t) => t.type === 'buy' && t.tradeDate.value === '2026-11-13') as Row;
    const targets = [first, ...valid.filter((t) => t !== first)].slice(0, 50);
    expect(targets).toHaveLength(50);
    const lines = targets.map((t, i) => `${t.id}\t${i === 7 ? 'lots' : i === 21 ? '-5' : `${1000 + i}`}`);
    await toolbarAction(page, 'transaction.import').click();
    await paste(page, '[data-slot="import-paste"]', ['Transaction\tQuantity', ...lines].join('\n'));
    // No wizard steps: the rows are in the grid, checked, with the two errors on their cells.
    await expect(importDialog(page).getByRole('table', { name: 'Rows to import' })).toBeVisible();
    await expect(summary(page)).toContainText('50 rows:');
    await expect(summary(page)).toContainText('2 errors');
    await expect(batchCell(page, 'Quantity, row 8')).toHaveAttribute('aria-invalid', 'true');
    await expect(importDialog(page).getByText('Quantity "lots" is not a number.')).toBeVisible();
    await expect(importStatus(page)).toContainText('Fix or exclude the 2 rows with errors first');
    await expect(importDialog(page).getByRole('button', { name: /^Import 50 rows/ })).toBeDisabled();

    // 3. Fix the two errors: type one, fill the other down from it (Ctrl+D).
    await importDialog(page).getByRole('button', { name: 'Errors (2)' }).click();
    await batchCell(page, 'Quantity, row 8').fill('2500');
    await page.keyboard.press('ArrowDown');
    await expect(batchCell(page, 'Quantity, row 22')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+d');
    await expect(batchCell(page, 'Quantity, row 22')).toHaveValue('2500');
    await expect(summary(page)).toContainText('0 errors');
    await expect(importStatus(page)).toContainText('Ready: 50 corrections to existing transactions, 0 new.');

    // 4. Commit asks first, says what will happen, then every row is changed and audited as imported.
    await importDialog(page)
      .getByRole('button', { name: /^Import 50 rows/ })
      .click();
    await expect(page.locator('[data-slot="import-confirm"]')).toContainText(
      '50 rows will change existing unposted transactions',
    );
    await expect(page.locator('[data-slot="import-confirm"]')).toContainText('Clipboard paste');
    await confirmImport(page);
    for (const i of [0, 7, 21, 49]) {
      const target = targets[i] as Row;
      expect((await getRow(page, target.id)).quantity.value, target.id).toBe(
        i === 7 || i === 21 ? '2500.0000' : `${1000 + i}.0000`,
      );
      const [event] = await auditOf(page, target.id);
      expect(event?.action).toBe('transaction.import.correct');
      expect(event?.after).toMatchObject({ source: 'imported' });
      expect(event?.evidence?.[0]?.label).toContain('Clipboard paste');
    }

    // 5. Clone a trade: the form opens as a copy with the cursor on quantity; saving creates a new unposted record.
    const source = first;
    await searchFor(page, source.id);
    await page.locator(`.ag-row[row-id="${source.id}"] [col-id="type"]`).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Clone' }).click();
    const form = page.getByRole('dialog', { name: `Clone of ${source.id}` });
    await expect(form.getByRole('textbox', { name: /^Quantity/ })).toBeFocused();
    await page.keyboard.type('777');
    // Ctrl+Enter saves from inside any field.
    await page.keyboard.press('ControlOrMeta+Enter');
    // A warning (for example a price away from the vendor price) has to be acknowledged, never skipped.
    const acknowledgement = form.locator('[data-slot="warning-acknowledgement"]');
    const panel = page.getByRole('complementary', { name: 'Transaction detail' });
    await expect(acknowledgement.or(panel)).toBeVisible();
    if (await acknowledgement.isVisible()) {
      await acknowledgement.getByRole('checkbox').check();
      await form.getByRole('button', { name: 'Save with warnings' }).click();
    }
    await expect(form).toBeHidden();
    const heading = (await panel.getByRole('heading').innerText()).trim();
    const cloneId = heading.replace('Transaction ', '');
    expect(cloneId).not.toBe(source.id);
    expect(await getRow(page, cloneId)).toMatchObject({
      status: 'unposted',
      quantity: { value: '777.0000' },
      portfolio: { id: source.portfolio.id },
    });
    await panel.getByRole('tab', { name: 'History' }).click();
    await expect(panel.locator('[data-slot="record-history"]')).toContainText('Created as a clone');
    await expect(panel.locator('[data-slot="record-history"]')).toContainText(source.id);
    await panel.getByRole('button', { name: 'Close' }).click();

    // 6. Post one record: one confirm, and it is posted.
    await focusRow(page, source.id);
    await page.keyboard.press('ControlOrMeta+Enter');
    const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: /Post/ }));
    await confirm.getByRole('button', { name: /^Post/ }).click();
    await expect.poll(async () => (await getRow(page, source.id)).status).toBe('posted');

    // 7. Ben opens the same record: Reverse is there, disabled, and says why.
    const benContext = await browser.newContext({ baseURL: test.info().project.use.baseURL as string });
    const ben = await benContext.newPage();
    await openBlotter(ben, 'u-ben');
    await searchFor(ben, source.id);
    await focusRow(ben, source.id);
    await ben.keyboard.press('Space');
    const reverse = ben
      .getByRole('group', { name: 'Actions for selected transactions' })
      .getByRole('button', { name: 'Reverse' });
    await expect(reverse).toHaveAttribute('aria-disabled', 'true');
    await reverse.focus();
    await expect(ben.getByRole('tooltip')).toContainText(
      'Reversing a posted transaction needs full access on transactions.',
    );
    await benContext.close();
  });
});

test.describe('transaction entry form', () => {
  test('field errors show on the field, a warning must be acknowledged, and the acknowledgement is audited', async ({
    page,
  }) => {
    const [like] = (await recentTrades(page, ['buy'], 1, 60)) as [Row];
    await openBlotter(page, 'u-ada');
    await toolbarAction(page, 'transaction.new').click();
    const form = page.getByRole('dialog', { name: 'New transaction' });
    await expect(form).toBeVisible();

    // Saving an empty form: every missing field is named, on the field.
    await form.getByRole('button', { name: 'Save as unposted' }).click();
    await expect(form.getByText(/fields need fixing/)).toBeVisible();
    await expect(form.getByText('Portfolio is required.')).toBeVisible();
    await expect(form.getByText('Quantity is required for this type.')).toBeVisible();

    const choose = async (label: RegExp, text: string) => {
      await form.getByRole('combobox', { name: label }).fill(text);
      await form.getByRole('listbox').getByRole('option').first().click();
    };
    await choose(/^Portfolio/, like.portfolio.id);
    await choose(/^Security/, (like.security as { id: string }).id);
    await expect(form.getByText('Portfolio is required.')).toBeHidden();

    // A settle date before the trade date is an error from the server, shown on the settle date.
    const trade = form.getByRole('textbox', { name: /^Trade date/ });
    const settle = form.getByRole('textbox', { name: /^Settle date/ });
    await trade.fill('2026-11-13');
    await settle.fill('2026-11-10');
    await form.getByRole('textbox', { name: /^Quantity/ }).fill('1.5k');
    await form.getByRole('textbox', { name: /^Price/ }).fill('100');
    await form.getByRole('button', { name: 'Save as unposted' }).click();
    await expect(form.getByText('Settlement date is before trade date.')).toBeVisible();

    // A late settle date is only a warning: it can be saved, but not without saying so.
    await settle.fill('2026-11-27');
    await form.getByRole('button', { name: 'Save as unposted' }).click();
    const acknowledgement = form.locator('[data-slot="warning-acknowledgement"]');
    await expect(acknowledgement).toContainText('Settlement date is later than usual');
    const save = form.getByRole('button', { name: 'Save with warnings' });
    await expect(save).toBeDisabled();
    await expect(form.locator('[data-slot="save-blocked-reason"]')).toContainText('Tick the box above');
    await acknowledgement.getByRole('checkbox').check();
    await save.click();
    await expect(form).toBeHidden();

    const panel = page.getByRole('complementary', { name: 'Transaction detail' });
    const id = (await panel.getByRole('heading').innerText()).replace('Transaction ', '').trim();
    const created = await getRow(page, id);
    expect(created).toMatchObject({ status: 'unposted', type: 'buy', quantity: { value: '1500.0000' } });
    const [event] = await auditOf(page, id);
    expect(event).toMatchObject({ action: 'transaction.create', note: { kind: 'warningAcknowledged' } });
    await panel.getByRole('tab', { name: 'History' }).click();
    await expect(panel.locator('[data-slot="record-history"]')).toContainText('Warning acknowledged');
  });

  test('something that is not a number never saves the value underneath it', async ({ page }) => {
    await openBlotter(page, 'u-ada');
    await toolbarAction(page, 'transaction.new').click();
    const form = page.getByRole('dialog', { name: 'New transaction' });
    await form.getByRole('textbox', { name: /^Quantity/ }).fill('lots');
    await form.getByRole('button', { name: 'Save as unposted' }).click();
    await expect(form.getByText('A field holds something that could not be read.')).toBeVisible();
    await expect(form).toBeVisible();
  });

  test('a user who cannot create sees New transaction disabled with the reason', async ({ page }) => {
    await openBlotter(page, 'u-dev');
    const button = toolbarAction(page, 'transaction.new');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveAttribute('title', /role/i);
    await button.click({ force: true });
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test.describe('spreadsheet import', () => {
  test('a file with unknown headers goes through mapping; an error blocks the commit until the row is excluded', async ({
    page,
  }) => {
    const [like] = (await recentTrades(page, ['buy'], 1, 61)) as [Row];
    const security = (like.security as { id: string }).id;
    const csv = [
      'Fund,Instrument,Side,Deal date,Nominal,Px,Desk note',
      `${like.portfolio.id},${security},Purchase,13/11/2026,"1,000",100,ok`,
      `${like.portfolio.id},${security},Purchase,13/11/2026,2k,100,ok`,
      `${like.portfolio.id},NOT-A-SECURITY,Purchase,13/11/2026,5,100,typo`,
    ].join('\n');
    await openBlotter(page, 'u-ada');
    await toolbarAction(page, 'transaction.import').click();
    await importDialog(page)
      .getByLabel('Or choose a CSV or Excel file')
      .setInputFiles({ name: 'desk-trades.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

    // Mapping step: known headers are matched, the unknown one is called out, nothing is silently dropped.
    const mapping = importDialog(page).getByRole('table', { name: 'Column mapping' });
    await expect(mapping).toBeVisible();
    await expect(importDialog(page).getByLabel('Import Nominal as')).toHaveValue('quantity');
    await expect(importDialog(page).getByLabel('Import Deal date as')).toHaveValue('tradeDate');
    await expect(importDialog(page).getByLabel('Import Desk note as')).toHaveValue('');
    await expect(importDialog(page).locator('[data-slot="mapping-status"]')).toContainText(
      '1 column will not be imported: Desk note.',
    );
    await importDialog(page).getByRole('button', { name: 'Check rows' }).click();

    await expect(summary(page)).toContainText('1 error');
    await expect(importDialog(page).getByText('There is no security NOT-A-SECURITY.')).toBeVisible();
    await expect(importDialog(page).getByRole('button', { name: /^Import 3 rows/ })).toBeDisabled();
    await importDialog(page).getByRole('checkbox', { name: 'Include row 3' }).uncheck();
    await expect(summary(page)).toContainText('1 excluded');
    await expect(importStatus(page)).toContainText('2 new');
    await importDialog(page)
      .getByRole('button', { name: /^Import 2 rows/ })
      .click();
    await expect(page.locator('[data-slot="import-confirm"]')).toContainText(
      '1 excluded row will be left out.',
    );
    await expect(page.locator('[data-slot="import-confirm"]')).toContainText('desk-trades.csv');
    await confirmImport(page);

    // The new rows exist, are unposted, came in as imported, and carry the file as evidence.
    const res = await page.request.post('/api/v1/transactions/query', {
      headers: ADA,
      data: {
        startRow: 0,
        endRow: 2,
        sort: [{ field: 'id', dir: 'desc' }],
        filters: [{ field: 'securityId', op: 'eq', value: security }],
      },
    });
    const newest = ((await res.json()) as { rows: Row[] }).rows;
    const imported = [];
    for (const row of newest) {
      const [event] = await auditOf(page, row.id);
      if (event?.evidence?.[0]?.label === 'desk-trades.csv') imported.push(event);
    }
    expect(imported.length).toBeGreaterThan(0);
    expect(imported[0]).toMatchObject({ action: 'transaction.import', after: { source: 'imported' } });
  });

  test('a 5,000-row paste is checked in under 5 seconds and shows the rows with errors', async ({ page }) => {
    const [like] = (await recentTrades(page, ['buy'], 1, 62)) as [Row];
    const security = (like.security as { id: string }).id;
    const lines = Array.from(
      { length: 5000 },
      (_, i) => `${like.portfolio.id}\t${security}\tbuy\t2026-11-13\t${i % 500 === 3 ? 'bad' : 100 + i}\t100`,
    );
    await openBlotter(page, 'u-ada');
    await toolbarAction(page, 'transaction.import').click();
    await paste(
      page,
      '[data-slot="import-paste"]',
      ['Portfolio\tSecurity\tType\tTrade date\tQuantity\tPrice', ...lines].join('\n'),
    );
    // Above 500 rows a paste goes through the mapping step, like a file.
    await expect(importDialog(page).locator('[data-slot="mapping-status"]')).toContainText(
      'Every column is mapped.',
    );
    const started = Date.now();
    await importDialog(page).getByRole('button', { name: 'Check rows' }).click();
    await expect(summary(page)).toContainText('10 errors', { timeout: 5000 });
    expect(Date.now() - started).toBeLessThan(5000);
    await expect(summary(page)).toContainText('5,000 rows:');
    await importDialog(page).getByRole('button', { name: 'Errors (10)' }).click();
    await expect(batchCell(page, 'Quantity, row 4')).toHaveAttribute('aria-invalid', 'true');
    await expect(importDialog(page).getByRole('button', { name: /^Import 5,000 rows/ })).toBeDisabled();
    // Closing is explicit once rows are in: Escape does not throw them away.
    await page.keyboard.press('Escape');
    await expect(importDialog(page)).toBeVisible();
    await importDialog(page).getByRole('button', { name: 'Discard and close' }).click();
    await expect(importDialog(page)).toBeHidden();
  });
});

test.describe('delta column and glossary', () => {
  test('Price vs vendor is off by default, turns on from Columns, and marks each price against the tolerance in words', async ({
    page,
  }) => {
    await openBlotter(page, 'u-ada');
    await expect(page.locator('.ag-header-cell[col-id="priceVsVendor"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Price vs vendor' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ag-header-cell[col-id="priceVsVendor"]')).toBeVisible();
    const cells = page.locator('[data-slot="delta-cell"][data-level]');
    await expect(cells.first()).toBeVisible();
    const marked = page.locator('[data-slot="delta-cell"]:not([data-level="none"])').first();
    await expect(marked).toHaveText(/^[+-]?\d[\d,]*\.\d{2}%(Within|Near limit|Breach)$/);
    await expect(marked).toHaveAttribute(
      'aria-label',
      /(above|below|the same as) vendor, .* against a 5% tolerance/,
    );
  });

  test('a new user gets definitions on domain terms; an experienced user does not', async ({
    page,
    browser,
  }) => {
    const [row] = (await recentTrades(page, ['sell'], 1, 5)) as [Row];
    await openBlotter(page, 'u-ben');
    await searchFor(page, row.id);
    await focusRow(page, row.id);
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Transaction detail' });
    const term = panel.getByRole('button', { name: 'Unposted: show definition' });
    await expect(term).toBeVisible();
    await term.focus();
    await expect(page.getByRole('tooltip')).toContainText('Entered but not yet in the ledger');
    // Once read, the term goes back to plain text for the rest of the session.
    await page.keyboard.press('Escape');
    await expect(term).toHaveCount(0);
    await expect(panel.getByText('Unposted', { exact: true })).toBeVisible();

    const adaContext = await browser.newContext({ baseURL: test.info().project.use.baseURL as string });
    const ada = await adaContext.newPage();
    await openBlotter(ada, 'u-ada');
    await searchFor(ada, row.id);
    await focusRow(ada, row.id);
    await ada.keyboard.press('Enter');
    const adaPanel = ada.getByRole('complementary', { name: 'Transaction detail' });
    await expect(adaPanel.getByRole('heading')).toBeVisible();
    await expect(adaPanel.locator('[data-slot="glossary-term"]')).toHaveCount(0);
    await adaContext.close();
  });
});
