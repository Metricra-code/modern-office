import { expect, test } from '@playwright/test';

test('the prerendered office cannot activate stale links before URL context initializes', async ({
  page,
}) => {
  // Hold application scripts at the network boundary; leave HTML and CSS available to render.
  const scripts = Promise.withResolvers<void>();
  let heldScripts = 0;
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') {
      heldScripts += 1;
      await scripts.promise;
    }
    await route.continue();
  });
  const workspace = `startup-context-${Date.now()}`;
  try {
    await page.goto(`/?workspace=${workspace}&mode=demo`, { waitUntil: 'commit' });
    const shell = page.locator('.app-shell');
    await expect(shell).toBeAttached();
    await expect.poll(() => heldScripts).toBeGreaterThan(0);
    await expect(shell).toHaveAttribute('inert', '');
    await expect(shell).toHaveAttribute('aria-busy', 'true');
    const notes = page.locator('.app-footer a');
    await notes.scrollIntoViewIfNeeded();
    await notes.evaluate((link) => {
      link.addEventListener('click', () => link.setAttribute('data-startup-activated', 'true'));
    });
    const bounds = await notes.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await expect(notes).not.toHaveAttribute('data-startup-activated', 'true');
    // This preview intentionally cannot finish loading until the script gate is released.
    expect(page.url()).toBe(new URL(`/?workspace=${workspace}&mode=demo`, page.url()).href);

    scripts.resolve();
    await expect(shell).not.toHaveAttribute('inert', '');
    await expect(shell).toHaveAttribute('aria-busy', 'false');
    await expect(notes).toHaveAttribute('href', `/case-study/?workspace=${workspace}&mode=demo`);
    await notes.click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/case-study/' &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === 'demo',
    );
    await page.getByRole('link', { name: 'Back to the office' }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/' &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === 'demo',
    );
    await expect(page.getByRole('heading', { name: 'Office', exact: true })).toBeVisible();
    await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
  } finally {
    scripts.resolve();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
