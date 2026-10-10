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

      // [DEBUG-webkit-floor] Temporary native hit-test probe; remove after diagnosis.
      const beforeTap = await page.evaluate((point) => {
        const tracked = window as Window & { floorTapEvents?: unknown[] };
        tracked.floorTapEvents = [];
        for (const type of ['touchstart', 'click']) {
          window.addEventListener(
            type,
            (event) => {
              const target = event.target instanceof Element ? event.target : null;
              const touch = event instanceof TouchEvent ? event.touches[0] : undefined;
              tracked.floorTapEvents?.push({
                type,
                target: target?.className,
                button: target?.closest('button')?.className,
                x: touch?.clientX ?? (event as MouseEvent).clientX,
                y: touch?.clientY ?? (event as MouseEvent).clientY,
                trusted: event.isTrusted,
              });
            },
            { once: true, capture: true },
          );
        }
        const hit = document.elementFromPoint(point.x, point.y);
        const person = document.querySelector('.map-person.is-self');
        return {
          point,
          hit: hit?.className,
          button: hit?.closest('button')?.className,
          person: person?.getBoundingClientRect().toJSON(),
          world: document.querySelector('.map-world')?.getBoundingClientRect().toJSON(),
          cursor: hit ? getComputedStyle(hit).cursor : null,
          scroll: { x: window.scrollX, y: window.scrollY },
        };
      }, floor);
      if (width === 320) await page.touchscreen.tap(floor.x, floor.y);
      else await page.mouse.click(floor.x, floor.y);
      console.log(
        '[DEBUG-webkit-floor]',
        JSON.stringify({
          beforeTap,
          afterTap: await page.evaluate(() => ({
            events: (window as Window & { floorTapEvents?: unknown[] }).floorTapEvents,
            scroll: { x: window.scrollX, y: window.scrollY },
          })),
        }),
      );
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
