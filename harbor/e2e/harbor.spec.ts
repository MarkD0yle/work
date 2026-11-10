import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

/* Acceptance tests for Phases 0–4. Later phases extend this file towards the
 * full golden path in SPEC section 15; step numbers below refer to it. */

const BLUE = 'fdc3.channel.6'
const GREEN = 'fdc3.channel.4'

async function signIn(page: Page, role: string, panels: number) {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(`^${role}`) }).click()
  await expect(page.locator('.hs-tab')).toHaveCount(panels)
}

const tab = (page: Page, appId: string) => page.locator(`.hs-tab[data-app="${appId}"]`)
const panel = (page: Page, appId: string) => page.locator(`.hs-panel[data-app="${appId}"]`)
const frame = (page: Page, appId: string) => page.frameLocator(`[data-testid="frame-${appId}"]`)
const saved = (page: Page) => expect(page.getByTestId('save-status')).toHaveText('All changes saved')

async function menu(page: Page, trigger: string | RegExp, item: string | RegExp) {
  await page.getByRole('button', { name: trigger }).click()
  await page.getByRole('menu').locator('[role^="menuitem"]').filter({ hasText: item }).first().click()
}

async function exportWorkspace(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), menu(page, /^Workspace:/, 'Export…')])
  const path = await download.path()
  return { path, file: JSON.parse(await readFile(path, 'utf8')) as { name: string; layout: { grid: unknown; panels: unknown }; panels: { panelId: string; appId: string; channelId: string | null }[] } }
}

test('phase 0: theme and density switch live, in the shell and inside iframe apps', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  const html = page.locator('html')
  const appHtml = frame(page, 'pretrade').locator('html')
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(appHtml).toHaveAttribute('data-theme', 'dark')
  const darkSurface = await page.locator('.hs-topbar').evaluate((el) => getComputedStyle(el).backgroundColor)

  await menu(page, /profile menu$/, 'Light theme')
  await expect(html).toHaveAttribute('data-theme', 'light')
  await expect(appHtml).toHaveAttribute('data-theme', 'light')
  expect(await page.locator('.hs-topbar').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(darkSurface)

  const compactRow = await html.evaluate((el) => getComputedStyle(el).getPropertyValue('--grid-row-height'))
  await menu(page, /profile menu$/, 'Comfortable density')
  await expect(html).toHaveAttribute('data-density', 'comfortable')
  await expect(appHtml).toHaveAttribute('data-density', 'comfortable')
  expect(compactRow.trim()).toBe('24px')
  expect((await html.evaluate((el) => getComputedStyle(el).getPropertyValue('--grid-row-height'))).trim()).toBe('32px')
  await expect(page.locator('.hs-mock')).toHaveText('MOCK')
})

test('phase 1: add, split, tab, float and close panels with the keyboard; panel states render', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  const groups = page.locator('.dv-groupview')
  await expect(groups).toHaveCount(5)

  // Keyboard only: focus the tab menu, open it, pick an item.
  const keyboardMenu = async (title: string, item: string) => {
    await page.getByRole('button', { name: `${title} menu` }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menu').getByRole('menuitem', { name: item, exact: true }).focus()
    await page.keyboard.press('Enter')
  }
  await keyboardMenu('TCA', 'Split right')
  await expect(groups).toHaveCount(6)
  await keyboardMenu('TCA', 'Move to next group')
  await expect(groups).toHaveCount(5)
  await keyboardMenu('TCA', 'Float')
  await expect(page.locator('.dv-resize-container')).toHaveCount(1)
  await keyboardMenu('TCA', 'Close')
  await expect(page.locator('.hs-tab')).toHaveCount(5)

  // Add from the rail with the keyboard; Shift-click with the mouse always opens another.
  await page.locator('.hs-rail [data-app="tca"]').focus()
  await page.keyboard.press('Enter')
  await expect(tab(page, 'tca')).toHaveCount(1)
  await page.locator('.hs-rail [data-app="tca"]').click()
  await expect(tab(page, 'tca')).toHaveCount(1)
  await page.locator('.hs-rail [data-app="tca"]').click({ modifiers: ['Shift'] })
  await expect(tab(page, 'tca')).toHaveCount(2)

  // Panel states.
  const pretrade = panel(page, 'pretrade')
  await menu(page, 'Pre-Trade menu', 'Dev: show loading')
  await expect(pretrade.getByRole('status', { name: 'Loading' })).toBeVisible()
  await menu(page, 'Pre-Trade menu', 'Dev: show empty')
  await expect(pretrade.getByText('Nothing to show')).toBeVisible()
  await menu(page, 'Pre-Trade menu', 'Dev: show error')
  await pretrade.getByRole('button', { name: 'Reload' }).click()
  await expect(frame(page, 'pretrade').getByText('Select an order to see an estimate.')).toBeVisible()

  await page.getByRole('button', { name: 'Interop log' }).click()
  await page.getByRole('switch', { name: /Simulate disconnect/ }).click()
  await page.keyboard.press('Escape')
  await expect(pretrade.getByText(/Disconnected — data may be stale. Last updated/)).toBeVisible()
  await expect(page.getByText('▲ Disconnected')).toBeVisible()
})

test('step 10: move a panel, change a channel, export, reset, import — layout and channels are identical', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await expect(page.getByTestId('save-status')).toHaveText(/Role default/)

  await menu(page, 'TCA menu', 'Split right')
  await menu(page, /^Channel for Pre-Trade/, 'Green')
  await saved(page)

  const before = await exportWorkspace(page)
  expect(before.file.name).toBe('FX Trading')
  expect(before.file.panels.find((p) => p.appId === 'pretrade')?.channelId).toBe(GREEN)

  // Autosave survived a reload: same panels, same channel links.
  await page.reload()
  await expect(page.locator('.hs-tab')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Channel for Pre-Trade: Green' })).toBeVisible()

  await menu(page, /^Workspace:/, 'Reset to default')
  await expect(page.getByRole('button', { name: 'Channel for Pre-Trade: Blue' })).toBeVisible()
  await expect(page.locator('.dv-groupview')).toHaveCount(5)
  // A layout rebuilt in place must put each panel's content back under its own tab.
  await expect
    .poll(async () => {
      const tabBox = await tab(page, 'pretrade').boundingBox()
      const frameBox = await page.locator('[data-testid="frame-pretrade"]').boundingBox()
      return tabBox && frameBox ? Math.round(frameBox.y - (tabBox.y + tabBox.height)) : null
    })
    .toBeLessThan(6)
  await expect(frame(page, 'pretrade').getByText('Select an order to see an estimate.')).toBeVisible()
  await saved(page)
  const reset = await exportWorkspace(page)
  expect(reset.file.layout.grid).not.toEqual(before.file.layout.grid)

  await page.getByTestId('import-input').setInputFiles(before.path)
  await expect(page.getByTestId('import-preview')).toContainText('FX Trading')
  await expect(page.getByTestId('import-preview')).toContainText('6')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Channel for Pre-Trade: Green' })).toBeVisible()
  await expect(page.locator('.dv-groupview')).toHaveCount(6)

  const after = await exportWorkspace(page)
  expect(after.file.layout.grid).toEqual(before.file.layout.grid)
  expect(after.file.layout.panels).toEqual(before.file.layout.panels)
  expect(after.file.panels).toEqual(before.file.panels)
  expect(after.file.panels.filter((p) => p.channelId === BLUE)).toHaveLength(5)
})

test('phase 2: unsupported and malformed workspace files are rejected with a clear message', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await page.getByTestId('import-input').setInputFiles({ name: 'future.harbor.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 9, id: 'x', name: 'Future' })) })
  await expect(page.getByText(/schema version 9 is not supported/)).toBeVisible()
  await page.getByTestId('import-input').setInputFiles({ name: 'broken.harbor.json', mimeType: 'application/json', buffer: Buffer.from('{not json') })
  await expect(page.getByText('This file is not valid JSON.')).toBeVisible()
  await expect(page.locator('.hs-tab')).toHaveCount(6)
})

test('phase 3: a new app appears from a directory record alone', async ({ page }) => {
  await page.route('**/directory.json', async (route) => {
    const response = await route.fetch()
    const directory = (await response.json()) as { applications: unknown[] }
    directory.applications.push({
      appId: 'brand-new',
      title: 'Brand New App',
      description: 'Added by editing the directory only.',
      publisher: 'In-house',
      category: 'Trading',
      type: 'web',
      details: { url: 'http://localhost:5174/?app=brand-new' },
      kind: 'app',
      allowedOrigins: ['http://localhost:5174'],
      requiredEntitlement: 'app.tca',
      glyph: 'BN',
      interop: { intents: { listensFor: { 'harbor.NoSuchIntent': { contexts: ['fdc3.instrument'] } } } },
    })
    await route.fulfill({ response, json: directory })
  })
  // The Admin workspace has the Context Inspector, which raises the intent below.
  await signIn(page, 'Admin', 3)
  await expect(page.locator('.hs-rail [data-app="brand-new"]')).toBeVisible()
  await page.getByRole('button', { name: 'All apps' }).click()
  const card = page.getByTestId('library').locator('[data-app="brand-new"]')
  await expect(card).toContainText('In-house')
  await card.getByRole('button', { name: 'Add Brand New App' }).click()
  await expect(frame(page, 'brand-new').getByText('Brand New App')).toBeVisible()
  // It is a full interop citizen: the intent nobody else handles now routes to it.
  await page.getByRole('button', { name: 'Close library' }).click()
  await panel(page, 'context-inspector').getByRole('button', { name: 'Raise unhandled intent' }).click()
  await expect(frame(page, 'brand-new').getByTestId('probe-received')).toContainText('harbor.NoSuchIntent')
})

test('step 11: the Operations user never sees FX Execution — launcher, library, resolver, restored workspace', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await expect(page.locator('.hs-rail [data-app="fx-exec"]')).toBeVisible()
  const traderFile = await exportWorkspace(page)

  await menu(page, /profile menu$/, 'Switch to Operations')
  await expect(page.getByTestId('user-role')).toHaveText('Operations')
  await expect(page.getByTestId('workspace-name')).toHaveText('Post-Trade')
  await expect(page.locator('.hs-tab')).toHaveCount(4)

  // Launcher
  await expect(page.locator('.hs-rail [data-app="post-trade"]')).toBeVisible()
  await expect(page.locator('.hs-rail [data-app="fx-exec"]')).toHaveCount(0)
  // Library
  await page.getByRole('button', { name: 'All apps' }).click()
  const library = page.getByTestId('library')
  await expect(library.locator('[data-app="post-trade"]')).toBeVisible()
  await expect(library.locator('[data-app="fx-exec"]')).toHaveCount(0)
  await library.getByRole('tab', { name: /Widgets/ }).click()
  await expect(library.locator('[data-app="context-inspector"]')).toBeVisible()
  await expect(library.locator('[data-app="order-blotter"]')).toHaveCount(0)
  await library.getByRole('tab', { name: /Apps/ }).click()
  await library.getByRole('textbox', { name: 'Search library' }).fill('FX Execution')
  await expect(library.getByText('Nothing matches')).toBeVisible()
  await page.keyboard.press('Escape')
  // Resolver / agent: raising the intent is refused by the agent and opens nothing.
  const inspector = panel(page, 'context-inspector')
  await inspector.getByRole('button', { name: 'Execute order' }).click()
  await expect(inspector.getByTestId('probe-status')).toContainText('AccessDenied')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tab(page, 'fx-exec')).toHaveCount(0)
  // The resolver only lists entitled handlers.
  await inspector.getByRole('button', { name: 'View news' }).click()
  const resolver = page.getByRole('dialog')
  await expect(resolver.locator('[data-app]')).toHaveCount(2)
  await expect(resolver.locator('[data-app="fx-exec"]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(inspector.getByTestId('probe-status')).toContainText('UserCancelledResolution')

  // A restored workspace that contains it shows "No access" in that slot.
  await page.getByTestId('import-input').setInputFiles(traderFile.path)
  await expect(page.getByTestId('import-preview')).toContainText('fx-exec')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(panel(page, 'fx-exec').getByText('No access')).toBeVisible()
  await expect(page.locator('[data-testid="frame-fx-exec"]')).toHaveCount(0)
  // Entitled panels in the same file still load (Post-Trade sits behind the TCA tab).
  await tab(page, 'post-trade').click()
  await expect(frame(page, 'post-trade').getByRole('heading', { name: 'Post-Trade' })).toBeVisible()
})

test('phase 4: iframes exchange context and intents through the agent; resolver; interop log', async ({ page }) => {
  // The Admin workspace is the interop bench: the inspector (in-process) plus the probe app on two origins.
  await signIn(page, 'Admin', 3)
  const research = frame(page, 'probe-a')
  const partner = frame(page, 'probe-b')
  const inspector = panel(page, 'context-inspector')
  await expect(research.getByTestId('probe-channel')).toContainText('Blue channel')
  await expect(partner.getByText('handles no intents')).toBeVisible()

  // Context: iframe -> iframe on another origin, and iframe -> in-process widget, on the shared channel only.
  await menu(page, /^Channel for Interop Probe B/, 'Green')
  await research.getByRole('button', { name: 'Broadcast new order' }).click()
  await expect(inspector.getByTestId('probe-received')).toContainText(/harbor\.fxOrder \d+ [A-Z]{6}/)
  await expect(inspector.getByTestId('probe-received')).toContainText('from probe-a')
  await expect(partner.getByText('Nothing received yet')).toBeVisible()
  // Late joiner: moving Partner News onto Blue replays the latest order.
  await menu(page, /^Channel for Interop Probe B/, 'Blue')
  await expect(partner.getByTestId('probe-received')).toContainText('harbor.fxOrder')

  // Intent with one handler routes directly: FX Execution was not running, opens, and has the same order (no re-keying).
  const orderId = (await inspector.getByTestId('probe-received').locator('li').first().innerText()).match(/harbor\.fxOrder (\d+)/)?.[1]
  await research.getByRole('button', { name: 'Execute order' }).click()
  await expect(frame(page, 'fx-exec').getByTestId('ticket-order')).toHaveText(orderId ?? 'missing')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Zero handlers.
  await research.getByRole('button', { name: 'Raise unhandled intent' }).click()
  await expect(page.getByText('Nothing can handle this')).toBeVisible()

  // Two handlers: the resolver opens and the chosen app, on a third origin, is launched and receives the intent.
  const pair = (await inspector.getByTestId('probe-received').locator('li').first().innerText()).match(/harbor\.fxOrder \d+ ([A-Z]{6})/)?.[1] ?? ''
  const headline = `Headlines for ${pair.slice(0, 3)}/${pair.slice(3)}`
  await research.getByRole('button', { name: 'View news' }).click()
  const resolver = page.getByRole('dialog')
  await expect(resolver.locator('[data-app]')).toHaveCount(2)
  await resolver.getByText('Remember my choice').click()
  await resolver.locator('[data-app="partner-news"]').click()
  const wirefeed = frame(page, 'partner-news')
  await expect(wirefeed.getByTestId('partner-filter')).toHaveText(headline)
  await expect(wirefeed.getByTestId('partner-headlines').locator('li')).toHaveCount(3)
  // Remembered: the second raise does not ask again.
  await wirefeed.getByRole('button', { name: 'Show all' }).click()
  await expect(wirefeed.getByTestId('partner-filter')).toHaveText('All headlines')
  await research.getByRole('button', { name: 'View news' }).click()
  await expect(wirefeed.getByTestId('partner-filter')).toHaveText(headline)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Every step left an entry in the interop log.
  await page.getByRole('button', { name: 'Interop log' }).click()
  const log = page.getByTestId('interop-log')
  await expect(log.locator('tr[data-kind="broadcast"]')).not.toHaveCount(0)
  await expect(log.locator('tr[data-kind="intent"]')).toHaveCount(3)
  await expect(log.locator('tr[data-kind="channel"]')).not.toHaveCount(0)
  await expect(log.locator('tr[data-kind="error"]')).toContainText('harbor.NoSuchIntent')
  await expect(log).toContainText('partner-news#')
  await expect(log).toContainText('fx-exec#')
})

test('phase 4: an app served from an origin that is not in allowedOrigins is dropped', async ({ page }) => {
  await page.route('**/directory.json', async (route) => {
    const response = await route.fetch()
    const directory = (await response.json()) as { applications: Record<string, unknown>[] }
    const probe = directory.applications.find((app) => app.appId === 'probe-a') as Record<string, unknown>
    // Another app legitimately lives on :5174, so the frame policy lets that origin load...
    directory.applications.push({ ...probe, appId: 'neighbour', title: 'Neighbour' })
    // ...but the directory says Probe A itself belongs elsewhere. Only the agent's own check can catch that.
    probe.allowedOrigins = ['http://localhost:5199']
    await route.fulfill({ response, json: directory })
  })
  await signIn(page, 'Admin', 3)
  await page.getByRole('button', { name: 'Interop log' }).click()
  const dropped = page.getByTestId('interop-log').locator('tr[data-kind="dropped"]').first()
  await expect(dropped).toContainText('http://localhost:5174')
  await expect(dropped).toContainText('origin is not in allowedOrigins')
  await page.keyboard.press('Escape')
  await expect(panel(page, 'probe-a').getByText('Interop Probe A did not respond')).toBeVisible({ timeout: 15_000 })
  // The rest of the desktop is unaffected.
  await expect(frame(page, 'probe-b').getByTestId('probe-channel')).toContainText('Blue channel')
})

test('phase 4: the frame policy blocks an origin that no directory record names', async ({ page }) => {
  await page.route('**/directory.json', async (route) => {
    const response = await route.fetch()
    const directory = (await response.json()) as { applications: { appId: string; allowedOrigins?: string[] }[] }
    // No record claims :5174 any more, so the shell's frame-src policy does not list it.
    for (const app of directory.applications) if (app.appId === 'probe-a') app.allowedOrigins = ['http://localhost:5199']
    await route.fulfill({ response, json: directory })
  })
  await signIn(page, 'Admin', 3)
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).not.toContain('localhost:5174')
  await expect(panel(page, 'probe-a').getByText('Interop Probe A did not respond')).toBeVisible({ timeout: 15_000 })
  // The app never ran, so the agent heard nothing from it at all.
  await page.getByRole('button', { name: 'Interop log' }).click()
  await expect(page.getByTestId('interop-log').locator('tr[data-kind="dropped"]')).toHaveCount(0)
})

test('phase 1: a panel pops out into its own window and its app reconnects there', async ({ page }) => {
  await signIn(page, 'Admin', 3)
  const [popout] = await Promise.all([page.waitForEvent('popup'), menu(page, 'Interop Probe A menu', 'Pop out')])
  await expect(popout.locator('.hs-tab[data-app="probe-a"]')).toBeVisible()
  await expect(page.locator('.hs-tab')).toHaveCount(2)
  // The iframe reloads in the new window and must still reach the agent in the opener.
  const app = popout.frameLocator('[data-testid="frame-probe-a"]')
  await expect(app.getByTestId('probe-channel')).toContainText('Blue channel')
  await panel(page, 'context-inspector').getByRole('button', { name: 'Broadcast new order' }).click()
  await expect(app.getByTestId('probe-received')).toContainText('harbor.fxOrder')
})

test('phase 3: dragging a library card onto the layout places the panel there', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await page.getByRole('button', { name: 'All apps' }).click()
  const card = page.getByTestId('library').locator('[data-app="research"]')
  await card.dragTo(panel(page, 'pretrade'), { targetPosition: { x: 300, y: 150 } })
  await expect(tab(page, 'research')).toHaveCount(1)
  // Dropped in the middle of Pre-Trade's group, so it joins that group as a tab.
  await expect(page.locator('.dv-groupview').filter({ has: tab(page, 'pretrade') }).locator('.hs-tab')).toHaveCount(2)
})

test('phase 5: the same seed gives identical data across reloads, in the shell and inside iframe apps', async ({ page }) => {
  const open = async (seed: string | null) => {
    await page.goto(seed ? `/?seed=${seed}` : '/')
    const signInButton = page.getByRole('button', { name: /^Admin/ })
    if (await signInButton.isVisible().catch(() => false)) await signInButton.click()
    await expect(page.locator('.hs-tab')).not.toHaveCount(0)
    if ((await tab(page, 'mock-data').count()) === 0) {
      await page.getByRole('button', { name: 'All apps' }).click()
      await page.getByTestId('library').getByRole('tab', { name: /Widgets/ }).click()
      await page.getByTestId('library').getByRole('button', { name: 'Add Mock Data' }).click()
      await page.keyboard.press('Escape')
    }
    const widget = panel(page, 'mock-data')
    await expect(widget.getByTestId('mock-prices').locator('tbody tr')).toHaveCount(12)
    return {
      seed: await widget.getByTestId('mock-seed').innerText(),
      fingerprint: await widget.getByTestId('mock-fingerprint').innerText(),
      firstOrder: await widget.getByTestId('mock-first-order').innerText(),
      counts: await widget.getByTestId('mock-counts').innerText(),
      inFrame: await frame(page, 'probe-a').getByTestId('probe-data').innerText(),
    }
  }

  const first = await open('42')
  expect(first.seed).toBe('42')
  expect(first.fingerprint).toMatch(/^[0-9a-f]{8}$/)
  expect(first.counts).toContain('40')
  expect(first.counts).toContain('400')
  // A separate app in its own iframe and origin built the same data from the same seed.
  expect(first.inFrame).toBe(`seed 42 · data ${first.fingerprint}`)

  const reloaded = await open('42')
  expect(reloaded).toEqual(first)

  const other = await open('43')
  expect(other.fingerprint).not.toBe(first.fingerprint)
  expect(other.inFrame).toBe(`seed 43 · data ${other.fingerprint}`)

  const fallback = await open(null)
  expect(fallback.seed).toBe('harbor')

  // Prices are live: the EURUSD tick counter moves within a couple of seconds.
  const tickCell = panel(page, 'mock-data').locator('tr[data-pair="EURUSD"] td').last()
  const before = Number(await tickCell.innerText())
  await expect.poll(async () => Number(await tickCell.innerText()), { timeout: 5000 }).toBeGreaterThan(before)
  await expect(page.getByTestId('mid-USDJPY')).toHaveText(/^\d{3}\.\d{3}$/)
  await expect(page.getByTestId('mid-EURUSD')).toHaveText(/^\d\.\d{5}$/)
})

/* The golden path: SPEC section 15, all twelve steps, as one spec. It is the definition of done. */
test('golden path steps 1–12', async ({ page }) => {
  test.setTimeout(120_000)
  // 1. Sign in as the Trader. "FX Trading" restores: six panels in five groups (Post-Trade and TCA share one).
  await signIn(page, 'Trader', 6)
  await expect(page.getByTestId('workspace-name')).toHaveText('FX Trading')
  await expect(page.locator('.dv-groupview')).toHaveCount(5)
  const blotter = panel(page, 'order-blotter')
  const pretrade = frame(page, 'pretrade')
  const exec = frame(page, 'fx-exec')
  await expect(pretrade.getByText('Select an order to see an estimate.')).toBeVisible()
  await expect(exec.getByText('Waiting for an order')).toBeVisible()
  const unmatchedBefore = Number(await page.getByTestId('tile-unmatched-count').innerText())
  await expect(page.getByTestId('tile-day-cost-value')).toHaveText('– bps')

  // 2. The tile shows a count. Click it. The blotter filters to those orders.
  const tile = page.getByTestId('tile-orders-count')
  const waiting = Number(await tile.innerText())
  expect(waiting).toBeGreaterThan(0)
  await expect(blotter.getByTestId('blotter-count')).toHaveText('40 of 40 orders')
  await page.getByTestId('tile-orders-awaiting').click()
  await expect(blotter.getByTestId('blotter-count')).toHaveText(`${waiting} of 40 orders`)
  await expect(blotter.getByRole('combobox', { name: 'Status' })).toHaveValue('NEW')

  // 3. Select a EURUSD order. Pre-Trade shows an estimate within 300ms.
  const row = blotter.locator('.ag-row').filter({ has: page.locator('[col-id="pair"]', { hasText: 'EURUSD' }) }).first()
  const orderId = (await row.getAttribute('row-id')) ?? ''
  const amount = (await row.locator('[col-id="amount"]').innerText()).trim()
  expect(orderId).toMatch(/^104\d\d$/)
  await row.locator('[col-id="pair"]').click()
  await expect(pretrade.getByTestId('estimate-order')).toHaveText(orderId, { timeout: 300 })
  await expect(pretrade.getByTestId('estimate-cost')).toHaveText(/^\d+\.\d\d bps$/)
  await expect(pretrade.getByTestId('estimate-liquidity')).toContainText('/ 5')

  // 4. Execute via RFQ. FX Execution takes focus with the ticket filled in and locked; nothing needed typing.
  await pretrade.getByRole('button', { name: 'Execute via RFQ' }).click()
  await expect(exec.getByTestId('ticket-order')).toHaveText(orderId)
  await expect(exec.getByTestId('ticket-pair')).toHaveText('EURUSD')
  await expect(exec.getByTestId('ticket-amount')).toHaveText(amount)
  await expect(exec.getByTestId('ticket')).toHaveAttribute('data-locked', 'true')
  await expect(exec.getByText(`Locked to order ${orderId}`)).toBeVisible()
  await expect(exec.locator('input:not([type="checkbox"]), select, textarea')).toHaveCount(0)
  await expect(page.locator('.dv-groupview.dv-active-group .hs-tab[data-app="fx-exec"]')).toBeVisible()

  // 5. Quotes stream from the suggested counterparties. Accept the best. A fill toast appears.
  const quotes = exec.getByTestId('quotes').locator('tbody tr')
  await expect(quotes).toHaveCount(5)
  await expect(exec.locator('tr[data-best="true"]')).toHaveCount(1)
  await exec.getByTestId('accept-best').click()
  const confirm = exec.getByTestId('confirm-trade')
  // Orders over the confirmation size get a second step that spells the amount out.
  if (Number(amount.replace(/[^0-9]/g, '')) > 50_000_000) {
    await expect(exec.getByTestId('confirm-words')).toContainText('million')
    await confirm.click()
  }
  await expect(exec.getByRole('status').filter({ hasText: /Filled (BUY|SELL) .* EURUSD/ })).toBeVisible()
  const tradeId = 'T-000401'
  await expect(exec.getByTestId('fill')).toBeVisible()
  // The fill is also announced to screen readers from the shell.
  await expect(page.getByTestId('live-region')).toHaveText(`Trade ${tradeId} filled.`)
  await expect(exec.getByText(`Trade ${tradeId}`).first()).toBeVisible()

  // 7. TCA shows the new trade in "Slippage vs arrival" within 2s of execution.
  const tca = frame(page, 'tca')
  await expect(tca.getByTestId('slippage-latest')).toHaveText(tradeId, { timeout: 2000 })
  await expect(tca.getByTestId('slippage-count')).toHaveText('401')

  // The tiles follow the same fill: one more unmatched trade, and a day cost at last.
  await expect(page.getByTestId('tile-unmatched-count')).toHaveText(String(unmatchedBefore + 1))
  await expect(page.getByTestId('tile-day-cost-value')).toHaveText(/^[+-]?\d+\.\d\d bps$/)

  // 6. Post-Trade shows the trade as UNMATCHED, then MATCHED.
  await tab(page, 'post-trade').click()
  const settled = frame(page, 'post-trade').locator(`.ag-row[row-id="${tradeId}"] [col-id="matchStatus"]`)
  await expect(settled).toHaveText(/UNMATCHED/)
  await expect(settled).toHaveText(/✓\s*MATCHED/, { timeout: 12_000 })
  await expect(page.getByTestId('tile-unmatched-count')).toHaveText(String(unmatchedBefore))

  // The loop closes back at the start: the order has left the awaiting list.
  await expect(tile).toHaveText(String(waiting - 1))
  await expect(blotter.locator(`.ag-row[row-id="${orderId}"]`)).toHaveCount(0)
  await expect(pretrade.getByText('No longer open')).toBeVisible()

  // 8. Force a mismatch from the dev panel. A critical alert appears. Its action opens Post-Trade on that exception.
  await expect(page.getByTestId('tile-alerts-critical')).toContainText('0')
  await tab(page, 'tca').click()
  await page.getByRole('button', { name: 'Interop log' }).click()
  await page.getByRole('button', { name: 'Force a mismatch' }).click()
  const alertToast = page.locator('.hb-toast--critical').filter({ hasText: `Trade ${tradeId} mismatched` })
  await expect(alertToast).toBeVisible()
  await expect(alertToast).toContainText('Critical')
  await expect(page.getByTestId('alert-unread')).toHaveText('1')
  await expect(page.getByTestId('tile-alerts-critical')).toContainText('1')
  // Put Post-Trade behind another tab first: the action must bring it forward.
  await tab(page, 'tca').click()
  await alertToast.getByRole('button', { name: 'Resolve' }).click()
  const exception = frame(page, 'post-trade').locator(`.st-exception[data-trade="${tradeId}"]`)
  await expect(exception).toBeVisible()
  await expect(exception).toHaveClass(/is-selected/)
  await expect(exception.locator('tr.is-differs')).toHaveCount(1)
  await expect(page.locator('.dv-groupview.dv-active-group .hs-tab[data-app="post-trade"]')).toBeVisible()
  await expect(alertToast).toHaveCount(0)
  await expect(page.getByTestId('tile-alerts-critical')).toContainText('0')
  // Resolving it in Post-Trade clears the exception.
  await exception.getByRole('button', { name: 'Accept theirs' }).click()
  await expect(exception).toHaveCount(0)
  await expect(settled).toHaveText(/✓\s*MATCHED/)

  // 9. Raise ViewNews for EURUSD from the command palette, by keyboard. The resolver shows two handlers. Pick Partner News.
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await palette.getByRole('combobox').fill('news eurusd')
  await expect(palette.getByRole('option').first()).toHaveText(/View news for EURUSD/)
  await expect(palette.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  const newsResolver = page.getByRole('dialog', { name: /ViewNews/ })
  await expect(newsResolver.locator('[data-app]')).toHaveCount(2)
  await expect(newsResolver.locator('[data-app="research"]')).toBeVisible()
  await newsResolver.locator('[data-app="partner-news"]').click()
  const wirefeed = frame(page, 'partner-news')
  await expect(wirefeed.getByTestId('partner-filter')).toHaveText('Headlines for EUR/USD')
  await expect(wirefeed.getByTestId('partner-headlines').locator('li')).toHaveCount(3)
  // The partner app has its own look and does not follow the host theme, yet sits on a host channel.
  expect(await wirefeed.locator('body').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Georgia/)

  // 10. Move a panel, change a channel, export the workspace, reset, import. Layout and channels are identical.
  await menu(page, 'Partner News menu', 'Move to next group')
  await menu(page, /^Channel for Pre-Trade/, 'Green')
  await saved(page)
  const before = await exportWorkspace(page)
  expect(before.file.panels.find((p) => p.appId === 'pretrade')?.channelId).toBe(GREEN)
  expect(before.file.panels.some((p) => p.appId === 'partner-news')).toBe(true)
  await menu(page, /^Workspace:/, 'Reset to default')
  await expect(page.getByRole('button', { name: 'Channel for Pre-Trade: Blue' })).toBeVisible()
  await expect(tab(page, 'partner-news')).toHaveCount(0)
  await saved(page)
  await page.getByTestId('import-input').setInputFiles(before.path)
  await expect(page.getByTestId('import-preview')).toContainText(String(before.file.panels.length))
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Channel for Pre-Trade: Green' })).toBeVisible()
  await expect(tab(page, 'partner-news')).toHaveCount(1)
  const after = await exportWorkspace(page)
  expect(after.file.layout.grid).toEqual(before.file.layout.grid)
  expect(after.file.layout.panels).toEqual(before.file.layout.panels)
  expect(after.file.panels).toEqual(before.file.panels)

  // 11. Switch to the Operations user. FX Execution is absent from the launcher, the library and the resolver.
  await menu(page, /profile menu$/, 'Switch to Operations')
  await expect(page.getByTestId('user-role')).toHaveText('Operations')
  await expect(page.locator('.hs-rail [data-app="post-trade"]')).toBeVisible()
  await expect(page.locator('.hs-rail [data-app="fx-exec"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'All apps' }).click()
  await expect(page.getByTestId('library').locator('[data-app="post-trade"]')).toBeVisible()
  await expect(page.getByTestId('library').locator('[data-app="fx-exec"]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k')
  await palette.getByRole('combobox').fill('execution')
  await expect(palette.getByRole('option').filter({ hasText: /FX Execution|Execute order/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  // The agent refuses the intent outright, so no resolver could ever list it.
  const opsInspector = panel(page, 'context-inspector')
  await opsInspector.getByRole('button', { name: 'Execute order' }).click()
  await expect(opsInspector.getByTestId('probe-status')).toContainText('AccessDenied')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tab(page, 'fx-exec')).toHaveCount(0)

  // 12. Open the interop log. Steps 3 to 9 each produced an entry.
  await page.getByRole('button', { name: 'Interop log' }).click()
  const log = page.getByTestId('interop-log')
  const entry = (kind: string, ...texts: string[]) => texts.reduce((rows, text) => rows.filter({ hasText: text }), log.locator(`tr[data-kind="${kind}"]`))
  await expect(entry('broadcast', 'harbor.fxOrder', orderId), 'step 3: order selected').not.toHaveCount(0)
  await expect(entry('broadcast', 'harbor.preTradeEstimate', orderId), 'step 3: estimate produced').not.toHaveCount(0)
  await expect(entry('intent', 'harbor.ExecuteOrder', orderId, 'pretrade#'), 'step 4: execute raised from Pre-Trade').toHaveCount(1)
  await expect(entry('broadcast', 'harbor.fxTrade', tradeId, 'fx-exec#'), 'step 5: fill broadcast').toHaveCount(1)
  await expect(entry('broadcast', 'harbor.settlement', tradeId), 'step 6: settlement updates').not.toHaveCount(0)
  await expect(entry('alert', 'critical', tradeId), 'step 8: alert published').toHaveCount(1)
  await expect(entry('intent', 'harbor.ViewSettlement', tradeId, 'shell#shell'), 'step 8: alert action').toHaveCount(1)
  await expect(entry('intent', 'ViewNews', 'partner-news#'), 'step 9: news routed to the partner app').toHaveCount(1)
  await expect(entry('denied', 'harbor.ExecuteOrder', 'u-ops'), 'step 11: refusal recorded').toHaveCount(1)
  // Step 7 has no hop of its own: TCA picked up the same harbor.fxTrade broadcast as step 5.
})

test('phase 7: alert centre — toasts, bell, drawer filters, bulk dismiss, tile, and acting when the target app is closed', async ({ page }) => {
  await signIn(page, 'Operations', 4)
  const forceMismatch = async () => {
    await page.getByRole('button', { name: 'Interop log' }).click()
    await page.getByRole('button', { name: 'Force a mismatch' }).click()
  }
  const toasts = page.locator('.hb-toast--critical')

  // Four breaks: at most three toasts on screen, and they do not time out.
  for (let i = 1; i <= 4; i++) {
    await forceMismatch()
    await expect(page.getByTestId('alert-unread')).toHaveText(String(i))
  }
  await expect(toasts).toHaveCount(3)
  await expect(page.getByTestId('tile-alerts-critical')).toContainText('4')
  await page.waitForTimeout(5500)
  await expect(toasts).toHaveCount(3)

  // Closing a toast is not dismissing the alert: it is marked seen and stays in the drawer.
  await toasts.first().getByRole('button', { name: 'Dismiss' }).click()
  await expect(toasts).toHaveCount(2)
  await expect(page.getByTestId('alert-unread')).toHaveText('3')

  // The tile opens the drawer filtered to that severity; severity has an icon and a label, not just a colour.
  await page.getByTestId('tile-alerts-critical').click()
  const drawer = page.getByRole('dialog', { name: 'Alerts' })
  await expect(drawer.getByRole('tab', { name: /Critical/ })).toHaveAttribute('aria-selected', 'true')
  const items = drawer.getByTestId('alert')
  await expect(items).toHaveCount(4)
  await expect(drawer.getByRole('heading', { name: 'Critical' })).toBeVisible()
  await expect(items.first()).toContainText('Post-Trade')
  await expect(items.first()).toContainText(/Trade T-\d{6} mismatched/)
  await drawer.getByRole('tab', { name: /Warning/ }).click()
  await expect(drawer.getByText('No alerts match')).toBeVisible()
  await drawer.getByRole('tab', { name: /^All/ }).click()
  await expect(drawer.getByRole('combobox', { name: 'Source app' }).locator('option')).toHaveText(['All apps', 'Post-Trade'])

  // Dismiss one, then close: what was on screen is now seen.
  await items.first().getByRole('button', { name: 'Dismiss' }).click()
  await expect(items).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('alert-unread')).toHaveCount(0)
  await expect(page.getByTestId('tile-alerts-critical')).toContainText('3')

  // Close Post-Trade, then act on an alert from the drawer: the app reopens on that trade.
  await menu(page, 'Post-Trade menu', 'Close')
  await expect(tab(page, 'post-trade')).toHaveCount(0)
  await page.getByTestId('alert-bell').click()
  const target = (await items.first().innerText()).match(/T-\d{6}/)?.[0] ?? ''
  await items.first().getByRole('button', { name: 'Resolve' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(tab(page, 'post-trade')).toHaveCount(1)
  await expect(frame(page, 'post-trade').locator(`.ag-row-selected[row-id="${target}"]`)).toBeVisible()
  await expect(page.getByTestId('tile-alerts-critical')).toContainText('2')

  // Bulk dismiss clears the rest, and the toasts go with them.
  await page.getByTestId('alert-bell').click()
  await expect(drawer.locator('[data-testid="alert"][data-status="actioned"]')).toHaveCount(1)
  await drawer.getByRole('button', { name: /Dismiss all/ }).click()
  await expect(drawer.getByText('No alerts', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(toasts).toHaveCount(0)
  await expect(page.getByTestId('tile-alerts-critical')).toContainText('0')
})

test('phase 7: alerts belong to the session that raised them and are cleared on user switch', async ({ page }) => {
  await signIn(page, 'Admin', 3)
  await page.getByRole('button', { name: 'Interop log' }).click()
  await page.getByRole('button', { name: 'Force a mismatch' }).click()
  await expect(page.locator('.hb-toast--critical')).toHaveCount(1)
  await menu(page, /profile menu$/, 'Switch to Treasury')
  await expect(page.getByTestId('user-role')).toHaveText('Treasury')
  // Alerts belong to the session that raised them.
  await expect(page.locator('.hb-toast--critical')).toHaveCount(0)
  await expect(page.getByTestId('alert-unread')).toHaveCount(0)
  await page.getByTestId('alert-bell').click()
  await expect(page.getByRole('dialog', { name: 'Alerts' }).getByText('No alerts', { exact: true })).toBeVisible()
})

test('phase 8: command palette is keyboard driven and only offers what the user may do', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  const search = async (text: string) => {
    await page.keyboard.press('Control+k')
    await palette.getByRole('combobox').fill(text)
  }

  // Focus an open panel.
  await search('focus tca')
  await expect(palette.getByRole('option').first()).toHaveText(/Focus TCA/)
  await page.keyboard.press('Enter')
  await expect(palette).toHaveCount(0)
  await expect(page.locator('.dv-groupview.dv-active-group .hs-tab[data-app="tca"]')).toBeVisible()

  // Raise an intent on an entity: arrow down from "Execute" to "Analyse" for the same order.
  await search('order 10401')
  await expect(palette.getByRole('option').nth(0)).toHaveText(/Execute order 10401/)
  await expect(palette.getByRole('option').nth(1)).toHaveText(/Analyse order 10401/)
  await page.keyboard.press('ArrowDown')
  await expect(palette.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(frame(page, 'pretrade').getByTestId('estimate-order')).toHaveText('10401')

  await search('view tca gbpusd')
  await page.keyboard.press('Enter')
  await expect(frame(page, 'tca').getByRole('combobox', { name: 'Pair' })).toHaveValue('GBPUSD')

  // Open an app that is not running; Escape closes without doing anything.
  await search('zzzz')
  await expect(palette.getByText(/Nothing matches/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(palette).toHaveCount(0)
  await search('open research')
  await page.keyboard.press('Enter')
  await expect(tab(page, 'research')).toHaveCount(1)
  await search('light theme')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  // Operations: nothing about executing orders or FX Execution is offered.
  await menu(page, /profile menu$/, 'Switch to Operations')
  await expect(page.getByTestId('user-role')).toHaveText('Operations')
  await search('execute')
  await expect(palette.getByRole('option').filter({ hasText: /Execute order|FX Execution/ })).toHaveCount(0)
  await palette.getByRole('combobox').fill('send payment')
  await expect(palette.getByRole('option').first()).toHaveText(/Send payment to/)
  await page.keyboard.press('Enter')
  await expect(frame(page, 'payments').getByTestId('payment-form')).toBeVisible()
})

test('phase 8: Cash blocks a policy breach and names the rule; compare is capped at four', async ({ page }) => {
  await signIn(page, 'Treasury', 3)
  const cash = frame(page, 'cash')
  const rows = cash.getByTestId('cash-funds').locator('tbody tr')
  await expect(rows).toHaveCount(30)

  // Compare up to four.
  for (let i = 0; i < 4; i++) await rows.nth(i).getByRole('checkbox').check()
  await expect(cash.getByTestId('compare').locator('article')).toHaveCount(4)
  await expect(rows.nth(4).getByRole('checkbox')).toBeDisabled()
  await cash.getByTestId('compare').getByRole('button', { name: /^Remove/ }).first().click()
  await expect(rows.nth(4).getByRole('checkbox')).toBeEnabled()

  // A well-rated fund: too large an amount breaches the concentration limit.
  await cash.locator('tr[data-rating="AAAm"]').first().getByRole('button', { name: 'Deal' }).click()
  const amount = cash.getByRole('textbox', { name: /^Amount/ })
  await amount.fill('5b')
  await expect(cash.getByTestId('cash-breach')).toContainText('Policy breach: Maximum 25% of cash in one fund')
  await expect(cash.getByTestId('cash-submit')).toBeDisabled()
  // Inside the limit: allowed, and the holding is remembered for the next check.
  await amount.fill('100k')
  await expect(cash.getByTestId('cash-ok')).toContainText('Within policy')
  await cash.getByTestId('cash-submit').click()
  await expect(cash.getByTestId('cash-placed')).toContainText('100,000')
  await expect(cash.getByText(/holds 100,000 in this fund/)).toBeVisible()
  // Redeeming more than is held is refused too.
  await cash.getByRole('combobox', { name: 'Action' }).selectOption('REDEEM')
  await cash.getByRole('textbox', { name: /^Amount/ }).fill('200k')
  await expect(cash.getByTestId('cash-breach')).toContainText('Cannot redeem more than is held')

  // A fund below the minimum rating cannot be bought at any size.
  const lowRated = cash.locator('tr[data-rating="Am"]').first()
  if ((await lowRated.count()) > 0) {
    await lowRated.getByRole('button', { name: 'Deal' }).click()
    await cash.getByRole('textbox', { name: /^Amount/ }).fill('10k')
    await expect(cash.getByTestId('cash-breach')).toContainText('Policy breach: Minimum rating AAm')
    await expect(cash.getByTestId('cash-submit')).toBeDisabled()
  }

  // Disconnected: dealing pauses.
  await cash.locator('tr[data-rating="AAAm"]').first().getByRole('button', { name: 'Deal' }).click()
  await cash.getByRole('combobox', { name: 'Action' }).selectOption('SUBSCRIBE')
  await cash.getByRole('textbox', { name: /^Amount/ }).fill('100k')
  await expect(cash.getByTestId('cash-submit')).toBeEnabled()
  await page.getByRole('button', { name: 'Interop log' }).click()
  await page.getByRole('switch', { name: /Simulate disconnect/ }).click()
  await page.keyboard.press('Escape')
  await expect(cash.getByText('Disconnected: dealing is paused')).toBeVisible()
  await expect(cash.getByTestId('cash-submit')).toBeDisabled()
  await expect(page.getByTestId('tile-cutoffs').locator('li')).toHaveCount(3)
})

test('phase 8: Payments needs a locked rate and a second person to approve', async ({ page }) => {
  await signIn(page, 'Treasury', 3)
  const payments = frame(page, 'payments')
  await expect(payments.getByText('No payments yet')).toBeVisible()
  await payments.getByTestId('beneficiaries').locator('tbody tr').first().getByRole('button', { name: 'Pay' }).click()
  await payments.getByRole('textbox', { name: /^Amount/ }).fill('250k')
  await payments.getByRole('textbox', { name: 'Reference' }).fill('INV-1042')
  // Cross-currency: cannot submit until a rate is locked.
  await expect(payments.getByTestId('payment-submit')).toBeDisabled()
  await payments.getByRole('button', { name: 'Lock FX rate' }).click()
  await expect(payments.getByTestId('payment-rate')).toContainText(/1 [A-Z]{3} = \d+\.\d+ [A-Z]{3}/)
  await expect(payments.getByTestId('payment-rate')).toContainText(/held for \d+s/)
  await payments.getByTestId('payment-submit').click()
  const row = payments.locator('tr[data-payment="PAY-0001"]')
  await expect(row).toContainText('Awaiting approval')
  await expect(row).toContainText('250,000')
  // Segregation of duties: the maker sees the rule, not the buttons.
  await expect(row.getByTestId('payment-rule')).toHaveText('Segregation of duties: the maker cannot approve their own payment.')
  await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0)

  // A second person approves it.
  await menu(page, /profile menu$/, 'Switch to Operations')
  await expect(page.getByTestId('user-role')).toHaveText('Operations')
  await page.locator('.hs-rail [data-app="payments"]').click()
  const asOps = frame(page, 'payments').locator('tr[data-payment="PAY-0001"]')
  await expect(asOps).toContainText('Tomás Reyes')
  await asOps.getByRole('button', { name: 'Approve' }).click()
  await expect(asOps).toContainText('Approved and sent')
  await expect(asOps).toContainText('by Omar Haddad')
})

test('phase 8: Research and the tiles follow the channel; tiles join the tile group', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  // Rates tile: six live pairs; clicking one shares it, and TCA on the same channel follows.
  const rates = page.getByTestId('tile-rates')
  await expect(rates.locator('li')).toHaveCount(6)
  await expect(rates.locator('[data-pair="USDJPY"] .hb-price')).toHaveText(/^\d{3}\.\d{3}$/)
  await rates.locator('[data-pair="GBPUSD"]').click()
  await expect(frame(page, 'tca').getByRole('combobox', { name: 'Pair' })).toHaveValue('GBPUSD')

  // Research opened by intent from the palette shows that pair; choosing another pair there moves TCA too.
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill('news usdjpy')
  await page.keyboard.press('Enter')
  await page.getByRole('dialog', { name: /ViewNews/ }).locator('[data-app="research"]').click()
  const research = frame(page, 'research')
  await expect(research.getByTestId('research-count')).toContainText('on USDJPY')
  await expect(research.getByTestId('research-note')).toContainText('USDJPY')
  await menu(page, /^Channel for Research/, 'Blue')
  await research.getByRole('combobox', { name: 'Pair' }).selectOption('EURUSD')
  await expect(frame(page, 'tca').getByRole('combobox', { name: 'Pair' })).toHaveValue('EURUSD')

  // Adding a tile from the library puts it in the existing tile group, not a new panel.
  await page.getByRole('button', { name: 'All apps' }).click()
  const library = page.getByTestId('library')
  await library.getByRole('tab', { name: /Tiles/ }).click()
  // The Trader is not entitled to the Cash app, so its cut-offs tile is not offered.
  await expect(library.locator('[data-app="tile-cutoffs"]')).toHaveCount(0)
  await expect(library.locator('[data-app="tile-rates"]')).toBeVisible()
  await library.getByRole('button', { name: 'Add Rates' }).click()
  await expect(page.getByText('That tile is already in this workspace')).toBeVisible()
  await expect(tab(page, 'tile-group')).toHaveCount(1)
})

test('phase 8: a tile added where there is no tile group creates one, and the next tile joins it', async ({ page }) => {
  await signIn(page, 'Admin', 3)
  await page.getByRole('button', { name: 'All apps' }).click()
  const library = page.getByTestId('library')
  await library.getByRole('tab', { name: /Tiles/ }).click()
  await library.getByRole('button', { name: 'Add Rates' }).click()
  await expect(tab(page, 'tile-group')).toHaveCount(1)
  await expect(page.getByTestId('tile-rates')).toBeVisible()
  await library.getByRole('button', { name: 'Add Cut-offs' }).click()
  await expect(tab(page, 'tile-group')).toHaveCount(1)
  await expect(page.locator('[data-testid="tile-group"] [data-tile]')).toHaveCount(2)
  await saved(page)
  // The group and its tiles survive a reload.
  await page.reload()
  await expect(page.locator('[data-testid="tile-group"] [data-tile]')).toHaveCount(2)
  await expect(page.getByTestId('tile-cutoffs').locator('li')).toHaveCount(3)
})
