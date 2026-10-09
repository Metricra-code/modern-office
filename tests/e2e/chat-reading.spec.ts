import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  clientEventSchema,
  serverEventSchema,
  type Channel,
  type ChatMessage,
  type Player,
} from '../../src/lib/protocol';

const makeMessage = (text: string, channel: Channel = 'general'): ChatMessage => ({
  id: randomUUID(),
  senderId: randomUUID(),
  name: 'Reader',
  color: 'sage',
  text,
  channel,
  sentAt: 1800000000000,
});

const installChatFeed = async (page: Page, historyLength = 100) => {
  let publish: ((message: ChatMessage) => void) | undefined;
  await page.routeWebSocket(/\/office(?:\?|$)/, (socket) => {
    const server = socket.connectToServer();
    let teammates: Player[] = [];
    publish = (message) => socket.send(JSON.stringify({ type: 'message', message }));
    server.onMessage((message) => {
      const event = serverEventSchema.parse(JSON.parse(message.toString()));
      if (event.type === 'presence') {
        socket.send(JSON.stringify({ ...event, players: [...event.players, ...teammates] }));
        return;
      }
      if (event.type !== 'welcome') {
        socket.send(message);
        return;
      }
      teammates = Array.from({ length: 20 }, (_, index) => ({
        ...event.players[0],
        id: randomUUID(),
        name: `Teammate ${index + 1}`,
      }));
      socket.send(
        JSON.stringify({
          ...event,
          players: [...event.players, ...teammates],
          messages: Array.from({ length: historyLength }, (_, index) =>
            makeMessage(`History ${index + 1}. A message to read before the latest update.`),
          ),
        }),
      );
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?workspace=chat-reading-${randomUUID().slice(0, 8)}&mode=live`);
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  await expect(page.locator('.message')).toHaveCount(historyLength);
  return (text: string, channel?: Channel) => publish!(makeMessage(text, channel));
};

const holdAcknowledgement = async (page: Page) => {
  let acknowledge: (() => void) | undefined;
  await page.routeWebSocket(/\/office(?:\?|$)/, (socket) => {
    const server = socket.connectToServer();
    let closed = false;
    socket.onClose(() => {
      closed = true;
    });
    socket.onMessage((message) => {
      const event = clientEventSchema.parse(JSON.parse(message.toString()));
      if (event.type === 'chat') {
        acknowledge = () => {
          if (!closed) socket.send(JSON.stringify({ type: 'ack', requestId: event.requestId }));
        };
      } else server.send(message);
    });
  });
  await page.goto(`/?workspace=chat-ack-${randomUUID().slice(0, 8)}&mode=live`);
  await expect(page.getByText('Live workspace', { exact: true })).toBeVisible();
  return async () => {
    await expect.poll(() => Boolean(acknowledge)).toBe(true);
    acknowledge!();
  };
};

const distanceFromLatest = (page: Page) =>
  page
    .locator('.chat-content')
    .evaluate((panel) => Math.round(panel.scrollHeight - panel.clientHeight - panel.scrollTop));

test('reading history ignores other channels and offers an explicit jump for new messages', async ({
  page,
}) => {
  const publish = await installChatFeed(page);
  const panel = page.getByRole('tabpanel');
  await expect.poll(() => distanceFromLatest(page)).toBeLessThanOrEqual(2);
  await panel.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  publish('A message in another channel.', 'lounge');
  await expect(page.locator('.message')).toHaveCount(99);
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByRole('button', { name: /Jump to latest/ })).not.toBeVisible();

  publish('A new general message.');
  await expect(page.getByRole('log')).toContainText('A new general message.');
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByRole('button', { name: /New messages.*Jump to latest/ }).click();
  await expect.poll(() => distanceFromLatest(page)).toBeLessThanOrEqual(2);
  await expect(page.getByRole('button', { name: /Jump to latest/ })).not.toBeVisible();

  publish('Following the latest again.');
  await expect(page.getByRole('log')).toContainText('Following the latest again.');
  await expect.poll(() => distanceFromLatest(page)).toBeLessThanOrEqual(2);
});

test('People does not scroll when a chat message arrives and switching panels resets follow mode', async ({
  page,
}) => {
  const publish = await installChatFeed(page, 99);
  await page.getByRole('tab', { name: 'People', exact: true }).click();
  const panel = page.getByRole('tabpanel');
  expect(await panel.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await panel.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  publish('An update while looking at people.');
  await expect(page.locator('.mobile-workspace-tabs button').last()).toContainText('100');
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByRole('button', { name: /Jump to latest/ })).not.toBeVisible();
  await page.getByRole('tab', { name: '# General', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('An update while looking at people.');
  await expect.poll(() => distanceFromLatest(page)).toBeLessThanOrEqual(2);
  await page.getByRole('tab', { name: 'This room', exact: true }).click();
  await page.getByRole('button', { name: 'Go to Lounge', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('No messages yet');
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(0);
});

test('conversation tabs use one tab stop, wrapped arrow navigation and a focusable matching panel', async ({
  page,
}) => {
  await page.goto('/?mode=demo');
  const general = page.getByRole('tab', { name: '# General', exact: true });
  const room = page.getByRole('tab', { name: 'This room', exact: true });
  const people = page.getByRole('tab', { name: 'People', exact: true });
  await expect(general).toHaveAttribute('tabindex', '0');
  await expect(room).toHaveAttribute('tabindex', '-1');
  await expect(people).toHaveAttribute('tabindex', '-1');
  await general.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(people).toBeFocused();
  await expect(people).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(general).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(room).toBeFocused();
  await page.keyboard.press('End');
  await expect(people).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(general).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tabpanel')).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-general');
  await expect(general).toHaveAttribute('aria-controls', 'chat-content');
});

test('drafts stay with their channel when switching tabs and rooms', async ({ page }) => {
  await page.goto('/?mode=demo');
  await page.getByLabel('Message general', { exact: true }).fill('General draft');
  await page.getByRole('tab', { name: 'This room', exact: true }).click();
  await expect(page.getByLabel('Message studio', { exact: true })).toHaveValue('');
  await page.getByLabel('Message studio', { exact: true }).fill('Studio draft');
  await page.getByRole('button', { name: 'Go to Lounge', exact: true }).click();
  await expect(page.getByLabel('Message lounge', { exact: true })).toHaveValue('');
  await page.getByLabel('Message lounge', { exact: true }).fill('Lounge draft');
  await page.getByRole('tab', { name: '# General', exact: true }).click();
  await expect(page.getByLabel('Message general', { exact: true })).toHaveValue('General draft');
  await page.getByRole('tab', { name: 'This room', exact: true }).click();
  await expect(page.getByLabel('Message lounge', { exact: true })).toHaveValue('Lounge draft');
  await page.getByRole('button', { name: 'Go to Studio', exact: true }).click();
  await expect(page.getByLabel('Message studio', { exact: true })).toHaveValue('Studio draft');
});

test('a delayed acknowledgement cannot clear an identical draft in another channel', async ({
  page,
}) => {
  const acknowledge = await holdAcknowledgement(page);
  await page.getByLabel('Message general', { exact: true }).fill('Same words');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('button', { name: 'Send message' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await page.getByRole('tab', { name: 'This room', exact: true }).click();
  await page.getByLabel('Message studio', { exact: true }).fill('Same words');
  await acknowledge();
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await expect(page.getByLabel('Message studio', { exact: true })).toHaveValue('Same words');
  await page.getByRole('tab', { name: '# General', exact: true }).click();
  await expect(page.getByLabel('Message general', { exact: true })).toHaveValue('');
});

test('an acknowledgement preserves a draft edited back to the same words', async ({ page }) => {
  const acknowledge = await holdAcknowledgement(page);
  const composer = page.getByLabel('Message general', { exact: true });
  await composer.fill('Same words');
  await page.getByRole('button', { name: 'Send message' }).click();
  await composer.fill('Edited words');
  await composer.fill('Same words');
  await acknowledge();
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await expect(composer).toHaveValue('Same words');
});

test('opening mobile Conversations follows latest once and preserves history across hiding', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installChatFeed(page);
  await page.getByRole('button', { name: /^Conversations/ }).click();
  await expect.poll(() => distanceFromLatest(page)).toBeLessThanOrEqual(2);
  const panel = page.getByRole('tabpanel');
  await panel.evaluate((element) => {
    element.scrollTop = 160;
    element.dispatchEvent(new Event('scroll'));
  });
  await page
    .locator('.mobile-workspace-tabs')
    .getByRole('button', { name: 'Office', exact: true })
    .click();
  await page.getByRole('button', { name: /^Conversations/ }).click();
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(160);
});

test('moving an avatar does not reformat unchanged messages but a new message does', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tracked = window as Window & { chatTimestampFormatCount?: number };
    tracked.chatTimestampFormatCount = 0;
    const descriptor = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, 'format')!;
    Object.defineProperty(Intl.DateTimeFormat.prototype, 'format', {
      ...descriptor,
      get(this: Intl.DateTimeFormat) {
        const format: (value?: number | Date) => string = Reflect.apply(descriptor.get!, this, []);
        return (value?: number | Date) => {
          tracked.chatTimestampFormatCount = (tracked.chatTimestampFormatCount ?? 0) + 1;
          return format(value);
        };
      },
    });
  });
  const publish = await installChatFeed(page);
  const formatCount = () =>
    page.evaluate(
      () =>
        (window as Window & { chatTimestampFormatCount?: number }).chatTimestampFormatCount ?? 0,
    );
  const map = page.getByRole('group', { name: /Interactive office/ });
  const avatar = page.locator('.map-person.is-self');
  await map.focus();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const before = await formatCount();
  expect(before).toBeGreaterThanOrEqual(100);
  const position = await avatar.evaluate((element) =>
    parseFloat((element as HTMLElement).style.left),
  );
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(160);
  await page.keyboard.up('ArrowRight');
  await expect
    .poll(() => avatar.evaluate((element) => parseFloat((element as HTMLElement).style.left)))
    .toBeGreaterThan(position);
  expect(await formatCount()).toBe(before);

  publish('A new message invalidates the message list.');
  await expect(page.getByRole('log')).toContainText('A new message invalidates the message list.');
  expect(await formatCount()).toBeGreaterThan(before);
});
