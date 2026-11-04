import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_REPO } from '../../../../packages/progress/test/board-fixture';
import { FAKE_BOARD_ID } from '../github-fake/contract';
import { HOOK_PATH, ROADMAP_PATHS } from '../../worker/routes';
import { PASSWORD, roadmapWorld, sign, type RoadmapWorld } from './harness';
import { privateJudge, privateSpec } from '../../api/judge';

/**
 * The private operations answer exactly as their hand-written spec,
 * `apps/site/api/private.openapi.json`, says (#589): the roadmap's health
 * report and GitHub's webhook, every status, documented header and field,
 * and nothing the spec does not list. Called through wrangler's harness
 * against the fake GitHub, on the dev host (behind the password) and the
 * production host, where the health report is a bare 404 (#846).
 */
const DEV = 'https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev';
const PROD = 'https://yawelo-idle.shyden.co.uk';
const AUTH = { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` };
const HEALTH = ROADMAP_PATHS.health;
const { judged } = privateJudge;

let world: RoadmapWorld;
let started = false;

// Started by the first test, in a beforeEach: a throw there fails each test,
// where one in a beforeAll would leave them skipped (#97).
beforeEach(async () => {
  if (!started) {
    started = true;
    world = roadmapWorld();
    await world.start();
  }
  await world.resetFake();
});

afterAll(async () => {
  if (started) await world.stop();
});

type Init = NonNullable<Parameters<typeof world.server.fetch>[1]>;
const call = (url: string, init: Init = {}) => world.server.fetch(url, init);

/** A delivery of `body` to the dev webhook, signed unless told otherwise. */
async function deliver(
  body: string,
  { signature, event = 'issues', method = 'POST' } = {} as {
    signature?: string;
    event?: string;
    method?: string;
  },
) {
  return call(`${DEV}${HOOK_PATH}`, {
    method,
    body: method === 'GET' ? undefined : body,
    headers: {
      'X-GitHub-Event': event,
      'X-Hub-Signature-256': signature ?? (await sign(body)),
      'Content-Type': 'application/json',
    },
  });
}

describe('the spec', () => {
  it('documents the health report and the webhook and no other path', () => {
    expect(Object.keys(privateSpec.paths).sort()).toEqual(
      [HEALTH, HOOK_PATH].sort(),
    );
  });

  it('documents GET on the health report and POST on the webhook', () => {
    expect(
      Object.entries(privateSpec.paths).map(([p, ops]) => [
        p,
        Object.keys(ops),
      ]),
    ).toEqual([
      [HEALTH, ['get']],
      [HOOK_PATH, ['post']],
    ]);
  });
});

describe(`GET ${HEALTH}`, () => {
  it('answers on the dev host as the spec says', async () => {
    const response = await call(`${DEV}${HEALTH}`, { headers: AUTH });
    expect(response.status).toBe(200);
    expect(await judged(HEALTH, 'get', response)).toEqual([]);
  });

  it('refuses a dev caller without the password as the spec says', async () => {
    const response = await call(`${DEV}${HEALTH}`);
    expect(response.status).toBe(401);
    expect(await judged(HEALTH, 'get', response)).toEqual([]);
  });

  it('refuses POST on dev with 405 as the spec says', async () => {
    const response = await call(`${DEV}${HEALTH}`, {
      method: 'POST',
      headers: AUTH,
    });
    expect(response.status).toBe(405);
    expect(await judged(HEALTH, 'get', response)).toEqual([]);
  });

  it('is a bare 404 on the production host as the spec says', async () => {
    const response = await call(`${PROD}${HEALTH}`);
    expect(response.status).toBe(404);
    expect(await judged(HEALTH, 'get', response)).toEqual([]);
  });
});

describe(`POST ${HOOK_PATH}`, () => {
  it('answers 202 to a signed event for this repository as the spec says', async () => {
    const response = await deliver(
      JSON.stringify({ repository: { full_name: FIXTURE_REPO } }),
    );
    expect(response.status).toBe(202);
    expect(await judged(HOOK_PATH, 'post', response)).toEqual([]);
  });

  it('answers 202 to a signed event for this board as the spec says', async () => {
    const response = await deliver(
      JSON.stringify({ projects_v2_item: { project_node_id: FAKE_BOARD_ID } }),
      { event: 'projects_v2_item' },
    );
    expect(response.status).toBe(202);
    expect(await judged(HOOK_PATH, 'post', response)).toEqual([]);
  });

  it('answers 204 to a signed ping as the spec says', async () => {
    const response = await deliver(JSON.stringify({ zen: 'Keep it simple.' }), {
      event: 'ping',
    });
    expect(response.status).toBe(204);
    expect(await judged(HOOK_PATH, 'post', response)).toEqual([]);
  });

  it('refuses a signed body that is not JSON with 400 as the spec says', async () => {
    const response = await deliver('not json');
    expect(response.status).toBe(400);
    expect(await judged(HOOK_PATH, 'post', response)).toEqual([]);
  });

  it('refuses a wrong signature with 401 as the spec says', async () => {
    const response = await deliver('{}', {
      signature: `sha256=${'0'.repeat(64)}`,
    });
    expect(response.status).toBe(401);
    expect(await judged(HOOK_PATH, 'post', response)).toEqual([]);
  });

  it('refuses GET with 405 as the spec says', async () => {
    const response = await deliver('', { method: 'GET' });
    expect(response.status).toBe(405);
    expect(await judged(HOOK_PATH, 'post', response)).toEqual([]);
  });

  it('refuses a body over 1 MiB with 413 as the spec says', async () => {
    const response = await deliver('x'.repeat(1_048_577));
    expect(response.status).toBe(413);
    expect(await judged(HOOK_PATH, 'post', response)).toEqual([]);
  });

  it('answers the same on the production host, outside any password', async () => {
    const body = JSON.stringify({ zen: 'Keep it simple.' });
    const response = await call(`${PROD}${HOOK_PATH}`, {
      method: 'POST',
      body,
      headers: {
        'X-GitHub-Event': 'ping',
        'X-Hub-Signature-256': await sign(body),
      },
    });
    expect(response.status).toBe(204);
    expect(await judged(HOOK_PATH, 'post', response)).toEqual([]);
  });
});
