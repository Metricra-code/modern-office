import { expect, test, type Locator, type Page } from '@playwright/test';

type PlaybackScenario = 'blocked' | 'pending-autoplay' | 'pending-manual';
type PlaybackProbe = {
  streams: MediaStream[];
  rejectPending?: () => Promise<void>;
};
type PlaybackWindow = Window & { playbackProbe?: PlaybackProbe };

test.use({ permissions: ['camera'] });

const openPreview = async (page: Page, scenario: PlaybackScenario) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((scenario: PlaybackScenario) => {
    const probe: PlaybackProbe = { streams: [] };
    (window as PlaybackWindow).playbackProbe = probe;
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      // Observe the existing fake camera without manufacturing or changing its tracks.
      const stream = await capture(constraints);
      probe.streams.push(stream);
      return stream;
    };
    const nativePlay = HTMLMediaElement.prototype.play;
    let requests = 0;
    HTMLMediaElement.prototype.play = function () {
      if (this.getAttribute('aria-label') !== 'Your local preview')
        return Reflect.apply(nativePlay, this, []);
      requests += 1;
      const held =
        (scenario === 'pending-autoplay' && requests === 1) ||
        (scenario === 'pending-manual' && requests === 2);
      if (requests !== 1 && !held) return Reflect.apply(nativePlay, this, []);
      // A policy denial must block attribute autoplay as well as the script request.
      this.autoplay = false;
      this.pause();
      const denied = new DOMException('Controlled playback denial', 'NotAllowedError');
      if (!held) return Promise.reject(denied);
      const pending = new Promise<void>((_, reject) => {
        probe.rejectPending = async () => {
          reject(denied);
          await pending.catch(() => {});
        };
      });
      return pending;
    };
  }, scenario);
  await page.goto('/?mode=demo');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Test camera', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Camera preview', exact: true });
  const video = dialog.getByLabel('Your local preview', { exact: true });
  const play = dialog.getByRole('button', { name: 'Play Your local preview', exact: true });
  await expect
    .poll(() =>
      video.evaluate((element) => {
        const video = element as HTMLVideoElement;
        return {
          currentStream: video.srcObject === (window as PlaybackWindow).playbackProbe!.streams[0],
          paused: video.paused,
        };
      }),
    )
    .toEqual({ currentStream: true, paused: true });
  return { dialog, video, play, errors };
};

const expectPlaying = async (video: Locator, captureIndex: number) => {
  await expect
    .poll(() =>
      video.evaluate((element, index) => {
        const video = element as HTMLVideoElement;
        return {
          currentStream:
            video.srcObject === (window as PlaybackWindow).playbackProbe!.streams[index],
          playing: !video.paused && video.readyState >= 2 && video.currentTime > 0,
        };
      }, captureIndex),
    )
    .toEqual({ currentStream: true, playing: true });
};

const capturedTracks = (page: Page) =>
  page.evaluate(() =>
    (window as PlaybackWindow).playbackProbe!.streams.map((stream) => ({
      audio: stream.getAudioTracks().length,
      video: stream.getVideoTracks().map((track) => track.readyState),
    })),
  );

const expectTracks = async (page: Page, states: MediaStreamTrackState[]) => {
  await expect
    .poll(() => capturedTracks(page))
    .toEqual(states.map((state) => ({ audio: 0, video: [state] })));
};

const rejectOldRequest = async (page: Page) => {
  await page.evaluate(async () => {
    const reject = (window as PlaybackWindow).playbackProbe!.rejectPending;
    if (!reject) throw new Error('No held playback request');
    await reject();
    // The rejected promise has settled; allow its UI update to commit before checking absence.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
};

const closePreview = async (page: Page, dialog: Locator, captures: number, errors: string[]) => {
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  // Report cleanup failures separately without replacing a failed playback assertion.
  await expect.soft(dialog).not.toBeVisible();
  await expect.soft
    .poll(() => capturedTracks(page))
    .toEqual(Array.from({ length: captures }, () => ({ audio: 0, video: ['ended'] })));
  expect.soft(errors).toEqual([]);
};

test('a current autoplay denial offers manual playback that starts the native video', async ({
  page,
}) => {
  const { dialog, video, play, errors } = await openPreview(page, 'blocked');
  try {
    await expect(play).toBeVisible();
    await expectTracks(page, ['live']);
    await play.click();
    await expectPlaying(video, 0);
    await expect(play).toHaveCount(0);
  } finally {
    await closePreview(page, dialog, 1, errors);
  }
});

test('retrying a blocked preview starts the replacement without a stale Play overlay', async ({
  page,
}) => {
  const { dialog, video, play, errors } = await openPreview(page, 'blocked');
  try {
    await expect(play).toBeVisible();
    await dialog.getByRole('button', { name: 'Retry camera', exact: true }).click();
    await expectPlaying(video, 1);
    await expectTracks(page, ['ended', 'live']);
    await expect(play).toHaveCount(0);
  } finally {
    await closePreview(page, dialog, 2, errors);
  }
});

test('an old autoplay denial cannot cover an already playing replacement', async ({ page }) => {
  const { dialog, video, play, errors } = await openPreview(page, 'pending-autoplay');
  try {
    await expect
      .poll(() =>
        page.evaluate(() => typeof (window as PlaybackWindow).playbackProbe!.rejectPending),
      )
      .toBe('function');
    await expect(play).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Retry camera', exact: true }).click();
    await expectPlaying(video, 1);
    await expectTracks(page, ['ended', 'live']);
    await rejectOldRequest(page);
    await expectPlaying(video, 1);
    await expect(play).toHaveCount(0);
  } finally {
    await closePreview(page, dialog, 2, errors);
  }
});

test('an old manual playback denial cannot cover an already playing replacement', async ({
  page,
}) => {
  const { dialog, video, play, errors } = await openPreview(page, 'pending-manual');
  try {
    await expect(play).toBeVisible();
    await play.click();
    await expect
      .poll(() =>
        page.evaluate(() => typeof (window as PlaybackWindow).playbackProbe!.rejectPending),
      )
      .toBe('function');
    await dialog.getByRole('button', { name: 'Retry camera', exact: true }).click();
    await expectPlaying(video, 1);
    await expectTracks(page, ['ended', 'live']);
    await rejectOldRequest(page);
    await expectPlaying(video, 1);
    await expect(play).toHaveCount(0);
  } finally {
    await closePreview(page, dialog, 2, errors);
  }
});

test('an old manual playback denial cannot cover a newer successful request on the same stream', async ({
  page,
}) => {
  const { dialog, video, play, errors } = await openPreview(page, 'pending-manual');
  try {
    await expect(play).toBeVisible();
    await play.click();
    await expect
      .poll(() =>
        page.evaluate(() => typeof (window as PlaybackWindow).playbackProbe!.rejectPending),
      )
      .toBe('function');
    await play.click();
    await expectPlaying(video, 0);
    await expectTracks(page, ['live']);
    await expect(play).toHaveCount(0);
    await rejectOldRequest(page);
    await expectPlaying(video, 0);
    await expect(play).toHaveCount(0);
  } finally {
    await closePreview(page, dialog, 1, errors);
  }
});
