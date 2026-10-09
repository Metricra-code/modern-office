import { expect, test } from '@playwright/test';
import { clientEventSchema } from '../../src/lib/protocol';

test('changing mode cancels delivery before a matching old acknowledgement can clear its draft', async ({
  page,
}) => {
  let heldAcknowledgement: string | undefined;
  await page.routeWebSocket(/\/office(?:\?|$)/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      const event = clientEventSchema.parse(JSON.parse(message.toString()));
      if (event.type === 'chat') {
        heldAcknowledgement = JSON.stringify({ type: 'ack', requestId: event.requestId });
      } else server.send(message);
    });
  });
  await page.goto(`/?workspace=mode-ack-${Date.now()}&mode=live`);
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  // Artificially place an ACK inside replaceState to cover the real hook's pre-cleanup window.
  // This is deterministic lifecycle coverage, not a claim about normal network event timing.
  // Install after routeWebSocket so send captures the actual hook socket, not its backend proxy.
  await page.evaluate(() => {
    const probe = window as Window & {
      heldOfficeAcknowledgement?: string;
      officeAcknowledgementInjected?: boolean;
      officeAcknowledgementTarget?: {
        hasHandler: boolean;
        open: boolean;
        path: string;
        matches: boolean;
      };
    };
    const officeSends: { socket: WebSocket; requestId: string }[] = [];
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (this: WebSocket, message) {
      if (new URL(this.url).pathname === '/office' && typeof message === 'string') {
        const event: unknown = JSON.parse(message);
        if (
          event &&
          typeof event === 'object' &&
          'type' in event &&
          event.type === 'chat' &&
          'requestId' in event &&
          typeof event.requestId === 'string'
        )
          officeSends.push({ socket: this, requestId: event.requestId });
      }
      Reflect.apply(send, this, [message]);
    };
    const replaceState = history.replaceState;
    history.replaceState = function (this: History, data, unused, url) {
      const next = new URL(url ?? location.href, location.href);
      const sent = officeSends.at(-1);
      if (next.searchParams.get('mode') === 'demo' && probe.heldOfficeAcknowledgement && sent) {
        const ack: unknown = JSON.parse(probe.heldOfficeAcknowledgement);
        const target = {
          hasHandler: typeof sent.socket.onmessage === 'function',
          open: sent.socket.readyState === WebSocket.OPEN,
          path: new URL(sent.socket.url).pathname,
          matches: Boolean(
            ack &&
            typeof ack === 'object' &&
            'requestId' in ack &&
            ack.requestId === sent.requestId,
          ),
        };
        probe.officeAcknowledgementTarget = target;
        if (target.hasHandler && target.open && target.path === '/office' && target.matches) {
          sent.socket.dispatchEvent(
            new MessageEvent('message', { data: probe.heldOfficeAcknowledgement }),
          );
          probe.officeAcknowledgementInjected = true;
          probe.heldOfficeAcknowledgement = undefined;
        }
      }
      Reflect.apply(replaceState, this, [data, unused, url]);
    };
  });
  await page.getByLabel('Message general', { exact: true }).fill('Keep my live draft');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('button', { name: 'Send message' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect.poll(() => Boolean(heldAcknowledgement)).toBe(true);
  await page.evaluate((payload) => {
    (window as Window & { heldOfficeAcknowledgement?: string }).heldOfficeAcknowledgement = payload;
  }, heldAcknowledgement!);

  await page.getByRole('button', { name: 'View demo', exact: true }).click();
  await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & {
            officeAcknowledgementTarget?: {
              hasHandler: boolean;
              open: boolean;
              path: string;
              matches: boolean;
            };
          }
        ).officeAcknowledgementTarget,
    ),
  ).toEqual({ hasHandler: true, open: true, path: '/office', matches: true });
  expect(
    await page.evaluate(
      () =>
        (window as Window & { officeAcknowledgementInjected?: boolean })
          .officeAcknowledgementInjected,
    ),
  ).toBe(true);
  await expect(page.getByRole('button', { name: 'Send message' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await expect(page.getByLabel('Message general', { exact: true })).toHaveValue('');
  await page.getByLabel('Message general', { exact: true }).fill('My separate demo draft');
  await page.getByRole('button', { name: 'Join live room', exact: true }).click();
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Message general', { exact: true })).toHaveValue(
    'Keep my live draft',
  );
  await page.getByRole('button', { name: 'View demo', exact: true }).click();
  await expect(page.getByLabel('Message general', { exact: true })).toHaveValue(
    'My separate demo draft',
  );
});
