import { describe, expect, it, vi } from 'vitest';
import {
  DEV_HOSTS,
  forward,
  type DevBinding,
  type Forward,
} from '../../apps/dev-hosts/hosts';

/**
 * The dev hostname adapter's logic (#429 AC1, #816), with each service
 * binding mocked: which host reaches which Worker, that the request goes on
 * unchanged, and that any other host is kept. The deployed adapter in front
 * of the real dev Workers is checked after each dev deploy by
 * scripts/verify-dev-hosts.ts.
 */

/** A mocked binding for each Worker, each answering with its own name. */
function bindings(): Record<DevBinding, ReturnType<typeof bindingFetch>> {
  return {
    SITE: bindingFetch('SITE'),
    SYNC: bindingFetch('SYNC'),
    HOLDING: bindingFetch('HOLDING'),
  };
}

const bindingFetch = (who: DevBinding) =>
  vi.fn<Forward['fetch']>(() => new Response(who, { status: 200 }));

const asEnv = (
  mocks: Record<DevBinding, ReturnType<typeof bindingFetch>>,
): Record<DevBinding, Forward> => ({
  SITE: { fetch: mocks.SITE },
  SYNC: { fetch: mocks.SYNC },
  HOLDING: { fetch: mocks.HOLDING },
});

describe('the dev hostnames', () => {
  it('are exactly the site’s, the sync API’s and the holding page’s dev copy, each with its binding (#429, #768)', () => {
    expect([...DEV_HOSTS]).toEqual([
      ['dev.yawelo-idle.shyden.co.uk', 'SITE'],
      ['dev-api.yawelo-idle.shyden.co.uk', 'SYNC'],
      ['dev-holding.yawelo-idle.shyden.co.uk', 'HOLDING'],
    ]);
  });
});

describe.each([...DEV_HOSTS])('%s', (host, binding) => {
  it(`hands ${binding} the very request, and nothing to the others`, async () => {
    const mocks = bindings();
    const request = new Request(`https://${host}/some/path?q=1`, {
      method: 'POST',
      body: 'payload',
    });
    const response = await forward(request, asEnv(mocks));
    expect(await response.text()).toBe(binding);
    expect(mocks[binding]).toHaveBeenCalledExactlyOnceWith(request);
    for (const other of Object.keys(mocks) as DevBinding[]) {
      // one scenario: every binding but the host's own stays untouched
      if (other !== binding) expect(mocks[other]).not.toHaveBeenCalled();
    }
  });
});

/**
 * Hosts the adapter must keep to itself. Its own pages.dev name and every
 * preview deployment's are public (#429 comment, 2026-10-06 07:57).
 */
const UNKNOWN_HOSTS: readonly [host: string, why: string][] = [
  ['yawelo-idle-dev-hosts.pages.dev', 'the project’s own address'],
  ['a1b2c3d4.yawelo-idle-dev-hosts.pages.dev', 'a preview deployment'],
  ['yawelo-idle.shyden.co.uk', 'production’s name'],
  ['api.yawelo-idle.shyden.co.uk', 'production’s API name'],
  ['dev.yawelo-idle.shyden.co.uk.evil.example', 'a dev name as a prefix'],
  ['evil-dev.yawelo-idle.shyden.co.uk', 'a dev name as a suffix'],
  ['constructor', 'a key every plain object inherits'],
];

describe.each(UNKNOWN_HOSTS)('%s (%s)', (host) => {
  it('answers 404, uncached, and reaches no Worker', async () => {
    const mocks = bindings();
    const response = await forward(
      new Request(`https://${host}/play/?q=1`, { method: 'POST', body: 'x' }),
      asEnv(mocks),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('not found');
    expect(mocks.SITE).not.toHaveBeenCalled();
    expect(mocks.SYNC).not.toHaveBeenCalled();
    expect(mocks.HOLDING).not.toHaveBeenCalled();
  });
});
