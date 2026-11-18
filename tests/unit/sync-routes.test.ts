import { describe, expect, it } from 'vitest';
import { DOOR_CLIENT_HEADER, DOOR_SECRET_HEADER } from '../../apps/door/worker/door';
import type { Equal } from '../../apps/door/worker/origin';
import type { Counts } from '../../apps/sync-worker/src/limit';
import { ROUTES, route, type SyncEnv } from '../../apps/sync-worker/src/routes';
import { memoryCounts } from './memory-counts';

/**
 * Every route the sync Worker serves is in one table, each with its input
 * checks and its request limit (#164 AC3; spec §12.9), and the router serves
 * nothing the table does not list.
 */
const PATHS = ['/health', '/v1/devices'] as const;

/** A D1 statement that answers every query, so a route can run in Node. */
const statement: ReturnType<SyncEnv['DB']['prepare']> = {
  bind: () => statement,
  run: () => Promise.resolve({}),
};

const DOOR_SECRET = 'the-dev-door-secret';

const env: SyncEnv = {
  COMMIT: 'test',
  RATE_KEY: 'the-rate-key',
  DOOR_SECRET,
  DB: { prepare: () => statement, batch: () => Promise.resolve([]) },
};

/** A plain byte comparison standing in for the runtime's constant-time one. */
const sameBytes: Equal = (a, b) => {
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  return (
    left.length === right.length && left.every((byte, i) => byte === right[i])
  );
};

/** 2026-11-19 00:00:30 UTC: 30 s into a minute, 30 s into an hour. */
const NOW = Date.UTC(2026, 10, 19, 0, 0, 30);

const send = (
  path: string,
  {
    method = 'GET',
    body,
    headers = { 'cf-connecting-ip': '203.0.113.7' },
    counts = memoryCounts(),
    withEnv = env,
  }: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    counts?: Counts;
    withEnv?: SyncEnv;
  } = {},
) =>
  route(
    new Request(`https://sync.test${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
    }),
    withEnv,
    { counts, now: () => NOW, equal: sameBytes },
  );

const fetchRoute = (path: string, method = 'GET', body?: string) =>
  send(path, { method, ...(body === undefined ? {} : { body }) });

/** A request `path` accepts: its own method, and `{}` for a body it reads. */
const accepted = (path: (typeof PATHS)[number]) =>
  ROUTES[path].method === 'POST'
    ? { method: 'POST', body: '{}' }
    : { method: 'GET' };

describe('the sync route table (#164 AC3)', () => {
  it('lists exactly the routes the Worker serves', () => {
    expect(Object.keys(ROUTES).sort()).toEqual([...PATHS]);
  });

  it.each(PATHS)(
    '%s has a request limit of whole, positive numbers',
    (path) => {
      const { limit } = ROUTES[path];
      expect([
        Number.isInteger(limit.requests) && limit.requests > 0,
        Number.isInteger(limit.perSeconds) && limit.perSeconds > 0,
      ]).toEqual([true, true]);
    },
  );

  it.each(PATHS)(
    '%s refuses an unknown query parameter with 422',
    async (path) => {
      const { method } = ROUTES[path];
      const response = await fetchRoute(
        `${path}?debug=1`,
        method,
        method === 'POST' ? '{}' : undefined,
      );
      expect([response.status, await response.json()]).toEqual([
        422,
        { error: 'invalid_field', field: 'debug' },
      ]);
    },
  );

  it.each(PATHS)(
    '%s answers another method with 405, naming its own',
    async (path) => {
      const { method } = ROUTES[path];
      const other = method === 'GET' ? 'POST' : 'GET';
      const response = await fetchRoute(path, other);
      expect([response.status, response.headers.get('allow')]).toEqual([
        405,
        method,
      ]);
    },
  );

  it('answers a path the table does not list with 404', async () => {
    expect((await fetchRoute('/v1/unlisted')).status).toBe(404);
  });

  it('serves /health through the table', async () => {
    expect((await fetchRoute('/health')).status).toBe(200);
  });

  it('serves /v1/devices through the table', async () => {
    expect((await fetchRoute('/v1/devices', 'POST', '{}')).status).toBe(201);
  });
});

describe('the request limits (#164 AC2)', () => {
  it.each(PATHS)(
    '%s accepts its limit’s last request and answers the next with 429 and the wait',
    async (path) => {
      const counts = memoryCounts();
      const { requests } = ROUTES[path].limit;
      const statuses = [];
      // one scenario: one network sends one more request than its limit
      for (let sent = 0; sent <= requests; sent += 1)
        statuses.push((await send(path, { ...accepted(path), counts })).status);
      const refused = await send(path, { ...accepted(path), counts });
      expect([
        statuses.at(-2),
        statuses.at(-1),
        refused.headers.get('retry-after'),
        refused.headers.get('cache-control'),
        await refused.json(),
      ]).toEqual([
        path === '/v1/devices' ? 201 : 200,
        429,
        String(ROUTES[path].limit.perSeconds - 30),
        'no-store',
        { error: 'too_many_requests' },
      ]);
    },
  );

  it('counts every address in one network together', async () => {
    const counts = memoryCounts();
    // one scenario: two addresses in one /24 share /health's 60
    for (let sent = 0; sent < 60; sent += 1)
      await send('/health', {
        counts,
        headers: { 'cf-connecting-ip': `203.0.113.${sent % 2}` },
      });
    expect((await send('/health', { counts })).status).toBe(429);
  });

  it('counts another network on its own', async () => {
    const counts = memoryCounts();
    // one scenario: one network uses /health's 60, then another asks
    for (let sent = 0; sent < 60; sent += 1) await send('/health', { counts });
    expect(
      (
        await send('/health', {
          counts,
          headers: { 'cf-connecting-ip': '198.51.100.7' },
        })
      ).status,
    ).toBe(200);
  });

  it('counts by the address the door names, its secret matching', async () => {
    const counts = memoryCounts();
    const throughDoor = (client: string) => ({
      'cf-connecting-ip': '2a06:98c0:3600::103',
      [DOOR_SECRET_HEADER]: DOOR_SECRET,
      [DOOR_CLIENT_HEADER]: client,
    });
    // one scenario: one player uses /health's 60 through the door, then another asks
    for (let sent = 0; sent < 60; sent += 1)
      await send('/health', { counts, headers: throughDoor('203.0.113.7') });
    expect(
      (await send('/health', { counts, headers: throughDoor('198.51.100.7') }))
        .status,
    ).toBe(200);
  });

  it('counts by Cloudflare’s address when a named one comes without the secret', async () => {
    const counts = memoryCounts();
    const forged = (client: string) => ({
      'cf-connecting-ip': '203.0.113.7',
      [DOOR_CLIENT_HEADER]: client,
    });
    // one scenario: one caller names a new address on each request
    for (let sent = 0; sent < 60; sent += 1)
      await send('/health', { counts, headers: forged(`198.51.100.${sent}`) });
    expect(
      (await send('/health', { counts, headers: forged('192.0.2.1') })).status,
    ).toBe(429);
  });

  it('keeps a keyed hash, never the address or its network', async () => {
    const counts = memoryCounts();
    await send('/health', { counts });
    expect(counts.keys).toEqual([
      expect.stringMatching(/^[\da-f]{64}$/),
    ]);
  });

  it('gives one network the same key each time and another a different one', async () => {
    const counts = memoryCounts();
    await send('/health', { counts, headers: { 'cf-connecting-ip': '203.0.113.7' } });
    await send('/health', { counts, headers: { 'cf-connecting-ip': '203.0.113.9' } });
    await send('/health', { counts, headers: { 'cf-connecting-ip': '198.51.100.7' } });
    const [first, second, third] = counts.keys;
    expect([first === second, first === third]).toEqual([true, false]);
  });

  it('counts a request whose query it then refuses', async () => {
    const counts = memoryCounts();
    await send('/health?debug=1', { counts });
    expect(counts.keys).toHaveLength(1);
  });

  it('counts nothing for a path the table does not list', async () => {
    const counts = memoryCounts();
    await send('/v1/unlisted', { counts });
    expect(counts.keys).toHaveLength(0);
  });

  it('answers 500 naming RATE_KEY when the deploy left it unset, counting nothing', async () => {
    const counts = memoryCounts();
    const { RATE_KEY: _unset, ...withoutKey } = env;
    const response = await send('/health', { counts, withEnv: withoutKey });
    expect([response.status, await response.json(), counts.keys]).toEqual([
      500,
      { error: 'not_configured', missing: 'RATE_KEY' },
      [],
    ]);
  });
});
