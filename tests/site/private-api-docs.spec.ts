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

test('the docs load from the site’s own origin, list the health report and the webhook, and “Try it out” shows the report’s 200 and the webhook’s 401', async ({
  page,
  hasTouch,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto(DOCS);
  await expect(
    page.getByRole('heading', { name: /Yawelo Idle private operations API/ }),
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect.soft(requested.length).toBeGreaterThan(0);
  expect
    .soft(requested.filter((url) => new URL(url).origin !== origin))
    .toEqual([]);

  await expect
    .soft(page.locator('.opblock-summary-path'))
    .toHaveText(['/api/roadmap/health', '/hooks/github']);

  const health = page.locator('#operations-default-getRoadmapHealth');
  await press(health.locator('.opblock-summary-control'), hasTouch);
  await press(health.getByRole('button', { name: 'Try it out' }), hasTouch);
  const report = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/roadmap/health',
  );
  await press(health.getByRole('button', { name: 'Execute' }), hasTouch);
  expect.soft((await report).status()).toBe(200);
  await expect
    .soft(health.locator('.live-responses-table tbody .response-col_status'))
    .toHaveText('200');

  // The webhook answers 401, since no browser holds the secret.
  const webhook = page.locator('#operations-default-postGitHubWebhook');
  await press(webhook.locator('.opblock-summary-control'), hasTouch);
  await press(webhook.getByRole('button', { name: 'Try it out' }), hasTouch);
  const signature = webhook.locator(
    'tr[data-param-name="X-Hub-Signature-256"] input',
  );
  await press(signature, hasTouch);
  await signature.pressSequentially(`sha256=${'0'.repeat(64)}`);
  const refused = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/hooks/github',
  );
  await press(webhook.getByRole('button', { name: 'Execute' }), hasTouch);
  expect.soft((await refused).status()).toBe(401);
  await expect
    .soft(webhook.locator('.live-responses-table tbody .response-col_status'))
    .toHaveText('401');
});
