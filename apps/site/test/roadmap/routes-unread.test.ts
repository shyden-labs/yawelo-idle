import { afterAll, beforeEach, expect, it } from 'vitest';
import { PASSWORD, roadmapWorld, type RoadmapWorld } from './harness';
import { judged, privateJudge } from '../../api/judge';

/**
 * `/api/roadmap.json` before any read has succeeded (#341). A file of its
 * own, so its Worker's storage is its own: here the Durable Object starts
 * with no snapshot at all.
 */
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

it('answers 503 with a plain sentence, never the error text, when the board has never been read (#846)', async () => {
  await world.resetFake();
  await world.configureFake({ graphqlStatus: 502 });
  const response = await world.server.fetch(
    'https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev/api/roadmap.json',
    { headers: { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` } },
  );
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({
    error: 'The roadmap could not be read just now.',
  });
});

it('answers its 503 as the API spec says (#588)', async () => {
  await world.resetFake();
  await world.configureFake({ graphqlStatus: 502 });
  const response = await world.server.fetch(
    'https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev/api/roadmap.json',
    { headers: { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` } },
  );
  expect(response.status).toBe(503);
  expect(await judged('/api/roadmap.json', 'get', response)).toEqual([]);
});

it('keeps the health report, error text and all, off the production host (#846)', async () => {
  await world.resetFake();
  await world.configureFake({ graphqlStatus: 502 });
  const response = await world.server.fetch(
    'https://yawelo-idle.shyden.co.uk/api/roadmap/health',
  );
  expect([response.status, await response.text()]).toEqual([404, '']);
});

it('reports the failed read’s error text on the dev health report, as the private spec says (#589)', async () => {
  await world.resetFake();
  await world.configureFake({ graphqlStatus: 502 });
  const response = await world.server.fetch(
    'https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev/api/roadmap/health',
    { headers: { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` } },
  );
  expect(response.status).toBe(200);
  const body = (await response.clone().json()) as { readError: unknown };
  expect(body.readError).toBe('GitHub refused POST /graphql: HTTP 502');
  expect(
    await privateJudge.judged('/api/roadmap/health', 'get', response),
  ).toEqual([]);
});
