import { expect, test } from '@playwright/test';
import { getRoom, isWalkable, WORLD } from '../../src/lib/space';

test.use({ hasTouch: true });

for (const width of [320, 1440]) {
  test(
    `a long map name does not intercept nearby floor movement at ${width}px`,
    { tag: '@browser-smoke' },
    async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 844 : 1000 });
      await page.goto('/?mode=demo');
      await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
      await page.getByRole('button', { name: 'Edit your profile', exact: true }).click();
      const longName = 'W'.repeat(24);
      await page.getByLabel('Your name', { exact: true }).fill(longName);
      await page.getByRole('button', { name: 'Save profile', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Edit profile' })).not.toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.floorplan').evaluate((image) => (image as HTMLImageElement).decode());

      const self = page.locator('.map-person.is-self');
      await expect(self).toHaveAccessibleName(`${longName}, you in studio`);
      await expect(self.getByText('you', { exact: true })).toBeVisible();
      const focus = page.getByRole('button', { name: 'Focus mode', exact: true });
      await focus.click();
      await expect(focus).toHaveAttribute('aria-pressed', 'true');
      await expect(self.locator('[aria-label="focusing"]')).toBeVisible();

      const map = page.getByRole('group', { name: /Interactive office/ });
      await map.scrollIntoViewIfNeeded();
      await expect(map).toBeInViewport({ ratio: 1 });
      await expect(self.getByText('you', { exact: true })).toBeInViewport({ ratio: 1 });
      await expect(self.locator('[aria-label="focusing"]')).toBeInViewport({ ratio: 1 });
      const world = (await page.locator('.map-world').boundingBox())!;
      const body = self.locator('.person-body');
      const visibleAvatar = (await body.boundingBox())!;
      const label = (await self.locator('.person-name').boundingBox())!;
      const floor = {
        x: Math.round(visibleAvatar.x + visibleAvatar.width / 2 + 64),
        y: Math.round(visibleAvatar.y + visibleAvatar.height - 4),
      };
      const destination = {
        x: ((floor.x - world.x) / world.width) * WORLD.width,
        y: ((floor.y - world.y) / world.height) * WORLD.height,
      };
      expect(floor.x - (visibleAvatar.x + visibleAvatar.width)).toBeGreaterThan(40);
      expect(floor.y).toBeLessThan(label.y);
      expect(floor.x).toBeGreaterThan(world.x);
      expect(floor.x).toBeLessThan(world.x + world.width);
      expect(isWalkable(destination)).toBe(true);

      if (width === 320) await page.touchscreen.tap(floor.x, floor.y);
      else await page.mouse.click(floor.x, floor.y);
      await expect(page.getByRole('dialog', { name: 'Edit profile' })).not.toBeVisible();
      await expect
        .poll(() => self.evaluate((element) => parseFloat((element as HTMLElement).style.left)))
        .toBeCloseTo((destination.x / WORLD.width) * 100, 2);
      await expect
        .poll(() => self.evaluate((element) => parseFloat((element as HTMLElement).style.top)))
        .toBeCloseTo((destination.y / WORLD.height) * 100, 2);
      await expect(self).toHaveAccessibleName(`${longName}, you in ${getRoom(destination)}`);

      await body.scrollIntoViewIfNeeded();
      const movedAvatar = (await body.boundingBox())!;
      const center = {
        x: movedAvatar.x + movedAvatar.width / 2,
        y: movedAvatar.y + movedAvatar.height / 2,
      };
      if (width === 320) await page.touchscreen.tap(center.x, center.y);
      else await page.mouse.click(center.x, center.y);
      const profile = page.getByRole('dialog', { name: 'Edit profile' });
      await expect(profile).toBeVisible();
      await expect(profile.getByLabel('Your name', { exact: true })).toHaveValue(longName);
      await page.keyboard.press('Escape');
      await expect(profile).not.toBeVisible();
      await expect(self.getByText('you', { exact: true })).toBeVisible();
      await expect(self.locator('[aria-label="focusing"]')).toBeVisible();
      await expect(self.getByText('you', { exact: true })).toBeInViewport({ ratio: 1 });
      await expect(self.locator('[aria-label="focusing"]')).toBeInViewport({ ratio: 1 });
      await expect(focus).toHaveAttribute('aria-pressed', 'true');
    },
  );
}
