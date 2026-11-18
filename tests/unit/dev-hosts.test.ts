import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEV_DOORS,
  DEV_HOSTS,
  forward,
  handle,
  type DevHostsEnv,
} from '../../apps/dev-hosts/hosts';
import {
  DOOR_HOST_HEADER,
  DOOR_SECRET_HEADER,
  DOORS,
  type Fetch,
} from '../../apps/door/worker/door';

/**
 * The dev hostname adapter's logic (#429 AC1, #816, #784): which host reaches
 * which Worker, and how. Since DEV moved to the non-PROD account (#784,
 * Shyden 2026-11-16), the adapter (a Pages project left in Shyden Labs Dev)
 * can no longer reach the Workers by service binding, which works within one
 * account only. Each dev hostname now stands in for its front door: the
 * request goes on through the door's own code (apps/door/worker/door.ts) to
 * the Worker's workers.dev address, carrying the dev door secret and the
 * door's name, so the site still shows the holding page at dev. (#673).
 * `fetch` is mocked; the deployed adapter in front of the real Workers is
 * checked after each dev deploy by scripts/verify-dev-hosts.ts.
 */

const ENV: DevHostsEnv = {
  ORIGIN_DOMAIN: 'yawelo-idle-non-prod.workers.dev',
  DEV_DOOR_SECRET: 'the-dev-door-secret',
};

const answering = () =>
  vi.fn<Fetch>(() => Promise.resolve(new Response('origin', { status: 200 })));

describe('the dev hostnames', () => {
  it('are exactly the site’s, the sync API’s and the holding page’s dev copy (#429, #768)', () => {
    expect([...DEV_HOSTS]).toEqual([
      ['dev.yawelo-idle.shyden.co.uk', 'SITE'],
      ['dev-api.yawelo-idle.shyden.co.uk', 'SYNC'],
      ['dev-holding.yawelo-idle.shyden.co.uk', 'HOLDING'],
    ]);
  });

  it('each stand in for the dev door that reaches the same Worker (#784)', () => {
    expect(
      Object.entries(DEV_DOORS).map(([worker, door]) => [
        worker,
        door,
        DOORS.get(door),
      ]),
    ).toEqual([
      [
        'SITE',
        'dev.yaweloidle.com',
        { worker: 'yawelo-idle-site-dev', environment: 'dev' },
      ],
      [
        'SYNC',
        'dev-api.yaweloidle.com',
        { worker: 'yawelo-idle-sync-dev', environment: 'dev' },
      ],
      [
        'HOLDING',
        'dev-holding.yaweloidle.com',
        { worker: 'yawelo-idle-holding-dev', environment: 'dev' },
      ],
    ]);
  });
});

describe.each([...DEV_HOSTS])('%s', (host, worker) => {
  it(`passes the request to ${worker}’s workers.dev address through its door, once`, async () => {
    const fetch = answering();
    const response = await forward(
      new Request(`https://${host}/some/path?q=1`, {
        method: 'POST',
        body: 'payload',
        headers: { 'x-caller': 'kept', [DOOR_SECRET_HEADER]: 'forged' },
      }),
      ENV,
      fetch,
    );
    expect(await response.text()).toBe('origin');
    expect(fetch).toHaveBeenCalledOnce();
    const [[sent] = [new Request('https://nothing.invalid/')]] =
      fetch.mock.calls;
    const door = DEV_DOORS[worker];
    expect(sent.url).toBe(
      `https://${DOORS.get(door)?.worker ?? 'no-door'}.yawelo-idle-non-prod.workers.dev/some/path?q=1`,
    );
    expect(sent.method).toBe('POST');
    expect(await sent.text()).toBe('payload');
    expect(sent.redirect).toBe('manual');
    expect(sent.headers.get('x-caller')).toBe('kept');
    expect(sent.headers.get(DOOR_SECRET_HEADER)).toBe('the-dev-door-secret');
    expect(sent.headers.get(DOOR_HOST_HEADER)).toBe(door);
  });
});

describe.each(['ORIGIN_DOMAIN', 'DEV_DOOR_SECRET'] as const)(
  'a deploy that left %s unset',
  (name) => {
    it('answers 500 naming it, and reaches no Worker', async () => {
      const fetch = answering();
      const response = await forward(
        new Request('https://dev.yawelo-idle.shyden.co.uk/'),
        { ...ENV, [name]: '' },
        fetch,
      );
      expect(response.status).toBe(500);
      expect(await response.text()).toBe(`door not configured: ${name}`);
      expect(fetch).not.toHaveBeenCalled();
    });
  },
);

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
  ['dev.yaweloidle.com', 'a door’s own name'],
  ['constructor', 'a key every plain object inherits'],
];

describe.each(UNKNOWN_HOSTS)('%s (%s)', (host) => {
  it('answers 404, uncached, and reaches no Worker', async () => {
    const fetch = answering();
    const response = await forward(
      new Request(`https://${host}/play/?q=1`, { method: 'POST', body: 'x' }),
      ENV,
      fetch,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('not found');
    expect(fetch).not.toHaveBeenCalled();
  });
});

/**
 * The Function's handler (functions/[[path]].ts re-exports it as onRequest):
 * the Pages context's request and env, sent on with the runtime's own fetch.
 */
describe('handle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards the context’s request with the context’s env, through the global fetch', async () => {
    const fetch = answering();
    vi.stubGlobal('fetch', fetch);
    const response = await handle({
      request: new Request('https://dev-api.yawelo-idle.shyden.co.uk/health'),
      env: ENV,
    });
    expect(await response.text()).toBe('origin');
    const [[sent] = [new Request('https://nothing.invalid/')]] =
      fetch.mock.calls;
    expect(sent.url).toBe(
      'https://yawelo-idle-sync-dev.yawelo-idle-non-prod.workers.dev/health',
    );
    expect(sent.headers.get(DOOR_SECRET_HEADER)).toBe('the-dev-door-secret');
  });
});
