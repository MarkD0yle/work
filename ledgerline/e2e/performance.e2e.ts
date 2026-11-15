import { expect, test, type Page } from '@playwright/test';

/**
 * Performance budgets (PLAN 7.3). These run against the development server and the small seed, so the
 * budgets are loose: they catch a regression of kind (a list that stops paging, a query that loses its index),
 * not a few milliseconds. Bundle size has its own check: `pnpm budget`.
 */
const ADA = { 'X-LL-User': 'u-ada' };
const signIn = (page: Page) =>
  page.addInitScript(() =>
    localStorage.setItem(
      'll-session',
      JSON.stringify({
        state: { userId: 'u-ada', theme: 'light', density: null, railCollapsed: false },
        version: 0,
      }),
    ),
  );

test('the transactions grid shows its first rows within 3 seconds, and re-sorts within 2', async ({
  page,
}) => {
  await signIn(page);
  const started = Date.now();
  await page.goto('/transactions?view=V-transactions-default');
  await expect(page.locator('.ag-row [col-id="id"]').first()).toBeVisible({ timeout: 3000 });
  expect(Date.now() - started).toBeLessThan(3000);

  // Sorting asks the server for a new first page: it must not reload everything.
  const sorted = page.waitForResponse(
    (r) =>
      r.url().endsWith('/transactions/query') &&
      (r.request().postDataJSON() as { sort?: unknown[] }).sort?.length === 1,
  );
  const before = Date.now();
  await page.locator('.ag-header-cell[col-id="amount"]').click();
  const response = await sorted;
  expect(
    (response.request().postDataJSON() as { endRow: number; startRow: number }).endRow -
      (response.request().postDataJSON() as { startRow: number }).startRow,
  ).toBeLessThanOrEqual(200);
  await expect(page.locator('.ag-header-cell[col-id="amount"]')).toHaveAttribute(
    'aria-sort',
    /ascending|descending/,
  );
  expect(Date.now() - before).toBeLessThan(2000);
});

test('list queries answer within their budgets', async ({ request }) => {
  const timed = async (path: string, data?: unknown) => {
    const started = Date.now();
    const res =
      data === undefined
        ? await request.get(`/api/v1${path}`, { headers: ADA })
        : await request.post(`/api/v1${path}`, { headers: ADA, data });
    expect(res.ok(), path).toBe(true);
    return Date.now() - started;
  };
  // Warm each route once: the first call pays for statement preparation.
  for (const [path, body] of [
    ['/transactions/query', { startRow: 0, endRow: 100 }],
    ['/transactions/query', { startRow: 4000, endRow: 4100, sort: [{ field: 'amount', dir: 'desc' }] }],
    ['/exceptions/query', { startRow: 0, endRow: 100 }],
    ['/audit/query', { startRow: 0, endRow: 100 }],
    [
      '/prices/query',
      { startRow: 0, endRow: 100, filters: [{ field: 'toleranceStatus', op: 'neq', value: 'ok' }] },
    ],
    ['/jobs/query', { startRow: 0, endRow: 50 }],
  ] as const) {
    await timed(path, body);
    expect(await timed(path, body), path).toBeLessThan(400);
  }
  await timed('/entities/search?kind=security&q=treasury');
  expect(await timed('/entities/search?kind=security&q=treasury')).toBeLessThan(250);
  expect(await timed('/periods/overview?scope=all')).toBeLessThan(400);
});
