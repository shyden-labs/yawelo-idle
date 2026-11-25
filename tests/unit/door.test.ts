import { join } from 'node:path';
import type { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { readDeployConfig } from './wrangler-configs';

const ROOT = new URL('../../', import.meta.url).pathname;
import {
  DOOR_CLIENT_HEADER,
  DOOR_HOST_HEADER,
  DOOR_SECRET_HEADER,
  DOORS,
  pass,
  type DoorEnv,
  type Fetch,
} from '../../apps/door/worker/door';
import {
  PASS_COOKIE,
  PASS_HEADER,
  SIGNIN_ORIGIN,
} from '../../apps/door/worker/dev-pass/door';
import {
  LIFETIME_SECONDS,
  mintPass,
  type SigningKey,
} from '../../apps/door/worker/dev-pass/pass';

/**
 * The front door's logic (#784 AC4), with the outbound fetch mocked: which
 * door reaches which origin, that the request goes on whole with its
 * environment's door secret, that a caller cannot forge the secret or the
 * door's name, that a WebSocket upgrade passes through, and that any other
 * host is kept. Door hosts are read from DOORS, never written out here: a
 * guard over tests/ will refuse a door address (#784 AC1b).
 */

/** The DEV pass signing key (#1078); the door gets its public half. */
const PAIR = (await crypto.subtle.generateKey('Ed25519', true, [
  'sign',
  'verify',
])) as webcrypto.CryptoKeyPair;
const KEY: SigningKey = { kid: 'k1', privateKey: PAIR.privateKey };
const PUBLIC_X = (await crypto.subtle.exportKey('jwk', PAIR.publicKey)).x;

const ENV: DoorEnv = {
  ORIGIN_DOMAIN: 'origins.example.workers.dev',
  DEV_DOOR_SECRET: 'dev-secret',
  TEST_DOOR_SECRET: 'test-secret',
  DEV_PASS_KEYS: JSON.stringify({ k1: PUBLIC_X }),
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** A DEV pass for `aud`, minted `now`. */
const passFor = (aud: string, now = nowSeconds()): Promise<string> =>
  mintPass({ aud, sub: 'tester@example.com', kind: 'machine' }, KEY, now);

/** `request`, carrying a valid DEV pass when its host is a dev door. */
async function withPass(request: Request): Promise<Request> {
  const host = new URL(request.url).hostname;
  if (DOORS.get(host)?.environment !== 'dev') return request;
  const headers = new Headers(request.headers);
  headers.set(PASS_HEADER, await passFor(host));
  return new Request(request, { headers });
}

/** `pass`, for a caller holding a valid DEV pass (#784's tests, before #1078). */
const through = async (
  request: Request,
  env: DoorEnv,
  fetch: Fetch,
): Promise<Response> => pass(await withPass(request), env, fetch);

const doorHost = (worker: string): string => {
  const found = [...DOORS].find(([, door]) => door.worker === worker);
  if (found === undefined) throw new Error(`no door for ${worker}`);
  return found[0];
};

const SITE_DEV = doorHost('yawelo-idle-site-dev');
const SYNC_DEV = doorHost('yawelo-idle-sync-dev');
const DEV_DOORS = [...DOORS]
  .filter(([, door]) => door.environment === 'dev')
  .map(([host]) => host);
const HOLDING_TEST = doorHost('yawelo-idle-holding-test');

/** A mocked outbound fetch answering 200, and the request it was handed. */
function origin(response: Response = new Response('origin')) {
  const fetch = vi.fn<Fetch>(() => Promise.resolve(response));
  const sent = (): Request => {
    const call = fetch.mock.calls[0];
    if (call === undefined) throw new Error('nothing was forwarded');
    return call[0];
  };
  return { fetch, sent };
}

describe('the doors (#784)', () => {
  it('are exactly the dev site, dev API, dev holding page and the TEST holding page, each on yaweloidle.com with its Worker and environment', () => {
    expect(
      [...DOORS].map(([host, door]) => [
        host.split('.')[0],
        host.split('.').slice(1).join('.'),
        door.worker,
        door.environment,
      ]),
    ).toEqual([
      ['dev', 'yaweloidle.com', 'yawelo-idle-site-dev', 'dev'],
      ['dev-api', 'yaweloidle.com', 'yawelo-idle-sync-dev', 'dev'],
      ['dev-holding', 'yaweloidle.com', 'yawelo-idle-holding-dev', 'dev'],
      ['test', 'yaweloidle.com', 'yawelo-idle-holding-test', 'test'],
    ]);
  });

  // TEST holds what production deploys (#784, #1021): the test door reaches
  // the Worker deploy-test.yml deploys, and moves with it.
  it('send test.yaweloidle.com to the Worker TEST deploys (#1021)', () => {
    const test = [...DOORS].find(([host]) => host === 'test.yaweloidle.com');
    expect(test?.[1].worker).toBe(
      readDeployConfig(join(ROOT, 'apps/site/holding-test/wrangler.jsonc'))
        .name,
    );
  });
});

describe('a request to a door (#784 AC4)', () => {
  it('goes to its Worker’s workers.dev address over https, path and query kept', async () => {
    const { fetch, sent } = origin();
    await through(new Request(`http://${SITE_DEV}/play/x?a=1&b=2`), ENV, fetch);
    expect(sent().url).toBe(
      'https://yawelo-idle-site-dev.origins.example.workers.dev/play/x?a=1&b=2',
    );
  });

  it('drops a port the caller named, since the origin answers on https’s own', async () => {
    const { fetch, sent } = origin();
    await through(new Request(`https://${SITE_DEV}:8443/`), ENV, fetch);
    expect(sent().url).toBe(
      'https://yawelo-idle-site-dev.origins.example.workers.dev/',
    );
  });

  it('keeps the method, headers and body', async () => {
    const { fetch, sent } = origin();
    await through(
      new Request(`https://${SITE_DEV}/hooks/github`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub': 'sig' },
        body: '{"a":1}',
      }),
      ENV,
      fetch,
    );
    expect(sent().method).toBe('POST');
    expect(sent().headers.get('content-type')).toBe('application/json');
    expect(sent().headers.get('x-hub')).toBe('sig');
    expect(await sent().text()).toBe('{"a":1}');
  });

  it('carries the dev door secret from a dev door', async () => {
    const { fetch, sent } = origin();
    await through(new Request(`https://${SITE_DEV}/`), ENV, fetch);
    expect(sent().headers.get(DOOR_SECRET_HEADER)).toBe('dev-secret');
  });

  it('carries the test door secret from the test door', async () => {
    const { fetch, sent } = origin();
    await through(new Request(`https://${HOLDING_TEST}/`), ENV, fetch);
    expect(sent().headers.get(DOOR_SECRET_HEADER)).toBe('test-secret');
  });

  it('names the door it came through', async () => {
    const { fetch, sent } = origin();
    await through(new Request(`https://${SITE_DEV}/`), ENV, fetch);
    expect(sent().headers.get(DOOR_HOST_HEADER)).toBe(SITE_DEV);
  });

  it('names the caller’s address, as Cloudflare gave it to the door (#164 AC2)', async () => {
    const { fetch, sent } = origin();
    await through(
      new Request(`https://${SITE_DEV}/`, {
        headers: { 'cf-connecting-ip': '203.0.113.7' },
      }),
      ENV,
      fetch,
    );
    expect(sent().headers.get(DOOR_CLIENT_HEADER)).toBe('203.0.113.7');
  });

  it('replaces an address the caller sent with Cloudflare’s (#164 AC2)', async () => {
    const { fetch, sent } = origin();
    await through(
      new Request(`https://${SITE_DEV}/`, {
        headers: {
          'cf-connecting-ip': '203.0.113.7',
          [DOOR_CLIENT_HEADER]: '198.51.100.1',
        },
      }),
      ENV,
      fetch,
    );
    expect(sent().headers.get(DOOR_CLIENT_HEADER)).toBe('203.0.113.7');
  });

  it('drops an address the caller sent when Cloudflare gave none (#164 AC2)', async () => {
    const { fetch, sent } = origin();
    await through(
      new Request(`https://${SITE_DEV}/`, {
        headers: { [DOOR_CLIENT_HEADER]: '198.51.100.1' },
      }),
      ENV,
      fetch,
    );
    expect(sent().headers.has(DOOR_CLIENT_HEADER)).toBe(false);
  });

  it('replaces a secret and a door name the caller sent', async () => {
    const { fetch, sent } = origin();
    await through(
      new Request(`https://${HOLDING_TEST}/`, {
        headers: {
          [DOOR_SECRET_HEADER]: 'forged',
          [DOOR_HOST_HEADER]: 'forged.example',
        },
      }),
      ENV,
      fetch,
    );
    expect(sent().headers.get(DOOR_SECRET_HEADER)).toBe('test-secret');
    expect(sent().headers.get(DOOR_HOST_HEADER)).toBe(HOLDING_TEST);
  });

  it('leaves a redirect for the caller to follow', async () => {
    const { fetch, sent } = origin();
    await through(new Request(`https://${SITE_DEV}/`), ENV, fetch);
    expect(sent().redirect).toBe('manual');
  });

  it('passes a WebSocket upgrade on and hands back the origin’s own answer', async () => {
    const answer = new Response('switching');
    const { fetch, sent } = origin(answer);
    const response = await through(
      new Request(`https://${SITE_DEV}/api/roadmap/live`, {
        headers: { upgrade: 'websocket', connection: 'Upgrade' },
      }),
      ENV,
      fetch,
    );
    expect(sent().headers.get('upgrade')).toBe('websocket');
    expect(response).toBe(answer);
  });
});

describe('a request the door will not pass (#784 AC4)', () => {
  it('answers 404 for any other host, reaching no origin', async () => {
    const { fetch } = origin();
    const response = await through(
      new Request('https://elsewhere.example/'),
      ENV,
      fetch,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers 500 naming the missing origin domain, reaching no origin', async () => {
    const { fetch } = origin();
    const response = await through(
      new Request(`https://${SITE_DEV}/`),
      { ...ENV, ORIGIN_DOMAIN: '' },
      fetch,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('door not configured: ORIGIN_DOMAIN');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers 500 naming a missing dev secret, reaching no origin', async () => {
    const { fetch } = origin();
    const response = await through(
      new Request(`https://${SITE_DEV}/`),
      { ...ENV, DEV_DOOR_SECRET: '' },
      fetch,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('door not configured: DEV_DOOR_SECRET');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers 500 naming a missing test secret, reaching no origin', async () => {
    const { fetch } = origin();
    const response = await through(
      new Request(`https://${HOLDING_TEST}/`),
      { ...ENV, TEST_DOOR_SECRET: '' },
      fetch,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('door not configured: TEST_DOOR_SECRET');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('a dev door checks the DEV pass (#1078 AC1)', () => {
  it.each(DEV_DOORS)(
    'sends a page request with no pass at %s to sign in, reaching no origin',
    async (host) => {
      const { fetch } = origin();
      const response = await pass(
        new Request(`https://${host}/a?b=1`, {
          headers: { accept: 'text/html' },
        }),
        ENV,
        fetch,
      );
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(
        `${SIGNIN_ORIGIN}/pass?for=${host}&back=%2Fa%3Fb%3D1`,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each(DEV_DOORS)(
    'forwards a request with a valid pass at %s, without the pass, with the dev secret',
    async (host) => {
      const { fetch, sent } = origin();
      const response = await pass(
        new Request(`https://${host}/`, {
          headers: { [PASS_HEADER]: await passFor(host) },
        }),
        ENV,
        fetch,
      );
      expect(response.status).toBe(200);
      expect(sent().headers.get(PASS_HEADER)).toBeNull();
      expect(sent().headers.get(DOOR_SECRET_HEADER)).toBe('dev-secret');
      expect(sent().headers.get(DOOR_HOST_HEADER)).toBe(host);
    },
  );

  it('drops the pass cookie and keeps the other cookies', async () => {
    const { fetch, sent } = origin();
    await pass(
      new Request(`https://${SITE_DEV}/`, {
        headers: {
          cookie: `a=1; ${PASS_COOKIE}=${await passFor(SITE_DEV)}; b=2`,
        },
      }),
      ENV,
      fetch,
    );
    expect(sent().headers.get('cookie')).toBe('a=1; b=2');
  });

  it('refuses a pass made for another dev door, 401, reaching no origin', async () => {
    const { fetch } = origin();
    const response = await pass(
      new Request(`https://${SYNC_DEV}/health`, {
        headers: { [PASS_HEADER]: await passFor(SITE_DEV) },
      }),
      ENV,
      fetch,
    );
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses an expired pass, 401, reaching no origin', async () => {
    const { fetch } = origin();
    const minted = nowSeconds() - LIFETIME_SECONDS.machine - 1;
    const response = await pass(
      new Request(`https://${SYNC_DEV}/health`, {
        headers: { [PASS_HEADER]: await passFor(SYNC_DEV, minted) },
      }),
      ENV,
      fetch,
    );
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sets the pass cookie from a pass the sign-in posts, reaching no origin', async () => {
    const { fetch } = origin();
    const minted = await passFor(SITE_DEV);
    const response = await pass(
      new Request(`https://${SITE_DEV}/__devpass/accept`, {
        method: 'POST',
        headers: {
          origin: SIGNIN_ORIGIN,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ pass: minted, back: '/play' }).toString(),
      }),
      ENV,
      fetch,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/play');
    expect(response.headers.get('set-cookie')).toContain(
      `${PASS_COOKIE}=${minted};`,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers 500 naming DEV_PASS_KEYS when the deploy left it unset, reaching no origin', async () => {
    const { fetch } = origin();
    const response = await pass(
      new Request(`https://${SITE_DEV}/`),
      { ...ENV, DEV_PASS_KEYS: '' },
      fetch,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('door not configured: DEV_PASS_KEYS');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers 500 naming DEV_PASS_KEYS when it is not JSON, reaching no origin', async () => {
    const { fetch } = origin();
    const response = await pass(
      new Request(`https://${SITE_DEV}/`),
      { ...ENV, DEV_PASS_KEYS: 'k1=abc' },
      fetch,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('door not configured: DEV_PASS_KEYS');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers 500 naming DEV_PASS_KEYS when it is not a set of named keys, reaching no origin', async () => {
    const { fetch } = origin();
    const response = await pass(
      new Request(`https://${SITE_DEV}/`),
      { ...ENV, DEV_PASS_KEYS: JSON.stringify({ k1: 7 }) },
      fetch,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('door not configured: DEV_PASS_KEYS');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('a dev door refuses a DEV pass key set it cannot use (#1078 AC1)', () => {
  it.each([
    ['an empty set', '{}'],
    ['a list', JSON.stringify(['x'])],
    ['an empty key', JSON.stringify({ k1: '' })],
  ])(
    'answers 500 naming DEV_PASS_KEYS for %s, reaching no origin',
    async (_, keys) => {
      const { fetch } = origin();
      const response = await pass(
        new Request(`https://${SITE_DEV}/`),
        { ...ENV, DEV_PASS_KEYS: keys },
        fetch,
      );
      expect(response.status).toBe(500);
      expect(await response.text()).toBe('door not configured: DEV_PASS_KEYS');
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe('the test door checks no pass (#1078 AC2)', () => {
  it('forwards a request with no pass, even with no DEV pass keys set', async () => {
    const { fetch, sent } = origin();
    const response = await pass(
      new Request(`https://${HOLDING_TEST}/`, {
        headers: { accept: 'text/html' },
      }),
      { ...ENV, DEV_PASS_KEYS: '' },
      fetch,
    );
    expect(response.status).toBe(200);
    expect(sent().headers.get(DOOR_SECRET_HEADER)).toBe('test-secret');
  });
});
