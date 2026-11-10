import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Frame, type Page } from '@playwright/test'

/* Phase 9: accessibility, performance, resilience and leak checks (SPEC section 14). */

async function signIn(page: Page, role: string, panels: number) {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(`^${role}`) }).click()
  await expect(page.locator('.hs-tab')).toHaveCount(panels)
}
const panel = (page: Page, appId: string) => page.locator(`.hs-panel[data-app="${appId}"]`)
const frame = (page: Page, appId: string) => page.frameLocator(`[data-testid="frame-${appId}"]`)
const tab = (page: Page, appId: string) => page.locator(`.hs-tab[data-app="${appId}"]`)
async function menu(page: Page, trigger: string | RegExp, item: string | RegExp) {
  await page.getByRole('button', { name: trigger }).click()
  await page.getByRole('menu').locator('[role^="menuitem"]').filter({ hasText: item }).first().click()
}

/** WCAG 2.1 A and AA rules, across the shell and every app iframe. Returns readable violation lines. */
async function scan(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`))
}

test('accessibility: no WCAG 2.1 A/AA violations in the shell, its overlays or any app, in both themes', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  expect(await scan(page), 'sign-in').toEqual([])

  await signIn(page, 'Trader', 6)
  await expect(frame(page, 'tca').getByTestId('slippage-count')).toBeVisible()
  await expect(page.getByTestId('tile-rates').locator('.hb-price').first()).toBeVisible()
  expect(await scan(page), 'trader workspace, dark').toEqual([])

  // Mid-flow: an estimate in Pre-Trade and live quotes in FX Execution.
  await panel(page, 'order-blotter').locator('.ag-row').first().locator('[col-id="pair"]').click()
  await frame(page, 'pretrade').getByRole('button', { name: 'Execute via RFQ' }).click()
  await expect(frame(page, 'fx-exec').locator('tr[data-best="true"]')).toHaveCount(1)
  await tab(page, 'post-trade').click()
  await expect(frame(page, 'post-trade').getByTestId('exception-queue')).toBeVisible()
  expect(await scan(page), 'trader workspace, mid-flow').toEqual([])

  await menu(page, /profile menu$/, 'Light theme')
  await expect(frame(page, 'pretrade').locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await scan(page), 'trader workspace, light').toEqual([])

  // Overlays.
  await page.getByRole('button', { name: 'All apps' }).click()
  expect(await scan(page), 'widget library').toEqual([])
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill('news')
  expect(await scan(page), 'command palette').toEqual([])
  await page.keyboard.press('Escape')
  await page.keyboard.press('?')
  await expect(page.getByTestId('shortcuts')).toBeVisible()
  expect(await scan(page), 'shortcut map').toEqual([])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Interop log' }).click()
  await page.getByRole('button', { name: 'Force a mismatch' }).click()
  await expect(page.locator('.hb-toast--critical')).toHaveCount(1)
  await page.getByTestId('alert-bell').click()
  expect(await scan(page), 'alert drawer and toast').toEqual([])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Interop log' }).click()
  expect(await scan(page), 'interop log').toEqual([])
})

test('accessibility: Treasury apps, Research, Partner News and the component gallery pass the same scan', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page, 'Treasury', 3)
  const cash = frame(page, 'cash')
  await cash.getByTestId('cash-funds').locator('tbody tr').first().getByRole('checkbox').check()
  await cash.getByTestId('cash-funds').locator('tbody tr').first().getByRole('button', { name: 'Deal' }).click()
  await cash.getByRole('textbox', { name: /^Amount/ }).fill('5b')
  await expect(cash.getByTestId('cash-breach')).toBeVisible()
  await frame(page, 'payments').getByTestId('beneficiaries').locator('tbody tr').first().getByRole('button', { name: 'Pay' }).click()
  expect(await scan(page), 'treasury workspace').toEqual([])

  await menu(page, /profile menu$/, 'Switch to Admin')
  await expect(page.getByTestId('user-role')).toHaveText('Admin')
  // Wait for the Admin workspace itself: the palette can open before the layout has been restored.
  await expect(page.locator('.hs-tab')).toHaveCount(3)
  for (const query of ['open research', 'open partner news', 'open component gallery']) {
    await page.keyboard.press('Control+k')
    await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill(query)
    await page.keyboard.press('Enter')
  }
  await expect(frame(page, 'research').getByTestId('research-note')).toBeVisible()
  await expect(frame(page, 'partner-news').getByTestId('partner-headlines')).toBeVisible()
  await expect(page.getByTestId('ui-gallery')).toBeVisible()
  expect(await scan(page), 'admin bench, research, partner news, gallery').toEqual([])
})

/** Every visible control must be at least 24 by 24 CSS pixels. */
async function smallTargets(scope: Page | Frame): Promise<string[]> {
  return scope.evaluate(() => {
    const out: string[] = []
    const controls = document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [role="tab"], [role="menuitem"], [role="option"], [role="switch"]')
    for (const el of controls) {
      // Third-party internals (grid cells, layout sashes, resize handles) are not Harbor controls.
      if (el.closest('.ag-root-wrapper, .react-resizable-handle, .dv-sash, .u-wrap') || el.closest('[aria-hidden="true"]')) continue
      // A checkbox or radio is hit through its label; measure that.
      const target = (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? el.closest('label') : null) ?? el
      const box = target.getBoundingClientRect()
      const style = getComputedStyle(target)
      if (box.width === 0 || box.height === 0 || style.visibility === 'hidden' || target.classList.contains('hb-sr-only')) continue
      if (box.width < 23.5 || box.height < 23.5) out.push(`${target.tagName.toLowerCase()}.${target.className || '-'} "${(target.getAttribute('aria-label') ?? target.textContent ?? '').trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`)
    }
    return [...new Set(out)]
  })
}

test('accessibility: every control is at least 24px in both densities, in the shell and in every app', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await panel(page, 'order-blotter').locator('.ag-row').first().locator('[col-id="pair"]').click()
  await frame(page, 'pretrade').getByRole('button', { name: 'Execute via RFQ' }).click()
  await expect(frame(page, 'fx-exec').locator('tr[data-best="true"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'All apps' }).click()
  const check = async (label: string) => {
    expect(await smallTargets(page), `${label}: shell`).toEqual([])
    for (const child of page.frames().filter((f) => f !== page.mainFrame() && f.url().startsWith('http://localhost'))) {
      expect(await smallTargets(child), `${label}: ${new URL(child.url()).port}`).toEqual([])
    }
  }
  await check('compact')
  await page.keyboard.press('Escape')
  await menu(page, /profile menu$/, 'Comfortable density')
  await check('comfortable')

  await menu(page, /profile menu$/, 'Switch to Treasury')
  await expect(page.locator('.hs-tab')).toHaveCount(3)
  await frame(page, 'cash').getByTestId('cash-funds').locator('tbody tr').first().getByRole('button', { name: 'Deal' }).click()
  await frame(page, 'payments').getByTestId('beneficiaries').locator('tbody tr').first().getByRole('button', { name: 'Pay' }).click()
  await check('treasury')
})

test('accessibility: the shortcut map opens with ? from the shell and from inside an app; F6 and Ctrl-Alt-arrows move focus', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await page.locator('.hs-mark').click()
  await page.keyboard.press('?')
  const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(shortcuts.getByTestId('shortcuts').locator('tr')).not.toHaveCount(0)
  await expect(shortcuts).toContainText('command palette')
  await page.keyboard.press('Escape')
  await expect(shortcuts).toHaveCount(0)

  // From inside an iframe app: the key press is forwarded to the shell.
  await frame(page, 'pretrade').getByText('Select an order to see an estimate.').click()
  await page.keyboard.press('?')
  await expect(shortcuts).toBeVisible()
  await page.keyboard.press('Escape')
  // Typing a question mark into a field is just typing.
  await panel(page, 'order-blotter').getByRole('combobox', { name: 'Pair' }).focus()
  await page.keyboard.press('?')
  await expect(shortcuts).toHaveCount(0)

  // F6 walks the shell's regions.
  const region = () => page.evaluate(() => document.activeElement?.closest('[data-region]')?.getAttribute('data-region') ?? null)
  await page.locator('.hs-mark').click()
  const seen: (string | null)[] = []
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('F6')
    seen.push(await region())
  }
  expect(new Set(seen)).toEqual(new Set(['topbar', 'rail', 'layout', 'statusbar']))

  // Ctrl-Alt-arrows move between panels.
  const active = () => page.locator('.dv-groupview.dv-active-group .dv-active-tab .hs-tab').getAttribute('data-app')
  const first = await active()
  await page.keyboard.press('Control+Alt+ArrowRight')
  await expect.poll(active).not.toBe(first)
  await page.keyboard.press('Control+Alt+ArrowLeft')
  await expect.poll(active).toBe(first)
})

test('performance: a background tab is not loaded until it is first shown', async ({ page }) => {
  await signIn(page, 'Admin', 3)
  // Tab Probe B in with another panel, so one of the two is hidden.
  await menu(page, 'Interop Probe B menu', 'Move to next group')
  await expect(page.locator('.dv-groupview')).toHaveCount(2)
  await expect(page.getByTestId('save-status')).toHaveText('All changes saved')
  await page.reload()
  await expect(page.locator('.hs-tab')).toHaveCount(3)
  // One of the two tabbed panels is behind the other. Nothing of it exists yet: no panel body, no iframe.
  const hiddenApp = (await page.locator('.dv-tab:not(.dv-active-tab) .hs-tab').first().getAttribute('data-app')) ?? ''
  expect(hiddenApp).not.toBe('')
  await expect(panel(page, hiddenApp)).toHaveCount(0)
  await expect(page.locator(`[data-testid="frame-${hiddenApp}"]`)).toHaveCount(0)
  await tab(page, hiddenApp).click()
  await expect(panel(page, hiddenApp)).toHaveAttribute('data-visible', 'true')
  if (hiddenApp.startsWith('probe')) await expect(frame(page, hiddenApp).getByTestId('probe-channel')).toContainText('Blue channel')
  else await expect(panel(page, hiddenApp).getByText('handles no intents')).toBeVisible()
  // Apps that must keep up while hidden (Post-Trade, TCA) are loaded regardless.
  await menu(page, /profile menu$/, 'Switch to Trader')
  await expect(page.locator('.hs-tab')).toHaveCount(6)
  await expect(page.locator('.hs-panel[data-app="post-trade"]')).toHaveAttribute('data-visible', 'false')
  await expect(page.locator('[data-testid="frame-post-trade"]')).toHaveCount(1)
})

test('performance: the shell is interactive in under 2s on a warm cache', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await expect(frame(page, 'tca').getByTestId('slippage-count')).toBeVisible()
  const times: number[] = []
  for (let i = 0; i < 3; i++) {
    const start = Date.now()
    await page.reload()
    // Interactive = the chrome is up, the workspace is restored and a shell control responds.
    await expect(page.locator('.hs-tab')).toHaveCount(6)
    await page.getByTestId('alert-bell').click()
    await expect(page.getByRole('dialog', { name: 'Alerts' })).toBeVisible()
    times.push(Date.now() - start)
  }
  console.log(`shell interactive (dev server, 3 warm reloads): ${times.join('ms, ')}ms`)
  expect(Math.min(...times)).toBeLessThan(2000)
})

test('performance: twelve panels with live prices hold 55+ frames per second', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  // Six more panels, each with a live price table.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Control+k')
    await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill('open mock data')
    await page.keyboard.press('Enter')
  }
  await expect(page.locator('.hs-tab')).toHaveCount(12)
  await expect(page.locator('[data-testid="mock-prices"]')).toHaveCount(6)
  await page.waitForTimeout(1500)
  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0
        const start = performance.now()
        const step = (now: number) => {
          frames++
          if (now - start < 4000) requestAnimationFrame(step)
          else resolve((frames * 1000) / (now - start))
        }
        requestAnimationFrame(step)
      }),
  )
  console.log(`12 panels with live prices: ${fps.toFixed(1)} fps`)
  expect(fps).toBeGreaterThanOrEqual(55)
})

test('resilience: opening and closing panels leaves nothing behind', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await expect(frame(page, 'tca').getByTestId('slippage-count')).toBeVisible()
  const snapshot = () =>
    page.evaluate(() => ({
      agent: (window as unknown as { __harbor: { stats: () => Record<string, number> } }).__harbor.stats(),
      frames: document.querySelectorAll('iframe').length,
      nodes: document.querySelectorAll('*').length,
    }))
  await page.waitForTimeout(500)
  const before = await snapshot()

  for (let i = 0; i < 5; i++) {
    for (const [query, app] of [['open research', 'research'], ['open mock data', 'mock-data'], ['open context inspector', 'context-inspector']] as const) {
      await page.keyboard.press('Control+k')
      await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill(query)
      await page.keyboard.press('Enter')
      await expect(tab(page, app)).toHaveCount(1)
    }
    await expect(frame(page, 'research').getByTestId('research-count')).toBeVisible()
    await expect(panel(page, 'context-inspector').getByText('handles no intents')).toBeVisible()
    for (const title of ['Research', 'Mock Data', 'Context Inspector']) await menu(page, `${title} menu`, 'Close')
    await expect(page.locator('.hs-tab')).toHaveCount(6)
  }
  await page.waitForTimeout(500)
  const after = await snapshot()
  expect(after.agent).toEqual(before.agent)
  expect(after.frames).toBe(before.frames)
  // The DOM is back to where it started, give or take a few nodes of toast and grid churn.
  expect(Math.abs(after.nodes - before.nodes)).toBeLessThan(before.nodes * 0.03)
})

test('resilience: a workspace whose layout cannot be restored falls back to the role default and is kept for export', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  const broken = {
    schemaVersion: 1,
    id: 'broken',
    name: 'Broken layout',
    ownerId: 'someone',
    updatedAt: new Date().toISOString(),
    // Passes the schema (the layout is opaque to it) but is not something the layout engine can load.
    layout: { grid: { root: { type: 'branch', data: 'nonsense' }, width: 100, height: 100, orientation: 'SIDEWAYS' }, panels: 7 },
    panels: [{ panelId: 'x', kind: 'app', appId: 'pretrade', channelId: null, config: {} }],
  }
  await page.getByTestId('import-input').setInputFiles({ name: 'broken.harbor.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) })
  await expect(page.getByTestId('import-preview')).toContainText('Broken layout')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('.hb-toast--critical').filter({ hasText: '"Broken layout" could not be restored' })).toBeVisible()
  // The shell is still alive on the role default.
  await expect(page.getByTestId('workspace-name')).toHaveText('FX Trading')
  await expect(page.locator('.hs-tab')).toHaveCount(6)
  await expect(frame(page, 'pretrade').getByText('Select an order to see an estimate.')).toBeVisible()
  // The damaged file was kept, not lost.
  await page.getByRole('button', { name: 'Interop log' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export 1 damaged workspace/ }).click()])
  expect(download.suggestedFilename()).toBe('harbor-quarantined-workspaces.json')
})

test('resilience: an app crashing or being closed mid-conversation does not disturb the agent or other panels', async ({ page }) => {
  await signIn(page, 'Admin', 3)
  const inspector = panel(page, 'context-inspector')
  const probeB = frame(page, 'probe-b')
  // Kill Probe A's document outright (as a crash would) while it holds listeners.
  await page.locator('[data-testid="frame-probe-a"]').evaluate((el: HTMLIFrameElement) => (el.src = 'about:blank'))
  await inspector.getByRole('button', { name: 'Broadcast new order' }).click()
  await expect(probeB.getByTestId('probe-received')).toContainText('harbor.fxOrder')
  // Reload brings the crashed panel back and it rejoins the channel, replaying the latest order.
  await menu(page, 'Interop Probe A menu', 'Reload')
  await expect(frame(page, 'probe-a').getByTestId('probe-received')).toContainText('harbor.fxOrder')
})

test('auditability: shell actions are recorded with who, when, before and after, and can be exported', async ({ page }) => {
  await signIn(page, 'Trader', 6)
  await menu(page, /^Channel for Pre-Trade/, 'Green')
  await menu(page, /profile menu$/, 'Comfortable density')
  await expect(page.getByTestId('save-status')).toHaveText('All changes saved')
  await page.getByRole('button', { name: 'Interop log' }).click()
  await page.getByRole('switch', { name: /Simulate disconnect/ }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export audit trail' }).click()])
  const entries = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8')) as { seq: number; at: string; userId: string; action: string; target: string; before: unknown; after: unknown }[]
  expect(entries.map((e) => e.seq)).toEqual(entries.map((_, i) => i + 1))
  expect(entries.every((e) => e.userId === 'u-trader' && !Number.isNaN(Date.parse(e.at)))).toBe(true)
  expect(entries.find((e) => e.action === 'session.start')).toMatchObject({ after: { role: 'Trader' } })
  expect(entries.find((e) => e.action === 'panel.channel')).toMatchObject({ before: { channelId: 'fdc3.channel.6' }, after: { channelId: 'fdc3.channel.4' } })
  expect(entries.find((e) => e.action === 'preference.density')).toMatchObject({ before: 'compact', after: 'comfortable' })
  expect(entries.find((e) => e.action === 'workspace.fork')).toBeDefined()
  expect(entries.find((e) => e.action === 'connection.simulate')).toMatchObject({ before: { connected: true }, after: { connected: false } })
})
