import { connect } from 'node:net';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_REPO } from '../../../../packages/progress/test/board-fixture';
import { FAKE_BOARD_ID } from '../github-fake/contract';
import { PASSWORD, roadmapWorld, sign, type RoadmapWorld } from './harness';

/**
 * The site Worker's roadmap routes (#341): the webhook's door at
 * `/hooks/github` (outside the dev password, guarded by its signature), the
 * three `/api/roadmap*` paths behind the password (R6, measured 2026-10-06:
 * every engine sends cached Basic credentials on the socket upgrade). There
 * is no cron (#1074): the roadmap reads on visit. Called through wrangler's harness (#506) with a dev hostname so the
 * gate applies; each call returns once the work it handed to `waitUntil` is
 * done (test/roadmap-worker/test-worker.ts).
 */
const HOST = 'https://yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev';
const AUTH = { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` };

let world: RoadmapWorld;
const resetFake: RoadmapWorld['resetFake'] = () => world.resetFake();
const seenByFake: RoadmapWorld['seenByFake'] = () => world.seenByFake();

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

// The harness takes miniflare's RequestInit, not the DOM's.
type Init = NonNullable<Parameters<typeof world.server.fetch>[1]>;
const call = (path: string, init: Init = {}) =>
  world.server.fetch(`${HOST}${path}`, init);

const HOOK_HEADERS = {
  'X-GitHub-Event': 'issues',
  'X-Hub-Signature-256': `sha256=${'0'.repeat(64)}`,
};

/**
 * Raw HTTP/1.1: a POST to /hooks/github declaring `length` and sending
 * `sent` bytes of body after the headers. The first status code that comes
 * back, or why none came within 5 s. A reset after that status is not read:
 * a server may close as soon as it has answered (#1107).
 */
async function statusOfRawPost(
  length: number | string,
  sent: number,
): Promise<string> {
  const { url } = await world.server.listen();
  return new Promise((resolve) => {
    const socket = connect(Number(url.port), url.hostname);
    const done = (outcome: string) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(outcome);
    };
    const timer = setTimeout(() => {
      done('no answer in 5 s');
    }, 5000);
    socket.on('connect', () => {
      const lines = [
        'POST /hooks/github HTTP/1.1',
        `Host: ${new URL(HOST).host}`,
        `Content-Length: ${String(length)}`,
        ...Object.entries(HOOK_HEADERS).map(([k, v]) => `${k}: ${v}`),
      ];
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (sent > 0) socket.write(Buffer.alloc(sent, 'x'));
    });
    socket.once('data', (data: Buffer) => {
      done(
        /^HTTP\/1\.1 (\d{3})/.exec(data.toString('latin1'))?.[1] ??
          'no status line',
      );
    });
    socket.on('error', (error: NodeJS.ErrnoException) => {
      done(`socket error ${error.code ?? error.message}`);
    });
  });
}

async function deliver(event: string, payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  return call('/hooks/github', {
    method: 'POST',
    body,
    headers: {
      'X-GitHub-Event': event,
      'X-Hub-Signature-256': signature ?? (await sign(body)),
      'Content-Type': 'application/json',
    },
  });
}

const boardReads = async () =>
  (await seenByFake()).filter((s) => s.query === 'board' && s.cursor === null)
    .length;

beforeEach(async () => {
  await resetFake();
});

describe('/hooks/github', () => {
  it('accepts a signed issue event from the board’s repository and reads the board', async () => {
    const response = await deliver('issues', {
      repository: { full_name: FIXTURE_REPO },
    });
    expect(response.status).toBe(202);
    expect(await boardReads()).toBe(1);
  });

  it('accepts a signed item event on the board and reads it', async () => {
    const response = await deliver('projects_v2_item', {
      projects_v2_item: { project_node_id: FAKE_BOARD_ID },
    });
    expect(response.status).toBe(202);
    expect(await boardReads()).toBe(1);
  });

  // #689: the hook hands the delivery's card and time to the roadmap. A
  // change stamped far ahead of the fixture is one no read can show yet.
  it('hands the delivery’s card and time to the roadmap, which counts a read behind it as late', async () => {
    const staleReads = async () =>
      (
        (await (
          await call('/api/roadmap/health', { headers: AUTH })
        ).json()) as { staleReads: number }
      ).staleReads;
    const before = await staleReads();
    const response = await deliver('issues', {
      action: 'edited',
      issue: { number: 9, updated_at: '2999-01-01T00:00:00Z' },
      repository: { full_name: FIXTURE_REPO },
    });
    expect(response.status).toBe(202);
    expect(await staleReads()).toBe(before + 1);
  });

  it('answers a signed ping without reading', async () => {
    const response = await deliver('ping', { zen: 'Design for failure.' });
    expect(response.status).toBe(204);
    expect(await boardReads()).toBe(0);
  });

  it('answers a signed event from another board without reading', async () => {
    const response = await deliver('projects_v2_item', {
      projects_v2_item: { project_node_id: 'PVT_shytalk' },
    });
    expect(response.status).toBe(204);
    expect(await boardReads()).toBe(0);
  });

  it('refuses an unsigned delivery with 401 and no detail', async () => {
    const response = await call('/hooks/github', {
      method: 'POST',
      body: '{}',
      headers: { 'X-GitHub-Event': 'issues' },
    });
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
    expect(await boardReads()).toBe(0);
  });

  it('refuses a delivery signed with another secret', async () => {
    const response = await deliver(
      'issues',
      { repository: { full_name: FIXTURE_REPO } },
      `sha256=${'0'.repeat(64)}`,
    );
    expect(response.status).toBe(401);
    expect(await boardReads()).toBe(0);
  });

  it('refuses a signed body that is not JSON', async () => {
    const body = 'not json';
    const response = await call('/hooks/github', {
      method: 'POST',
      body,
      headers: {
        'X-GitHub-Event': 'issues',
        'X-Hub-Signature-256': await sign(body),
      },
    });
    expect(response.status).toBe(400);
  });

  // A length that is not a number must never read as small (#1107's
  // security review): the request is refused before the Worker sees it.
  it('refuses a declared length that is not a number with 400', async () => {
    expect(await statusOfRawPost('abc', 0)).toBe('400');
  });

  it('refuses any method but POST, naming POST', async () => {
    const response = await call('/hooks/github');
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
  });
});

describe('/api/roadmap*', () => {
  it('keeps the roadmap behind the dev password', async () => {
    expect((await call('/api/roadmap.json')).status).toBe(401);
  });

  it('serves the snapshot as JSON, never cached', async () => {
    const response = await call('/api/roadmap.json', { headers: AUTH });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const snapshot = (await response.json()) as { version: number };
    expect(snapshot.version).toBeGreaterThanOrEqual(1);
  });

  it('serves nothing the public page does not show (#840)', async () => {
    const response = await call('/api/roadmap.json', { headers: AUTH });
    const served = await response.text();
    expect({
      postLaunchStory: served.includes('"number":7,'),
      notPlannedStory: served.includes('"number":8,'),
      rawTitle: served.includes('Story '),
      epicTicketTitle: served.includes('Epic'),
      labels: served.includes('labels'),
      closeOutLines: served.includes('By tickets'),
    }).toEqual({
      postLaunchStory: false,
      notPlannedStory: false,
      rawTitle: false,
      epicTicketTitle: false,
      labels: false,
      closeOutLines: false,
    });
  });

  /** The snapshot's card for issue `number`, as the Worker serves it. */
  const servedItem = async (number: number) => {
    const response = await call('/api/roadmap.json', { headers: AUTH });
    const snapshot = (await response.json()) as {
      items: { number: number }[];
    };
    return snapshot.items.find((item) => item.number === number);
  };

  it('serves each story’s epic and Public title (#826)', async () => {
    expect(await servedItem(2)).toMatchObject({
      parent: 1,
      publicTitle: 'Your village grows',
      publicSummary: null,
    });
  });

  it('serves each epic’s Public summary (#826)', async () => {
    expect(await servedItem(1)).toMatchObject({
      parent: null,
      publicTitle: null,
      publicSummary: 'The heart of the game.',
    });
  });

  it('serves the health as JSON, never cached', async () => {
    const response = await call('/api/roadmap/health', { headers: AUTH });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      drift: 0,
      readFailingSince: null,
    });
  });

  it('upgrades the live path to a WebSocket behind the password', async () => {
    const response = await call('/api/roadmap/live', {
      headers: { ...AUTH, Upgrade: 'websocket' },
    });
    expect(response.status).toBe(101);
    response.webSocket?.accept();
    response.webSocket?.close(1000, 'done');
  });
});

/**
 * The roadmap pages carry the held board (#1104 AC1): the site Worker writes
 * the Roadmap object's snapshot into the page's HTML at request time, so the
 * map draws at once with no loading line. The route and its measured cost are
 * on the ticket (comment 7217629209).
 */
describe('the roadmap pages carry the held snapshot (#1104)', () => {
  const CARRIED =
    /<script type="application\/json" id="roadmap-snapshot">([\s\S]*?)<\/script>/;

  it.each(['/roadmap', '/id/roadmap'])(
    '%s carries the snapshot /api/roadmap.json serves, safe inside its script, and its no-script line says the map needs JavaScript',
    async (path) => {
      const served = (await (
        await call('/api/roadmap.json', { headers: AUTH })
      ).json()) as { version: number; items: unknown };
      const page = await call(path, { headers: AUTH });
      const html = await page.text();
      const carried = CARRIED.exec(html)?.[1];
      const parsed =
        carried === undefined
          ? undefined
          : (JSON.parse(carried) as { version: number; items: unknown });
      expect({
        status: page.status,
        cache: page.headers.get('Cache-Control'),
        version: parsed?.version,
        items: parsed?.items,
        // A `<` in a title would end the script early: each is written <.
        rawAngles: carried?.includes('<'),
        noScript:
          /<noscript>[\s\S]*The map needs JavaScript to show\.[\s\S]*<\/noscript>/.test(
            html,
          ),
        oldLines: [
          'Reading the board…',
          'The roadmap could not be read just now.',
        ].filter((line) => html.includes(line)),
      }).toEqual({
        status: 200,
        cache: 'no-store',
        version: served.version,
        items: served.items,
        rawAngles: false,
        noScript: true,
        oldLines: [],
      });
    },
  );
});
