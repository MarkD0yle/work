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
  await signIn(page, 'Trader', 5)
  const html = page.locator('html')
  const appHtml = frame(page, 'pretrade').locator('html')
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(appHtml).toHaveAttribute('data-theme', 'dark')
  const darkSurface = await page.locator('.hs-topbar').evaluate((el) => getComputedStyle(el).backgroundColor)

  await menu(page, /^Profile:/, 'Light theme')
  await expect(html).toHaveAttribute('data-theme', 'light')
  await expect(appHtml).toHaveAttribute('data-theme', 'light')
  expect(await page.locator('.hs-topbar').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(darkSurface)

  const compactRow = await html.evaluate((el) => getComputedStyle(el).getPropertyValue('--grid-row-height'))
  await menu(page, /^Profile:/, 'Comfortable density')
  await expect(html).toHaveAttribute('data-density', 'comfortable')
  await expect(appHtml).toHaveAttribute('data-density', 'comfortable')
  expect(compactRow.trim()).toBe('24px')
  expect((await html.evaluate((el) => getComputedStyle(el).getPropertyValue('--grid-row-height'))).trim()).toBe('32px')
  await expect(page.locator('.hs-mock')).toHaveText('MOCK')
})

test('phase 1: add, split, tab, float and close panels with the keyboard; panel states render', async ({ page }) => {
  await signIn(page, 'Trader', 5)
  const groups = page.locator('.dv-groupview')
  await expect(groups).toHaveCount(4)

  // Keyboard only: focus the tab menu, open it, pick an item.
  const keyboardMenu = async (title: string, item: string) => {
    await page.getByRole('button', { name: `${title} menu` }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menu').getByRole('menuitem', { name: item, exact: true }).focus()
    await page.keyboard.press('Enter')
  }
  await keyboardMenu('TCA', 'Split right')
  await expect(groups).toHaveCount(5)
  await keyboardMenu('TCA', 'Move to next group')
  await expect(groups).toHaveCount(4)
  await keyboardMenu('TCA', 'Float')
  await expect(page.locator('.dv-resize-container')).toHaveCount(1)
  await keyboardMenu('TCA', 'Close')
  await expect(page.locator('.hs-tab')).toHaveCount(4)

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
  await expect(frame(page, 'pretrade').getByText('handles harbor.AnalyseOrder')).toBeVisible()

  await page.getByRole('button', { name: 'Interop log' }).click()
  await page.getByRole('switch', { name: /Simulate disconnect/ }).click()
  await page.keyboard.press('Escape')
  await expect(pretrade.getByText(/Disconnected — data may be stale. Last updated/)).toBeVisible()
  await expect(page.getByText('▲ Disconnected')).toBeVisible()
})

test('step 10: move a panel, change a channel, export, reset, import — layout and channels are identical', async ({ page }) => {
  await signIn(page, 'Trader', 5)
  await expect(page.getByTestId('save-status')).toHaveText(/Role default/)

  await menu(page, 'TCA menu', 'Split right')
  await menu(page, /^Channel for Pre-Trade/, 'Green')
  await expect(frame(page, 'pretrade').getByTestId('probe-channel')).toContainText('Green channel')
  await saved(page)

  const before = await exportWorkspace(page)
  expect(before.file.name).toBe('FX Trading')
  expect(before.file.panels.find((p) => p.appId === 'pretrade')?.channelId).toBe(GREEN)

  // Autosave survived a reload: same panels, same channel links.
  await page.reload()
  await expect(page.locator('.hs-tab')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Channel for Pre-Trade: Green' })).toBeVisible()

  await menu(page, /^Workspace:/, 'Reset to default')
  await expect(page.getByRole('button', { name: 'Channel for Pre-Trade: Blue' })).toBeVisible()
  await expect(page.locator('.dv-groupview')).toHaveCount(4)
  await saved(page)
  const reset = await exportWorkspace(page)
  expect(reset.file.layout.grid).not.toEqual(before.file.layout.grid)

  await page.getByTestId('import-input').setInputFiles(before.path)
  await expect(page.getByTestId('import-preview')).toContainText('FX Trading')
  await expect(page.getByTestId('import-preview')).toContainText('5')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Channel for Pre-Trade: Green' })).toBeVisible()
  await expect(page.locator('.dv-groupview')).toHaveCount(5)

  const after = await exportWorkspace(page)
  expect(after.file.layout.grid).toEqual(before.file.layout.grid)
  expect(after.file.layout.panels).toEqual(before.file.layout.panels)
  expect(after.file.panels).toEqual(before.file.panels)
  expect(after.file.panels.filter((p) => p.channelId === BLUE)).toHaveLength(4)
})

test('phase 2: unsupported and malformed workspace files are rejected with a clear message', async ({ page }) => {
  await signIn(page, 'Trader', 5)
  await page.getByTestId('import-input').setInputFiles({ name: 'future.harbor.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 9, id: 'x', name: 'Future' })) })
  await expect(page.getByText(/schema version 9 is not supported/)).toBeVisible()
  await page.getByTestId('import-input').setInputFiles({ name: 'broken.harbor.json', mimeType: 'application/json', buffer: Buffer.from('{not json') })
  await expect(page.getByText('This file is not valid JSON.')).toBeVisible()
  await expect(page.locator('.hs-tab')).toHaveCount(5)
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
  await signIn(page, 'Trader', 5)
  await expect(page.locator('.hs-rail [data-app="brand-new"]')).toBeVisible()
  await page.keyboard.press('Control+k')
  const card = page.getByTestId('library').locator('[data-app="brand-new"]')
  await expect(card).toContainText('In-house')
  await card.getByRole('button', { name: 'Add Brand New App' }).click()
  await expect(frame(page, 'brand-new').getByText('Brand New App')).toBeVisible()
  // It is a full interop citizen: the intent nobody else handles now routes to it.
  await page.keyboard.press('Escape')
  await panel(page, 'context-inspector').getByRole('button', { name: 'Raise unhandled intent' }).click()
  await expect(frame(page, 'brand-new').getByTestId('probe-received')).toContainText('harbor.NoSuchIntent')
})

test('step 11: the Operations user never sees FX Execution — launcher, library, resolver, restored workspace', async ({ page }) => {
  await signIn(page, 'Trader', 5)
  await expect(page.locator('.hs-rail [data-app="fx-exec"]')).toBeVisible()
  const traderFile = await exportWorkspace(page)

  await menu(page, /^Profile:/, 'Switch to Operations')
  await expect(page.getByTestId('user-role')).toHaveText('Operations')
  await expect(page.getByTestId('workspace-name')).toHaveText('Post-Trade')
  await expect(page.locator('.hs-tab')).toHaveCount(3)

  // Launcher
  await expect(page.locator('.hs-rail [data-app="post-trade"]')).toBeVisible()
  await expect(page.locator('.hs-rail [data-app="fx-exec"]')).toHaveCount(0)
  // Library
  await page.getByRole('button', { name: 'All apps' }).click()
  const library = page.getByTestId('library')
  await expect(library.locator('[data-app="post-trade"]')).toBeVisible()
  await expect(library.locator('[data-app="fx-exec"]')).toHaveCount(0)
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
  await expect(frame(page, 'post-trade').getByText('handles harbor.ViewSettlement')).toBeVisible()
})

test('phase 4: iframes exchange context and intents through the agent; resolver; interop log', async ({ page }) => {
  await signIn(page, 'Trader', 5)
  const pretrade = frame(page, 'pretrade')
  const exec = frame(page, 'fx-exec')
  await expect(pretrade.getByTestId('probe-channel')).toContainText('Blue channel')
  await expect(exec.getByText('handles harbor.ExecuteOrder')).toBeVisible()

  // Context: iframe -> iframe and iframe -> in-process widget, on the shared channel only.
  await menu(page, /^Channel for TCA/, 'Green')
  await pretrade.getByRole('button', { name: 'Broadcast new order' }).click()
  await expect(exec.getByTestId('probe-received')).toContainText(/harbor\.fxOrder \d+ [A-Z]{6}/)
  await expect(exec.getByTestId('probe-received')).toContainText('from pretrade')
  await expect(panel(page, 'context-inspector').getByTestId('probe-received')).toContainText('harbor.fxOrder')
  await tab(page, 'tca').click()
  await expect(frame(page, 'tca').getByText('Nothing received yet')).toBeVisible()
  // Late joiner: moving TCA onto Blue replays the latest order.
  await menu(page, /^Channel for TCA/, 'Blue')
  await expect(frame(page, 'tca').getByTestId('probe-received')).toContainText('harbor.fxOrder')

  // Intent with one handler routes directly, with the same order (no re-keying).
  await pretrade.getByRole('button', { name: 'Execute order' }).click()
  await expect(exec.getByTestId('probe-received')).toContainText('harbor.ExecuteOrder · harbor.fxOrder')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Zero handlers.
  await pretrade.getByRole('button', { name: 'Raise unhandled intent' }).click()
  await expect(page.getByText('Nothing can handle this')).toBeVisible()

  // Two handlers: the resolver opens; the chosen app is launched (it was not running) and receives the intent.
  await exec.getByRole('button', { name: 'View news' }).click()
  const resolver = page.getByRole('dialog')
  await expect(resolver.locator('[data-app]')).toHaveCount(2)
  await resolver.getByText('Remember my choice').click()
  await resolver.locator('[data-app="partner-news"]').click()
  await expect(frame(page, 'partner-news').getByTestId('probe-received')).toContainText('ViewNews · fdc3.instrument')
  // Remembered: the second raise does not ask again.
  await exec.getByRole('button', { name: 'View news' }).click()
  await expect(frame(page, 'partner-news').locator('[data-testid="probe-received"] li')).toHaveCount(2)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Every step left an entry in the interop log.
  await page.getByRole('button', { name: 'Interop log' }).click()
  const log = page.getByTestId('interop-log')
  await expect(log.locator('tr[data-kind="broadcast"]')).not.toHaveCount(0)
  await expect(log.locator('tr[data-kind="intent"]')).toHaveCount(3)
  await expect(log.locator('tr[data-kind="channel"]')).not.toHaveCount(0)
  await expect(log.locator('tr[data-kind="error"]')).toContainText('harbor.NoSuchIntent')
  await expect(log).toContainText('partner-news#')
})

test('phase 4: an app served from an origin that is not in allowedOrigins is dropped', async ({ page }) => {
  await page.route('**/directory.json', async (route) => {
    const response = await route.fetch()
    const directory = (await response.json()) as { applications: { appId: string; allowedOrigins?: string[] }[] }
    // The directory says TCA lives elsewhere; what actually loads comes from :5174.
    for (const app of directory.applications) if (app.appId === 'tca') app.allowedOrigins = ['http://localhost:5199']
    await route.fulfill({ response, json: directory })
  })
  await page.goto('/')
  // The frame-src policy is derived from the directory, so relax it here to reach the agent's own check.
  await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.remove())
  await page.getByRole('button', { name: /^Trader/ }).click()
  await expect(page.locator('.hs-tab')).toHaveCount(5)
  await tab(page, 'tca').click()
  await page.getByRole('button', { name: 'Interop log' }).click()
  const dropped = page.getByTestId('interop-log').locator('tr[data-kind="dropped"]').first()
  await expect(dropped).toContainText('http://localhost:5174')
  await expect(dropped).toContainText('origin is not in allowedOrigins')
  await page.keyboard.press('Escape')
  await expect(panel(page, 'tca').getByText('TCA did not respond')).toBeVisible({ timeout: 15_000 })
  // The rest of the desktop is unaffected.
  await expect(frame(page, 'pretrade').getByTestId('probe-channel')).toContainText('Blue channel')
})

test('phase 1: a panel pops out into its own window and its app reconnects there', async ({ page }) => {
  await signIn(page, 'Trader', 5)
  const [popout] = await Promise.all([page.waitForEvent('popup'), menu(page, 'Pre-Trade menu', 'Pop out')])
  await expect(popout.locator('.hs-tab[data-app="pretrade"]')).toBeVisible()
  await expect(page.locator('.hs-tab')).toHaveCount(4)
  // The iframe reloads in the new window and must still reach the agent in the opener.
  const app = popout.frameLocator('[data-testid="frame-pretrade"]')
  await expect(app.getByTestId('probe-channel')).toContainText('Blue channel')
  await panel(page, 'context-inspector').getByRole('button', { name: 'Broadcast new order' }).click()
  await expect(app.getByTestId('probe-received')).toContainText('harbor.fxOrder')
})

test('phase 3: dragging a library card onto the layout places the panel there', async ({ page }) => {
  await signIn(page, 'Trader', 5)
  await page.getByRole('button', { name: 'All apps' }).click()
  const card = page.getByTestId('library').locator('[data-app="research"]')
  await card.dragTo(panel(page, 'pretrade'), { targetPosition: { x: 300, y: 150 } })
  await expect(tab(page, 'research')).toHaveCount(1)
  // Dropped in the middle of Pre-Trade's group, so it joins that group as a tab.
  await expect(page.locator('.dv-groupview').filter({ has: tab(page, 'pretrade') }).locator('.hs-tab')).toHaveCount(2)
})
