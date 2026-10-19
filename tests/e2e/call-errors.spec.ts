import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clientEventSchema } from '../../src/lib/protocol';

const join = async (page: Page, workspace: string, name: string) => {
  await page.goto(`/?workspace=${workspace}&mode=live`);
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save profile' }).click();
};
const observeCallCaptures = (context: BrowserContext) =>
  context.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      const observed = window as Window & { callCaptures?: MediaStreamTrack[][] };
      observed.callCaptures = [...(observed.callCaptures ?? []), stream.getTracks()];
      return stream;
    };
  });

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

test('a pending old offer cannot block hangup, redial or end a newer call', async ({ browser }) => {
  const caller = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const receiver = await browser.newContext({ permissions: ['camera', 'microphone'] });
  await observeCallCaptures(caller);
  await caller.addInitScript(() => {
    const createOffer = RTCPeerConnection.prototype.createOffer;
    let firstOffer = true;
    RTCPeerConnection.prototype.createOffer = function (this: RTCPeerConnection) {
      if (!firstOffer) return Reflect.apply(createOffer, this, []);
      firstOffer = false;
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
    // A remote hangup must bypass the indefinitely pending SDP work.
    await bob.getByRole('button', { name: 'End call' }).click();
    await expect(alice.getByRole('dialog')).not.toBeVisible();
    expect(
      await alice.evaluate(() => {
        const tracks = (window as Window & { callCaptures?: MediaStreamTrack[][] })
          .callCaptures?.[0];
        return Boolean(tracks?.length && tracks.every((track) => track.readyState === 'ended'));
      }),
    ).toBe(true);
    await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
    await bob.getByRole('button', { name: 'Accept call' }).click();
    const activeCall = alice.getByRole('dialog').filter({
      hasText: 'Connected · Direct peer-to-peer video',
    });
    // The next call must connect without settling the previous offer first.
    await expect(activeCall).toBeVisible({ timeout: 20000 });
    await alice.evaluate(() =>
      (window as Window & { rejectPriorOffer?: () => void }).rejectPriorOffer?.(),
    );
    // Let the old catch settle; it must not clean up the active second call.
    await alice.waitForTimeout(150);
    await expect(activeCall).toBeVisible();
    await alice.getByRole('button', { name: 'End call' }).click();
  } finally {
    await caller.close();
    await receiver.close();
  }
});

test('a guest leaving before accepting immediately ends the invitation and stops media', async ({
  browser,
}) => {
  const caller = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const receiver = await browser.newContext();
  await observeCallCaptures(caller);
  const alice = await caller.newPage();
  const bob = await receiver.newPage();
  try {
    const workspace = `call-peer-left-${Date.now()}`;
    await join(alice, workspace, 'Alice');
    await join(bob, workspace, 'Bob');
    await alice.getByRole('tab', { name: 'People', exact: true }).click();
    await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
    await expect(bob.getByRole('button', { name: 'Accept call' })).toBeVisible();
    await receiver.close();
    await expect(alice.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(alice.locator('.toast')).toContainText('Your teammate left the office');
    expect(
      await alice.evaluate(() => {
        const tracks = (
          window as Window & { callCaptures?: MediaStreamTrack[][] }
        ).callCaptures?.flat();
        return Boolean(tracks?.length && tracks.every((track) => track.readyState === 'ended'));
      }),
    ).toBe(true);
  } finally {
    await caller.close();
    await receiver.close();
  }
});

for (const kind of ['end', 'decline'] as const) {
  test(`a delayed previous ${kind} cannot close a new call with the same guest`, async ({
    browser,
  }) => {
    const caller = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const receiver = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const alice = await caller.newPage();
    const bob = await receiver.newPage();
    let releasePrevious: (() => void) | undefined;
    await bob.routeWebSocket(/\/office(?:\?|$)/, (socket) => {
      const server = socket.connectToServer();
      socket.onMessage((message) => {
        const event = clientEventSchema.parse(JSON.parse(message.toString()));
        if (event.type === 'signal' && event.signal.kind === kind && !releasePrevious)
          releasePrevious = () => server.send(message);
        else server.send(message);
      });
    });
    try {
      const workspace = `stale-${kind}-${Date.now()}`;
      await join(alice, workspace, 'Alice');
      await join(bob, workspace, 'Bob');
      await alice.getByRole('tab', { name: 'People', exact: true }).click();
      await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
      await expect(bob.getByRole('button', { name: 'Accept call' })).toBeVisible();
      await bob
        .getByRole('button', { name: kind === 'decline' ? 'Decline' : 'Close dialog' })
        .click();
      await expect.poll(() => Boolean(releasePrevious)).toBe(true);
      await alice.getByRole('button', { name: 'End call' }).click();
      await alice.getByRole('button', { name: 'Call Bob', exact: true }).click();
      await expect(bob.getByRole('button', { name: 'Accept call' })).toBeVisible();
      releasePrevious?.();
      await bob.getByRole('button', { name: 'Accept call' }).click();
      await expect(
        alice.getByRole('dialog').filter({ hasText: 'Connected · Direct peer-to-peer video' }),
      ).toBeVisible({ timeout: 20000 });
      await alice.getByRole('button', { name: 'End call' }).click();
    } finally {
      await caller.close();
      await receiver.close();
    }
  });
}

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
