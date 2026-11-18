import { describe, expect, it } from 'vitest';
import { ROUTES, route } from '../../apps/sync-worker/src/routes';

/**
 * Every route the sync Worker serves is in one table, each with its input
 * checks and its request limit (#164 AC3; spec §12.9), and the router serves
 * nothing the table does not list.
 */
const PATHS = ['/health', '/v1/devices'] as const;

/** An env whose D1 answers every query, so a route can run in Node. */
const env = {
  COMMIT: 'test',
  DB: {
    prepare: () => ({
      run: () => Promise.resolve({}),
      bind: () => ({}),
    }),
    batch: () => Promise.resolve([]),
  },
} as unknown as Env;

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

  it('serves /v1/devices through the table', async () => {
    expect((await fetchRoute('/v1/devices', 'POST', '{}')).status).toBe(201);
  });
});
