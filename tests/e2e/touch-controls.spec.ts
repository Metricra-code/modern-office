import { expect, test, type Locator } from '@playwright/test';

test.use({ hasTouch: true });

for (const width of [320, 390]) {
  test(`critical controls respond to edge touches without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?mode=demo');
    await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.floorplan').evaluate((image) => (image as HTMLImageElement).decode());

    const tapRightEdge = async (button: Locator) => {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport({ ratio: 1 });
      const bounds = (await button.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await page.touchscreen.tap(bounds.x + bounds.width - 3, bounds.y + bounds.height / 2);
    };

    await test.step('navigation opens and closes from the touch target edges', async () => {
      const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
      await tapRightEdge(menu);
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await tapRightEdge(page.getByRole('button', { name: 'Close navigation', exact: true }));
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    });

    await test.step('zoom targets fit, do not overlap, and never move the avatar', async () => {
      const footer = page.locator('.map-bottom');
      const controls = page.locator('.zoom-controls');
      await footer.scrollIntoViewIfNeeded();
      await expect(controls).toBeInViewport({ ratio: 1 });
      const buttons = controls.getByRole('button');
      await expect(buttons).toHaveCount(3);
      const bounds = await buttons.evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      for (const button of bounds) {
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
      }
      for (let first = 0; first < bounds.length; first++) {
        for (let second = first + 1; second < bounds.length; second++) {
          const a = bounds[first];
          const b = bounds[second];
          expect(
            a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y,
          ).toBe(true);
        }
      }
      expect(await footer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );

      const self = page.locator('.map-person.is-self');
      const position = (await self.getAttribute('style'))!;
      const percentage = controls.locator('span:not(.control-divider)');
      const zoomIn = controls.getByRole('button', { name: 'Zoom in', exact: true });
      const zoomOut = controls.getByRole('button', { name: 'Zoom out', exact: true });
      await tapRightEdge(zoomIn);
      await expect(percentage).toHaveText('110%');
      await expect(self).toHaveAttribute('style', position);
      await tapRightEdge(zoomOut);
      await expect(percentage).toHaveText('100%');
      await expect(self).toHaveAttribute('style', position);
      await tapRightEdge(zoomOut);
      await expect(percentage).toHaveText('90%');
      await expect(self).toHaveAttribute('style', position);
      await tapRightEdge(controls.getByRole('button', { name: 'Reset map zoom', exact: true }));
      await expect(percentage).toHaveText('100%');
      await expect(self).toHaveAttribute('style', position);
    });

    await test.step('a send target edge delivers exactly one message', async () => {
      await page
        .locator('.mobile-workspace-tabs')
        .getByRole('button', { name: /^Conversations/ })
        .tap();
      const text = `Touch message at ${width}px.`;
      await page.getByLabel('Message general', { exact: true }).fill(text);
      await tapRightEdge(page.getByRole('button', { name: 'Send message', exact: true }));
      await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
    });

    await test.step('the dialog close target edge dismisses the dialog', async () => {
      await page.getByRole('button', { name: 'Invite people', exact: true }).tap();
      const dialog = page.getByRole('dialog', { name: 'Invite people', exact: true });
      await expect(dialog).toBeVisible();
      await tapRightEdge(dialog.getByRole('button', { name: 'Close dialog', exact: true }));
      await expect(dialog).not.toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    });
  });
}
