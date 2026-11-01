import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The built game shell in each engine (#123 AC3, AC5). Every collector here
 * receives events asynchronously over the browser protocol, so each proves
 * it is alive with an event the test makes itself, and asserts absence only
 * after that event has arrived.
 */

const CONSOLE_SENTINEL = 'yawelo-idle smoke: console sentinel';
const ERROR_SENTINEL = 'yawelo-idle smoke: page error sentinel';
/** An address CSP's default-src 'self' refuses; never fetched. */
const FOREIGN_IMAGE = 'https://example.invalid/planted.png';
/** A script from another origin, which script-src refuses (#451 AC2). */
const FOREIGN_SCRIPT = 'https://example.invalid/planted.js';
/**
 * A script on the beacon's own host but outside its path: script-src admits
 * Cloudflare Web Analytics' beacon alone, never the whole host (#451 AC2).
 */
const NEIGHBOUR_SCRIPT = 'https://static.cloudflareinsights.com/planted.js';
/**
 * Cloudflare Web Analytics' real beacon as Cloudflare injects it, with a
 * version after `beacon.min.js/` (#451). It is fetched from Cloudflare, never
 * replaced by a copy (#819): with no token it sets `window.__cfBeacon` and sends nothing.
 * Cloudflare served this version with 200 on 2026-10-31.
 */
const BEACON =
  'https://static.cloudflareinsights.com/beacon.min.js/v8b253dfea2ab4077af8c6f58422dfbfd1689876627854';
/** Every address the CSP test plants; each must be refused. */
const PLANTED = [FOREIGN_IMAGE, FOREIGN_SCRIPT, NEIGHBOUR_SCRIPT] as const;
/** The axe rule an image with no text alternative breaks. */
const PLANTED_AXE_RULE = 'image-alt';
/** The planted image's id, so its finding is told from a real one. */
const PLANTED_AXE_ID = 'planted-axe';

interface Event {
  readonly kind: 'console' | 'pageerror';
  readonly type: string;
  readonly text: string;
}

test('the shell renders with no console errors or page errors', async ({
  page,
}) => {
  const events: Event[] = [];
  page.on('console', (message) => {
    events.push({
      kind: 'console',
      type: message.type(),
      text: message.text(),
    });
  });
  page.on('pageerror', (error) => {
    events.push({ kind: 'pageerror', type: 'error', text: error.message });
  });

  await page.goto('/play/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Yawelo Idle' }),
  ).toBeVisible();

  await page.evaluate(
    ([consoleText, errorText]) => {
      console.error(consoleText);
      setTimeout(() => {
        throw new Error(errorText);
      });
    },
    [CONSOLE_SENTINEL, ERROR_SENTINEL] as const,
  );
  await expect
    .poll(() =>
      [CONSOLE_SENTINEL, ERROR_SENTINEL].every((sentinel) =>
        events.some(({ text }) => text.includes(sentinel)),
      ),
    )
    .toBe(true);

  // Errors only: the count is the two sentinels this test raised, so it moves
  // only when something really errs, never because a browser update logs
  // one more harmless line.
  const errors = events.filter(({ type }) => type === 'error');
  const unplanned = errors.filter(
    ({ text }) =>
      !text.includes(CONSOLE_SENTINEL) && !text.includes(ERROR_SENTINEL),
  );
  expect(unplanned).toEqual([]);
});

test('the shell runs under its Content Security Policy with no violation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.defineProperty(window, '__violations', { value: seen });
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  const response = await page.goto('/play/');
  expect(response?.headers()['content-security-policy']).toContain(
    "default-src 'self'",
  );
  await expect(
    page.getByRole('heading', { level: 1, name: 'Yawelo Idle' }),
  ).toBeVisible();

  await page.evaluate(
    ([image, scripts]) => {
      const planted = document.createElement('img');
      planted.src = image;
      planted.alt = '';
      document.body.append(planted);
      document.body.append(
        ...scripts.map((src) =>
          Object.assign(document.createElement('script'), { src }),
        ),
      );
    },
    [FOREIGN_IMAGE, [FOREIGN_SCRIPT, NEIGHBOUR_SCRIPT]] as const,
  );
  const violations = (): Promise<string[]> =>
    page.evaluate(
      () => (window as unknown as { __violations: string[] }).__violations,
    );
  await expect
    .poll(async () => {
      const seen = await violations();
      return PLANTED.filter((url) => !seen.some((v) => v.includes(url)));
    })
    .toEqual([]);

  const seen = await violations();
  const unplanned = seen.filter((v) => !PLANTED.some((url) => v.includes(url)));
  expect(unplanned).toEqual([]);
});

test("the shell runs Cloudflare Web Analytics' real beacon (#451, #819)", async ({
  page,
}) => {
  const fetched = page.waitForResponse(BEACON);
  await page.goto('/play/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Yawelo Idle' }),
  ).toBeVisible();
  await page.evaluate((src) => {
    document.body.append(
      Object.assign(document.createElement('script'), { src }),
    );
  }, BEACON);
  // No fallback: if Cloudflare cannot be reached, the test fails here naming it.
  const response = await fetched;
  expect(response.status(), `Cloudflare served ${BEACON}`).toBe(200);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __cfBeacon?: { load?: string } }).__cfBeacon
            ?.load,
      ),
    )
    .toBe('single');
});

test('the shell has no axe violations', async ({ page }) => {
  await page.goto('/play/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Yawelo Idle' }),
  ).toBeVisible();
  // A planted violation proves axe ran and reports: an image with no text
  // alternative, inside the page's main landmark. Findings are counted per
  // element, not per rule, so a real image breaking the same rule is still
  // seen; the count is that one planted element whatever axe's version, and
  // any other element is a real finding.
  await page.evaluate((id) => {
    const image = document.createElement('img');
    image.id = id;
    image.src = '/play/';
    document.querySelector('main')?.append(image);
  }, PLANTED_AXE_ID);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const found = violations.flatMap(({ id, nodes }) =>
    nodes.map(({ target }) => `${id} ${target.join(' ')}`),
  );
  const planted = `${PLANTED_AXE_RULE} #${PLANTED_AXE_ID}`;
  expect(found).toContain(planted);
  const unplanned = found.filter((finding) => finding !== planted);
  expect(unplanned).toEqual([]);
});
