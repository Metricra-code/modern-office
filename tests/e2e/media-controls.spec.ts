import { expect, test, type Page } from '@playwright/test';

const join = async (page: Page, workspace: string, name: string) => {
  await page.goto(`/?workspace=${workspace}&mode=live`);
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save profile' }).click();
};

const enabledTracks = (page: Page, kind: 'audio' | 'video') =>
  page.evaluate(
    (type) =>
      ((window as Window & { mediaControlTracks?: MediaStreamTrack[] }).mediaControlTracks ?? [])
        .filter((track) => track.kind === type)
        .map((track) => track.enabled),
    kind,
  );

test('focus keeps one accessible name while pressed state follows the guest status', async ({
  page,
}) => {
  await page.goto('/?mode=demo');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  const focus = page.getByRole('button', { name: 'Focus mode', exact: true });
  const selfStatus = page.locator('.profile-button .status-dot');
  const selfFocusIndicator = page.locator('.map-person.is-self [aria-label="focusing"]');
  await expect(focus).toHaveAttribute('aria-pressed', 'false');
  await expect(selfStatus).toHaveClass(/status-available/);
  await expect(selfFocusIndicator).toHaveCount(0);

  await focus.click();
  await expect(focus).toHaveAccessibleName('Focus mode');
  await expect(focus).toHaveAttribute('aria-pressed', 'true');
  await expect(selfStatus).toHaveClass(/status-focus/);
  await expect(selfFocusIndicator).toHaveCount(1);

  await focus.click();
  await expect(focus).toHaveAccessibleName('Focus mode');
  await expect(focus).toHaveAttribute('aria-pressed', 'false');
  await expect(selfStatus).toHaveClass(/status-available/);
  await expect(selfFocusIndicator).toHaveCount(0);
});

test('call action labels mute and restore the actual synthetic audio and video tracks', async ({
  browser,
}) => {
  const first = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const second = await browser.newContext({ permissions: ['camera', 'microphone'] });
  // The existing Playwright launch flags provide fake devices. This wrapper only observes
  // the original capture; it never changes track.enabled or the app's toggle behavior.
  await first.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      (window as Window & { mediaControlTracks?: MediaStreamTrack[] }).mediaControlTracks =
        stream.getTracks();
      return stream;
    };
  });
  const alice = await first.newPage();
  const bob = await second.newPage();
  try {
    const workspace = `media-controls-${Date.now()}`;
    await join(alice, workspace, 'Alice');
    await join(bob, workspace, 'Bob');
    await alice.getByRole('tab', { name: 'People', exact: true }).click();
    await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
    await expect(bob.getByRole('dialog')).toContainText(
      'Accept to share your camera and microphone',
    );
    await bob.getByRole('button', { name: 'Accept call', exact: true }).click();
    const call = alice.getByRole('dialog').filter({
      hasText: 'Connected · Direct peer-to-peer video',
    });
    await expect(call).toBeVisible({ timeout: 20000 });
    await expect.poll(() => enabledTracks(alice, 'audio')).toEqual([true]);
    await expect.poll(() => enabledTracks(alice, 'video')).toEqual([true]);

    for (const [action, enabled] of [
      ['Mute', false],
      ['Unmute', true],
    ] as const) {
      const microphone = call.getByRole('button', { name: action, exact: true });
      await expect(microphone).toHaveText(action);
      await expect(microphone).not.toHaveAttribute('aria-pressed');
      await microphone.click();
      await expect.poll(() => enabledTracks(alice, 'audio')).toEqual([enabled]);
      await expect.poll(() => enabledTracks(alice, 'video')).toEqual([true]);
    }
    await expect(call.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();

    for (const [action, enabled] of [
      ['Turn camera off', false],
      ['Turn camera on', true],
    ] as const) {
      const camera = call.getByRole('button', { name: action, exact: true });
      await expect(camera).toHaveText(action);
      await expect(camera).not.toHaveAttribute('aria-pressed');
      await camera.click();
      await expect.poll(() => enabledTracks(alice, 'video')).toEqual([enabled]);
      await expect.poll(() => enabledTracks(alice, 'audio')).toEqual([true]);
    }
    await expect(call.getByRole('button', { name: 'Turn camera off', exact: true })).toBeVisible();
    await call.getByRole('button', { name: 'End call', exact: true }).click();
    await expect(call).not.toBeVisible();
    await expect(bob.getByRole('dialog')).not.toBeVisible();
    await expect
      .poll(() =>
        alice.evaluate(() =>
          (
            (window as Window & { mediaControlTracks?: MediaStreamTrack[] }).mediaControlTracks ??
            []
          ).map((track) => track.readyState),
        ),
      )
      .toEqual(['ended', 'ended']);
  } finally {
    await first.close();
    await second.close();
  }
});
