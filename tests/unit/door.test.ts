import { describe, expect, it, vi } from 'vitest';
import {
  DOOR_HOST_HEADER,
  DOOR_SECRET_HEADER,
  DOORS,
  pass,
  type DoorEnv,
  type Fetch,
} from '../../apps/door/worker/door';

/**
 * The front door's logic (#784 AC4), with the outbound fetch mocked: which
 * door reaches which origin, that the request goes on whole with its
 * environment's door secret, that a caller cannot forge the secret or the
 * door's name, that a WebSocket upgrade passes through, and that any other
 * host is kept. Door hosts are read from DOORS, never written out here: a
 * guard over tests/ will refuse a door address (#784 AC1b).
 */

const ENV: DoorEnv = {
  ORIGIN_DOMAIN: 'origins.example.workers.dev',
  DEV_DOOR_SECRET: 'dev-secret',
  TEST_DOOR_SECRET: 'test-secret',
};

const doorHost = (worker: string): string => {
  const found = [...DOORS].find(([, door]) => door.worker === worker);
  if (found === undefined) throw new Error(`no door for ${worker}`);
  return found[0];
};

const SITE_DEV = doorHost('yawelo-idle-site-dev');
const SITE_TEST = doorHost('yawelo-idle-site-test');

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
  it('are exactly the dev site, dev API, dev holding page and test site, each on yaweloidle.com with its Worker and environment', () => {
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
      ['test', 'yaweloidle.com', 'yawelo-idle-site-test', 'test'],
    ]);
  });
});

describe('a request to a door (#784 AC4)', () => {
  it('goes to its Worker’s workers.dev address over https, path and query kept', async () => {
    const { fetch, sent } = origin();
    await pass(new Request(`http://${SITE_DEV}/play/x?a=1&b=2`), ENV, fetch);
    expect(sent().url).toBe(
      'https://yawelo-idle-site-dev.origins.example.workers.dev/play/x?a=1&b=2',
    );
  });

  it('drops a port the caller named, since the origin answers on https’s own', async () => {
    const { fetch, sent } = origin();
    await pass(new Request(`https://${SITE_DEV}:8443/`), ENV, fetch);
    expect(sent().url).toBe(
      'https://yawelo-idle-site-dev.origins.example.workers.dev/',
    );
  });

  it('keeps the method, headers and body', async () => {
    const { fetch, sent } = origin();
    await pass(
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
    await pass(new Request(`https://${SITE_DEV}/`), ENV, fetch);
    expect(sent().headers.get(DOOR_SECRET_HEADER)).toBe('dev-secret');
  });

  it('carries the test door secret from the test door', async () => {
    const { fetch, sent } = origin();
    await pass(new Request(`https://${SITE_TEST}/`), ENV, fetch);
    expect(sent().headers.get(DOOR_SECRET_HEADER)).toBe('test-secret');
  });

  it('names the door it came through', async () => {
    const { fetch, sent } = origin();
    await pass(new Request(`https://${SITE_DEV}/`), ENV, fetch);
    expect(sent().headers.get(DOOR_HOST_HEADER)).toBe(SITE_DEV);
  });

  it('replaces a secret and a door name the caller sent', async () => {
    const { fetch, sent } = origin();
    await pass(
      new Request(`https://${SITE_TEST}/`, {
        headers: {
          [DOOR_SECRET_HEADER]: 'forged',
          [DOOR_HOST_HEADER]: 'forged.example',
        },
      }),
      ENV,
      fetch,
    );
    expect(sent().headers.get(DOOR_SECRET_HEADER)).toBe('test-secret');
    expect(sent().headers.get(DOOR_HOST_HEADER)).toBe(SITE_TEST);
  });

  it('leaves a redirect for the caller to follow', async () => {
    const { fetch, sent } = origin();
    await pass(new Request(`https://${SITE_DEV}/`), ENV, fetch);
    expect(sent().redirect).toBe('manual');
  });

  it('passes a WebSocket upgrade on and hands back the origin’s own answer', async () => {
    const answer = new Response('switching');
    const { fetch, sent } = origin(answer);
    const response = await pass(
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
    const response = await pass(
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
    const response = await pass(
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
    const response = await pass(
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
    const response = await pass(
      new Request(`https://${SITE_TEST}/`),
      { ...ENV, TEST_DOOR_SECRET: '' },
      fetch,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('door not configured: TEST_DOOR_SECRET');
    expect(fetch).not.toHaveBeenCalled();
  });
});
