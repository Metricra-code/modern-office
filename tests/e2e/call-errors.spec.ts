import { expect, test, type Page } from '@playwright/test';

const join = async (page: Page, workspace: string, name: string) => {
  await page.goto(`/?workspace=${workspace}&mode=live`);
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save profile' }).click();
};

test('RTC initialization failure stops captured media and ends the invitation', async ({
  browser,
}) => {
  const caller = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const receiver = await browser.newContext({ permissions: ['camera', 'microphone'] });
  await receiver.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      (window as Window & { capturedTracks?: MediaStreamTrack[] }).capturedTracks =
        stream.getTracks();
      return stream;
    };
    window.RTCPeerConnection = class {
      constructor() {
        throw new Error('RTC unavailable');
      }
    } as unknown as typeof RTCPeerConnection;
  });
  const alice = await caller.newPage();
  const bob = await receiver.newPage();
  const runtimeErrors: string[] = [];
  bob.on('pageerror', (error) => runtimeErrors.push(error.message));
  const workspace = `rtc-error-${Date.now()}`;
  try {
    await join(alice, workspace, 'Alice');
    await join(bob, workspace, 'Bob');
    await alice.getByRole('tab', { name: 'People', exact: true }).click();
    await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
    await bob.getByRole('button', { name: 'Accept call' }).click();
    await expect(bob.locator('.toast')).toContainText('The call could not be established');
    await expect(alice.getByRole('dialog')).not.toBeVisible();
    expect(
      await bob.evaluate(() => {
        const tracks = (window as Window & { capturedTracks?: MediaStreamTrack[] }).capturedTracks;
        return Boolean(tracks?.length && tracks.every((track) => track.readyState === 'ended'));
      }),
    ).toBe(true);
    expect(runtimeErrors).toEqual([]);
  } finally {
    await caller.close();
    await receiver.close();
  }
});

test('an old offer rejection cannot end a newer call', async ({ browser }) => {
  const caller = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const receiver = await browser.newContext({ permissions: ['camera', 'microphone'] });
  await caller.addInitScript(() => {
    RTCPeerConnection.prototype.createOffer = function () {
      return new Promise<RTCSessionDescriptionInit>((_resolve, reject) => {
        (window as Window & { rejectPriorOffer?: () => void }).rejectPriorOffer = () =>
          reject(new Error('Previous call failed late'));
      });
    } as typeof RTCPeerConnection.prototype.createOffer;
  });
  const alice = await caller.newPage();
  const bob = await receiver.newPage();
  try {
    const workspace = `rtc-race-${Date.now()}`;
    await join(alice, workspace, 'Alice');
    await join(bob, workspace, 'Bob');
    await alice.getByRole('tab', { name: 'People', exact: true }).click();
    await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
    await bob.getByRole('button', { name: 'Accept call' }).click();
    await expect
      .poll(() =>
        alice.evaluate(() =>
          Boolean((window as Window & { rejectPriorOffer?: () => void }).rejectPriorOffer),
        ),
      )
      .toBe(true);
    await alice.getByRole('button', { name: 'End call' }).click();
    await expect(bob.getByRole('dialog')).not.toBeVisible();
    await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
    await expect(bob.getByRole('button', { name: 'Accept call' })).toBeVisible();
    await alice.evaluate(() =>
      (window as Window & { rejectPriorOffer?: () => void }).rejectPriorOffer?.(),
    );
    // Let the rejected offer's catch settle; the second invitation must survive.
    await alice.waitForTimeout(150);
    await expect(alice.getByRole('button', { name: 'End call' })).toBeVisible();
    await expect(bob.getByRole('button', { name: 'Accept call' })).toBeVisible();
    await alice.getByRole('button', { name: 'End call' }).click();
  } finally {
    await caller.close();
    await receiver.close();
  }
});

test('a delayed camera preview cannot replace an accepted call stream', async ({ browser }) => {
  const caller = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const receiver = await browser.newContext({ permissions: ['camera', 'microphone'] });
  await receiver.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      const observed = window as Window & {
        releasePreview?: () => void;
        previewTracks?: MediaStreamTrack[];
        callTracks?: MediaStreamTrack[];
      };
      if (constraints?.audio !== false) {
        observed.callTracks = stream.getTracks();
        return stream;
      }
      observed.previewTracks = stream.getTracks();
      return new Promise<MediaStream>((resolve) => {
        observed.releasePreview = () => resolve(stream);
      });
    };
  });
  const alice = await caller.newPage();
  const bob = await receiver.newPage();
  try {
    const workspace = `preview-race-${Date.now()}`;
    await join(alice, workspace, 'Alice');
    await join(bob, workspace, 'Bob');
    await bob.getByRole('button', { name: 'Test camera' }).click();
    await expect
      .poll(() =>
        bob.evaluate(() =>
          Boolean((window as Window & { releasePreview?: () => void }).releasePreview),
        ),
      )
      .toBe(true);
    await alice.getByRole('tab', { name: 'People', exact: true }).click();
    await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
    await bob.getByRole('button', { name: 'Accept call' }).click();
    await expect(
      bob.getByRole('dialog').filter({ hasText: 'Connected · Direct peer-to-peer video' }),
    ).toBeVisible();
    await bob.evaluate(() =>
      (window as Window & { releasePreview?: () => void }).releasePreview?.(),
    );
    await expect
      .poll(() =>
        bob.evaluate(() => {
          const observed = window as Window & {
            previewTracks?: MediaStreamTrack[];
            callTracks?: MediaStreamTrack[];
          };
          return Boolean(
            observed.previewTracks?.every((track) => track.readyState === 'ended') &&
            observed.callTracks?.every((track) => track.readyState === 'live'),
          );
        }),
      )
      .toBe(true);
    await alice.getByRole('button', { name: 'End call' }).click();
  } finally {
    await caller.close();
    await receiver.close();
  }
});
