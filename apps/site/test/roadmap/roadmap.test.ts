import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeOutLines } from '../../../../packages/progress/src/index';
import {
  boardPages,
  FIXTURE_REPO,
  FIXTURE_TITLE,
} from '../../../../packages/progress/test/board-fixture';
import { roadmapWorld, type RoadmapWorld } from './harness';

/**
 * The `Roadmap` Durable Object (#341, spec §5.2 items 3–6), driven over RPC
 * in wrangler's harness (#506) with its clock replaced, against the fake
 * GitHub serving the shared board fixture. Each test takes a Durable Object
 * of its own.
 */
let world: RoadmapWorld;
const configureFake: RoadmapWorld['configureFake'] = (config) =>
  world.configureFake(config);
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

/** worker/roadmap.ts's grace for a late webhook, pinned here as a literal. */
const GRACE_MS = 120_000;

/** The published shapes, declared here: this program cannot load the Worker's modules. */
interface Snapshot {
  version: number;
  items: { number: number }[];
  lines: [string, string];
}
interface Health {
  version: number;
  drift: number;
  driftTotal: number;
  dropped: Record<string, number>;
  lastCheckAt: string | null;
  lastDriftAt: string | null;
  pendingDriftSince: string | null;
  readFailingSince: string | null;
  readError: string | null;
}
/** The socket a 101 carries: workerd's, which is accepted before use. */
interface Socket {
  accept(): void;
  send(message: string): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void;
}
interface RoadmapStub {
  setClock(at: number): Promise<void>;
  check(): Promise<void>;
  changed(): Promise<void>;
  health(): Promise<Health>;
  snapshot(): Promise<Snapshot | null>;
  fetch(
    url: string,
    init?: RequestInit,
  ): Promise<{ status: number; webSocket: Socket | null }>;
}
type Calls = Omit<RoadmapStub, 'setClock' | 'fetch'>;

const today = () => new Date().toISOString().slice(0, 10);
// The virtual clock starts at the real time, so "today" is the fake's today;
// GitHub's JWT runs on the wall clock regardless (worker/roadmap.ts).
const T0 = Date.now();

let count = 0;
const fresh = async (): Promise<RoadmapStub> => {
  const env = await world.server
    .getWorker<{ ROADMAP: { getByName(name: string): RoadmapStub } }>()
    .getEnv();
  return env.ROADMAP.getByName(`roadmap-test-${String((count += 1))}`);
};

/**
 * Runs `body` against a fresh Durable Object whose clock reads `clock.at`:
 * each call `body` makes sets the object's clock first, so moving `clock.at`
 * moves the next call's time, as the in-object tests did (#341).
 */
async function inRoadmap<T>(
  body: (roadmap: Calls, clock: { at: number }) => Promise<T>,
  stub?: RoadmapStub,
): Promise<T> {
  const target = stub ?? (await fresh());
  const clock = { at: T0 };
  const at =
    <K extends keyof Calls>(method: K) =>
    async (): Promise<Awaited<ReturnType<Calls[K]>>> => {
      await target.setClock(clock.at);
      return (await target[method]()) as Awaited<ReturnType<Calls[K]>>;
    };
  return body(
    {
      check: at('check'),
      changed: at('changed'),
      health: at('health'),
      snapshot: at('snapshot'),
    },
    clock,
  );
}

/** The fixture board with more stories, numbered from 99, so it hashes differently. */
function boardWithExtraStory(extra = 1): unknown[] {
  const pages = boardPages(today()) as {
    data: {
      node: {
        items: { nodes: { content: { number: number; title: string } }[] };
      };
    };
  }[];
  const last = pages.at(-1)?.data.node.items.nodes;
  const template = last?.at(-1);
  if (last === undefined || template === undefined)
    throw new Error('the fixture has no story to copy');
  for (let n = 0; n < extra; n += 1)
    last.push({
      ...structuredClone(template),
      content: {
        ...structuredClone(template.content),
        number: 99 + n,
        title: `Extra story ${String(99 + n)}`,
      },
    });
  return pages;
}

/** GraphQL first-page reads the fake has served: one per board read. */
const boardReads = async () =>
  (await seenByFake()).filter(
    (s) => s.url.endsWith('/graphql') && s.cursor === null,
  ).length;

beforeEach(async () => {
  await resetFake();
});

describe('reading the board', () => {
  it('reads the board on the first health request, as version 1', async () => {
    const health = await inRoadmap((r) => r.health());
    expect(health.version).toBe(1);
    expect(health.lastCheckAt).toBe(new Date(T0).toISOString());
    expect(health.readFailingSince).toBeNull();
  });

  it('gives the same two lines as the close-out script, from one fixture', async () => {
    const snapshot = await inRoadmap((r) => r.snapshot());
    expect(snapshot?.lines).toEqual(
      closeOutLines(boardPages(today()), FIXTURE_TITLE, FIXTURE_REPO, today()),
    );
  });

  it('keeps the version when a read finds the same board', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      clock.at += 600_000;
      await r.check();
      return r.health();
    });
    expect(health.version).toBe(1);
  });

  it('raises the version when an event finds the board changed', async () => {
    const snapshot = await inRoadmap(async (r) => {
      await r.check();
      await configureFake({ pages: boardWithExtraStory() });
      await r.changed();
      return r.snapshot();
    });
    expect(snapshot?.version).toBe(2);
    expect(snapshot?.items.map((i) => i.number)).toContain(99);
  });

  it('coalesces a burst of ten events into at most two reads, ending on the last board', async () => {
    const { reads, snapshot } = await inRoadmap(async (r) => {
      await r.check();
      const before = await boardReads();
      await configureFake({ pages: boardWithExtraStory() });
      await Promise.all(Array.from({ length: 10 }, () => r.changed()));
      return {
        reads: (await boardReads()) - before,
        snapshot: await r.snapshot(),
      };
    });
    expect(reads).toBeGreaterThanOrEqual(1);
    expect(reads).toBeLessThanOrEqual(2);
    expect(snapshot?.items.map((i) => i.number)).toContain(99);
  });

  // Never shown (spec §5.2 item 1), and in production the snapshot and the
  // health are public: a dropped card is counted, never named (#341).
  const STRAYS = [
    [
      'a draft',
      'draft',
      { __typename: 'DraftIssue', title: 'Secret draft idea' },
    ],
    [
      'a pull request',
      'pullRequest',
      { __typename: 'PullRequest', title: 'Secret pull request' },
    ],
    [
      'another repository’s issue',
      'anotherRepository',
      {
        __typename: 'Issue',
        number: 7,
        title: 'Secret other-repo issue',
        state: 'OPEN',
        stateReason: null,
        createdAt: '2026-10-01T00:00:00Z',
        closedAt: null,
        labels: { totalCount: 0, nodes: [] },
        repository: { nameWithOwner: 'shyden-labs/elsewhere' },
      },
    ],
  ] as const;
  for (const [what, key, content] of STRAYS) {
    it(`leaves ${what} off the published snapshot, counting it in health without its title`, async () => {
      const pages = boardPages(today()) as {
        data: { node: { items: { nodes: unknown[] } } };
      }[];
      pages[0]?.data.node.items.nodes.push({ estimate: null, content });
      await configureFake({ pages });
      const { snapshot, health } = await inRoadmap(async (r) => ({
        snapshot: await r.snapshot(),
        health: await r.health(),
      }));
      expect(snapshot?.items.map((i) => i.number)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
      // Exactly these fields are published: a list naming what was dropped,
      // or any other new field, fails here before it ships.
      expect(Object.keys(snapshot ?? {}).sort()).toEqual([
        'hash',
        'items',
        'lines',
        'progress',
        'readAt',
        'version',
      ]);
      expect(Object.keys(health).sort()).toEqual([
        'drift',
        'driftTotal',
        'dropped',
        'lastCheckAt',
        'lastDriftAt',
        'lastEventAt',
        'pendingDriftSince',
        'readError',
        'readFailingSince',
        'version',
      ]);
      expect(health.readError).toBeNull();
      expect(health.dropped).toEqual({
        draft: 0,
        pullRequest: 0,
        anotherRepository: 0,
        [key]: 1,
      });
    });
  }

  it('refuses a board with another title, keeping nothing from it', async () => {
    const pages = boardPages(today()) as {
      data: { node: { title: string } };
    }[];
    for (const page of pages) page.data.node.title = 'ShyTalk Stories';
    await configureFake({ pages });
    const health = await inRoadmap((r) => r.health());
    expect(health.version).toBe(0);
    expect(health.readError).toBe(
      'the board is "ShyTalk Stories", not "Fixture Stories": nothing read',
    );
  });
});

describe('a failed read', () => {
  it('keeps the snapshot and records since when reads fail, and why', async () => {
    const { health, snapshot } = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ graphqlStatus: 502, pages: boardWithExtraStory() });
      clock.at += 60_000;
      await r.changed();
      return { health: await r.health(), snapshot: await r.snapshot() };
    });
    expect(snapshot?.version).toBe(1);
    expect(health.readFailingSince).toBe(new Date(T0 + 60_000).toISOString());
    expect(health.readError).toBe('GitHub refused POST /graphql: HTTP 502');
  });

  it('keeps the first failure’s time while reads go on failing', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ graphqlStatus: 502 });
      clock.at += 60_000;
      await r.changed();
      clock.at += 60_000;
      await r.changed();
      return r.health();
    });
    expect(health.readFailingSince).toBe(new Date(T0 + 60_000).toISOString());
  });

  it('clears the failure on the next good read', async () => {
    const health = await inRoadmap(async (r) => {
      await r.check();
      await configureFake({ graphqlStatus: 502 });
      await r.changed();
      await configureFake({ graphqlStatus: 200 });
      await r.changed();
      return r.health();
    });
    expect(health.readFailingSince).toBeNull();
    expect(health.readError).toBeNull();
  });

  it('reads once for a failed event, never again by itself', async () => {
    const reads = await inRoadmap(async (r) => {
      await r.check();
      await configureFake({ graphqlStatus: 502 });
      const before = await boardReads();
      await r.changed();
      return (await boardReads()) - before;
    });
    expect(reads).toBe(1);
  });
});

describe('drift', () => {
  it('counts a difference the check found with no event, once the grace has passed', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithExtraStory() });
      clock.at += 600_000;
      await r.check();
      const pending = await r.health();
      expect(pending.pendingDriftSince).toBe(new Date(clock.at).toISOString());
      expect(pending.drift).toBe(0);
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.drift).toBe(1);
    expect(health.driftTotal).toBe(1);
    expect(health.pendingDriftSince).toBeNull();
  });

  it('counts no drift when the late webhook arrives within the grace', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithExtraStory() });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS;
      await r.changed();
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.drift).toBe(0);
    expect(health.driftTotal).toBe(0);
  });

  it('counts drift when the webhook comes only after the grace', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithExtraStory() });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      await r.changed();
      return r.health();
    });
    expect(health.drift).toBe(1);
  });

  it('counts no drift when an event came after the last good read began, its own read having failed', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ graphqlStatus: 502, pages: boardWithExtraStory() });
      clock.at += 60_000;
      await r.changed();
      await configureFake({ graphqlStatus: 200 });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(0);
    expect(health.pendingDriftSince).toBeNull();
  });

  it('counts no drift when the check finds the board it already has', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.drift).toBe(0);
    expect(health.pendingDriftSince).toBeNull();
  });

  it('keeps drift with no expiry while no webhook has delivered a change', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithExtraStory() });
      clock.at += 600_000;
      await r.check();
      const found = clock.at;
      clock.at = found + 30 * 86_400_000;
      return r.health();
    });
    expect(health.drift).toBe(1);
    expect(health.driftTotal).toBe(1);
    expect(health.lastDriftAt).toBe(new Date(T0 + 600_000).toISOString());
  });

  it('clears drift once a webhook delivers a change before the check finds it', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithExtraStory(1) });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      expect((await r.health()).drift).toBe(1);
      await configureFake({ pages: boardWithExtraStory(2) });
      clock.at += 60_000;
      await r.changed();
      return r.health();
    });
    expect(health.drift).toBe(0);
    expect(health.driftTotal).toBe(1);
  });

  // Only a webhook proves the delivery path works: a change the check finds
  // leaves earlier drift standing (S3M5a in #341's mutation run survived
  // without this case).
  it('keeps drift when the next change is found by a check, not a webhook', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithExtraStory(1) });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      expect((await r.health()).drift).toBe(1);
      await configureFake({ pages: boardWithExtraStory(2) });
      clock.at += 600_000;
      await r.check();
      return r.health();
    });
    expect(health.drift).toBe(1);
    expect(health.driftTotal).toBe(1);
  });
});

describe('the live socket', () => {
  /**
   * Opens a socket on `stub` and collects what it receives. `next` never
   * waits on a message that will not come: with nothing buffered it sends a
   * ping, and a socket's messages arrive in order, so a pong before any
   * snapshot means no snapshot was sent, and the test fails naming it (#341:
   * three mutants hung here before).
   */
  async function open(stub: RoadmapStub) {
    const response = await stub.fetch('https://roadmap/api/roadmap/live', {
      headers: { Upgrade: 'websocket' },
    });
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    if (socket === null) throw new Error('no socket in the 101');
    socket.accept();
    const received: Snapshot[] = [];
    const pongs: (() => void)[] = [];
    let waiter: {
      resolve: (s: Snapshot) => void;
      reject: (e: Error) => void;
    } | null = null;
    // A pong answering a ping sent while a snapshot was already on its way.
    let late = 0;
    socket.addEventListener('message', (event) => {
      const data = String(event.data);
      if (data === 'pong') {
        if (pongs.length > 0) pongs.shift()?.();
        else if (late > 0) late -= 1;
        else if (waiter !== null) {
          waiter.reject(
            new Error(
              'the socket answered a ping before sending a snapshot: no new version was sent',
            ),
          );
          waiter = null;
        }
        return;
      }
      const snapshot = JSON.parse(data) as Snapshot;
      if (waiter === null) received.push(snapshot);
      else {
        late += 1;
        waiter.resolve(snapshot);
        waiter = null;
      }
    });
    const next = (): Promise<Snapshot> =>
      new Promise((resolve, reject) => {
        const have = received.shift();
        if (have !== undefined) {
          resolve(have);
          return;
        }
        waiter = { resolve, reject };
        socket.send('ping');
      });
    /** Sends a ping and resolves on its pong, the snapshots left alone. */
    const ping = (): Promise<void> =>
      new Promise((resolve) => {
        pongs.push(resolve);
        socket.send('ping');
      });
    return { next, ping };
  }

  it('answers a ping with a pong, whether or not the board has been read', async () => {
    const socket = await open(await fresh());
    await socket.ping();
  });

  it('sends the snapshot on connect, then each new version', async () => {
    const stub = await fresh();
    await inRoadmap((r) => r.check(), stub);
    const socket = await open(stub);
    expect((await socket.next()).version).toBe(1);
    await configureFake({ pages: boardWithExtraStory() });
    await inRoadmap((r) => r.changed(), stub);
    expect((await socket.next()).version).toBe(2);
  });

  it('refuses a request that is not a WebSocket upgrade', async () => {
    const response = await (
      await fresh()
    ).fetch('https://roadmap/api/roadmap/live');
    expect(response.status).toBe(426);
  });
});
