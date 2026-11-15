import { expect, test, type Page } from '@playwright/test';

/** Milestone 7: Admin (SPEC 9) and Client Home (SPEC 8.6). */

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
const toastOf = (page: Page, text: string) => page.locator('[data-sonner-toast]').filter({ hasText: text });
const editor = (page: Page) => page.locator('[data-slot="user-editor"]');
const pending = (page: Page) => page.locator('[data-slot="pending-count"]');
interface Permission {
  action: string;
  accessLevel: string;
  allowed: boolean;
}
const permissionOf = async (page: Page, userId: string, action: string) =>
  (
    (await (
      await page.request.get(`/api/v1/admin/users/${userId}/permissions`, {
        headers: { 'X-LL-User': 'u-fay' },
      })
    ).json()) as Permission[]
  ).find((p) => p.action === action) as Permission;

test.describe('admin', () => {
  test('Fay changes an access level and a blotter scope; both are staged, saved and audited', async ({
    page,
  }) => {
    await signIn(page, 'u-fay');
    await page.goto('/admin');
    await page.getByRole('table', { name: 'Users' }).getByRole('button', { name: /^Dev/ }).click();
    await expect(editor(page).getByRole('heading', { name: 'Dev' })).toBeVisible();
    await expect(pending(page)).toHaveText('No unsaved changes');

    // An access level: staged first, with a count, never saved silently.
    const reports = editor(page).getByRole('region', { name: 'Reports permissions' });
    const level = reports.getByLabel('Run', { exact: true }).first();
    await expect(level).toHaveValue('view');
    await level.selectOption('full');
    await expect(reports.getByText('Changed, not saved yet')).toBeVisible();
    await expect(pending(page)).toHaveText('1 unsaved change');
    expect((await permissionOf(page, 'u-dev', 'report.run')).accessLevel).toBe('view');

    // A blotter scope: add a portfolio.
    await editor(page).getByRole('combobox', { name: 'Add a portfolio to the scope' }).fill('P-0001');
    await editor(page).getByRole('listbox').getByRole('option').first().click();
    await expect(editor(page).getByRole('list', { name: 'Portfolios in scope' })).toContainText('P-0001');
    await expect(pending(page)).toHaveText('2 unsaved changes');

    await editor(page).getByRole('button', { name: 'Save' }).click();
    await expect(toastOf(page, 'Saved')).toContainText('2 changes for Dev');
    await expect(pending(page)).toHaveText('No unsaved changes');
    expect((await permissionOf(page, 'u-dev', 'report.run')).accessLevel).toBe('full');
    await expect(page.getByRole('table', { name: 'Users' }).getByRole('row', { name: /Dev/ })).toContainText(
      '1 portfolio',
    );

    // Both changes are in the user's history, with who made them.
    await editor(page).getByRole('tab', { name: 'History' }).click();
    const history = editor(page).locator('[data-slot="record-history"]');
    await expect(history).toContainText('Fay');
    await expect(history).toContainText('report.run');
    await expect(history).toContainText('P-0001');

    // Put it back, so other journeys see Dev as seeded.
    await editor(page).getByRole('tab', { name: 'Access' }).click();
    await editor(page).getByRole('button', { name: 'Remove P-0001 from scope' }).click();
    await editor(page)
      .getByRole('region', { name: 'Reports permissions' })
      .getByLabel('Run', { exact: true })
      .first()
      .selectOption('view');
    await editor(page).getByRole('button', { name: 'Save' }).click();
    await expect(pending(page)).toHaveText('No unsaved changes');
    await expect(page.getByRole('table', { name: 'Users' }).getByRole('row', { name: /Dev/ })).toContainText(
      'Every portfolio',
    );
  });

  test('an administrator cannot remove their own administrator access, and is told why', async ({ page }) => {
    await signIn(page, 'u-fay');
    await page.goto('/admin');
    await page.getByRole('table', { name: 'Users' }).getByRole('button', { name: /^Fay/ }).click();
    await expect(editor(page).getByText('This is you')).toBeVisible();
    await editor(page)
      .getByRole('region', { name: 'Admin permissions' })
      .getByLabel('Permissions', { exact: true })
      .selectOption('none');
    await editor(page).getByRole('button', { name: 'Save' }).click();
    await expect(editor(page).getByText('You cannot remove your own administrator access.')).toBeVisible();
    await expect(pending(page)).toHaveText('1 unsaved change');
    expect((await permissionOf(page, 'u-fay', 'admin.permissions')).allowed).toBe(true);
  });

  test('a whole group can be set at once; someone who is not an administrator is told why they cannot', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'u-fay');
    await page.goto('/admin');
    await page.getByRole('table', { name: 'Users' }).getByRole('button', { name: /^Eli/ }).click();
    const group = editor(page).getByRole('region', { name: 'Market data permissions' });
    await group.getByLabel(/^Set all/).selectOption('view');
    await expect(group.getByText('Changed, not saved yet').first()).toBeVisible();
    await expect(pending(page)).toHaveText(/^\d unsaved changes$/);
    await editor(page).getByRole('button', { name: 'Discard changes' }).click();
    await expect(pending(page)).toHaveText('No unsaved changes');

    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL as string });
    const ada = await context.newPage();
    await signIn(ada, 'u-ada');
    await ada.goto('/admin');
    await expect(ada.getByText('User administration is limited to administrators.')).toBeVisible();
    await expect(ada.getByRole('table', { name: 'Users' })).toHaveCount(0);
    await context.close();
  });
});

test.describe('client home', () => {
  test('Eli reaches last month’s statement in two clicks from sign-in, and sees only their own portfolios', async ({
    page,
  }) => {
    await signIn(page, 'u-eli');
    // Sign-in lands on the client home page: no workbench, no job tray, no admin.
    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
    await expect(page.locator('[data-slot="job-tray-button"]')).toHaveCount(0);
    const latest = page.locator('[data-slot="latest-statements"]');
    await expect(latest).toContainText('Latest statement: Oct 2026');

    // Click one: the statement downloads. (Two were allowed.)
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      latest
        .getByRole('button', { name: /^Download statement for/ })
        .first()
        .click(),
    ]);
    expect(file.suggestedFilename()).toMatch(/^statement-P-00(07|19)-2026-10-31\.pdf$/);

    // Positions: only the portfolios on the account.
    await expect(page.locator('[data-slot="status-bar"]')).toContainText(/\d+ rows/);
    const portfolios = await page.locator('.ag-row [col-id="portfolio"]').allInnerTexts();
    expect(portfolios.length).toBeGreaterThan(0);
    expect(portfolios.every((text) => /P-0007|P-0019/.test(text))).toBe(true);

    // Transactions: read only. No entry, no import, no bulk actions.
    await page.getByRole('tab', { name: 'Transactions' }).click();
    await expect(page.getByRole('searchbox', { name: 'Quick search transactions' })).toBeVisible();
    await expect(page.locator('button[data-action-id="transaction.new"]')).toHaveCount(0);
    await expect(page.locator('button[data-action-id="transaction.import"]')).toHaveCount(0);

    // Every statement, by month.
    await page.getByRole('tab', { name: 'All statements' }).click();
    const table = page.getByRole('table', { name: 'Statements' });
    await expect(table.getByRole('row').nth(1)).toContainText('Oct 2026');
    await expect(table).not.toContainText('P-0001');
  });

  test('the command palette offers a client navigation and views only', async ({ page }) => {
    await signIn(page, 'u-eli');
    await page.goto('/home');
    await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('listbox', { name: 'Commands' });
    await expect(palette).toBeVisible();
    await expect(palette.locator('[data-command-id^="transaction."]')).toHaveCount(0);
  });
});
