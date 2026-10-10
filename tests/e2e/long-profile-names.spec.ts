import { expect, test, type Locator } from '@playwright/test';

const longName = 'W'.repeat(24);
const expectContained = async (content: Locator, container: Locator) => {
  const inner = (await content.boundingBox())!;
  const outer = (await container.boundingBox())!;
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 1);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - 1);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
};

for (const [width, height] of [
  [320, 480],
  [568, 320],
] as const) {
  test(`a full-length profile stays usable across live projections at ${width}x${height}`, async ({
    browser,
  }) => {
    const caller = await browser.newContext({
      viewport: { width, height },
      permissions: ['camera', 'microphone'],
    });
    const receiver = await browser.newContext({ viewport: { width, height } });
    const alice = await caller.newPage();
    const bob = await receiver.newPage();
    const workspace = `long-name-${width}-${Date.now()}`;
    try {
      for (const guest of [alice, bob]) {
        await guest.goto(`/?workspace=${workspace}&mode=live`);
        await expect(guest.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
        await expect(guest.getByText('Live workspace', { exact: true })).toBeVisible();
        await guest.evaluate(() => document.fonts.ready);
        await guest.locator('.floorplan').evaluate((image) => (image as HTMLImageElement).decode());
      }
      await alice.getByRole('button', { name: 'Edit your profile', exact: true }).click();
      await alice.getByLabel('Your name', { exact: true }).fill('Caller');
      await alice.getByRole('button', { name: 'Save profile', exact: true }).click();

      await test.step('the own profile draft and saved sidebar name stay contained', async () => {
        await bob.getByRole('button', { name: 'Edit your profile', exact: true }).click();
        const profile = bob.getByRole('dialog', { name: 'Edit profile', exact: true });
        await profile.getByLabel('Your name', { exact: true }).fill(longName);
        const preview = profile.locator('.profile-preview');
        await preview.scrollIntoViewIfNeeded();
        await expect(preview).toContainText(longName);
        await expectContained(preview, profile);
        await expectContained(preview.locator(':scope > span:nth-child(2)'), preview);
        expect(
          await profile.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        await profile.getByRole('button', { name: 'Save profile', exact: true }).click();
        await expect(profile).not.toBeVisible();
        await expect(
          bob.getByRole('button', { name: `${longName}, you in studio`, exact: true }),
        ).toBeVisible();
        await expect(
          alice.getByRole('button', { name: `${longName} in studio`, exact: true }),
        ).toBeVisible();

        await bob.getByRole('button', { name: 'Open navigation', exact: true }).click();
        const navigation = bob.locator('#workspace-nav');
        const ownProfile = navigation.locator('.profile-button');
        await ownProfile.scrollIntoViewIfNeeded();
        await expect(ownProfile.locator('strong')).toHaveText(longName);
        await expectContained(ownProfile, navigation);
        await expectContained(ownProfile.locator('strong'), ownProfile);
        expect(
          await navigation.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        await bob.keyboard.press('Escape');
      });

      await test.step('the peer heading and native Close are already reachable', async () => {
        await alice.getByRole('button', { name: `${longName} in studio`, exact: true }).click();
        const member = alice.getByRole('dialog', { name: longName, exact: true });
        const heading = member.getByRole('heading', { name: longName, exact: true });
        await expect(heading).toHaveText(longName);
        await expectContained(heading, member);
        expect(await member.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        const close = member.getByRole('button', { name: 'Close dialog', exact: true });
        await expectContained(close, member);
        await expect(close).toBeInViewport({ ratio: 1 });
        const bounds = (await close.boundingBox())!;
        await alice.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await expect(member).not.toBeVisible();
      });

      await test.step('the Team row and trailing control fit the directory', async () => {
        await alice.getByRole('button', { name: 'Open navigation', exact: true }).click();
        await alice.locator('#workspace-nav').getByRole('button', { name: /^Team/ }).click();
        const directory = alice.locator('.team-directory');
        const row = directory
          .locator('.team-member')
          .filter({ has: alice.getByText(longName, { exact: true }) });
        await row.scrollIntoViewIfNeeded();
        await expect(row.locator('strong')).toHaveText(longName);
        await expectContained(directory, alice.getByRole('region', { name: 'Team directory' }));
        await expectContained(row, directory);
        await expectContained(row.locator('strong'), row);
        await expectContained(row.locator(':scope > svg'), row);
        expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        expect(
          await directory.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        const pageWidth = await alice.evaluate(() => document.documentElement.scrollWidth);
        expect(pageWidth).toBeLessThanOrEqual(width);
      });

      await test.step('General contains the full author and timestamp', async () => {
        await bob.getByRole('button', { name: /^Conversations/ }).click();
        const text = `A message from the long-name guest at ${width}px.`;
        await bob.getByLabel('Message general', { exact: true }).fill(text);
        await bob.getByRole('button', { name: 'Send message', exact: true }).click();
        await alice.getByRole('button', { name: /^Conversations/ }).click();
        await alice.getByRole('tab', { name: '# General', exact: true }).click();
        const panel = alice.getByRole('complementary', { name: 'Team conversations' });
        const message = panel.getByRole('log').locator('.message').filter({ hasText: text });
        await expect(message).toHaveCount(1);
        await message.scrollIntoViewIfNeeded();
        const metadata = message.locator('.message-meta');
        await expect(metadata.locator('strong')).toHaveText(longName);
        await expect(metadata.locator('time')).toHaveText(/^\d{2}:\d{2}$/);
        await expectContained(message, panel);
        await expectContained(metadata, message);
        await expectContained(metadata.locator('strong'), metadata);
        await expectContained(metadata.locator('time'), metadata);
        expect(
          await metadata.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
      });

      await test.step('the outgoing call heading and native Close stay usable', async () => {
        await alice.getByRole('button', { name: 'Open navigation', exact: true }).click();
        await alice
          .locator('#workspace-nav')
          .getByRole('button', { name: /^Office/ })
          .click();
        await alice.getByRole('button', { name: `${longName} in studio`, exact: true }).click();
        await alice.getByRole('button', { name: 'Start a video call', exact: true }).click();
        await expect(bob.getByRole('button', { name: 'Accept call', exact: true })).toBeVisible();
        const call = alice.getByRole('dialog', { name: `Call with ${longName}`, exact: true });
        await expect(call.getByRole('heading')).toHaveText(`Call with ${longName}`);
        await expectContained(call.getByRole('heading'), call);
        const close = call.getByRole('button', { name: 'Close dialog', exact: true });
        await expectContained(close, call);
        await expect(close).toBeInViewport({ ratio: 1 });
        expect(await call.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        await call.getByRole('button', { name: 'End call', exact: true }).click();
        await expect(call).not.toBeVisible();
        await expect(bob.getByRole('dialog')).not.toBeVisible();
      });
    } finally {
      await caller.close();
      await receiver.close();
    }
  });
}
