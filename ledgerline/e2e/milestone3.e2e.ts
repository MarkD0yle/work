import { expect, test, type Page } from '@playwright/test';

/** Milestone 3: shell, action registry (SPEC 7.8) and command palette (SPEC 6). */

/** Shortcut labels follow the platform (`formatShortcut`): symbols on a Mac, words elsewhere. */
const keys =
  process.platform === 'darwin'
    ? { post: '⌘↵', delete: '⌫', open: '↵' }
    : { post: 'Ctrl+Enter', delete: 'Delete', open: 'Enter' };

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

interface Row {
  id: string;
  status: string;
}
/** Tests share one database and run in parallel: each takes its own transactions, from the end of the list. */
async function pick(page: Page, status: 'unposted' | 'posted', offset: number, count = 1): Promise<Row[]> {
  const res = await page.request.post('/api/v1/transactions/query', {
    headers: { 'X-LL-User': 'u-ada' },
    data: {
      startRow: 0,
      endRow: 200,
      sort: [{ field: 'id', dir: 'desc' }],
      filters: [
        { field: 'status', op: 'eq', value: status },
        { field: 'type', op: 'eq', value: 'income' },
      ],
    },
  });
  return ((await res.json()) as { rows: Row[] }).rows.slice(offset, offset + count);
}
const statusOf = async (page: Page, id: string) => {
  const res = await page.request.get(`/api/v1/transactions/${id}`, { headers: { 'X-LL-User': 'u-ada' } });
  return res.ok() ? ((await res.json()) as Row).status : 'gone';
};

async function openOn(page: Page, userId: string, ids: string[]) {
  await signIn(page, userId);
  await page.goto('/transactions?view=V-transactions-default');
  // A search that matches exactly these records keeps each test on its own rows.
  await expect(statusBar(page)).toContainText(/[45],\d{3} rows/);
  const picker = page.getByRole('searchbox', { name: 'Quick search transactions' });
  await picker.fill(ids[0] as string);
  await expect(statusBar(page)).toContainText('1 row');
}
const focusRow = (page: Page, id: string) =>
  page.locator(`.ag-row[row-id="${id}"] [col-id="type"]`).first().click();

test.describe('action registry', () => {
  test('the same action has the same label and shortcut in the toolbar, the menus and the palette', async ({
    page,
  }) => {
    const [row] = (await pick(page, 'unposted', 0)) as [Row];
    await openOn(page, 'u-ada', [row.id]);
    await focusRow(page, row.id);
    const seen: Record<string, string[]> = {};
    const record = async (surface: string, locator: ReturnType<Page['locator']>) => {
      for (const el of await locator.all()) {
        const id =
          (await el.getAttribute('data-action-id')) ?? (await el.getAttribute('data-command-id')) ?? '';
        // The label is the first line; the shortcut is the <kbd>, if the action has one.
        const label = (await el.innerText()).split('\n')[0]?.trim() ?? '';
        const kbd = el.locator('kbd');
        const shortcut = (await kbd.count()) ? (await kbd.first().innerText()).trim() : '';
        // A button shows label and shortcut on one line ("Delete Delete"); a menu item shows them on two.
        const name =
          shortcut && label !== shortcut && label.endsWith(shortcut)
            ? label.slice(0, -shortcut.length).trim()
            : label;
        (seen[id] ??= []).push(`${surface}: ${name} | ${shortcut}`);
      }
    };

    // Selection bar (buttons + More menu).
    await page.keyboard.press('Space');
    const bar = page.getByRole('group', { name: 'Actions for selected transactions' });
    await expect(bar.locator('button[data-action-id]')).toHaveCount(3);
    await record('bar', bar.locator('[data-action-id]'));
    await bar.getByRole('button', { name: 'More actions' }).click();
    await record('bar', page.getByRole('menu').locator('[data-action-id]'));
    await page.keyboard.press('Escape');
    // Toolbar row-actions menu.
    await page.getByRole('button', { name: 'Row actions' }).click();
    await record('menu', page.getByRole('menu').locator('[data-action-id]'));
    await page.keyboard.press('Escape');
    // Context menu, opened by right-click.
    await page.locator(`.ag-row[row-id="${row.id}"] [col-id="type"]`).first().click({ button: 'right' });
    await record('context', page.getByRole('menu').locator('[data-action-id]'));
    await page.keyboard.press('Escape');
    // Command palette.
    await page.keyboard.press('Control+k');
    await record('palette', page.getByRole('listbox', { name: 'Commands' }).locator('[data-command-id]'));
    await page.keyboard.press('Escape');

    for (const id of [
      'row.open',
      'transaction.post',
      'transaction.reverse',
      'transaction.delete',
      'grid.copy',
      'grid.copyRaw',
    ]) {
      const entries = seen[id] ?? [];
      // On every surface it appears on, the label and shortcut are identical.
      expect(entries.length, `${id}: ${JSON.stringify(seen)}`).toBeGreaterThanOrEqual(4);
      expect(new Set(entries.map((e) => e.split(': ')[1])).size, `${id}: ${entries.join(' / ')}`).toBe(1);
    }
    expect(seen['transaction.post']?.[0]).toContain(`Post | ${keys.post}`);
    expect(seen['transaction.delete']?.[0]).toContain(`Delete | ${keys.delete}`);
    expect(seen['row.open']?.[0]).toContain(`Open | ${keys.open}`);
  });

  test('at most 3 actions show as buttons; the rest are under More', async ({ page }) => {
    const [row] = (await pick(page, 'unposted', 1)) as [Row];
    await openOn(page, 'u-ada', [row.id]);
    await focusRow(page, row.id);
    await page.keyboard.press('Space');
    const bar = page.getByRole('group', { name: 'Actions for selected transactions' });
    await expect(bar.locator('button[data-action-id]')).toHaveCount(3);
    await expect(bar.locator('button[data-action-id]').nth(0)).toHaveAttribute('data-action-id', 'row.open');
    await bar.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menuitem')).toHaveCount(4);
  });

  test('Post confirms once, stating the consequence; one Enter posts; the result is audited', async ({
    page,
  }) => {
    const [row] = (await pick(page, 'unposted', 2)) as [Row];
    await openOn(page, 'u-ada', [row.id]);
    await focusRow(page, row.id);
    // The registry shortcut, straight from the grid.
    await page.keyboard.press('Control+Enter');
    const dialog = page.getByRole('dialog', { name: 'Post 1 transaction?' });
    await expect(dialog).toContainText('Posts unposted transactions to the ledger.');
    await expect(dialog).toContainText('This can be reversed later. Both steps stay in the audit history.');
    await expect(dialog.getByRole('button', { name: 'Post 1 transaction' })).toBeFocused();
    expect(await statusOf(page, row.id)).toBe('unposted');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Post: done' })).toBeVisible();
    await expect(page.locator(`.ag-row[row-id="${row.id}"] [col-id="status"]`).first()).toHaveText('Posted');
    expect(await statusOf(page, row.id)).toBe('posted');
  });

  test('Ben sees Reverse disabled with the reason, on every surface, and cannot run it', async ({ page }) => {
    const [row] = (await pick(page, 'posted', 0)) as [Row];
    await openOn(page, 'u-ben', [row.id]);
    await focusRow(page, row.id);
    await page.keyboard.press('Space');
    const reason = 'Reversing a posted transaction needs full access on transactions.';

    // Selection bar: visible, focusable, reason on focus.
    const button = page
      .getByRole('group', { name: 'Actions for selected transactions' })
      .getByRole('button', { name: 'Reverse' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.focus();
    await expect(page.getByRole('tooltip')).toContainText(reason);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Context menu: listed with the reason.
    await page.locator(`.ag-row[row-id="${row.id}"] [col-id="type"]`).first().click({ button: 'right' });
    const item = page.getByRole('menuitem', { name: /Reverse/ });
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    await expect(item).toContainText(reason);
    await page.keyboard.press('Escape');

    // Palette: listed, not available, with the reason.
    await page.keyboard.press('Control+k');
    await page.keyboard.type('reverse');
    await expect(page.getByRole('option', { name: /Reverse/ })).toContainText(`Not available: ${reason}`);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    expect(await statusOf(page, row.id)).toBe('posted');
  });

  test('every right-click action is reachable by keyboard: Shift+F10 opens the same menu', async ({
    page,
  }) => {
    const [row] = (await pick(page, 'unposted', 3)) as [Row];
    await openOn(page, 'u-ada', [row.id]);
    const cell = page.locator(`.ag-row[row-id="${row.id}"] [col-id="type"]`).first();
    await cell.click({ button: 'right' });
    const byMouse = await page
      .getByRole('menu')
      .locator('[data-action-id]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-action-id')));
    await page.keyboard.press('Escape');

    await cell.click();
    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const byKeyboard = await menu
      .locator('[data-action-id]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-action-id')));
    expect(byKeyboard).toEqual(byMouse);
    expect(byKeyboard).toEqual([
      'row.open',
      'transaction.post',
      'transaction.reverse',
      'transaction.delete',
      'transaction.clone',
      'grid.copy',
      'grid.copyRaw',
    ]);
    // Run one from the keyboard: type its first letter to move to Post, then Enter.
    await page.keyboard.press('p');
    await expect(menu.getByRole('menuitem', { name: /^Post/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Post 1 transaction?' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Focus returns to the grid cell.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('.ag-row')?.getAttribute('row-id')))
      .toBe(row.id);
  });

  test('Delete is irreversible: it says so, asks for the action to be typed, and removes the record', async ({
    page,
  }) => {
    const [row] = (await pick(page, 'unposted', 7)) as [Row];
    await openOn(page, 'u-ada', [row.id]);
    await focusRow(page, row.id);
    await page.keyboard.press('Delete');
    const dialog = page.getByRole('dialog', { name: 'Delete 1 transaction?' });
    await expect(dialog.locator('[data-slot="confirm-consequence"]')).toHaveText('This cannot be undone.');
    // It cannot be undone, so confirmation is scaled up: the action and count are typed (SPEC 7.4).
    const confirm = dialog.getByRole('button', { name: 'Delete 1 transaction' });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/to confirm/).fill('delete 1');
    await confirm.click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Delete: done' })).toBeVisible();
    await expect(statusBar(page)).toContainText('0 rows');
    expect(await statusOf(page, row.id)).toBe('gone');
  });

  test('mixed selection: the confirm step counts ineligible rows by reason, and the outcome is reported in full', async ({
    page,
  }) => {
    const [a] = (await pick(page, 'unposted', 8)) as [Row];
    await openOn(page, 'u-ada', [a.id]);
    // Search by a shared prefix so posted and unposted rows are on screen together.
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill(a.id.slice(0, 8));
    await expect(statusBar(page)).toContainText(/\d+ rows/);
    await page.locator(`.ag-row[row-id="${a.id}"] [col-id="type"]`).first().click();
    await page.keyboard.press('Control+a');
    const selected = Number(
      /(\d+) selected/.exec(await page.locator('[data-slot="selection-bar"]').innerText())?.[1],
    );
    expect(selected).toBeGreaterThan(1);

    await page
      .getByRole('group', { name: 'Actions for selected transactions' })
      .getByRole('button', { name: /^Post/ })
      .click();
    const dialog = page.getByRole('dialog');
    const eligibility = dialog.locator('[data-slot="confirm-eligibility"]');
    await expect(eligibility).toContainText(`${selected} selected.`);
    await expect(eligibility.getByRole('listitem').filter({ hasText: 'Already posted.' })).toBeVisible();
    const willRun = Number(/This will run on (\d+)/.exec(await eligibility.innerText())?.[1]);
    const left = Number(/(\d+) will be left/.exec(await eligibility.innerText())?.[1]);
    expect(willRun + left).toBe(selected);
    await expect(
      dialog.getByRole('button', { name: new RegExp(`^Post ${willRun} transaction`) }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await statusOf(page, a.id)).toBe('unposted');
  });
});

test.describe('command palette and shell', () => {
  test('Ctrl+K lists navigation, views, workspaces and the actions in context; Enter runs', async ({
    page,
  }) => {
    await signIn(page, 'u-ada');
    await page.goto('/transactions?view=V-transactions-default');
    await expect(statusBar(page)).toContainText(/[45],\d{3} rows/);
    await page.keyboard.press('Control+k');
    const list = page.getByRole('listbox', { name: 'Commands' });
    for (const text of [
      'Refresh',
      "View: Yesterday's unposted trades",
      'Go to Market Data',
      'Open workspace: Transaction Operations',
    ]) {
      await expect(list.getByRole('option', { name: new RegExp(text) }).first()).toBeVisible();
    }
    // Apply a view from the palette, keyboard only.
    await page.keyboard.type('yesterday');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-slot="view-selector"]')).toContainText("Yesterday's unposted trades");
    await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Status is unposted');
  });

  test('the palette finds a record and opens its transactions', async ({ page }) => {
    await signIn(page, 'u-ada');
    await page.goto('/profile');
    await page.getByRole('button', { name: /^Commands/ }).click();
    await page.keyboard.type('P-0009');
    await page.getByRole('option', { name: /P-0009/ }).click();
    await expect(page).toHaveURL(/\/transactions\?view=V-transactions-default&d=/);
    await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Portfolio is P-0009');
  });

  test('a client gets navigation and views only: no actions, no record search', async ({ page }) => {
    await signIn(page, 'u-eli');
    await page.goto('/transactions?view=V-transactions-default');
    await expect(statusBar(page)).toContainText(/rows/);
    await page.keyboard.press('Control+k');
    const groups = await page
      .getByRole('listbox', { name: 'Commands' })
      .locator('[data-command-id]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-command-id')?.split('.')[0]));
    expect(new Set(groups)).toEqual(new Set(['view', 'nav']));
    await expect(page.getByText(/find records/)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Jobs' })).toHaveCount(0);
  });

  test('all domains are reachable without a mouse: g then a letter, and the palette', async ({ page }) => {
    await signIn(page, 'u-ada');
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Signed in as Ada' })).toBeVisible();
    for (const [key, name] of [
      ['p', 'Portfolios'],
      ['s', 'Securities'],
      ['m', 'Market Data'],
      ['c', 'Cash'],
      ['a', 'Accounting'],
      ['r', 'Reports'],
      ['d', 'Admin'],
    ] as const) {
      await page.keyboard.press('g');
      await page.keyboard.press(key);
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    }
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible();
    // And through the palette.
    await page.keyboard.press('Control+k');
    await page.keyboard.type('go to cash');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Cash' })).toBeVisible();
  });

  test('g then a letter does nothing while typing in a field', async ({ page }) => {
    await signIn(page, 'u-ada');
    await page.goto('/transactions?view=V-transactions-default');
    const search = page.getByRole('searchbox', { name: 'Quick search transactions' });
    await search.fill('');
    await search.pressSequentially('gp');
    await expect(search).toHaveValue('gp');
    await expect(page).toHaveURL(/\/transactions/);
  });

  test('"?" opens the shortcut sheet with global keys, grid keys and this screen\'s action shortcuts', async ({
    page,
  }) => {
    await signIn(page, 'u-ada');
    await page.goto('/transactions?view=V-transactions-default');
    await expect(statusBar(page)).toContainText(/[45],\d{3} rows/);
    await page.locator('.ag-row[row-index="0"] [col-id="type"]').first().click();
    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(sheet.getByRole('region', { name: 'Everywhere' })).toContainText('g then t');
    await expect(sheet.getByRole('region', { name: 'In a grid' })).toContainText('Shift+F10');
    const actions = sheet.getByRole('region', { name: 'Actions on this screen' });
    await expect(actions).toContainText(keys.post);
    await expect(actions).toContainText('Post');
    // It is also a button, for people who do not know the key.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    await expect(sheet).toBeVisible();
  });

  test('the job tray lists the user’s jobs; actions are recorded as analytics events', async ({ page }) => {
    const events: string[] = [];
    page.on('console', (m) => {
      if (m.text().startsWith('[analytics]')) events.push(m.text());
    });
    const [row] = (await pick(page, 'unposted', 9)) as [Row];
    await openOn(page, 'u-ada', [row.id]);
    await page.locator('[data-slot="job-tray-button"]').click();
    // Ada's seeded export failed before she signed in: it is waiting in the tray.
    await expect(page.getByRole('dialog', { name: 'Jobs' })).toContainText('Transaction register export');
    await page.keyboard.press('Escape');

    await focusRow(page, row.id);
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Post 1 transaction' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Post: done' })).toBeVisible();
    await expect.poll(() => events.some((e) => e.includes('action.invoked'))).toBe(true);
    expect(events.some((e) => e.includes('view.applied'))).toBe(false);
    await page.getByRole('button', { name: /^View:/ }).click();
    await page.getByRole('menuitemradio', { name: /Yesterday/ }).click();
    await expect.poll(() => events.some((e) => e.includes('view.applied'))).toBe(true);
  });
});
