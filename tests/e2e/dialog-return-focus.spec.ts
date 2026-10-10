import { expect, test, type Page } from '@playwright/test';

const join = async (page: Page, workspace: string, name: string) => {
  await page.goto(`/?workspace=${workspace}&mode=live`);
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save profile' }).click();
};

const observedTracks = (page: Page) =>
  page.evaluate(() =>
    ((window as Window & { dialogReturnTracks?: MediaStreamTrack[] }).dialogReturnTracks ?? [])
      .map((track) => `${track.kind}:${track.readyState}`)
      .sort(),
  );

test(
  'a departed map profile returns keyboard focus to the interactive office on Escape',
  { tag: '@browser-smoke' },
  async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    const alice = await first.newPage();
    const bob = await second.newPage();
    try {
      const workspace = `focus-profile-${Date.now()}`;
      await join(alice, workspace, 'Alice');
      await join(bob, workspace, 'Bob');
      const trigger = alice.getByRole('button', {
        name: 'Bob in studio',
        exact: true,
        includeHidden: true,
      });
      await expect(trigger).toBeVisible();
      await trigger.focus();
      await expect(trigger).toBeFocused();
      await alice.keyboard.press('Enter');
      const profile = alice.getByRole('dialog', { name: 'Bob', exact: true });
      await expect(profile).toBeVisible();
      await expect(trigger).toHaveCount(1);

      // Closing the other context produces a real WebSocket departure, not a synthetic frame.
      await second.close();
      await expect(trigger).toHaveCount(0);
      await expect(profile.getByRole('status')).toHaveText('This guest has left the workspace.');
      await expect(profile.getByRole('button', { name: 'Start a video call' })).toBeDisabled();
      await expect(profile).toBeVisible();
      await expect(profile.getByRole('button', { name: 'Close dialog' })).toBeFocused();
      await alice.keyboard.press('Escape');
      await expect(alice.getByRole('dialog')).not.toBeVisible();

      const office = alice.getByRole('group', { name: /Interactive office/ });
      await expect(office).toBeVisible();
      await expect(office).toBeFocused();
    } finally {
      await first.close();
      await second.close();
    }
  },
);

test('a departed outgoing call stops native tracks and returns keyboard focus to People', async ({
  browser,
}) => {
  const first = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const second = await browser.newContext({ permissions: ['camera', 'microphone'] });
  // Playwright supplies synthetic devices; this observer returns the original browser stream.
  // It does not replace tracks, alter their state, or intercept the real office connection.
  await first.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      const observed = window as Window & { dialogReturnTracks?: MediaStreamTrack[] };
      observed.dialogReturnTracks = [...(observed.dialogReturnTracks ?? []), ...stream.getTracks()];
      return stream;
    };
  });
  const alice = await first.newPage();
  const bob = await second.newPage();
  try {
    const workspace = `focus-call-${Date.now()}`;
    await join(alice, workspace, 'Alice');
    await join(bob, workspace, 'Bob');
    const people = alice.getByRole('tab', { name: 'People', exact: true });
    await people.focus();
    await expect(people).toBeFocused();
    await alice.keyboard.press('Enter');
    await expect(people).toHaveAttribute('aria-selected', 'true');
    const trigger = alice.getByRole('button', {
      name: 'Call Bob',
      exact: true,
      includeHidden: true,
    });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await alice.keyboard.press('Enter');
    const call = alice.getByRole('dialog', { name: 'Call with Bob', exact: true });
    await expect(call).toBeVisible();
    await expect(call).toContainText('Waiting for your teammate to accept…');
    await expect(bob.getByRole('button', { name: 'Accept call', exact: true })).toBeVisible();
    await expect(trigger).toHaveCount(1);
    await expect.poll(() => observedTracks(alice)).toEqual(['audio:live', 'video:live']);

    await second.close();
    await expect(trigger).toHaveCount(0);
    await expect(alice.getByRole('dialog')).not.toBeVisible();
    // Assert cleanup while Alice's context is still open, before finally can stop anything.
    await expect.poll(() => observedTracks(alice)).toEqual(['audio:ended', 'video:ended']);
    await expect(people).toBeVisible();
    await expect(people).toHaveAttribute('aria-selected', 'true');
    const panel = alice.getByRole('tabpanel', { name: 'People', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel).toBeFocused();
  } finally {
    await first.close();
    await second.close();
  }
});

test('declining a stacked incoming call preserves profile draft and native input focus', async ({
  browser,
}) => {
  const first = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const second = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const alice = await first.newPage();
  const bob = await second.newPage();
  try {
    const workspace = `focus-stacked-${Date.now()}`;
    await join(alice, workspace, 'Alice');
    await join(bob, workspace, 'Bob');
    const editProfile = bob.getByRole('button', { name: 'Edit your profile' });
    await editProfile.focus();
    await expect(editProfile).toBeFocused();
    await bob.keyboard.press('Enter');
    const profile = bob.getByRole('dialog', {
      name: 'Edit profile',
      exact: true,
      includeHidden: true,
    });
    await expect(profile).toBeVisible();
    const name = profile.getByLabel('Your name', { exact: true });
    const draft = 'Bob unsaved draft';
    await name.fill(draft);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue(draft);

    const people = alice.getByRole('tab', { name: 'People', exact: true });
    await people.focus();
    await expect(people).toBeFocused();
    await alice.keyboard.press('Enter');
    const trigger = alice.getByRole('button', { name: 'Call Bob', exact: true });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await alice.keyboard.press('Enter');
    await expect(alice.getByRole('dialog', { name: 'Call with Bob', exact: true })).toContainText(
      'Waiting for your teammate to accept…',
    );
    const incoming = bob.getByRole('dialog', { name: 'Alice is calling.', exact: true });
    await expect(incoming).toBeVisible();
    await expect(profile).toHaveAttribute('open', '');
    await expect(name).toHaveValue(draft);
    const decline = incoming.getByRole('button', { name: 'Decline', exact: true });
    await decline.focus();
    await expect(decline).toBeFocused();
    await bob.keyboard.press('Enter');

    await expect(incoming).not.toBeVisible();
    await expect(profile).toHaveAttribute('open', '');
    await expect(profile).toBeVisible();
    await expect(name).toHaveValue(draft);
    await expect(name).toBeFocused();
    await expect(alice.getByRole('dialog')).not.toBeVisible();
  } finally {
    await first.close();
    await second.close();
  }
});

test('a hidden People panel falls back to visible main after a departed outgoing call', async ({
  browser,
}) => {
  const first = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 1440, height: 1000 },
  });
  const second = await browser.newContext({ permissions: ['camera', 'microphone'] });
  // Observe the original native capture; never replace its stream or set track state.
  await first.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      const observed = window as Window & { dialogReturnTracks?: MediaStreamTrack[] };
      observed.dialogReturnTracks = [...(observed.dialogReturnTracks ?? []), ...stream.getTracks()];
      return stream;
    };
  });
  const alice = await first.newPage();
  const bob = await second.newPage();
  try {
    const workspace = `focus-resize-${Date.now()}`;
    await join(alice, workspace, 'Alice');
    await join(bob, workspace, 'Bob');
    const people = alice.getByRole('tab', { name: 'People', exact: true });
    await people.focus();
    await expect(people).toBeFocused();
    await alice.keyboard.press('Enter');
    const panel = alice.getByRole('tabpanel', {
      name: 'People',
      exact: true,
      includeHidden: true,
    });
    await expect(panel).toBeVisible();
    const trigger = alice.getByRole('button', {
      name: 'Call Bob',
      exact: true,
      includeHidden: true,
    });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await alice.keyboard.press('Enter');
    const call = alice.getByRole('dialog', { name: 'Call with Bob', exact: true });
    await expect(call).toBeVisible();
    await expect(bob.getByRole('button', { name: 'Accept call', exact: true })).toBeVisible();
    await expect.poll(() => observedTracks(alice)).toEqual(['audio:live', 'video:live']);

    await alice.setViewportSize({ width: 390, height: 844 });
    await expect(
      alice.getByRole('complementary', { name: 'Team conversations', includeHidden: true }),
    ).toHaveCSS('display', 'none');
    await expect(panel).not.toBeVisible();
    await expect(trigger).toHaveCount(1);
    await expect(call).toBeVisible();
    await second.close();
    await expect(trigger).toHaveCount(0);
    await expect(alice.getByRole('dialog')).not.toBeVisible();
    await expect.poll(() => observedTracks(alice)).toEqual(['audio:ended', 'video:ended']);
    const main = alice.getByRole('main');
    await expect(main).toBeVisible();
    await expect(main).toBeFocused();
  } finally {
    await first.close();
    await second.close();
  }
});
