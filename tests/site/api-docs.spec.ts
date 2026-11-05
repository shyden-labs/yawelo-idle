import { expect, test } from '@playwright/test';
import { press } from '../press';

/**
 * The roadmap API docs on dev (#588): Swagger UI, served from the site's own
 * origin, renders the hand-written spec, and "Try it out" calls the real
 * data file on the same origin. Real clicks only (global real-tests rule).
 */

test('loads every request from the site’s own origin', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto('/api/docs');
  await expect(
    page.getByRole('heading', { name: /Yawelo Idle roadmap API/ }),
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.filter((url) => new URL(url).origin !== origin)).toEqual([]);
});

test('lists both public operations', async ({ page }) => {
  await page.goto('/api/docs');
  await expect(page.locator('.opblock-summary-path')).toHaveText([
    '/api/roadmap.json',
    '/api/roadmap/live',
  ]);
});

test('“Try it out” reads the data file and shows its 200', async ({
  page,
  hasTouch,
}) => {
  await page.goto('/api/docs');
  const operation = page.locator('#operations-default-getRoadmapSnapshot');
  await press(operation.locator('.opblock-summary-control'), hasTouch);
  await press(operation.getByRole('button', { name: 'Try it out' }), hasTouch);
  const answered = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/roadmap.json',
  );
  await press(operation.getByRole('button', { name: 'Execute' }), hasTouch);
  expect((await answered).status()).toBe(200);
  await expect(
    operation.locator('.live-responses-table tbody .response-col_status'),
  ).toHaveText('200');
});
