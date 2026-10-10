import { expect, test } from '@playwright/test';

test('mobile workspace tabs name the Team or Office content they restore', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mode=demo');
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
  const navigation = page.locator('#workspace-nav');
  const tabs = page.locator('.mobile-workspace-tabs');
  const conversations = tabs.getByRole('button', { name: /^Conversations/ });

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await navigation.getByRole('button', { name: /^Team/ }).click();
  await conversations.click();
  await expect(page.getByRole('complementary', { name: 'Team conversations' })).toBeVisible();
  const team = tabs.getByRole('button', { name: 'Team', exact: true });
  await expect(team).toBeVisible();
  await team.click();
  await expect(team).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Workspace members', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await navigation.getByRole('button', { name: /^Office/ }).click();
  await conversations.click();
  const office = tabs.getByRole('button', { name: 'Office', exact: true });
  await expect(office).toBeVisible();
  await office.click();
  await expect(office).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: /Interactive office/ })).toBeVisible();
});
