import { expect, test } from '@playwright/test';
import { press } from '../press';

/**
 * The roadmap API docs on dev (#588): Swagger UI, served from the site's own
 * origin, renders the hand-written spec, and "Try it out" calls the real
 * data file on the same origin. Real clicks only (global real-tests rule).
 */

test('the docs load from the site’s own origin, list both public operations, and “Try it out” shows the data file’s 200', async ({
  page,
  hasTouch,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto('/api/docs');
  await expect(
    page.getByRole('heading', { name: /Yawelo Idle roadmap API/ }),
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect.soft(requested.length).toBeGreaterThan(0);
  expect
    .soft(requested.filter((url) => new URL(url).origin !== origin))
    .toEqual([]);

  await expect
    .soft(page.locator('.opblock-summary-path'))
    .toHaveText(['/api/roadmap.json', '/api/roadmap/live']);

  const operation = page.locator('#operations-default-getRoadmapSnapshot');
  await press(operation.locator('.opblock-summary-control'), hasTouch);
  await press(operation.getByRole('button', { name: 'Try it out' }), hasTouch);
  const answered = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/roadmap.json',
  );
  await press(operation.getByRole('button', { name: 'Execute' }), hasTouch);
  expect.soft((await answered).status()).toBe(200);
  await expect
    .soft(operation.locator('.live-responses-table tbody .response-col_status'))
    .toHaveText('200');
});
