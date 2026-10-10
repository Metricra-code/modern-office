import { expect, test } from '@playwright/test';

for (const mode of ['demo', 'live'] as const) {
  test(`${mode} startup prefetch waits for the requested workspace context`, async ({ page }) => {
    test.skip(
      !process.env.PLAYWRIGHT_BASE_URL,
      'Next Link prefetch is production-only; run against built Cloudflare or the public URL.',
    );
    const workspace = `prefetch-${mode}-${Date.now()}`;
    let requests: URL[] = [];
    let notesPrefetchStatuses: number[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'fetch') requests = [...requests, new URL(request.url())];
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (
        response.request().resourceType() === 'fetch' &&
        response.request().method() === 'GET' &&
        url.pathname.startsWith('/case-study/') &&
        url.searchParams.has('_rsc') &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === mode
      )
        notesPrefetchStatuses = [...notesPrefetchStatuses, response.status()];
    });
    const stalePrefetches = () =>
      requests
        .filter(
          (url) =>
            url.searchParams.get('workspace') === 'studio-team' &&
            url.searchParams.get('mode') === 'demo',
        )
        .map((url) => url.href);

    await page.goto(`/?workspace=${workspace}&mode=${mode}`);
    await expect(page.locator('.app-shell')).toHaveAttribute('aria-busy', 'false');
    const notes = page.locator('#workspace-nav').getByRole('link', { name: 'Engineering notes' });
    await expect(notes).toHaveAttribute('href', `/case-study/?workspace=${workspace}&mode=${mode}`);
    // Observe a successful background request before clicking: disabling all prefetch cannot pass.
    await expect
      .poll(() => notesPrefetchStatuses, {
        message: 'The correct-context notes route must prefetch before navigation.',
        timeout: 15000,
      })
      .toContain(200);
    expect(stalePrefetches()).toEqual([]);

    await notes.click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/case-study/' &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === mode,
    );
    await page.getByRole('link', { name: 'Back to the office' }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/' &&
        url.searchParams.get('workspace') === workspace &&
        url.searchParams.get('mode') === mode,
    );
    await expect(
      page.getByText(mode === 'demo' ? 'Demo workspace' : 'Live workspace', { exact: true }),
    ).toBeVisible();
    expect(stalePrefetches()).toEqual([]);
  });
}
