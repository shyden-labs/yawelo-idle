import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { describePlatformContract } from '../contract/index';
import { createWebPlatform, webPlatform } from '../src/web';
import { standIn } from './web-host';

/**
 * The web implementation (#124 AC1, AC2, AC4), over a stood-in browser
 * (test/web-host.ts).
 */

describePlatformContract('the web platform', () => {
  const { host, driver } = standIn({ share: () => Promise.resolve() });
  return { platform: createWebPlatform(host), driver };
});

describe('the web platform’s storage is IndexedDB (#124 AC1)', () => {
  it('a second platform on the same browser reads what the first stored, as a reload would', async () => {
    const indexedDB = new IDBFactory();
    const first = createWebPlatform(standIn({ indexedDB }).host);
    await first.storage.set('save', new Uint8Array([7, 8, 9]));
    const second = createWebPlatform(standIn({ indexedDB }).host);
    expect(await second.storage.get('save')).toEqual(new Uint8Array([7, 8, 9]));
  });

  it('keeps its data in the yawelo-idle database', async () => {
    const indexedDB = new IDBFactory();
    await createWebPlatform(standIn({ indexedDB }).host).storage.set(
      'save',
      new Uint8Array([1]),
    );
    const names = (await indexedDB.databases()).map(({ name }) => name);
    expect(names).toEqual(['yawelo-idle']);
  });
});

describe('the web platform’s entitlements (#124 AC1)', () => {
  it('unlock regions 1 and 2', () => {
    expect(createWebPlatform(standIn().host).entitlements.regions()).toEqual([
      1, 2,
    ]);
  });
});

describe('the web platform says what it cannot do (#124 AC1)', () => {
  const platform = () => createWebPlatform(standIn().host);

  it('scheduling a notification', async () => {
    expect(
      await platform().notifications.schedule({
        id: 'n',
        title: 't',
        body: 'b',
        atMs: 0,
      }),
    ).toEqual({
      done: false,
      reason: 'the web build sends no notifications',
    });
  });

  it('cancelling a notification', async () => {
    expect(await platform().notifications.cancel('n')).toEqual({
      done: false,
      reason: 'the web build sends no notifications',
    });
  });

  it('unlocking an achievement', async () => {
    expect(await platform().achievements.unlock('a')).toEqual({
      done: false,
      reason: 'the web build has no achievements',
    });
  });

  it('a haptic pulse', () => {
    expect(platform().haptics.pulse('light')).toEqual({
      done: false,
      reason: 'the web build has no haptics',
    });
  });
});

describe('the web platform shares through the browser (#124 AC1)', () => {
  const request = {
    title: 'Yawelo Idle',
    text: 'A word learned today.',
    url: 'https://yawelo-idle.shyden.co.uk/',
  };

  it('hands the request to navigator.share and reports it done', async () => {
    const browser = standIn({ share: () => Promise.resolve() });
    expect(await createWebPlatform(browser.host).share.share(request)).toEqual({
      done: true,
    });
    expect(browser.shared).toEqual([request]);
  });

  it('says so when the browser cannot share', async () => {
    expect(
      await createWebPlatform(standIn().host).share.share(request),
    ).toEqual({ done: false, reason: 'this browser cannot share' });
  });

  it('says so when the player closes the share sheet', async () => {
    const browser = standIn({
      share: () =>
        Promise.reject(new DOMException('Share canceled', 'AbortError')),
    });
    expect(await createWebPlatform(browser.host).share.share(request)).toEqual({
      done: false,
      reason: 'the player closed the share sheet',
    });
  });

  it('passes on any other failure', async () => {
    const browser = standIn({
      share: () =>
        Promise.reject(new DOMException('Not allowed', 'NotAllowedError')),
    });
    await expect(
      createWebPlatform(browser.host).share.share(request),
    ).rejects.toThrow('Not allowed');
  });
});

describe('the web platform’s lifecycle (#124 AC4)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delivers nothing when the page is shown while already visible', () => {
    const browser = standIn();
    const seen: boolean[] = [];
    createWebPlatform(browser.host).lifecycle.onVisibility((visible) => {
      seen.push(visible);
    });
    browser.driver.show();
    expect(seen).toEqual([]);
  });

  it('keeps no timer, before or after the page is hidden', () => {
    vi.useFakeTimers();
    const browser = standIn();
    const platform = createWebPlatform(browser.host);
    platform.lifecycle.onVisibility(() => undefined);
    platform.lifecycle.onPageHide(() => undefined);
    expect(vi.getTimerCount()).toBe(0);
    browser.driver.hide();
    browser.driver.pageHide();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('webPlatform() runs over the browser’s own globals (#124 AC1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores in the global IndexedDB and hears the global document and window', async () => {
    const browser = standIn();
    vi.stubGlobal('indexedDB', browser.host.indexedDB);
    vi.stubGlobal('document', browser.host.document);
    vi.stubGlobal('window', browser.host.window);
    vi.stubGlobal('navigator', browser.host.navigator);
    const platform = webPlatform();
    await platform.storage.set('save', new Uint8Array([3]));
    const seen: string[] = [];
    platform.lifecycle.onVisibility((visible) => {
      seen.push(visible ? 'shown' : 'hidden');
    });
    platform.lifecycle.onPageHide(() => {
      seen.push('page hide');
    });
    browser.driver.hide();
    browser.driver.pageHide();
    const direct = createWebPlatform(browser.host);
    expect(await direct.storage.get('save')).toEqual(new Uint8Array([3]));
    expect(seen).toEqual(['hidden', 'page hide']);
    expect(
      await platform.share.share({ title: 't', text: 't', url: 'u' }),
    ).toEqual({
      done: false,
      reason: 'this browser cannot share',
    });
  });
});
