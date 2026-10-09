import { expect, test } from '@playwright/test';

for (const width of [320, 390]) {
  test(`the complete office fits at ${width}px and zoomed edges remain reachable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?mode=demo');
    const viewport = page.getByRole('group', { name: /Interactive office/ });
    const world = page.locator('.map-world');
    await page.locator('.floorplan').evaluate((image) => (image as HTMLImageElement).decode());
    const frame = (await viewport.boundingBox())!;
    const floor = (await world.boundingBox())!;
    expect(floor.x).toBeGreaterThanOrEqual(frame.x);
    expect(floor.x + floor.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(await viewport.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
      frame.width + 1,
    );

    for (let step = 0; step < 3; step++) {
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    }
    expect((await world.boundingBox())!.width).toBeCloseTo(floor.width * 1.3, 0);
    await viewport.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const panned = (await world.boundingBox())!;
    expect(panned.x + panned.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    await page.mouse.click(
      panned.x + panned.width * (800 / 900),
      panned.y + panned.height * (450 / 570),
    );
    await expect(page.locator('.map-person.is-self')).toHaveAttribute('aria-label', /in lounge$/);

    await viewport.evaluate((element) => {
      element.scrollLeft = 0;
    });
    const start = (await world.boundingBox())!;
    expect(start.x).toBeCloseTo(floor.x, 0);
    await page.mouse.click(
      start.x + start.width * (80 / 900),
      start.y + start.height * (300 / 570),
    );
    await expect(page.locator('.map-person.is-self')).toHaveAttribute('aria-label', /in studio$/);
    await page.getByRole('button', { name: 'Reset map zoom', exact: true }).click();
    expect((await world.boundingBox())!.width).toBeCloseTo(floor.width, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}
