import { expect, test } from '@playwright/test';

test('outdated call clients receive a reload hint without losing chat access', async ({ page }) => {
  const connection = page.waitForEvent('websocket', {
    predicate: (socket) => new URL(socket.url()).pathname === '/office',
  });
  await page.goto(`/?workspace=legacy-${Date.now()}&mode=live`);
  const endpoint = (await connection).url();
  const result = await page.evaluate(
    (url) =>
      new Promise<{ error: string; chat: string }>((resolve, reject) => {
        const socket = new WebSocket(url);
        let error = '';
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error('Legacy client did not receive a response'));
        }, 10000);
        socket.onmessage = ({ data }) => {
          const event = JSON.parse(data);
          if (event.type === 'welcome') {
            socket.send(
              JSON.stringify({
                type: 'signal',
                target: crypto.randomUUID(),
                signal: { kind: 'invite' },
              }),
            );
          } else if (event.type === 'error') {
            error = event.message;
            socket.send(
              JSON.stringify({ type: 'chat', text: 'Chat still works', channel: 'general' }),
            );
          } else if (event.type === 'message') {
            clearTimeout(timer);
            socket.close();
            resolve({ error, chat: event.message.text });
          }
        };
        socket.onerror = () => {
          clearTimeout(timer);
          socket.close();
          reject(new Error('Legacy client connection failed'));
        };
      }),
    endpoint,
  );
  expect(result).toEqual({
    error: 'Calling was updated. Reload this page before starting a call.',
    chat: 'Chat still works',
  });
});
