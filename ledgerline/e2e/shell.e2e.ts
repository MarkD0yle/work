import { expect, test } from '@playwright/test';

test.describe('Milestone 0 shell', () => {
  test('signs in as the first seeded user and applies their default density', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Signed in as Ada' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  });

  test('the role switcher changes the user the API sees', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Signed in as Ada' })).toBeVisible();

    const meAsBen = page.waitForRequest(
      (r) => r.url().endsWith('/api/v1/me') && r.headers()['x-ll-user'] === 'u-ben',
    );
    await page.getByRole('button', { name: /Switch user/ }).click();
    await page.getByRole('menuitemradio', { name: /Ben/ }).click();
    await meAsBen;

    await expect(page.getByRole('heading', { name: 'Signed in as Ben' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
    // Disabled actions explain why (non-negotiable rule 8).
    const reverse = page.getByRole('row', { name: /transaction\.reverse/ });
    await expect(reverse).toContainText('not allowed');
    await expect(reverse).toContainText('needs full access on transactions');
  });

  test('the chosen user survives a reload', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: /Switch user/ }).click();
    await page.getByRole('menuitemradio', { name: /Cleo/ }).click();
    await expect(page.getByRole('heading', { name: 'Signed in as Cleo' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Signed in as Cleo' })).toBeVisible();
  });

  test('theme and density switch from the keyboard only', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /Signed in as/ })).toBeVisible();
    const prefs = page.getByRole('button', { name: 'Display preferences' });
    await prefs.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitemradio', { name: 'Dark' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await prefs.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitemradio', { name: 'Comfortable' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
    // Density reaches real layout through the token, not just the attribute.
    expect(await prefs.evaluate((el) => el.getBoundingClientRect().height)).toBe(40);
  });

  test('every domain not built yet is reachable and says it is a placeholder', async ({ page }) => {
    await page.goto('/profile');
    const rail = page.getByRole('navigation', { name: 'Domains' });
    for (const name of ['Portfolios', 'Securities', 'Market Data', 'Cash', 'Accounting', 'Admin']) {
      await rail.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      await expect(page.getByText('Not built yet')).toBeVisible();
    }
  });

  test('an API failure shows what happened and what to do, never a blank screen', async ({ page }) => {
    await page.route('**/api/v1/users', (route) => route.abort());
    await page.goto('/profile');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('The Ledgerline API did not respond.');
    await expect(alert).toContainText('LL-NET-0001');
    await page.unroute('**/api/v1/users');
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: /Signed in as/ })).toBeVisible();
  });
});
