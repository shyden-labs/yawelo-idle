import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ROADMAP_PATHS } from '../../worker/routes';
import { PASSWORD, roadmapWorld, type RoadmapWorld } from './harness';
import { differences, judged, spec } from './openapi';

/**
 * The public roadmap API answers exactly as its hand-written spec,
 * `apps/site/api/roadmap.openapi.json`, says (#588): every route, method,
 * status, header and field, and nothing the spec does not list. Called
 * through wrangler's harness against the fake GitHub, on the dev host (behind
 * the password) and the production host.
 */
const DEV = 'https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev';
const PROD = 'https://yawelo-idle.shyden.co.uk';
const AUTH = { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` };
const { snapshot: SNAPSHOT, live: LIVE } = ROADMAP_PATHS;

let world: RoadmapWorld;
let started = false;

// Started by the first test, in a beforeEach: a throw there fails each test,
// where one in a beforeAll would leave them skipped (#97).
beforeEach(async () => {
  if (started) return;
  started = true;
  world = roadmapWorld();
  await world.start();
});

afterAll(async () => {
  if (started) await world.stop();
});

type Init = NonNullable<Parameters<typeof world.server.fetch>[1]>;
const call = (url: string, init: Init = {}) => world.server.fetch(url, init);

describe('the spec', () => {
  it('documents the two public paths and no other', () => {
    expect(Object.keys(spec.paths).sort()).toEqual([LIVE, SNAPSHOT].sort());
  });

  it('documents GET alone on each path', () => {
    expect(Object.values(spec.paths).map((p) => Object.keys(p))).toEqual([
      ['get'],
      ['get'],
    ]);
  });
});

describe(`GET ${SNAPSHOT}`, () => {
  it('answers on the dev host as the spec says', async () => {
    const response = await call(`${DEV}${SNAPSHOT}`, { headers: AUTH });
    expect(response.status).toBe(200);
    expect(await judged(SNAPSHOT, 'get', response)).toEqual([]);
  });

  it('answers on the production host as the spec says', async () => {
    const response = await call(`${PROD}${SNAPSHOT}`);
    expect(response.status).toBe(200);
    expect(await judged(SNAPSHOT, 'get', response)).toEqual([]);
  });

  it('answers HEAD with the same status and no body', async () => {
    const response = await call(`${DEV}${SNAPSHOT}`, {
      method: 'HEAD',
      headers: AUTH,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('refuses a dev caller without the password as the spec says', async () => {
    const response = await call(`${DEV}${SNAPSHOT}`);
    expect(response.status).toBe(401);
    expect(await judged(SNAPSHOT, 'get', response)).toEqual([]);
  });

  it('refuses POST with 405 as the spec says', async () => {
    const response = await call(`${DEV}${SNAPSHOT}`, {
      method: 'POST',
      headers: AUTH,
    });
    expect(response.status).toBe(405);
    expect(await judged(SNAPSHOT, 'get', response)).toEqual([]);
  });

  it('refuses DELETE on the production host with 405 as the spec says', async () => {
    const response = await call(`${PROD}${SNAPSHOT}`, { method: 'DELETE' });
    expect(response.status).toBe(405);
    expect(await judged(SNAPSHOT, 'get', response)).toEqual([]);
  });
});

describe(`GET ${LIVE}`, () => {
  it('upgrades to a socket whose first message is a snapshot as the spec says', async () => {
    // The data file first, so the board has been read when the socket opens.
    await call(`${DEV}${SNAPSHOT}`, { headers: AUTH });
    const response = await call(`${DEV}${LIVE}`, {
      headers: { ...AUTH, Upgrade: 'websocket' },
    });
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    if (socket === null) throw new Error('the 101 carried no socket');
    const first = new Promise<string>((resolve) => {
      socket.addEventListener('message', (event) => {
        // The spec promises text frames; a binary one fails the parse below.
        resolve(typeof event.data === 'string' ? event.data : 'a binary frame');
      });
    });
    socket.accept();
    const message: unknown = JSON.parse(await first);
    socket.close(1000, 'done');
    expect(
      differences(LIVE, 'get', {
        status: 101,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: message,
      }),
    ).toEqual([]);
  });

  it('refuses a plain request with 426 as the spec says', async () => {
    const response = await call(`${DEV}${LIVE}`, { headers: AUTH });
    expect(response.status).toBe(426);
    expect(await judged(LIVE, 'get', response)).toEqual([]);
  });

  it('refuses POST with 405 as the spec says', async () => {
    const response = await call(`${DEV}${LIVE}`, {
      method: 'POST',
      headers: { ...AUTH, Upgrade: 'websocket' },
    });
    expect(response.status).toBe(405);
    expect(await judged(LIVE, 'get', response)).toEqual([]);
  });
});

describe('the private health path, outside the public spec', () => {
  it('stays a bare 404 on the production host for POST too (#846 before #588)', async () => {
    const response = await call(`${PROD}/api/roadmap/health`, {
      method: 'POST',
    });
    expect(response.status).toBe(404);
    expect(response.headers.get('Allow')).toBeNull();
  });

  it('refuses POST on dev with 405, as the public paths do', async () => {
    const response = await call(`${DEV}/api/roadmap/health`, {
      method: 'POST',
      headers: AUTH,
    });
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });
});

describe('the judge', () => {
  // The judge itself, so a pass above means the answer matched, never that
  // nothing was compared.
  it('names a field the spec does not list', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers({
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        }),
        body: { error: 'The roadmap could not be read just now.', extra: 1 },
      }),
    ).toEqual(['body must NOT have additional properties']);
  });

  it('names a status the spec does not document', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 500,
        headers: new Headers(),
        body: null,
      }),
    ).toEqual([
      'GET /api/roadmap.json answered 500, which the spec does not document',
    ]);
  });

  it('names a missing header', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: { error: 'The roadmap could not be read just now.' },
      }),
    ).toEqual(['header Cache-Control is missing']);
  });

  it('names a body type the spec does not document', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
        }),
        body: '<p>',
      }),
    ).toEqual(['Content-Type text/html is not one of application/json']);
  });
});
