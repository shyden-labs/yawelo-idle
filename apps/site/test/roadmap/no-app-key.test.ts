import { afterAll, beforeEach, expect, it } from 'vitest';
import { PASSWORD, roadmapWorld, type RoadmapWorld } from './harness';

/**
 * A deploy whose `ROADMAP_APP_KEY` secret never arrived (#341): the App id is
 * committed config, the key is a Worker secret, so the key is the one thing a
 * deploy can lack. The health names it, which dev verify reads. A file of
 * its own: its Worker starts without the key.
 */
let world: RoadmapWorld;

let started = false;

// Started by the first test, in a beforeEach: a throw there fails each test,
// where one in a beforeAll would leave them skipped (#97).
beforeEach(async () => {
  if (started) return;
  started = true;
  world = roadmapWorld({ appKey: false });
  await world.start();
});

afterAll(async () => {
  if (started) await world.stop();
});

it('names the missing App key in the health, the board never read', async () => {
  await world.resetFake();
  const response = await world.server.fetch(
    'https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev/api/roadmap/health',
    { headers: { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` } },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    version: 0,
    readError: 'ROADMAP_APP_KEY is not set',
  });
});
