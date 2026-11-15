import { expect, test, type Page } from '@playwright/test';

/** Milestone 5: bulk actions (SPEC 7.4) and jobs (SPEC 7.11). */

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
const ADA = { 'X-LL-User': 'u-ada' };
const statusBar = (page: Page) => page.locator('[data-slot="status-bar"]');
const results = (page: Page) => page.locator('[data-slot="bulk-results"]');
const tray = (page: Page) => page.locator('[data-slot="job-tray-button"]');

interface Row {
  id: string;
  status: string;
  price: { value: string | null };
  portfolio: { id: string };
  security: { id: string } | null;
}
const MAPPING = {
  targetType: 'transaction',
  columns: ['Id', 'Portfolio', 'Security', 'Type', 'Trade date', 'Settle date', 'Quantity', 'Price'].map(
    (sourceHeader, i) => ({
      sourceHeader,
      targetField: [
        'id',
        'portfolioId',
        'securityId',
        'type',
        'tradeDate',
        'settleDate',
        'quantity',
        'price',
      ][i] as string,
    }),
  ),
};

/**
 * Creates unposted buys in one portfolio, so each journey has rows of its own. The last `broken` of them have
 * no settlement date: they import, but cannot be posted until the date is added.
 */
async function createTrades(
  page: Page,
  portfolioId: string,
  total: number,
  broken: number,
): Promise<string[]> {
  const like = (
    (await (
      await page.request.post('/api/v1/transactions/query', {
        headers: ADA,
        data: {
          startRow: 0,
          endRow: 1,
          filters: [
            { field: 'type', op: 'eq', value: 'buy' },
            { field: 'status', op: 'eq', value: 'posted' },
          ],
        },
      })
    ).json()) as { rows: Row[] }
  ).rows[0] as Row;
  const rows = Array.from({ length: total }, (_, i) => ({
    Portfolio: portfolioId,
    Security: (like.security as { id: string }).id,
    Type: 'buy',
    // The engine's business date: the Today chip then shows exactly these rows and no seeded ones.
    'Trade date': '2026-11-14',
    'Settle date': i >= total - broken ? '' : '2026-11-17',
    Quantity: String(i + 1),
    Price: like.price.value as string,
  }));
  const res = await page.request.post('/api/v1/imports/commit', {
    headers: ADA,
    data: {
      mapping: MAPPING,
      rows,
      fileEvidence: { name: `e2e-${portfolioId}.csv` },
      acknowledgeWarnings: true,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { succeeded: string[] }).succeeded;
}
const addSettleDates = async (page: Page, ids: string[]) => {
  const res = await page.request.post('/api/v1/imports/commit', {
    headers: ADA,
    data: {
      mapping: MAPPING,
      rows: ids.map((Id) => ({ Id, 'Settle date': '2026-11-17' })),
      fileEvidence: { name: 'settle-dates.csv' },
      acknowledgeWarnings: true,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
};
const statusOf = async (page: Page, id: string) =>
  ((await (await page.request.get(`/api/v1/transactions/${id}`, { headers: ADA })).json()) as Row).status;

async function openPortfolio(page: Page, userId: string, portfolioId: string) {
  await signIn(page, userId);
  await page.goto('/transactions?view=V-transactions-default');
  await expect(statusBar(page)).toContainText(/\d rows/);
  await page.getByRole('combobox', { name: 'Portfolio', exact: true }).fill(portfolioId);
  await page.getByRole('option', { name: new RegExp(portfolioId) }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Trade date is today');
}
async function selectAllMatching(page: Page) {
  await page.locator('.ag-row[row-index="0"] [col-id="id"]').first().click();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /^Select all [\d,]+ matching$/ }).click();
  await expect(page.locator('[data-slot="selection-count"]')).toContainText(
    /^All [\d,]+ matching transactions selected$/,
  );
}
const selectionBar = (page: Page) => page.getByRole('group', { name: 'Actions for selected transactions' });

test.describe('exit gate', () => {
  test('Ada bulk-posts 500, 10 fail, she closes the browser mid-run, recovers the result, fixes and retries', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const ids = await createTrades(page, 'P-0050', 500, 10);
    const broken = ids.slice(-10);

    // Select every match, not just the rows on screen.
    await openPortfolio(page, 'u-ada', 'P-0050');
    await selectAllMatching(page);
    await selectionBar(page).getByRole('button', { name: 'Post' }).click();
    const confirm = page.getByRole('dialog', { name: 'Post 500 transactions?' });
    // More than 50 rows: the action and the count are typed.
    const go = confirm.getByRole('button', { name: 'Post 500 transactions' });
    await expect(go).toBeDisabled();
    await confirm.getByLabel(/to confirm/).fill('post 500');
    await go.click();

    // It runs as a job. She can leave: here the whole browser window is closed mid-run.
    await expect(page.locator('[data-slot="job-running"]')).toContainText('Post is running as a job');
    await expect(tray(page)).toHaveAccessibleName(/1 running/);
    await page.close();

    // Next sign-in: the job is in the tray, finished, flagged as not yet opened.
    const back = await context.newPage();
    await signIn(back, 'u-ada');
    await back.goto('/');
    await expect(tray(back)).toHaveAccessibleName(/1 finished and not yet opened/, { timeout: 30_000 });
    await tray(back).click();
    const entry = back
      .locator('[data-slot="job-tray"] [data-job-id]')
      .filter({ hasText: 'Post 500 transactions' })
      .first();
    await expect(entry).toContainText('Partly done');
    await expect(entry).toContainText('490 succeeded, 10 failed, 0 skipped');
    await entry.click();
    const detail = back.locator('[data-slot="job-detail"]');
    await expect(detail.locator('[data-slot="job-status"]')).toHaveText('Partly done');
    await expect(detail.getByRole('table', { name: 'Failed rows' })).toContainText(
      'Settlement date is missing.',
    );
    await expect(detail.getByRole('table', { name: 'Failed rows' }).getByRole('row')).toHaveCount(11);
    expect(await statusOf(back, ids[0] as string)).toBe('posted');
    expect(await statusOf(back, broken[0] as string)).toBe('unposted');

    // Fix the cause, then retry. Nothing is typed again: the job knows what failed.
    await addSettleDates(back, broken);
    await detail.getByRole('button', { name: 'Retry the 10 failed' }).click();
    await expect(detail.getByRole('heading', { name: 'Post 500 transactions (retry)' })).toBeVisible();
    await expect(detail.locator('[data-slot="job-status"]')).toHaveText('Completed', { timeout: 20_000 });
    await expect(detail.locator('[data-slot="job-results"]')).toContainText('Succeeded10');
    for (const id of broken) expect(await statusOf(back, id)).toBe('posted');

    // No row was posted twice: each has exactly one post in its audit history.
    for (const id of [ids[0], ids[250], broken[0]] as string[]) {
      const audit = (await (
        await back.request.get(`/api/v1/audit/record/transaction/${id}`, { headers: ADA })
      ).json()) as { action: string }[];
      expect(
        audit.filter((e) => e.action === 'transaction.post'),
        id,
      ).toHaveLength(1);
    }
  });
});

test.describe('bulk results', () => {
  test('partial results: filter to failures and retry in two clicks', async ({ page }) => {
    const ids = await createTrades(page, 'P-0051', 20, 3);
    const broken = ids.slice(-3);
    await openPortfolio(page, 'u-ada', 'P-0051');
    await selectAllMatching(page);
    await selectionBar(page).getByRole('button', { name: 'Post' }).click();
    // 50 rows or fewer and reversible: one confirm, no typing.
    const confirm = page.getByRole('dialog', { name: 'Post 20 transactions?' });
    await expect(confirm.getByLabel(/to confirm/)).toHaveCount(0);
    await confirm.getByRole('button', { name: 'Post 20 transactions' }).click();

    await expect(results(page).locator('[data-slot="bulk-succeeded"]')).toHaveText('Succeeded17');
    await expect(results(page).locator('[data-slot="bulk-failed"]')).toHaveText('Failed3');
    await expect(results(page)).toContainText('3 failed: Settlement date is missing.');

    // Click one: only the failures are in the grid, and the filter shows as a tag.
    await results(page).getByRole('button', { name: 'Show the 3 failed' }).click();
    await expect(statusBar(page)).toContainText('3 rows');
    await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('is one of');
    for (const id of broken) await expect(page.locator(`.ag-row[row-id="${id}"]`).first()).toBeVisible();

    // Click two: retry runs on those three only.
    await addSettleDates(page, broken);
    await results(page).getByRole('button', { name: 'Retry the 3 failed' }).click();
    await expect(results(page)).toBeHidden();
    for (const id of broken) expect(await statusOf(page, id)).toBe('posted');
  });

  test('a new user sees the preview before confirming; a super user gets it in one click', async ({
    page,
    browser,
  }) => {
    const [a, b] = await createTrades(page, 'P-0052', 2, 1);
    await openPortfolio(page, 'u-ben', 'P-0052');
    await page.getByRole('searchbox', { name: 'Quick search transactions' }).fill(b as string);
    await expect(statusBar(page)).toContainText('1 row');
    await page.locator(`.ag-row[row-id="${b}"] [col-id="id"]`).first().click();
    await page.keyboard.press('ControlOrMeta+Enter');
    const confirm = page.getByRole('dialog', { name: 'Post 1 transaction?' });
    // Opened by itself for Ben, and it says this row would fail and why.
    const preview = confirm.getByRole('table', { name: 'Preview of changes' });
    await expect(preview).toContainText('Settlement date is missing.');
    await expect(confirm.getByText('1 with something to check')).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancel' }).click();

    const adaContext = await browser.newContext({ baseURL: test.info().project.use.baseURL as string });
    const ada = await adaContext.newPage();
    await openPortfolio(ada, 'u-ada', 'P-0052');
    await ada.getByRole('searchbox', { name: 'Quick search transactions' }).fill(a as string);
    await expect(statusBar(ada)).toContainText('1 row');
    await ada.locator(`.ag-row[row-id="${a}"] [col-id="id"]`).first().click();
    await ada.keyboard.press('ControlOrMeta+Enter');
    const adaConfirm = ada.getByRole('dialog', { name: 'Post 1 transaction?' });
    await expect(adaConfirm.getByRole('button', { name: 'Post 1 transaction' })).toBeFocused();
    await expect(adaConfirm.getByRole('table', { name: 'Preview of changes' })).toHaveCount(0);
    await adaConfirm.getByRole('button', { name: 'Preview the changes' }).click();
    await expect(adaConfirm.getByRole('table', { name: 'Preview of changes' })).toContainText('unposted');
    await adaContext.close();
  });
});

test.describe('jobs and reports', () => {
  test('a report runs as a job; the file is downloaded from the job', async ({ page }) => {
    await signIn(page, 'u-ada');
    await page.goto('/reports');
    await page.getByRole('button', { name: 'Run Transaction register' }).click();
    await expect(page.locator('[data-slot="report-submitted"]')).toContainText(
      'Transaction register is running as a job',
    );
    await tray(page).click();
    const entry = page
      .locator('[data-slot="job-tray"] [data-job-id]')
      .filter({ hasText: 'Transaction register' })
      .first();
    await expect(entry).toContainText('Completed', { timeout: 15_000 });
    await expect(entry).toContainText('A file is ready to download');
    await entry.click();
    const detail = page.locator('[data-slot="job-detail"]');
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      detail.getByRole('button', { name: /^Download txn-register-2026-11-14\.csv$/ }).click(),
    ]);
    expect(file.suggestedFilename()).toBe('txn-register-2026-11-14.csv');
    await expect(detail.getByRole('region', { name: 'Log' })).toContainText('rows as of 2026-11-14');
  });

  test('the jobs list filters to mine, and a failed job retries with its original inputs', async ({
    page,
  }) => {
    await signIn(page, 'u-ada');
    await page.goto('/jobs');
    await expect(statusBar(page)).toContainText(/\d rows?/);
    await page.getByRole('button', { name: 'Failed or partly done' }).click();
    await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Status');
    const row = page.locator('.ag-row[row-id="J-000002"]').first();
    await expect(row).toContainText('Failed');
    const detail = page.locator('[data-slot="job-detail"]');
    // Other journeys run jobs as Ada at the same time, and each one reloads this list: open the row again if a reload got in first.
    await expect(async () => {
      await row.locator('[col-id="name"]').click();
      await page.keyboard.press('Enter');
      await expect(detail.getByRole('heading', { name: 'Transaction register export' })).toBeVisible({
        timeout: 1500,
      });
    }).toPass();
    await expect(detail.getByRole('region', { name: 'Inputs' })).toContainText('R-txn-register');
    await detail.getByRole('button', { name: 'Retry' }).click();
    // The retry is a new job, opened in place, with the same inputs and nothing typed.
    await expect(detail.getByRole('heading', { name: 'Transaction register export (retry)' })).toBeVisible();
    await expect(detail.locator('[data-slot="job-status"]')).toHaveText('Completed', { timeout: 15_000 });
    await expect(detail.getByRole('region', { name: 'Inputs' })).toContainText('J-000002');
    await expect(detail.getByRole('button', { name: /^Download/ })).toBeVisible();
  });

  test('a client has no job tray and cannot run reports, and is told why', async ({ page }) => {
    await signIn(page, 'u-eli');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(tray(page)).toHaveCount(0);
    await expect(page.getByText(/Client access is limited/)).toBeVisible();
  });
});
