import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { clientEventSchema } from '../../src/lib/protocol';

const openProfile = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save profile' }).click();
};
const enterLive = async (page: Page, workspace: string) => {
  await page.goto(`/?workspace=${workspace}&mode=live`);
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
};

test(
  'demo: profile, keyboard movement, room selection and local chat',
  { tag: '@browser-smoke' },
  async ({ page }) => {
    await page.goto('/?mode=demo');
    await expect(page.getByRole('heading', { name: 'Office', exact: true })).toBeVisible();
    await openProfile(page, 'Interview Guest');
    await expect(
      page.getByRole('button', { name: 'Interview Guest, you in studio' }),
    ).toBeVisible();
    const map = page.getByRole('group', { name: /Interactive office/ });
    const avatar = page.getByRole('button', { name: /^Interview Guest, you in/ });
    const before = await avatar.boundingBox();
    await map.focus();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(160);
    await page.keyboard.up('ArrowRight');
    expect((await avatar.boundingBox())!.x).toBeGreaterThan(before!.x);
    await page.getByRole('button', { name: 'Go to Lounge' }).click();
    await expect(
      page.getByRole('button', { name: 'Interview Guest, you in lounge' }),
    ).toBeVisible();
    await page.getByLabel('Message general').fill('A thoughtful workspace.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('log')).toContainText('A thoughtful workspace.');
    await page.getByRole('tab', { name: 'This room' }).click();
    await page.getByLabel('Message lounge').fill('Hello lounge');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('log')).toContainText('Hello lounge');
    await expect(page.getByRole('log')).not.toContainText('A thoughtful workspace.');
  },
);

test(
  'native dialogs trap focus, escape closes, sample calls are honest',
  { tag: '@browser-smoke' },
  async ({ page }) => {
    await page.goto('/?mode=demo');
    await page.getByRole('button', { name: 'Mia Chen in studio' }).click();
    await expect(page.getByRole('dialog')).toContainText(
      'sample teammate, not a real person online',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const invite = page.getByRole('button', { name: 'Invite people', exact: true });
    await invite.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Workspace link')).toHaveValue(/workspace=office-/);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await expect(invite).toBeFocused();
  },
);

test('the advertised ? shortcut opens help everywhere except text fields', async ({ page }) => {
  await page.goto('/?mode=demo');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  const composer = page.getByLabel('Message general');
  await composer.fill('Any questions?');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('heading', { name: 'Office', exact: true }).click();
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'How to use the office' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(composer).toHaveValue('Any questions?');
});

test('two guests sync chat, presence, video consent and cleanup', async ({ browser }) => {
  const first = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const second = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const alice = await first.newPage();
  const bob = await second.newPage();
  const workspace = `test-${Date.now()}`;
  await enterLive(alice, workspace);
  await openProfile(alice, 'Alice');
  await enterLive(bob, workspace);
  await openProfile(bob, 'Bob');
  await expect(alice.getByRole('button', { name: 'Bob in studio' })).toBeVisible();
  await alice.getByLabel('Message general').fill('Hello from Alice');
  await alice.getByRole('button', { name: 'Send message' }).click();
  await expect(bob.getByRole('log')).toContainText('Hello from Alice');
  await bob.getByRole('button', { name: 'Go to Lounge' }).click();
  await expect(alice.getByRole('button', { name: 'Bob in lounge' })).toBeVisible();
  const world = bob.locator('.map-world');
  const bounds = (await world.boundingBox())!;
  await bob.mouse.click(
    bounds.x + bounds.width * (700 / 900),
    bounds.y + bounds.height * (420 / 570),
  );
  await expect
    .poll(() =>
      alice
        .getByRole('button', { name: 'Bob in lounge' })
        .evaluate((element) => parseFloat((element as HTMLElement).style.left)),
    )
    .toBeCloseTo((700 / 900) * 100, 0);
  await expect(bob.locator('.toast')).not.toBeVisible();
  await alice.getByRole('button', { name: 'Bob in lounge' }).click();
  await alice.getByRole('button', { name: 'Start a video call' }).click();
  await expect(bob.getByRole('dialog')).toContainText('Accept to share your camera and microphone');
  await bob.getByRole('button', { name: 'Accept call' }).click();
  await expect(alice.getByRole('dialog')).toContainText('Connected · Direct peer-to-peer video', {
    timeout: 20000,
  });
  await expect(bob.getByRole('dialog')).toContainText('Connected · Direct peer-to-peer video');
  await expect
    .poll(() =>
      alice
        .locator('video[aria-label="Bob"]')
        .evaluate((video) => (video as HTMLVideoElement).videoWidth),
    )
    .toBeGreaterThan(0);
  await alice.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(alice.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
  await expect(alice.getByRole('button', { name: 'Unmute', exact: true })).not.toHaveAttribute(
    'aria-pressed',
  );
  await alice.getByRole('button', { name: 'End call' }).click();
  await expect(bob.getByRole('dialog')).not.toBeVisible();
  await expect(alice.locator('video')).toHaveCount(0);
  await second.close();
  await expect(alice.getByRole('button', { name: 'Bob in lounge' })).not.toBeVisible();
  await first.close();
});

test(
  'mobile controls remain usable without horizontal page overflow',
  { tag: '@browser-smoke' },
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?mode=demo');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Go to Focus room' }).click();
    await page.getByRole('button', { name: /^Conversations/ }).click();
    await page.getByLabel('Message general').fill('Mobile hello');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('log')).toContainText('Mobile hello');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: /^Team/ }).click();
    await page
      .locator('.mobile-workspace-tabs')
      .getByRole('button', { name: 'Team', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Workspace members' })).toBeVisible();
  },
);

test('desktop and mobile meet automated accessibility checks', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?mode=demo');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.goto('/case-study/');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test(
  'map has no focus frame while keyboard movement retains a visible instruction cue',
  { tag: '@browser-smoke' },
  async ({ page }) => {
    await page.goto('/?mode=demo');
    await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
    const map = page.getByRole('group', { name: /Interactive office/ });
    const world = page.locator('.map-world');
    const bounds = (await world.boundingBox())!;
    await page.mouse.click(
      bounds.x + bounds.width * (400 / 900),
      bounds.y + bounds.height * (315 / 570),
    );
    await expect(map).toBeFocused();
    await expect(map).toHaveCSS('outline-style', 'none');
    await page.keyboard.press('Tab');
    await map.focus();
    expect(await map.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await expect(map).toHaveCSS('outline-style', 'none');
    await expect(page.locator('#map-instructions')).not.toHaveCSS('box-shadow', 'none');
  },
);

test('a rejected chat acknowledgement preserves the draft for retry', async ({ page }) => {
  await page.routeWebSocket(/\/office(?:\?|$)/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      const event = clientEventSchema.parse(JSON.parse(message.toString()));
      if (event.type === 'chat') {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'You are sending messages too quickly. Try again.',
            requestId: event.requestId,
          }),
        );
      } else server.send(message);
    });
  });
  await enterLive(page, `chat-rejected-${Date.now()}`);
  const draft = page.getByLabel('Message general');
  await draft.fill('Keep this message for retry');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.toast')).toContainText('You are sending messages too quickly');
  await expect(draft).toHaveValue('Keep this message for retry');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await expect(page.getByRole('log')).not.toContainText('Keep this message for retry');
});

test(
  'furniture is passable while walls and map zoom controls remain usable',
  { tag: '@browser-smoke' },
  async ({ page }) => {
    await page.goto('/?mode=demo');
    await page.locator('.floorplan').evaluate((image) => (image as HTMLImageElement).decode());
    const world = page.locator('.map-world');
    const self = page.locator('.map-person.is-self');
    const clickWorldPoint = async (x: number, y: number) => {
      const bounds = (await world.boundingBox())!;
      await page.mouse.click(
        bounds.x + (bounds.width * x) / 900,
        bounds.y + (bounds.height * y) / 570,
      );
    };
    const initialPosition = (await self.getAttribute('style'))!;
    await clickWorldPoint(400, 315);
    await expect(self).not.toHaveAttribute('style', initialPosition);
    const movedPosition = (await self.getAttribute('style'))!;
    await clickWorldPoint(216, 140);
    await expect(self).not.toHaveAttribute('style', movedPosition);
    await expect(page.locator('.map-shell').getByRole('status')).not.toBeVisible();
    const furniturePosition = (await self.getAttribute('style'))!;
    await clickWorldPoint(468, 150);
    await expect(page.locator('.map-shell').getByRole('status')).toHaveText(
      'Choose a spot inside the office, away from walls.',
    );
    await expect(self).toHaveAttribute('style', furniturePosition);

    const originalWidth = (await world.boundingBox())!.width;
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    expect((await world.boundingBox())!.width).toBeCloseTo(originalWidth * 1.1, 0);
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    expect((await world.boundingBox())!.width).toBeCloseTo(originalWidth, 0);
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    expect((await world.boundingBox())!.width).toBeCloseTo(originalWidth * 0.9, 0);
    await page.getByRole('button', { name: 'Reset map zoom', exact: true }).click();
    expect((await world.boundingBox())!.width).toBeCloseTo(originalWidth, 0);
  },
);
