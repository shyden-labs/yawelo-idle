import { describe, expect, it } from 'vitest';
import { ROUTES, route, type SyncEnv } from '../../apps/sync-worker/src/routes';

/**
 * Every route the sync Worker serves is in one table, each with its input
 * checks and its request limit (#164 AC3; spec §12.9), and the router serves
 * nothing the table does not list.
 */
const PATHS = [
  '/health',
  '/v1/content-reports',
  '/v1/content-reports/health',
  '/v1/devices',
] as const;

/** A D1 statement that answers every query, so a route can run in Node. */
const statement: ReturnType<SyncEnv['DB']['prepare']> = {
  bind: () => statement,
  run: () => Promise.resolve({}),
};

const env: SyncEnv = {
  COMMIT: 'test',
  DB: { prepare: () => statement, batch: () => Promise.resolve([]) },
};

const fetchRoute = (path: string, method = 'GET', body?: string) =>
  route(
    new Request(`https://sync.test${path}`, {
      method,
      ...(body === undefined ? {} : { body }),
    }),
    env,
  );

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

  it('serves /v1/content-reports through the table', async () => {
    const body = JSON.stringify({
      course: 'en-id',
      kind: 'lexicon',
      itemId: 'lex.a',
      problem: 'other',
      appVersion: '0.1.0',
      contentVersion: 'c1',
      installId: 'install-a',
      website: '',
    });
    expect((await fetchRoute('/v1/content-reports', 'POST', body)).status).toBe(
      201,
    );
  });

  it('serves /v1/content-reports/health through the table', async () => {
    const response = await fetchRoute('/v1/content-reports/health');
    expect([response.status, await response.json()]).toEqual([
      200,
      { ok: true },
    ]);
  });

  it('serves /v1/devices through the table', async () => {
    expect((await fetchRoute('/v1/devices', 'POST', '{}')).status).toBe(201);
  });
});
