import { afterAll, beforeEach, expect, it } from 'vitest';
import { PASSWORD, roadmapWorld, type RoadmapWorld } from './harness.ts';

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

it('answers 503 with the reason when the board has never been read', async () => {
  await world.resetFake();
  await world.configureFake({ graphqlStatus: 502 });
  const response = await world.server.fetch(
    'https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev/api/roadmap.json',
    { headers: { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` } },
  );
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({
    error: 'GitHub refused POST /graphql: HTTP 502',
  });
});
