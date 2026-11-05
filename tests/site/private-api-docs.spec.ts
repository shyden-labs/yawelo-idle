import { expect, test } from '@playwright/test';
import { press } from '../press';

/**
 * The private API docs on dev (#589; Shyden, 2026-11-04: "Dev only, dev
 * password"): Swagger UI, served from the site's own origin, renders the
 * private spec, and "Try it out" calls the real health report and the real
 * webhook on the same origin. Real clicks and key presses only (global
 * real-tests rule).
 */
const DOCS = '/api/private/docs';

test('loads every request from the site’s own origin', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto(DOCS);
  await expect(
    page.getByRole('heading', { name: /Yawelo Idle private operations API/ }),
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.filter((url) => new URL(url).origin !== origin)).toEqual([]);
});

test('lists the health report and the webhook', async ({ page }) => {
  await page.goto(DOCS);
  await expect(page.locator('.opblock-summary-path')).toHaveText([
    '/api/roadmap/health',
    '/hooks/github',
  ]);
});

test('“Try it out” reads the health report and shows its 200', async ({
  page,
  hasTouch,
}) => {
  await page.goto(DOCS);
  const operation = page.locator('#operations-default-getRoadmapHealth');
  await press(operation.locator('.opblock-summary-control'), hasTouch);
  await press(operation.getByRole('button', { name: 'Try it out' }), hasTouch);
  const answered = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/roadmap/health',
  );
  await press(operation.getByRole('button', { name: 'Execute' }), hasTouch);
  expect((await answered).status()).toBe(200);
  await expect(
    operation.locator('.live-responses-table tbody .response-col_status'),
  ).toHaveText('200');
});

test('“Try it out” on the webhook shows its 401, since no browser holds the secret', async ({
  page,
  hasTouch,
}) => {
  await page.goto(DOCS);
  const operation = page.locator('#operations-default-postGitHubWebhook');
  await press(operation.locator('.opblock-summary-control'), hasTouch);
  await press(operation.getByRole('button', { name: 'Try it out' }), hasTouch);
  const signature = operation.locator(
    'tr[data-param-name="X-Hub-Signature-256"] input',
  );
  await press(signature, hasTouch);
  await signature.pressSequentially(`sha256=${'0'.repeat(64)}`);
  const answered = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/hooks/github',
  );
  await press(operation.getByRole('button', { name: 'Execute' }), hasTouch);
  expect((await answered).status()).toBe(401);
  await expect(
    operation.locator('.live-responses-table tbody .response-col_status'),
  ).toHaveText('401');
});
