import { expect, test } from '@playwright/test';

test(
  'hosted entry joins live without signup and a second guest shares the workspace',
  { tag: '@browser-smoke' },
  async ({ page, context }, testInfo) => {
    test.skip(
      !process.env.PLAYWRIGHT_BASE_URL && !testInfo.config.metadata.publicBuild,
      'Run against the built Cloudflare runtime or public URL.',
    );
    await page.goto('/');
    await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
    const workspace = new URL(page.url()).searchParams.get('workspace');
    expect(workspace).toMatch(/^office-[a-f0-9]{8}$/);
    await expect(page.locator('.map-person')).toHaveCount(1);
    await page.getByRole('button', { name: 'Invite people', exact: true }).click();
    const secondGuest = context.waitForEvent('page');
    await page.getByRole('link', { name: 'Open a second guest' }).click();
    const second = await secondGuest;
    try {
      await expect(second.getByText('Live workspace', { exact: true })).toBeVisible();
      expect(new URL(second.url()).searchParams.get('workspace')).toBe(workspace);
      await expect(second.locator('.map-person')).toHaveCount(2);
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await expect(page.locator('.map-person')).toHaveCount(2);
      await second.bringToFront();
      await second.getByLabel('Message general').fill('Hello from the second guest.');
      await second.getByRole('button', { name: 'Send message' }).click();
      await expect(page.getByRole('log')).toContainText('Hello from the second guest.');
      await page.locator('.floorplan').evaluate((image) => (image as HTMLImageElement).decode());
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: test.info().outputPath('workspace-live.png'), fullPage: true });
      await page.reload();
      await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('workspace')).toBe(workspace);
    } finally {
      await second.close();
    }
  },
);
