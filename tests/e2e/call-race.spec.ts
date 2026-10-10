import { expect, test } from '@playwright/test';
import { serverEventSchema } from '../../src/lib/protocol';

test('a batched invitation and caller departure cannot open a stale call or capture media', async ({
  page,
}) => {
  const receiver = {
    id: crypto.randomUUID(),
    name: 'Receiver',
    color: 'sage',
    x: 450,
    y: 315,
    status: 'available',
  };
  const caller = { ...receiver, id: crypto.randomUUID(), name: 'Caller', x: 390 };
  const welcome = serverEventSchema.parse({
    type: 'welcome',
    selfId: receiver.id,
    players: [receiver, caller],
    messages: [],
  });
  const frames = [
    { type: 'signal', from: caller.id, signal: { kind: 'invite', callId: crypto.randomUUID() } },
    { type: 'presence', players: [receiver] },
  ].map((frame) => JSON.stringify(serverEventSchema.parse(frame)));
  await page.routeWebSocket(/\/office(?:\?|$)/, (socket) => {
    // Mock-only: no backend guest or real media is needed to exercise the hook's ordering.
    socket.onMessage(() => {});
    socket.send(JSON.stringify(welcome));
  });
  await page.goto(`/?workspace=batch-call-${Date.now()}&mode=live`);
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Caller in studio', exact: true })).toBeVisible();

  // Install after routing, then observe a real UI send to capture the hook client,
  // not Playwright's backend proxy. Both validated frames enter in one JavaScript task.
  await page.evaluate(() => {
    const probe = window as Window & { callRaceClient?: WebSocket; callRaceCaptures?: number };
    probe.callRaceCaptures = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      probe.callRaceCaptures = (probe.callRaceCaptures ?? 0) + 1;
      throw new DOMException('Unexpected media capture', 'NotAllowedError');
    };
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (this: WebSocket, message) {
      if (new URL(this.url).pathname === '/office' && typeof this.onmessage === 'function')
        probe.callRaceClient = this;
      Reflect.apply(send, this, [message]);
    };
  });
  await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
  expect(
    await page.evaluate((payloads) => {
      const socket = (window as Window & { callRaceClient?: WebSocket }).callRaceClient;
      if (!socket || socket.readyState !== WebSocket.OPEN || typeof socket.onmessage !== 'function')
        throw new Error('The real office client was not captured');
      for (const data of payloads) socket.dispatchEvent(new MessageEvent('message', { data }));
      return { open: socket.readyState === WebSocket.OPEN, deliveredFrames: payloads.length };
    }, frames),
  ).toEqual({ open: true, deliveredFrames: 2 });

  await expect(page.getByRole('button', { name: 'Caller in studio', exact: true })).toHaveCount(0);
  // Let the committed presence render and its deferred signal effect finish before
  // asserting absence, rather than passing before the invitation has been processed.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept call', exact: true })).not.toBeVisible();
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { callRaceCaptures?: number }).callRaceCaptures),
  ).toBe(0);
});
