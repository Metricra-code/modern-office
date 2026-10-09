import { expect, test } from '@playwright/test';

test('engineering notes return to the same live workspace after reload', async ({
  page,
  context,
}) => {
  const workspace = `notes-live-${Date.now()}`;
  const teammate = await context.newPage();
  try {
    for (const guest of [page, teammate]) {
      await guest.goto(`/?workspace=${workspace}&mode=live`);
      await expect(guest.getByText('Live workspace', { exact: true })).toBeVisible();
    }
    await teammate.getByRole('button', { name: 'Edit your profile' }).click();
    await teammate.getByLabel('Your name', { exact: true }).fill('Case Guest');
    await teammate.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('button', { name: 'Case Guest in studio' })).toBeVisible();

    await page.locator('#workspace-nav').getByRole('link', { name: 'Engineering notes' }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/case-study/' &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === 'live',
    );
    await page.getByRole('link', { name: 'Back to the office' }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/' &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === 'live',
    );
    await expect(page.getByRole('heading', { name: 'Office', exact: true })).toBeVisible();
    await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Case Guest in studio' })).toBeVisible();
    await teammate.getByLabel('Message general').fill('Welcome back to our workspace.');
    await teammate.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('log')).toContainText('Welcome back to our workspace.');
  } finally {
    await teammate.close();
  }
});

for (const entry of ['footer', 'help'] as const) {
  test(`${entry} engineering notes preserve demo routing context`, async ({ page }) => {
    const workspace = `notes-demo-${entry}`;
    await page.goto(`/?workspace=${workspace}&mode=demo`);
    await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
    if (entry === 'help') {
      await page.getByRole('button', { name: /^Help & shortcuts/ }).click();
      await page.getByRole('link', { name: 'Read the engineering notes' }).click();
    } else {
      await page.locator('.app-footer').getByRole('link', { name: 'Engineering notes' }).click();
    }
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/case-study/' &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === 'demo',
    );
    await page.getByRole('link', { name: 'Explore the office' }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/' &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === 'demo',
    );
    await expect(page.getByRole('heading', { name: 'Office', exact: true })).toBeVisible();
    await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
    await expect(page.locator('.map-person')).toHaveCount(6);
  });
}

test('a direct notes page ignores unsafe or malformed return context', async ({ page }) => {
  await page.goto(
    '/case-study/?workspace=https%3A%2F%2Fexample.com&mode=live&returnTo=https%3A%2F%2Fexample.com',
  );
  await expect(page.getByRole('link', { name: 'Back to the office' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'Explore the office' })).toHaveAttribute('href', '/');
});
