// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The support pages' own script (#860): the "did not load" line when
 * ShyDesk's piece never defined its element, and the ticket's `#t=` token
 * kept on the language switch. Loaded fresh into a page like the built one.
 */
const PAGE = `
  <nav><a href="/id/support/ticket" hreflang="id" lang="id" data-language-switch>Bahasa Indonesia</a></nav>
  <shydesk-support product="yawelo-idle" view="ticket" lang="en"></shydesk-support>
  <p data-support-failed hidden>The support form did not load.</p>`;

const failed = () =>
  document.querySelector<HTMLElement>('[data-support-failed]');
const switchLink = () =>
  document.querySelector<HTMLAnchorElement>('a[data-language-switch]');

const load = async (): Promise<void> => {
  vi.resetModules();
  await import('./page');
};

beforeEach(() => {
  document.body.innerHTML = PAGE;
  window.history.replaceState(null, '', '/support/ticket');
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('the support page script (#860)', () => {
  it('shows the "did not load" line when the piece never defined its element', async () => {
    await load();
    window.dispatchEvent(new Event('load'));
    expect(failed()?.hidden).toBe(false);
  });

  it('keeps the line hidden when the piece defined its element', async () => {
    if (customElements.get('shydesk-support') === undefined)
      customElements.define('shydesk-support', class extends HTMLElement {});
    await load();
    window.dispatchEvent(new Event('load'));
    expect(failed()?.hidden).toBe(true);
  });

  it('keeps the ticket token on the language switch when the page opens', async () => {
    window.history.replaceState(null, '', '/support/ticket#t=abc');
    await load();
    expect(switchLink()?.getAttribute('href')).toBe(
      `${window.location.origin}/id/support/ticket#t=abc`,
    );
  });

  it('follows a token that arrives after the page opened', async () => {
    await load();
    window.location.hash = '#t=later';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(switchLink()?.getAttribute('href')).toBe(
      `${window.location.origin}/id/support/ticket#t=later`,
    );
  });

  it('leaves no empty fragment on the link without a token', async () => {
    await load();
    expect(switchLink()?.getAttribute('href')).toBe(
      `${window.location.origin}/id/support/ticket`,
    );
  });

  it('runs on a page with no switch and no failed line', async () => {
    document.body.innerHTML = '<p>nothing</p>';
    await load();
    window.dispatchEvent(new Event('load'));
    expect(document.body.innerHTML).toBe('<p>nothing</p>');
  });
});
