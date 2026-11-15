import { expect, test, type Page } from '@playwright/test';

/** Milestone 2: saved views and workspaces (SPEC 7.2), Entity Picker (7.3), date and period fields (7.6). */

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
const tags = (page: Page) =>
  page
    .getByRole('list', { name: 'Active filters' })
    .getByRole('listitem')
    .filter({ hasNot: page.getByRole('button', { name: 'Clear all' }) });
const viewButton = (page: Page) => page.locator('[data-slot="view-selector"]');
const lastQuery = (page: Page, predicate: (body: Record<string, unknown>) => boolean) =>
  page.waitForRequest(
    (r) =>
      r.url().endsWith('/transactions/query') &&
      predicate((r.postDataJSON() ?? {}) as Record<string, unknown>),
  );

async function openTransactions(page: Page, userId: string, query = '?view=V-transactions-default') {
  await signIn(page, userId);
  await page.goto(`/transactions${query}`);
  await expect(statusBar(page)).toContainText(/\d rows?/);
}
const selectView = async (page: Page, name: string | RegExp) => {
  await viewButton(page).click();
  await page.getByRole('menuitemradio', { name }).click();
};

test.describe('saved views', () => {
  test('a new user starts on their team default view, never an empty list', async ({ page }) => {
    await signIn(page, 'u-ben');
    await page.goto('/transactions');
    await expect(viewButton(page)).toContainText("Yesterday's unposted trades");
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await viewButton(page).click();
    await expect(page.getByRole('menuitemradio')).toHaveCount(3);
  });

  test('the active filter count on screen equals the conditions applied to the query', async ({ page }) => {
    await signIn(page, 'u-ada');
    const first = lastQuery(page, (b) => Array.isArray(b.filters));
    await page.goto('/transactions?view=V-transactions-unposted-yesterday');
    const sent = ((await first).postDataJSON() as { filters: unknown[] }).filters;
    // The view's two conditions, each a visible tag. "Yesterday" was sent as relative, not as a date.
    expect(sent).toEqual([
      { field: 'status', op: 'eq', value: 'unposted' },
      { field: 'tradeDate', op: 'relative', period: 'yesterday' },
    ]);
    await expect(tags(page)).toHaveText(['Status is unposted', 'Trade date is yesterday']);

    // Add a chip and a search: four conditions sent, four tags shown.
    const chip = lastQuery(page, (b) => (b.filters as unknown[] | undefined)?.length === 3);
    await page.getByRole('button', { name: 'Warnings only' }).click();
    await chip;
    const searched = lastQuery(page, (b) => b.quickSearch === 'ord');
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('ord');
    const body = (await searched).postDataJSON() as { filters: unknown[]; quickSearch: string };
    expect(body.filters).toHaveLength(3);
    await expect(tags(page)).toHaveCount(4);
    await expect(tags(page).nth(0)).toHaveText('Search: ord');

    // Removing a tag removes exactly that condition; Clear all removes the rest.
    const removed = lastQuery(
      page,
      (b) => (b.filters as unknown[] | undefined)?.length === 2 && b.quickSearch === 'ord',
    );
    await page.getByRole('button', { name: 'Remove filter: Warning is not empty' }).click();
    await removed;
    await expect(page.getByRole('button', { name: 'Warnings only' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
    await expect(statusBar(page)).toContainText('5,000 rows');
  });

  test('a saved view restores columns, sort, filters, search, grouping and density exactly', async ({
    page,
  }) => {
    await openTransactions(page, 'u-dev');
    const name = `Dev check ${Date.now()}`;

    // Change every part of the view.
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Settle date' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Quantity' }).click();
    await page.keyboard.press('Escape');
    await page.locator('.ag-header-cell[col-id="amount"]').click();
    await page.locator('.ag-header-cell[col-id="amount"]').click();
    await page.getByRole('button', { name: 'Warnings only' }).click();
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('treasury');
    await page.getByRole('button', { name: 'Group' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Status' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Density' }).click();
    await page.getByRole('menuitemradio', { name: 'Comfortable' }).click();
    await expect(page.locator('[data-slot="view-dirty"]')).toHaveText('edited');

    await viewButton(page).click();
    await page.getByRole('menuitem', { name: 'Save as new view…' }).click();
    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Save view' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'View saved' })).toBeVisible();
    await expect(viewButton(page)).toContainText(name);
    await expect(page.locator('[data-slot="view-dirty"]')).toHaveCount(0);

    // Go to the default view: everything goes back.
    await selectView(page, 'All transactions');
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
    await expect(page.locator('.ag-header-cell[col-id="settleDate"]')).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Quick search transactions' })).toHaveValue('');
    await expect(page.locator('.ag-row-group').first()).toHaveCount(0);

    // Open the saved view again and reload the page on it: it comes back exactly.
    await selectView(page, name);
    await expect(page).toHaveURL(/view=V-\d+/);
    const restored = lastQuery(page, (b) => b.quickSearch === 'treasury' && Array.isArray(b.groupBy));
    await page.reload();
    const body = (await restored).postDataJSON() as Record<string, unknown>;
    expect(body.filters).toEqual([{ field: 'warning', op: 'isNotNull' }]);
    expect(body.groupBy).toEqual(['status']);
    await expect(viewButton(page)).toContainText(name);
    await expect(page.locator('[data-slot="view-dirty"]')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
    await expect(page.getByRole('searchbox', { name: 'Quick search transactions' })).toHaveValue('treasury');
    await expect(tags(page)).toHaveText(['Search: treasury', 'Warning is not empty']);
    await expect(page.locator('.ag-header-cell[col-id="settleDate"]')).toHaveCount(0);
    await expect(page.locator('.ag-header-cell[col-id="quantity"]')).toHaveCount(0);
    await expect(page.locator('.ag-header-cell[col-id="amount"]')).toHaveAttribute('aria-sort', 'descending');
    await expect(page.getByRole('button', { name: /Group.*1/ })).toBeVisible();
    await expect(page.locator('.ag-row-group').first()).toBeVisible();
    // Opening a group loads its records, sorted as the view says.
    const leaf = lastQuery(
      page,
      (b) => Array.isArray(b.groupKeys) && (b.groupKeys as unknown[]).length === 1,
    );
    await page.locator('.ag-row-group .ag-group-contracted').first().click();
    expect(((await leaf).postDataJSON() as { sort: unknown[] }).sort).toEqual([
      { field: 'amount', dir: 'desc' },
    ]);
  });

  test('a user cannot overwrite a shared view they do not own: saving makes a personal copy', async ({
    page,
  }) => {
    await openTransactions(page, 'u-ben', '?view=V-transactions-unposted-yesterday');
    await page.getByRole('button', { name: 'My records' }).click();
    await expect(page.locator('[data-slot="view-dirty"]')).toBeVisible();
    await viewButton(page).click();
    await expect(page.getByRole('menuitem', { name: 'Save changes' })).toHaveCount(0);
    const copy = page.getByRole('menuitem', { name: /Save as my copy/ });
    await expect(copy).toContainText('Only Ada can change this view.');
    await copy.click();
    await expect(page.getByLabel('Name')).toHaveValue("Yesterday's unposted trades (my copy)");
    await page.getByRole('button', { name: 'Save view' }).click();
    await expect(viewButton(page)).toContainText("Yesterday's unposted trades (my copy)");

    // The shared view itself is untouched, and the server refuses a direct overwrite.
    const shared = await page.request.get('/api/v1/views?gridId=transactions', {
      headers: { 'X-LL-User': 'u-ada' },
    });
    const original = ((await shared.json()) as { id: string; state: { filters: unknown[] } }[]).find(
      (v) => v.id === 'V-transactions-unposted-yesterday',
    );
    expect(original?.state.filters).toHaveLength(2);
    const direct = await page.request.put('/api/v1/views/V-transactions-unposted-yesterday', {
      headers: { 'X-LL-User': 'u-ben' },
      data: {
        gridId: 'transactions',
        name: 'x',
        ownership: 'shared',
        schemaVersion: 2,
        state: { columns: [], sort: [], filters: [] },
      },
    });
    expect(direct.status()).toBe(403);
  });

  test('a view saved before a column rename still loads; a removed column is dropped with a warning', async ({
    page,
  }) => {
    await openTransactions(page, 'u-ada', '?view=V-transactions-legacy-sells');
    await expect(viewButton(page)).toContainText('Large sells (old layout)');
    // portfolioId and securityId were renamed: the columns are there, in the saved order, and the sort still applies.
    const order = await page
      .locator('.ag-header-cell')
      .evaluateAll((cells) =>
        cells
          .map((c) => c.getAttribute('col-id'))
          .filter((id) => id && !id.startsWith('ag-') && !id.startsWith('__')),
      );
    expect(order.slice(0, 6)).toEqual(['id', 'tradeDate', 'security', 'portfolio', 'amount', 'status']);
    await expect(page.locator('.ag-header-cell[col-id="security"]')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(tags(page)).toHaveText(['Type is sell', 'Amount more than 1000000']);
    // The currency column no longer exists: said plainly, not silently ignored.
    const warning = page.getByRole('status').filter({ hasText: 'no longer exists' });
    await expect(warning).toContainText('This view used a column that no longer exists: currency.');
    await expect(warning).toContainText('LL-VIEW-0002');
  });

  test('restore default goes back to the default view, not an empty grid', async ({ page }) => {
    await openTransactions(page, 'u-ada', '?view=V-transactions-unposted-yesterday');
    await viewButton(page).click();
    await page.getByRole('menuitem', { name: 'Restore default' }).click();
    await expect(viewButton(page)).toContainText('All transactions');
    await expect(statusBar(page)).toContainText('5,000 rows');
    await expect(page.locator('.ag-header-cell[col-id="tradeDate"]')).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  test('the URL carries the view and unsaved changes, so a view can be shared by link', async ({
    page,
    context,
  }) => {
    await openTransactions(page, 'u-ada');
    await page.getByRole('button', { name: 'Warnings only' }).click();
    const searched = page.waitForResponse(
      (r) =>
        r.url().endsWith('/transactions/query') &&
        (r.request().postDataJSON() as { quickSearch?: string }).quickSearch === 'gilt',
    );
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('gilt');
    const total = ((await (await searched).json()) as { totalRows: number }).totalRows;
    await expect(statusBar(page)).toContainText(`${total} row`);
    await expect(page).toHaveURL(/view=V-transactions-default&d=[\w-]+/);
    await expect(tags(page)).toHaveCount(2);
    const rows = await statusBar(page).innerText();

    // Someone else opens the link.
    const other = await context.newPage();
    await other.addInitScript(() =>
      localStorage.setItem(
        'll-session',
        JSON.stringify({
          state: { userId: 'u-cleo', theme: 'light', density: null, railCollapsed: false },
          version: 0,
        }),
      ),
    );
    await other.goto(page.url());
    await expect(other.getByRole('searchbox', { name: 'Quick search transactions' })).toHaveValue('gilt');
    await expect(other.getByRole('button', { name: 'Warnings only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(other.locator('[data-slot="view-dirty"]')).toHaveText('edited');
    await expect(other.locator('[data-slot="status-bar"]')).toContainText(rows.split('\n')[0] as string);
  });
});

test.describe('workspaces', () => {
  test('a workspace marked load-at-startup opens on sign-in with all its panels', async ({ page }) => {
    await signIn(page, 'u-ada');
    await page.goto('/');
    await expect(page).toHaveURL(/\/w\/W-txn-ops$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Transaction Operations' })).toBeVisible();
    await expect(page.getByText('Team default')).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Transaction Operations panels' }).getByRole('tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toContainText('All transactions');
    await expect(tabs.nth(1)).toContainText("Yesterday's unposted trades");
    await expect(statusBar(page)).toContainText('5,000 rows');
    // The second panel opens on its own view. Tabs move with arrow keys.
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(viewButton(page)).toContainText("Yesterday's unposted trades");
    await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Status is unposted');
  });

  test('each role starts in its own team workspace; panels not built yet say so', async ({ page }) => {
    await signIn(page, 'u-cleo');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Period close' })).toBeVisible();
    await expect(page.getByText('Not built yet')).toBeVisible();
    await expect(page.getByText('Period close arrives in Milestone 6')).toBeVisible();
  });

  test('a user with no start-up workspace lands on their access page', async ({ page }) => {
    await signIn(page, 'u-eli');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Signed in as Eli' })).toBeVisible();
  });

  test('a team default cannot be changed by a member; saving makes their own, which then opens at sign-in', async ({
    page,
  }) => {
    await signIn(page, 'u-ben');
    await page.goto('/w/W-txn-ops');
    await page.getByRole('button', { name: 'Edit workspace' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit workspace' });
    await expect(dialog).toContainText('This workspace belongs to Ada.');
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await dialog.getByLabel('Name').fill("Ben's morning");
    await dialog.getByLabel('Group (optional)').fill('Daily');
    await dialog.getByLabel(/Single: the first panel only/).check();
    await dialog.getByRole('button', { name: 'Remove panel 1' }).click();
    await dialog.getByRole('button', { name: 'Save as new' }).click();

    await expect(page.getByRole('heading', { level: 1, name: "Ben's morning" })).toBeVisible();
    await expect(page.getByText('Daily', { exact: true })).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(viewButton(page)).toContainText("Yesterday's unposted trades");
    // His own start-up workspace now comes before the team default.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: "Ben's morning" })).toBeVisible();
    // The switcher lists both.
    await page.getByRole('button', { name: /^Workspace:/ }).click();
    await expect(page.getByRole('menuitem', { name: /Transaction Operations.*Team default/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Ben's morning.*Yours/ })).toBeVisible();
  });

  test('a panel pops out into its own window and stays in sync: selection, refresh, bring back', async ({
    page,
    context,
  }) => {
    await signIn(page, 'u-ada');
    await page.goto('/w/W-txn-ops');
    await expect(statusBar(page)).toContainText('5,000 rows');

    const [popout] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Pop out Transactions' }).click(),
    ]);
    await popout.waitForLoadState();
    await expect(popout.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible();
    await expect(popout.getByText('Popped out of Transaction Operations')).toBeVisible();
    await expect(popout.getByRole('navigation', { name: 'Domains' })).toHaveCount(0);
    await expect(popout.locator('[data-slot="status-bar"]')).toContainText('5,000 rows');

    // The main window knows the panel is out, and sees the selection made there.
    const placeholder = page.locator('[data-slot="popped-out"]');
    await expect(placeholder).toContainText('Transactions is open in its own window');
    await popout.locator('.ag-row[row-index="1"] [col-id="type"]').first().click();
    await popout.keyboard.press('Space');
    await popout.keyboard.press('ArrowDown');
    await popout.keyboard.press('Space');
    await expect(placeholder.getByRole('status')).toContainText('2 rows selected there');

    // A refresh in the pop-out refreshes the other panel in the main window too.
    await page.getByRole('tab', { name: /Yesterday's unposted trades/ }).click();
    await expect(statusBar(page)).toContainText(/rows?/);
    const mainReload = page.waitForRequest((r) => r.url().endsWith('/transactions/query'));
    await popout.getByRole('button', { name: 'Refresh' }).click();
    await mainReload;

    // Bring it back: the pop-out closes and the panel returns.
    await page.getByRole('tab', { name: /All transactions/ }).click();
    const closed = popout.waitForEvent('close');
    await placeholder.getByRole('button', { name: 'Bring it back here' }).click();
    await closed;
    await expect(placeholder).toHaveCount(0);
    await expect(statusBar(page)).toContainText('5,000 rows');
  });
});

test.describe('Entity Picker', () => {
  const isinOf = async (page: Page) => {
    const res = await page.request.post('/api/v1/transactions/query', {
      headers: { 'X-LL-User': 'u-ada' },
      data: { startRow: 0, endRow: 1, filters: [{ field: 'type', op: 'eq', value: 'buy' }] },
    });
    const row = (
      (await res.json()) as { rows: { security: { id: string; label: string; altIds: { isin: string } } }[] }
    ).rows[0];
    return row?.security as { id: string; label: string; altIds: { isin: string } };
  };

  test('pasting a known ISIN selects the security in one step', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openTransactions(page, 'u-ada');
    const security = await isinOf(page);
    await page.evaluate((text) => navigator.clipboard.writeText(text), security.altIds.isin);
    const picker = page.getByRole('combobox', { name: 'Security', exact: true });
    await picker.focus();
    const filtered = lastQuery(page, (b) => JSON.stringify(b.filters ?? []).includes(security.id));
    await page.keyboard.press('Control+v');
    await filtered;
    // One paste: the security is chosen, the grid is filtered, the filter is a visible tag.
    await expect(picker).toHaveAttribute('placeholder', `${security.label} (${security.id})`);
    await expect(tags(page)).toHaveText([`Security is ${security.id}`]);
    await expect(page.getByRole('option')).toHaveCount(0);
  });

  test('typing searches after two characters and shows id, description, type, currency and parent', async ({
    page,
  }) => {
    await openTransactions(page, 'u-ada');
    const picker = page.getByRole('combobox', { name: 'Security', exact: true });
    await picker.fill('t');
    await expect(page.getByText('search starts at 2 characters')).toBeVisible();
    await picker.fill('treasury');
    const option = page.getByRole('option').first();
    await expect(option).toContainText(/S-\d{7}/);
    await expect(option).toContainText('TREASURY');
    await expect(option).toContainText('govt');
    await expect(option).toContainText(/USD|EUR|GBP|JPY/);
    await page.keyboard.press('Enter');
    await expect(tags(page)).toHaveText([/^Security is S-\d{7}$/]);
    // The pick is remembered as a recent item.
    await page.getByRole('button', { name: /^Clear Security/ }).click();
    await expect(
      page.getByRole('listbox', { name: 'Recent security' }).getByRole('option').first(),
    ).toContainText('TREASURY');
  });

  test('restricted records appear with their reason and cannot be chosen', async ({ page }) => {
    await openTransactions(page, 'u-eli');
    const picker = page.getByRole('combobox', { name: 'Portfolio', exact: true });
    await picker.fill('P-00');
    const restricted = page.getByRole('option', { name: /P-0001/ });
    await expect(restricted).toHaveAttribute('aria-disabled', 'true');
    await expect(restricted).toHaveAccessibleName(/Restricted: Outside your account scope\./);
    // Forced: the option is marked disabled, which is the point of the test.
    await restricted.click({ force: true });
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
    // A record in scope can be chosen.
    await picker.fill('P-0007');
    await page.getByRole('option', { name: /P-0007/ }).click();
    await expect(tags(page)).toHaveText(['Portfolio is P-0007']);
  });

  test('the sheet searches by criteria and selects several records at once', async ({ page }) => {
    await openTransactions(page, 'u-ada');
    await page.getByRole('button', { name: 'Choose several…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Choose securities' });
    await sheet.getByLabel('Type').selectOption('govt');
    await sheet.getByLabel('Currency').selectOption('GBP');
    const list = sheet.getByRole('list', { name: 'Choose securities results' });
    await expect(list.getByRole('listitem').first()).toContainText('UK TSY GILT');
    await list.getByRole('checkbox').nth(0).check();
    await list.getByRole('checkbox').nth(1).check();
    await list.getByRole('checkbox').nth(2).check();
    await sheet.getByRole('button', { name: 'Use 3 selected' }).click();
    await expect(tags(page)).toHaveText([/^Security is one of S-\d{7}, S-\d{7}, S-\d{7}$/]);
    await expect(page.getByRole('combobox', { name: 'Security', exact: true })).toHaveAttribute(
      'placeholder',
      '3 securities chosen',
    );
  });

  test('global search finds a portfolio by id and opens its transactions, with the filter visible', async ({
    page,
  }) => {
    await signIn(page, 'u-ada');
    await page.goto('/profile');
    const search = page.getByRole('combobox', { name: 'Search portfolios and securities' });
    await search.fill('P-0005');
    await page.getByRole('option', { name: /P-0005/ }).click();
    await expect(page).toHaveURL(/\/transactions\?view=V-transactions-default&d=/);
    await expect(tags(page)).toHaveText(['Portfolio is P-0005']);
    await expect(statusBar(page)).not.toContainText('5,000 rows');
    // Searching again while already on Transactions re-applies the new link.
    await search.fill('P-0006');
    await page.getByRole('option', { name: /P-0006/ }).click();
    await expect(tags(page)).toHaveText(['Portfolio is P-0006']);
  });
});

test.describe('date and period fields', () => {
  test.use({ viewport: { width: 1920, height: 900 } });

  const unposted = async (page: Page, index: number) => {
    const res = await page.request.post('/api/v1/transactions/query', {
      headers: { 'X-LL-User': 'u-ada' },
      data: {
        startRow: 0,
        endRow: 50,
        sort: [{ field: 'id', dir: 'desc' }],
        filters: [
          { field: 'status', op: 'eq', value: 'unposted' },
          { field: 'type', op: 'eq', value: 'sell' },
        ],
      },
    });
    return ((await res.json()) as { rows: { id: string; tradeDate: { value: string; calendar: string } }[] })
      .rows[index] as { id: string; tradeDate: { value: string; calendar: string } };
  };
  const open = async (page: Page, id: string) => {
    await openTransactions(page, 'u-ada');
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill(id);
    await expect(statusBar(page)).toContainText('1 row');
    await page.locator(`.ag-row[row-id="${id}"] [col-id="type"]`).first().dblclick();
    return page.getByRole('complementary', { name: 'Transaction detail' });
  };

  test('every date shows its basis; t+2 on a Friday trade resolves to Tuesday and saves', async ({
    page,
  }) => {
    const row = await unposted(page, 0);
    const panel = await open(page, row.id);
    await expect(panel.getByText('Trade basis')).toBeVisible();
    await expect(panel.getByText('Settle basis')).toBeVisible();

    const trade = panel.getByLabel(/^Trade date/);
    await trade.fill('2026-11-13');
    await trade.blur();
    const settle = panel.getByLabel(/^Settle date/);
    // The settle field counts from the trade date: Friday 13 Nov + 2 business days = Tuesday 17 Nov.
    await settle.fill('t+2');
    await expect(panel.getByText(/Tue 17 Nov 2026/)).toBeVisible();
    await settle.blur();
    await expect(settle).toHaveValue('17 Nov 2026');
    await panel.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(page.locator(`.ag-row[row-id="${row.id}"] [col-id="settleDate"]`).first()).toHaveText(
      '17 Nov 2026',
    );
  });

  test('a weekend settle date warns and shows the adjusted business day', async ({ page }) => {
    const row = await unposted(page, 1);
    const panel = await open(page, row.id);
    const settle = panel.getByLabel(/^Settle date/);
    await settle.fill('2026-11-21');
    await settle.blur();
    await expect(panel.getByRole('status').filter({ hasText: 'not a business day' })).toContainText(
      '21 Nov 2026 is a Saturday, not a business day. Moved to Mon 23 Nov 2026.',
    );
    await expect(settle).toHaveValue('23 Nov 2026');
  });

  test('entry into a closed period is blocked; the message names the period and the reopen role', async ({
    page,
  }) => {
    const row = await unposted(page, 2);
    const panel = await open(page, row.id);
    const trade = panel.getByLabel(/^Trade date/);
    await trade.fill('15 Sep 2026');
    await trade.blur();
    const alert = panel.getByRole('alert').filter({ hasText: 'closed' });
    await expect(alert).toContainText('Sep 2026 is closed for transactions in this portfolio.');
    await expect(alert).toContainText('ask a controller in Investment Accounting to reopen it');
    await expect(trade).toHaveAttribute('aria-invalid', 'true');
    // Nothing was staged, so there is nothing to save.
    await expect(panel.getByRole('button', { name: 'Save' })).toBeDisabled();

    // The server enforces the same rule for anyone who bypasses the screen.
    const direct = await page.request.patch(`/api/v1/transactions/${row.id}`, {
      headers: { 'X-LL-User': 'u-ada', 'If-Match': '1' },
      data: { dates: { tradeDate: '2026-09-15', settleDate: '2026-09-17' } },
    });
    expect(direct.status()).toBe(422);
    const message = ((await direct.json()) as { messages: { code: string; text: string; fix: string }[] })
      .messages[0];
    expect(message?.code).toBe('LL-PER-0001');
    expect(message?.text).toContain('period ending 2026-09-30');
    expect(message?.fix).toContain('controller in Investment Accounting');
  });

  test('no date renders as a dash labelled "No date"', async ({ page }) => {
    await openTransactions(page, 'u-ada');
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill('T-00');
    const none = page.locator('.ag-row [col-id="settleDate"]').getByLabel('No date').first();
    await expect(none).toHaveText('—');
  });
});
