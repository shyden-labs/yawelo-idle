import { expect, test, type Page } from '@playwright/test';
import { COPY } from '../../apps/site/src/copy';
import type { Locale } from '../../apps/site/src/i18n';
import { SITE_DOOR } from '../../apps/site/worker/routes';
import { supportPolicy } from '../../apps/site/worker/support';

/**
 * The support pages on dev (#860), through the dev front door: the only dev
 * origin ShyDesk allows its piece on (relayed by shydesk-b1, 2026-11-22).
 * ShyDesk's piece is loaded from ShyDesk's own dev host and talks straight to
 * it; Yawelo Idle forwards nothing (Shyden, 2026-11-22). Real clicks only
 * (global real-tests rule).
 */
const DOOR = `https://${SITE_DOOR}`;
const SHYDESK_DEV = 'https://shydesk.shydesk-non-prod.workers.dev';
const TURNSTILE = 'https://challenges.cloudflare.com';
/**
 * Cloudflare Web Analytics' beacon, which Cloudflare injects on every page:
 * the site-wide exception (website spec W17; measured on dev 2026-11-23,
 * deploy run 45069145980). It reports to the page's own origin.
 */
const BEACON = 'https://static.cloudflareinsights.com';
const ALLOWED = [DOOR, SHYDESK_DEV, TURNSTILE, BEACON];
/** A made-up token: the ticket view opens and says what it says about it. */
const TOKEN = '#t=not-a-real-ticket';

/** Every origin the page reaches, and every policy refusal the browser reports. */
function watch(page: Page): { origins: Set<string>; refusals: string[] } {
  const origins = new Set<string>();
  const refusals: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'https:' || url.protocol === 'http:')
      origins.add(url.origin);
  });
  page.on('console', (message) => {
    if (/content.security.policy|refused to/i.test(message.text()))
      refusals.push(message.text());
  });
  return { origins, refusals };
}

/**
 * ShyDesk's piece, drawn: its Email field, found by its label inside the
 * piece's open shadow root (relayed by shydesk-b1, 2026-11-22: ShyDesk's own
 * e2e finds its controls by label).
 */
const pieceField = (page: Page) =>
  page.locator('shydesk-support').getByLabel('Email');

const contactPage = (locale: Locale, path: string) => {
  test(`the ${locale} support page: ShyDesk’s form from ShyDesk’s host, the page’s words and policy, and no other host reached (#860 AC1, AC5, AC6)`, async ({
    page,
  }) => {
    const seen = watch(page);
    const response = await page.goto(`${DOOR}${path}`);
    expect(response?.status(), 'the support page').toBe(200);
    expect(response?.headers()['content-security-policy']).toBe(
      supportPolicy(SHYDESK_DEV),
    );
    await expect(page.locator('h1')).toHaveText(COPY[locale].titles.support);
    await expect(page.locator('[data-support-intro]')).toHaveText(
      COPY[locale].support.intro,
    );
    const piece = page.locator('shydesk-support');
    await expect(piece).toHaveAttribute('product', 'yawelo-idle');
    await expect(piece).toHaveAttribute('view', 'contact');
    await expect(piece).toHaveAttribute('lang', locale);
    await expect(pieceField(page), 'ShyDesk’s form, drawn').toBeVisible();
    await expect(page.locator('[data-support-failed]')).toBeHidden();
    expect([...seen.origins].filter((o) => !ALLOWED.includes(o))).toEqual([]);
    expect(seen.origins.has(SHYDESK_DEV), 'ShyDesk’s host reached').toBe(true);
    expect(seen.refusals).toEqual([]);
  });
};

contactPage('en', '/support');
contactPage('id', '/id/support');

test.describe('a browser preferring Indonesian', () => {
  test.use({ locale: 'id-ID' });

  test('opens the email’s ticket link on the Indonesian ticket page, keeps the token through the language switch, and is not sent back (#860 AC1, AC4)', async ({
    page,
  }) => {
    const seen = watch(page);
    await page.goto(`${DOOR}/support/ticket${TOKEN}`);
    await expect(page).toHaveURL(`${DOOR}/id/support/ticket${TOKEN}`);
    await expect(page.locator('h1')).toHaveText(COPY.id.titles.supportTicket);
    await expect(page.locator('[data-support-intro]')).toHaveText(
      COPY.id.support.ticketIntro,
    );
    const piece = page.locator('shydesk-support');
    await expect(piece).toHaveAttribute('view', 'ticket');
    await expect(piece).toHaveAttribute('lang', 'id');
    await expect(page.locator('[data-support-failed]')).toBeHidden();
    await page.locator('[data-language-switch]').click();
    await expect(page).toHaveURL(`${DOOR}/support/ticket${TOKEN}`);
    await expect(page.locator('shydesk-support')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText(COPY.en.titles.supportTicket);
    expect([...seen.origins].filter((o) => !ALLOWED.includes(o))).toEqual([]);
    expect(seen.refusals).toEqual([]);
  });
});

test.describe('a browser preferring English', () => {
  test.use({ locale: 'en-GB' });

  test('opens the email’s ticket link on the English ticket page and keeps the token through the language switch (#860 AC1, AC4)', async ({
    page,
  }) => {
    const seen = watch(page);
    const response = await page.goto(`${DOOR}/support/ticket${TOKEN}`);
    await expect(page).toHaveURL(`${DOOR}/support/ticket${TOKEN}`);
    await expect(page.locator('h1')).toHaveText(COPY.en.titles.supportTicket);
    expect(response?.headers()['content-security-policy']).toBe(
      supportPolicy(SHYDESK_DEV),
    );
    await expect(page.locator('[data-support-intro]')).toHaveText(
      COPY.en.support.ticketIntro,
    );
    await expect(page.locator('shydesk-support')).toHaveAttribute(
      'view',
      'ticket',
    );
    await page.locator('[data-language-switch]').click();
    await expect(page).toHaveURL(`${DOOR}/id/support/ticket${TOKEN}`);
    await expect(page.locator('shydesk-support')).toHaveAttribute('lang', 'id');
    expect([...seen.origins].filter((o) => !ALLOWED.includes(o))).toEqual([]);
    expect(seen.refusals).toEqual([]);
  });
});
