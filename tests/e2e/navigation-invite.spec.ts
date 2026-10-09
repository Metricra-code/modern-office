import { expect, test } from '@playwright/test';

test('mobile drawer contains focus and preserves native dialog keyboard behavior', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mode=demo');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const navigation = page.locator('#workspace-nav');
  const first = navigation.getByRole('link', { name: 'Modern Office home', exact: true });
  const last = navigation.getByRole('button', { name: /^Kai Available/ });
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await expect(page.locator('.workspace-main')).toHaveAttribute('inert', '');

  await navigation.getByRole('button', { name: /^Help & shortcuts/ }).click();
  await expect(page.getByRole('dialog', { name: 'How to use the office' })).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]')))).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.mobile-menu')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await expect(page.locator('.workspace-main')).not.toHaveAttribute('inert', '');
});

test('resizing an open mobile drawer to desktop removes background inert', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mode=demo');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.mobile-menu')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.workspace-main')).not.toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: 'Invite people', exact: true })).toBeEnabled();
});

test('opening a second guest from demo joins both pages to the same live workspace', async ({
  page,
}) => {
  await page.goto('/?mode=demo');
  await page.getByRole('button', { name: 'Invite people', exact: true }).click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open a second guest' }).click();
  const second = await popup;
  try {
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
    await expect(second.getByText('Live workspace', { exact: true })).toBeVisible();
    expect(new URL(second.url()).searchParams.get('workspace')).toBe(
      new URL(page.url()).searchParams.get('workspace'),
    );
    await expect(page.locator('.map-person')).toHaveCount(2);
    await expect(second.locator('.map-person')).toHaveCount(2);
    await second.getByLabel('Message general').fill('Both guests are connected.');
    await second.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('log')).toContainText('Both guests are connected.');
  } finally {
    await second.close();
  }
});

test('a departed guest profile disables calling before any media capture', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const tracked = window as Window & { mediaCaptureCount?: number };
    tracked.mediaCaptureCount = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      tracked.mediaCaptureCount = (tracked.mediaCaptureCount ?? 0) + 1;
      throw new DOMException('Media capture should not start', 'NotAllowedError');
    };
  });
  const second = await context.newPage();
  const workspace = `departed-profile-${Date.now()}`;
  try {
    for (const [guest, name] of [
      [page, 'Alice'],
      [second, 'Bob'],
    ] as const) {
      await guest.goto(`/?workspace=${workspace}&mode=live`);
      await expect(guest.getByText('Live workspace', { exact: true })).toBeVisible();
      await guest.getByRole('button', { name: 'Edit your profile' }).click();
      await guest.getByLabel('Your name', { exact: true }).fill(name);
      await guest.getByRole('button', { name: 'Save profile' }).click();
    }
    await page.getByRole('button', { name: 'Bob in studio' }).click();
    await second.close();
    await expect(page.locator('.map-person[aria-label="Bob in studio"]')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toContainText('This guest has left the workspace.');
    await expect(page.getByRole('button', { name: 'Start a video call' })).toBeDisabled();
    expect(
      await page.evaluate(
        () => (window as Window & { mediaCaptureCount?: number }).mediaCaptureCount,
      ),
    ).toBe(0);
  } finally {
    await second.close();
  }
});
