import { expect, test, type Browser, type Page } from '@playwright/test';

/** Milestone 6: close console (SPEC 8.3), exception queue (8.2), approvals (8.5), price review (8.4), comparison (7.9), audit (7.10). */

const PERIOD = '2026-11-30';
const headers = (userId: string) => ({ 'X-LL-User': userId });
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
/** A separate signed-in window for another person, as in real life. Tall, so every row of a short grid is on screen. */
async function as(browser: Browser, userId: string, path: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL as string,
    viewport: { width: 1440, height: 2400 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await signIn(page, userId);
  await page.goto(path);
  return page;
}
const statusBar = (page: Page) => page.locator('[data-slot="status-bar"]');
const panel = (page: Page, label: string) => page.getByRole('complementary', { name: label });
const toastOf = (page: Page, text: string) => page.locator('[data-sonner-toast]').filter({ hasText: text });
const row = (page: Page, id: string) => page.locator(`.ag-row[row-id="${id}"]`).first();
/** Selects rows the keyboard way: move to each row and press Space. */
async function selectRows(page: Page, ids: string[], column: string) {
  for (const id of ids) {
    await row(page, id).locator(`[col-id="${column}"]`).click();
    await page.keyboard.press('Space');
  }
}

interface Exception {
  id: string;
  type: string;
  status: string;
  severity: string;
  portfolioId: string;
  recordRef: { label: string };
  evidence: { id: string; label: string }[];
  matchedRuleId?: string;
  proposal?: unknown;
}
interface Overview {
  periodId: string;
  portfolio: { id: string; label: string };
  blocking: number;
  state: string;
  closes: Record<string, string>;
  overrideStatus?: string;
  signOff?: { signedBy: { name: string } };
}
const api = async <T>(
  page: Page,
  method: 'get' | 'post',
  path: string,
  userId: string,
  data?: unknown,
): Promise<T> => {
  const res = await page.request[method](`/api/v1${path}`, {
    headers: headers(userId),
    ...(data === undefined ? {} : { data }),
  });
  expect(res.ok(), `${path}: ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
};
const exceptions = async (page: Page, filters: unknown[]) =>
  (
    await api<{ rows: Exception[] }>(page, 'post', '/exceptions/query', 'u-cleo', {
      startRow: 0,
      endRow: 500,
      filters,
    })
  ).rows;
const overviewOf = async (page: Page, portfolioId: string) =>
  (await api<Overview[]>(page, 'get', `/periods/overview?periodEnd=${PERIOD}&scope=all`, 'u-cleo')).find(
    (r) => r.portfolio.id === portfolioId,
  ) as Overview;
const OPEN = { field: 'status', op: 'in', value: ['new', 'inProgress', 'waitingOnOthers'] };

async function openPortfolio(page: Page, portfolioId: string) {
  await row(page, portfolioId).locator('[col-id="cutoff"]').click();
  await page.keyboard.press('Enter');
  const detail = panel(page, 'Close detail');
  await expect(detail.getByRole('table', { name: 'Close checklist' })).toBeVisible();
  return detail;
}
async function sendReason(page: Page, text: string, button: string) {
  const dialog = page.locator('[data-slot="reason-dialog"]');
  await dialog.getByRole('textbox').fill(text);
  await dialog.getByRole('button', { name: button }).click();
  await expect(dialog).toBeHidden();
}
/** Fay, the second approver, decides the newest waiting request about a period. */
async function fayApproves(browser: Browser, periodId: string, note: string) {
  const fay = await as(browser, 'u-fay', '/accounting/approvals');
  const request = fay.locator('.ag-row').filter({ hasText: periodId }).first();
  await request.locator('[col-id="reason"]').click();
  await fay.keyboard.press('Enter');
  const detail = panel(fay, 'Approval detail');
  await expect(detail.getByRole('button', { name: 'Approve' })).toBeEnabled();
  await detail.getByRole('button', { name: 'Approve' }).click();
  await sendReason(fay, note, 'Approve');
  await expect(toastOf(fay, 'Approve: done')).toBeVisible();
  await fay.context().close();
}

test.describe('exit gate', () => {
  test('Cleo closes three portfolios: two after Dev and Rafa clear the way, one under an approved override, then signs off, downloads the package and reopens one', async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    // The cast: two portfolios blocked only by a price exception, and one blocked by a cash break.
    const high = await exceptions(page, [OPEN, { field: 'severity', op: 'eq', value: 'high' }]);
    const blockers = new Map<string, Exception[]>();
    for (const x of high) blockers.set(x.portfolioId, [...(blockers.get(x.portfolioId) ?? []), x]);
    const only = (types: string[]) =>
      [...blockers]
        .filter(([, list]) => list.length === 1 && types.includes((list[0] as Exception).type))
        .map(([, list]) => list[0] as Exception);
    const [priceA, priceB] = only(['priceVariance', 'priceMissing']) as [Exception, Exception];
    const cash =
      only(['cashBreak']).find((x) => x.recordRef.label.startsWith('Outstanding wire')) ??
      (only(['cashBreak'])[0] as Exception);
    expect(priceA && priceB && cash).toBeTruthy();
    const [A, B, C] = [priceA.portfolioId, priceB.portfolioId, cash.portfolioId];

    // 1. Cleo opens the close console and sees why a portfolio cannot close: the exception is named.
    const cleo = await as(browser, 'u-cleo', '/accounting');
    await expect(cleo.locator('[data-slot="close-summary"]')).toContainText('Nov 2026');
    await cleo.getByRole('button', { name: 'All portfolios' }).click();
    await expect(statusBar(cleo)).toContainText('60 rows');
    await expect(row(cleo, A).locator('[col-id="blocking"]')).toHaveText('1 high severity');
    await expect(row(cleo, A).locator('[col-id="cutoff"]')).toContainText('23 days left');
    let detail = await openPortfolio(cleo, A);
    const blocking = detail.locator('[data-slot="blocking"]');
    await expect(blocking).toContainText('Close is blocked by 1 high-severity exception');
    await expect(blocking).toContainText(priceA.id);
    await expect(blocking).toContainText(priceA.recordRef.label);
    await expect(detail.getByRole('button', { name: 'Close this portfolio' })).toBeDisabled();
    await expect(detail.locator('[data-slot="close-reasons"]')).toContainText(
      'Blocked by 1 high-severity exception',
    );
    // The books tab compares the investment book with the accounting book.
    await detail.getByRole('tab', { name: 'Books' }).click();
    await expect(detail.locator('[data-slot="comparison"]')).toContainText('compared.');

    // 2. Dev resolves the two price exceptions, each showing the rule that failed.
    const dev = await as(browser, 'u-dev', '/market-data');
    await dev.getByRole('button', { name: 'High severity' }).click();
    await expect(row(dev, priceA.id)).toBeVisible();
    await expect(row(dev, priceA.id).locator('[col-id="failedRule"]')).toContainText(/^TOL-/);
    await selectRows(dev, [priceA.id, priceB.id], 'type');
    await expect(dev.locator('[data-slot="selection-count"]')).toHaveText('2 selected');
    await dev
      .getByRole('group', { name: 'Actions for selected exceptions' })
      .getByRole('button', { name: 'Resolve' })
      .click();
    const resolve = dev.locator('[data-slot="exception-action"]');
    await expect(resolve.getByRole('heading')).toHaveText('Resolve 2 exceptions');
    // A resolution without a root cause is refused, and the form says what is missing.
    await resolve.getByLabel('Note').fill('Vendor confirmed the prices; corrected file loaded.');
    await resolve.getByRole('button', { name: 'Resolve 2 exceptions' }).click();
    await expect(resolve.getByText('Resolve needs a root cause.')).toBeVisible();
    await resolve.getByLabel('Root cause').selectOption('missingPrice');
    await resolve.getByRole('button', { name: 'Resolve 2 exceptions' }).click();
    await expect(toastOf(dev, 'Resolve: done')).toBeVisible();
    await dev.context().close();

    // 3. Rafa saves a recurring-break rule from one cash break, then attaches one statement to ten breaks.
    const rafa = await as(browser, 'u-rafa', '/accounting/exceptions');
    const receipts = (await exceptions(page, [OPEN, { field: 'type', op: 'eq', value: 'cashBreak' }])).filter(
      (x) => x.recordRef.label.startsWith('Unapplied receipt') && x.id !== cash.id,
    );
    expect(receipts.length).toBeGreaterThanOrEqual(10);
    const seed = receipts[0] as Exception;
    await rafa.getByRole('searchbox', { name: 'Quick search exceptions' }).fill(seed.id);
    await expect(statusBar(rafa)).toContainText('1 row');
    await row(rafa, seed.id).locator('[col-id="type"]').click();
    await rafa.keyboard.press('Enter');
    const exceptionDetail = panel(rafa, 'Exception detail');
    await exceptionDetail.getByRole('button', { name: 'Save as recurring-break rule' }).click();
    const ruleDialog = rafa.locator('[data-slot="reason-dialog"]');
    await expect(ruleDialog.getByLabel('Record name contains')).toHaveValue('Unapplied receipt');
    await ruleDialog.getByLabel('Proposed root cause').selectOption('timing');
    await ruleDialog.getByRole('textbox', { name: /Rule name/ }).fill('Unapplied receipts clear next day');
    await ruleDialog.getByRole('button', { name: 'Save rule and tag matches' }).click();
    await expect(toastOf(rafa, 'Rule saved')).toContainText('tagged as proposals');
    await exceptionDetail.getByRole('button', { name: 'Close' }).click();
    // Tagged, with a proposal, and still open: a rule never resolves anything by itself.
    const tagged = await exceptions(page, [{ field: 'matchedRuleId', op: 'isNotNull' }]);
    expect(tagged.length).toBeGreaterThanOrEqual(10);
    expect(tagged.every((x) => ['new', 'inProgress', 'waitingOnOthers'].includes(x.status))).toBe(true);

    await rafa.getByRole('searchbox', { name: 'Quick search exceptions' }).fill('');
    await rafa.getByRole('button', { name: 'Proposed by a rule' }).click();
    await expect(statusBar(rafa)).toContainText(`${tagged.length} rows`);
    const ten = tagged.slice(0, 10);
    await selectRows(
      rafa,
      ten.map((x) => x.id),
      'type',
    );
    await expect(rafa.locator('[data-slot="selection-count"]')).toHaveText('10 selected');
    await rafa
      .getByRole('group', { name: 'Actions for selected exceptions' })
      .getByRole('button', { name: 'More actions' })
      .click();
    await rafa.getByRole('menuitem', { name: 'Attach evidence' }).click();
    const attach = rafa.locator('[data-slot="exception-action"]');
    await attach.getByLabel('File').setInputFiles({
      name: 'custodian-statement-2026-11.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 statement'),
    });
    await attach.getByRole('button', { name: 'Attach to 10 exceptions' }).click();
    await expect(toastOf(rafa, 'Attach evidence: done')).toBeVisible();
    const after = await exceptions(page, [{ field: 'id', op: 'in', value: ten.map((x) => x.id) }]);
    expect(new Set(after.map((x) => x.evidence.at(-1)?.id)).size).toBe(1);
    expect(after.every((x) => x.evidence.at(-1)?.label === 'custodian-statement-2026-11.pdf')).toBe(true);
    await rafa.context().close();

    // 4. Cleo closes the two cleared portfolios in one job, with a result for each.
    await detail.getByRole('button', { name: 'Close', exact: true }).click();
    await cleo.getByRole('button', { name: 'Refresh' }).click();
    await expect(row(cleo, A).locator('[col-id="blocking"]')).toHaveText('Nothing blocking');
    await selectRows(cleo, [A, B], 'cutoff');
    await cleo
      .getByRole('group', { name: 'Actions for selected portfolios' })
      .getByRole('button', { name: 'Close' })
      .click();
    const confirm = cleo.getByRole('dialog', { name: 'Close 2 portfolios?' });
    await expect(confirm).toContainText('This can be reversed later.');
    await confirm.getByRole('button', { name: 'Close 2 portfolios' }).click();
    await expect(toastOf(cleo, 'Close: done')).toContainText('2 portfolios');
    await expect(row(cleo, A).locator('[col-id="close-generalLedger"]')).toHaveText('Closed');
    await expect(row(cleo, B).locator('[col-id="close-transaction"]')).toHaveText('Closed');

    await cleo.getByRole('button', { name: 'Clear selection' }).click();

    // 5. The third is still blocked. Cleo asks for a block override; she cannot approve it herself.
    detail = await openPortfolio(cleo, C);
    await expect(detail.locator('[data-slot="blocking"]')).toContainText(cash.id);
    await detail.getByRole('button', { name: 'Request block override…' }).click();
    await sendReason(
      cleo,
      'Custodian confirmed the wire by phone; statement follows Monday.',
      'Send for approval',
    );
    await expect(
      detail
        .locator('[data-slot="section-banner"]')
        .or(detail.getByText(/Waiting for approval|approval/i))
        .first(),
    ).toBeVisible();
    const periodC = (await overviewOf(page, C)).periodId;
    expect((await overviewOf(page, C)).overrideStatus).toBe('pending');
    const own = await as(browser, 'u-cleo', '/accounting/approvals');
    await own.locator('.ag-row').filter({ hasText: periodC }).first().locator('[col-id="reason"]').click();
    await own.keyboard.press('Enter');
    const ownDetail = panel(own, 'Approval detail');
    await expect(ownDetail.getByRole('button', { name: 'Approve' })).toBeDisabled();
    await expect(ownDetail.locator('[data-slot="decide-reason"]')).toContainText('segregation of duties');
    await own.context().close();

    // 6. Fay, a second approver, approves. Now Cleo can close, sign off and download the package.
    await fayApproves(browser, periodC, 'Wire confirmation seen.');
    await cleo.getByRole('button', { name: 'Refresh' }).click();
    await expect(detail.locator('[data-slot="override-approved"]')).toContainText(
      'Block override approved by Fay',
    );
    await detail.getByRole('button', { name: 'Close this portfolio' }).click();
    await expect(toastOf(cleo, 'Closed')).toBeVisible();
    await detail.getByRole('button', { name: 'Sign off…' }).click();
    await sendReason(cleo, 'Closed under override; wire statement due Monday.', 'Sign off');
    await expect(detail.locator('[data-slot="sign-off"]')).toContainText('Cleo');
    await detail.getByRole('button', { name: 'Create close package' }).click();
    const pack = detail.locator('[data-slot="close-package"]');
    await expect(pack).toContainText('Close package ready', { timeout: 20_000 });
    const [pdf] = await Promise.all([
      cleo.waitForEvent('download'),
      pack.getByRole('button', { name: 'Download PDF' }).click(),
    ]);
    expect(pdf.suggestedFilename()).toBe(`close-package-${C}-${PERIOD}.pdf`);
    const [xlsx] = await Promise.all([
      cleo.waitForEvent('download'),
      pack.getByRole('button', { name: 'Download XLSX' }).click(),
    ]);
    expect(xlsx.suggestedFilename()).toBe(`close-package-${C}-${PERIOD}.xlsx`);

    // 7. A late notice: Cleo reopens one portfolio, with a reason, through the same second approver.
    await detail.getByRole('button', { name: 'Close', exact: true }).click();
    detail = await openPortfolio(cleo, A);
    await detail.getByRole('button', { name: 'Reopen…' }).click();
    await sendReason(cleo, 'Late corporate action notice from the custodian.', 'Send for approval');
    const periodA = (await overviewOf(page, A)).periodId;
    expect((await overviewOf(page, A)).state).toBe('closed');
    await fayApproves(browser, periodA, 'Notice attached.');
    expect((await overviewOf(page, A)).state).toBe('reopened');
    await cleo.getByRole('button', { name: 'Refresh' }).click();
    // The open panel shows the new state (the grid behind it is narrower now, so the column may be scrolled away).
    await expect(detail.getByText('Reopened').first()).toBeVisible();

    // 8. Every one of those actions is in the audit history, with who did it and why.
    await detail.getByRole('tab', { name: 'History' }).click();
    const history = detail.locator('[data-slot="record-history"]');
    for (const text of [
      'Reopened',
      'Reopen requested',
      'Closed',
      'Late corporate action notice from the custodian.',
      'Approved by Fay',
    ])
      await expect(history).toContainText(text);
    await cleo.goto('/accounting/audit');
    await cleo.getByRole('button', { name: 'Periods' }).click();
    await cleo.getByRole('searchbox', { name: 'Quick search audit history' }).fill(periodC);
    for (const what of ['Signed off', 'Closed', 'Block override approved', 'Block override requested'])
      await expect(cleo.locator('.ag-row').filter({ hasText: what }).first()).toBeVisible();
    const audit = await api<{
      rows: { action: string; before?: unknown; after?: unknown; note?: { text: string } }[];
    }>(page, 'post', '/audit/query', 'u-cleo', {
      startRow: 0,
      endRow: 200,
      filters: [
        { field: 'recordId', op: 'in', value: [periodA, periodC, priceA.id, (ten[0] as Exception).id] },
      ],
    });
    const actions = new Set(audit.rows.map((e) => e.action));
    for (const action of [
      'period.close',
      'period.overrideBlock.request',
      'period.overrideBlock.approved',
      'period.signoff',
      'period.reopen.request',
      'period.reopen',
      'exception.resolve',
      'exception.attachEvidence',
      'exception.propose',
    ])
      expect(actions, action).toContain(action);
    expect(audit.rows.filter((e) => e.action === 'period.close').every((e) => e.before && e.after)).toBe(
      true,
    );
    await cleo.context().close();
  });
});

test.describe('approvals', () => {
  test('a rejected request returns to its maker with the note', async ({ page, browser }) => {
    // A portfolio no other journey uses: closed here through the API, then a reopen is asked for and refused.
    const rows = await api<Overview[]>(page, 'get', `/periods/overview?periodEnd=${PERIOD}`, 'u-cleo');
    const target = rows.filter((r) => r.blocking === 0 && r.state === 'open').at(-1) as Overview;
    await api(page, 'post', '/periods/close', 'u-cleo', {
      portfolioIds: [target.portfolio.id],
      periodEnd: PERIOD,
    });
    await expect
      .poll(async () => (await overviewOf(page, target.portfolio.id)).state, { timeout: 15_000 })
      .toBe('closed');
    const request = await api<{ id: string }>(page, 'post', '/periods/reopen', 'u-cleo', {
      periodId: target.periodId,
      reason: 'Want to rebook a fee.',
    });

    const fay = await as(browser, 'u-fay', '/accounting/approvals');
    await row(fay, request.id).locator('[col-id="reason"]').click();
    await fay.keyboard.press('Enter');
    await panel(fay, 'Approval detail').getByRole('button', { name: 'Reject…' }).click();
    const dialog = fay.locator('[data-slot="reason-dialog"]');
    // A rejection needs a note: the maker has to know what to change.
    await dialog.getByRole('button', { name: 'Reject' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Enter the note');
    await dialog.getByRole('textbox').fill('Book the fee in December instead.');
    await dialog.getByRole('button', { name: 'Reject' }).click();
    await expect(toastOf(fay, 'Reject: done')).toBeVisible();
    await fay.context().close();

    const cleo = await as(browser, 'u-cleo', '/accounting/approvals');
    await cleo.getByRole('button', { name: 'Waiting', exact: true }).click();
    await cleo.getByRole('button', { name: 'Rejected', exact: true }).click();
    await expect(row(cleo, request.id).locator('[col-id="status"]')).toHaveText('Rejected');
    await row(cleo, request.id).locator('[col-id="reason"]').click();
    await cleo.keyboard.press('Enter');
    await expect(panel(cleo, 'Approval detail').locator('[data-slot="rejection"]')).toContainText(
      'Rejected by Fay. Book the fee in December instead.',
    );
    expect((await overviewOf(page, target.portfolio.id)).state).toBe('closed');
    await cleo.context().close();
  });

  test('someone who is not an approver sees only their own requests, and is told why', async ({
    browser,
  }) => {
    const ada = await as(browser, 'u-ada', '/accounting/approvals');
    await expect(ada.getByText('You see the requests you made.')).toBeVisible();
    await expect(statusBar(ada)).toContainText('0 rows');
    await ada.context().close();
  });
});

test.describe('exception queue', () => {
  test('filter to mine, high severity, new, then bulk-assign; the thread and history stay with the exception', async ({
    page,
    browser,
  }) => {
    const rafa = await as(browser, 'u-rafa', '/accounting/exceptions');
    for (const chip of ['Mine', 'High severity', 'New'])
      await rafa.getByRole('button', { name: chip, exact: true }).click();
    const tags = rafa.getByRole('list', { name: 'Active filters' });
    await expect(tags).toContainText('Owner');
    await expect(tags).toContainText('Severity is high');
    const mine = (
      await exceptions(page, [
        { field: 'ownerId', op: 'eq', value: 'u-rafa' },
        { field: 'severity', op: 'eq', value: 'high' },
        { field: 'status', op: 'eq', value: 'new' },
        { field: 'type', op: 'eq', value: 'importRowError' },
      ])
    )[0] as Exception;
    await rafa.getByRole('searchbox', { name: 'Quick search exceptions' }).fill(mine.id);
    await expect(statusBar(rafa)).toContainText('1 row');
    await row(rafa, mine.id).locator('[col-id="type"]').click();
    await rafa.keyboard.press('Space');
    await rafa
      .getByRole('group', { name: 'Actions for selected exceptions' })
      .getByRole('button', { name: 'Assign' })
      .click();
    const assign = rafa.locator('[data-slot="exception-action"]');
    await assign.getByLabel('Assign to').selectOption('u-ada');
    await assign.getByRole('button', { name: 'Assign 1 exception' }).click();
    await expect(toastOf(rafa, 'Assign: done')).toBeVisible();

    // It is Ada's now, so it leaves "Mine". Take the filters off to open it.
    await rafa.getByRole('button', { name: 'Mine', exact: true }).click();
    await rafa.getByRole('button', { name: 'New', exact: true }).click();
    await expect(row(rafa, mine.id).locator('[col-id="owner"]')).toHaveText('Ada');
    await row(rafa, mine.id).locator('[col-id="type"]').click();
    await rafa.keyboard.press('Enter');
    const detail = panel(rafa, 'Exception detail');
    await detail.getByLabel('Add a comment').fill('Source file re-sent by the custodian this morning.');
    await detail.getByRole('button', { name: 'Add comment' }).click();
    await expect(detail.getByRole('region', { name: 'Thread' })).toContainText(
      'Source file re-sent by the custodian this morning.',
    );
    await detail.getByRole('tab', { name: 'History' }).click();
    await expect(detail.locator('[data-slot="record-history"]')).toContainText('Comment added');
    await expect(detail.locator('[data-slot="record-history"]')).toContainText('Assigned');
    await rafa.context().close();
  });

  test('similar exceptions can be grouped; a viewer sees actions disabled with the reason', async ({
    browser,
  }) => {
    const ben = await as(browser, 'u-ben', '/accounting/exceptions');
    await expect(statusBar(ben)).toContainText(/\d+ rows/);
    await ben.getByRole('button', { name: 'Group' }).click();
    await ben.getByRole('menuitemcheckbox', { name: 'Type' }).click();
    await ben.keyboard.press('Escape');
    await expect(
      ben.locator('.ag-row-group [data-slot="group-label"]').filter({ hasText: 'Cash break' }),
    ).toBeVisible();
    await ben.getByRole('button', { name: 'Group' }).click();
    await ben.getByRole('menuitemcheckbox', { name: 'Type' }).click();
    await ben.keyboard.press('Escape');
    await ben.locator('.ag-row[row-index="0"] [col-id="type"]').first().click();
    await ben.keyboard.press('Space');
    const resolve = ben
      .getByRole('group', { name: 'Actions for selected exceptions' })
      .getByRole('button', { name: 'Resolve' });
    await expect(resolve).toHaveAttribute('aria-disabled', 'true');
    await ben.context().close();
  });
});

test.describe('price review', () => {
  test('a tolerance change shows how many exceptions would appear or clear before it can be saved', async ({
    browser,
  }) => {
    const dev = await as(browser, 'u-dev', '/market-data');
    await dev.getByRole('tab', { name: 'Tolerance rules' }).click();
    const impact = dev.locator('[data-slot="tolerance-impact"]');
    const save = dev.getByRole('button', { name: /^Save/ });
    await expect(impact).toContainText('Change a threshold');
    await expect(save).toBeDisabled();
    const threshold = dev.getByLabel('Government day-over-day move threshold');
    await expect(threshold).toHaveValue('2');
    await threshold.fill('0.01');
    await expect(impact).toContainText(
      /On prices for 13 Nov 2026: [\d,]+ exceptions would appear and 0 would clear/,
    );
    await expect(save).toBeEnabled();
    // Looser instead: exceptions clear, none appear.
    await threshold.fill('99');
    await expect(impact).toContainText(/0 exceptions would appear and \d+ would clear/);
    await threshold.fill('abc');
    await expect(impact).toContainText('Fix the threshold marked in red.');
    await expect(save).toBeDisabled();
    await dev.getByRole('button', { name: 'Discard changes' }).click();
    await expect(threshold).toHaveValue('2');
    await dev.context().close();
  });

  test('tolerance rules are read only outside Market Data, with the reason; prices show the prior day beside them', async ({
    browser,
  }) => {
    const cleo = await as(browser, 'u-cleo', '/market-data');
    await cleo.getByRole('tab', { name: 'Tolerance rules' }).click();
    await expect(cleo.locator('[data-slot="read-only-reason"]')).toContainText(
      'Tolerance rules are owned by Market Data.',
    );
    await expect(cleo.getByLabel('Government day-over-day move threshold')).toBeDisabled();
    await cleo.getByRole('tab', { name: 'Prices' }).click();
    await expect(cleo.getByRole('list', { name: 'Active filters' })).toContainText('Price date is yesterday');
    const first = cleo.locator('.ag-row[row-index="0"]');
    await expect(first.locator('[col-id="failedRule"]').first()).toContainText(/^TOL-/);
    await expect(cleo.locator('[data-slot="delta-cell"]').first()).toBeVisible();
    await cleo.context().close();
  });
});
