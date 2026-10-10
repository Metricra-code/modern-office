import { expect, test } from '@playwright/test';

test('two self-hosted variable fonts render the original body and heading typefaces', async ({
  page,
}) => {
  await page.goto('/?mode=demo');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      faces: Array.from(document.fonts)
        .filter((font) => font.family === 'Manrope' || font.family === 'Urbanist')
        .map((font) => ({
          family: font.family,
          weight: font.weight,
          status: font.status,
          display: font.display,
        })),
      resources: performance
        .getEntriesByType('resource')
        .filter((entry) => new URL(entry.name).pathname.endsWith('.woff2'))
        .map((entry) => ({ url: entry.name, origin: new URL(entry.name).origin })),
      origin: location.origin,
    };
  });
  expect(loaded.faces).toEqual(
    expect.arrayContaining([
      { family: 'Manrope', weight: '200 800', status: 'loaded', display: 'swap' },
      { family: 'Urbanist', weight: '100 900', status: 'loaded', display: 'swap' },
    ]),
  );
  expect(loaded.faces).toHaveLength(2);
  expect(loaded.resources).toHaveLength(2);
  expect(loaded.resources.every((resource) => resource.origin === loaded.origin)).toBe(true);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  for (const [selector, family] of [
    ['.welcome h1', /^Urbanist$/],
    // CDP reports a platform family name, which may include the default 200-weight label.
    ['.welcome p', /^Manrope(?: ExtraLight)?$/],
  ] as const) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    expect(fonts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ familyName: expect.stringMatching(family), isCustomFont: true }),
      ]),
    );
    expect(
      fonts.find((font: { familyName: string }) => family.test(font.familyName))?.glyphCount,
    ).toBeGreaterThan(0);
  }
  await cdp.detach();
});
