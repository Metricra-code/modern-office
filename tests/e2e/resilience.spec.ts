import { expect, test } from '@playwright/test';

test('guests using the same room shortcut remain individually clickable', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const alice = await first.newPage();
  const bob = await second.newPage();
  const workspace = `room-arrival-${Date.now()}`;
  try {
    for (const [page, name] of [
      [alice, 'Alice'],
      [bob, 'Bob'],
    ] as const) {
      await page.goto(`/?workspace=${workspace}&mode=live`);
      await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Edit your profile' }).click();
      await page.getByLabel('Your name', { exact: true }).fill(name);
      await page.getByRole('button', { name: 'Save profile' }).click();
    }
    await alice.getByRole('button', { name: 'Go to Lounge', exact: true }).click();
    await expect(bob.getByRole('button', { name: 'Alice in lounge' })).toBeVisible();
    await bob.getByRole('button', { name: 'Go to Lounge', exact: true }).click();
    await alice.getByRole('button', { name: 'Bob in lounge' }).click({ timeout: 1500 });
    await expect(alice.getByRole('dialog')).toHaveAccessibleName('Bob');
    await alice.getByRole('button', { name: 'Close dialog' }).click();
    await bob.getByRole('button', { name: 'Alice in lounge' }).click({ timeout: 1500 });
    await expect(bob.getByRole('dialog')).toHaveAccessibleName('Alice');
  } finally {
    await first.close();
    await second.close();
  }
});

test('camera denial is recoverable and never starts a microphone', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
    });
  });
  await page.goto('/?mode=demo');
  await page.getByRole('button', { name: 'Test camera' }).click();
  await expect(page.getByRole('dialog')).toContainText('Camera or microphone unavailable');
  await expect(page.getByRole('dialog')).toContainText('microphone is not captured or shared');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByLabel('Message general').fill('Still able to chat');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('Still able to chat');
});

test('responsive screenshots have no runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [label, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/?mode=demo');
    await expect(page.getByRole('heading', { name: 'Office', exact: true })).toBeVisible();
    await page.locator('.floorplan').evaluate((image) => (image as HTMLImageElement).decode());
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/assets/workspace-${label}.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
