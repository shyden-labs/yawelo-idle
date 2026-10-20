import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeOutLines } from '../../../../packages/progress/src/index';
import {
  boardPages,
  FIXTURE_REPO,
  FIXTURE_TITLE,
  fixtureCardId,
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
  staleReads: number;
  lastStaleReadAt: string | null;
  unseenEvents: number;
  readFailingSince: string | null;
  readError: string | null;
}
/** worker/witness.ts's Witness: the card a webhook changed, and when (#689). */
type Witness =
  | { kind: 'issue'; number: number; updatedAt: string; gone: boolean }
  | { kind: 'item'; id: string; updatedAt: string; gone: boolean };
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
  changed(witness: Witness | null): Promise<void>;
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
    async (
      ...args: Parameters<Calls[K]>
    ): Promise<Awaited<ReturnType<Calls[K]>>> => {
      await target.setClock(clock.at);
      return (await Reflect.apply(target[method], target, args)) as Awaited<
        ReturnType<Calls[K]>
      >;
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

/** When the changes these tests make happened, by GitHub's stamps (#689). */
const CHANGED_AT = new Date(T0).toISOString();

interface FixtureNode {
  id: string;
  updatedAt: string;
  content: {
    number: number;
    title: string;
    state: string;
    stateReason: string | null;
    closedAt: string | null;
    updatedAt: string;
    repository: { nameWithOwner: string };
  };
}
type FixturePages = { data: { node: { items: { nodes: FixtureNode[] } } } }[];

const fixturePages = () => boardPages(today()) as FixturePages;

/** The fixture board with more stories, numbered from 99, so it hashes differently. */
function boardWithExtraStory(extra = 1, pages = fixturePages()): unknown[] {
  const last = pages.at(-1)?.data.node.items.nodes;
  const template = last?.at(-1);
  if (last === undefined || template === undefined)
    throw new Error('the fixture has no story to copy');
  for (let n = 0; n < extra; n += 1)
    last.push({
      ...structuredClone(template),
      id: fixtureCardId(99 + n),
      updatedAt: CHANGED_AT,
      content: {
        ...structuredClone(template.content),
        number: 99 + n,
        title: `Extra story ${String(99 + n)}`,
        updatedAt: CHANGED_AT,
      },
    });
  return pages;
}

/** The fixture board with story #9 closed at CHANGED_AT, as #678 closed. */
function boardWithStoryNineClosed(pages = fixturePages()): FixturePages {
  const nine = pages
    .flatMap((p) => p.data.node.items.nodes)
    .find((n) => n.content.number === 9);
  if (nine === undefined) throw new Error('the fixture has no story 9');
  nine.updatedAt = CHANGED_AT;
  Object.assign(nine.content, {
    state: 'CLOSED',
    stateReason: 'COMPLETED',
    closedAt: CHANGED_AT,
    updatedAt: CHANGED_AT,
  });
  return pages;
}

/** The fixture board without story #9's card, as an archived card leaves it. */
function boardWithoutStoryNine(): unknown[] {
  const pages = fixturePages();
  for (const page of pages)
    page.data.node.items.nodes = page.data.node.items.nodes.filter(
      (n) => n.content.number !== 9,
    );
  return pages;
}

/**
 * The fixture board with story #9 transferred to another repository: its
 * card stays, holding the issue's new home (#689).
 */
function boardWithStoryNineTransferred(): unknown[] {
  const pages = fixturePages();
  const nine = pages
    .flatMap((p) => p.data.node.items.nodes)
    .find((n) => n.content.number === 9);
  if (nine === undefined) throw new Error('the fixture has no story 9');
  nine.content.repository = { nameWithOwner: 'shyden-labs/elsewhere' };
  return pages;
}

/** The webhooks for those changes. */
const extraStoryClosed: Witness = {
  kind: 'issue',
  number: 99,
  updatedAt: CHANGED_AT,
  gone: false,
};
const storyNineClosed: Witness = {
  kind: 'issue',
  number: 9,
  updatedAt: CHANGED_AT,
  gone: false,
};
/** #9 deleted, or transferred to another repository: gone from this one. */
const storyNineGone: Witness = { ...storyNineClosed, gone: true };
// Functions, so the fixture's card ids are made at test time, never at
// collection (tests/guards/collection-calls.test.ts).
const cardAdded = (number = 99): Witness => ({
  kind: 'item',
  id: fixtureCardId(number),
  updatedAt: CHANGED_AT,
  gone: false,
});
const storyNineArchived = (): Witness => ({
  kind: 'item',
  id: fixtureCardId(9),
  updatedAt: CHANGED_AT,
  gone: true,
});

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
      await r.changed(cardAdded());
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
      await Promise.all(
        Array.from({ length: 10 }, () => r.changed(cardAdded())),
      );
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
        'lastStaleReadAt',
        'pendingDriftSince',
        'readError',
        'readFailingSince',
        'staleReads',
        'unseenEvents',
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

  // The fixture's 9 items, with GitHub counting 10 on the board (#703).
  it('refuses a read short of the board, keeping nothing from it', async () => {
    await configureFake({ totalCount: 10 });
    const health = await inRoadmap((r) => r.health());
    expect(health.version).toBe(0);
    expect(health.readError).toBe(
      'the board has 10 items and 9 were read: nothing read',
    );
  });
});

describe('a failed read', () => {
  it('keeps the snapshot and records since when reads fail, and why', async () => {
    const { health, snapshot } = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ graphqlStatus: 502, pages: boardWithExtraStory() });
      clock.at += 60_000;
      await r.changed(cardAdded());
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
      await r.changed(null);
      clock.at += 60_000;
      await r.changed(null);
      return r.health();
    });
    expect(health.readFailingSince).toBe(new Date(T0 + 60_000).toISOString());
  });

  it('clears the failure on the next good read', async () => {
    const health = await inRoadmap(async (r) => {
      await r.check();
      await configureFake({ graphqlStatus: 502 });
      await r.changed(null);
      await configureFake({ graphqlStatus: 200 });
      await r.changed(null);
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
      await r.changed(null);
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
      await r.changed(cardAdded());
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
      await r.changed(cardAdded());
      return r.health();
    });
    expect(health.drift).toBe(1);
  });

  it('counts no drift when an event’s own read failed and the check finds its change', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ graphqlStatus: 502, pages: boardWithExtraStory() });
      clock.at += 60_000;
      await r.changed(cardAdded());
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
      await r.changed(cardAdded(100));
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

/**
 * #689: on 2026-10-19 every webhook was delivered and accepted, yet dev
 * reported drift: the read #678's closure caused most likely got the board
 * from before it. Each webhook now names its card and when it changed; a
 * read is judged card by card against those witnesses.
 */
describe('a read behind its webhook (#689)', () => {
  it('counts no drift when an event’s read is behind its webhook and the check then finds the change', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      clock.at += 60_000;
      // The fake still serves the board from before #9 closed.
      await r.changed(storyNineClosed);
      await configureFake({ pages: boardWithStoryNineClosed() });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(0);
    expect(health.driftTotal).toBe(0);
    expect(health.staleReads).toBe(1);
    expect(health.lastStaleReadAt).toBe(new Date(T0 + 60_000).toISOString());
    expect(health.unseenEvents).toBe(0);
  });

  // Blind spot 1: a late read used to excuse every change until the check.
  it('counts drift for a change no webhook named, though another card’s webhook was owed', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      clock.at += 60_000;
      await r.changed(storyNineClosed);
      await configureFake({
        pages: boardWithExtraStory(1, boardWithStoryNineClosed()),
      });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(1);
    expect(health.staleReads).toBe(1);
  });

  // Blind spot 2: a card added to the board but not yet in the read.
  it('counts no drift when an event’s read is behind a card added to the board', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      clock.at += 60_000;
      await r.changed(cardAdded());
      await configureFake({ pages: boardWithExtraStory() });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(0);
    expect(health.staleReads).toBe(1);
  });

  it('does not count a read late for an issue that is not on the board', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      clock.at += 60_000;
      await r.changed(extraStoryClosed);
      return r.health();
    });
    expect(health.staleReads).toBe(0);
    expect(health.lastStaleReadAt).toBeNull();
  });

  it('counts drift for a change an event’s read found that no webhook named', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({
        pages: boardWithExtraStory(1, boardWithStoryNineClosed()),
      });
      clock.at += 60_000;
      await r.changed(storyNineClosed);
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(1);
    expect(health.lastDriftAt).toBe(new Date(T0 + 60_000).toISOString());
    expect(health.staleReads).toBe(0);
  });

  it('lets a late webhook within the grace explain its own card, not another', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({
        pages: boardWithExtraStory(1, boardWithStoryNineClosed()),
      });
      clock.at += 600_000;
      await r.check();
      clock.at += 60_000;
      await r.changed(storyNineClosed);
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.drift).toBe(1);
    expect(health.driftTotal).toBe(1);
  });

  // A deleted or transferred issue never shows in this repository's read
  // again, so its witness is seen by its absence (#689, found after #691).
  it('counts no drift when a deleted issue’s card leaves the board by webhook', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithoutStoryNine() });
      clock.at += 60_000;
      await r.changed(storyNineGone);
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(0);
    expect(health.staleReads).toBe(0);
  });

  it('counts no drift when a transferred issue leaves the roadmap by webhook', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithStoryNineTransferred() });
      clock.at += 60_000;
      await r.changed(storyNineGone);
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(0);
    expect(health.staleReads).toBe(0);
  });

  it('counts no drift when an archived card leaves the board by webhook', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithoutStoryNine() });
      clock.at += 60_000;
      await r.changed(storyNineArchived());
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(0);
    expect(health.staleReads).toBe(0);
  });

  it('drops a webhook no check shows within the grace, counting it unseen', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      clock.at += 60_000;
      await r.changed(storyNineClosed);
      clock.at += 600_000;
      await r.check();
      return r.health();
    });
    expect(health.unseenEvents).toBe(1);
    expect(health.staleReads).toBe(2);
    expect(health.drift).toBe(0);
  });

  it('lets a dropped webhook explain no later change', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      clock.at += 60_000;
      await r.changed(storyNineClosed);
      clock.at += 600_000;
      await r.check();
      await configureFake({ pages: boardWithStoryNineClosed() });
      clock.at += 600_000;
      await r.check();
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.unseenEvents).toBe(1);
    expect(health.drift).toBe(1);
  });

  it('explains nothing by a delivery that names no card', async () => {
    const health = await inRoadmap(async (r, clock) => {
      await r.check();
      await configureFake({ pages: boardWithExtraStory() });
      clock.at += 60_000;
      await r.changed(null);
      clock.at += GRACE_MS + 1;
      return r.health();
    });
    expect(health.version).toBe(2);
    expect(health.drift).toBe(1);
  });
});

describe('the live socket', () => {
  /**
   * The stated ceiling on one wait for the socket (#341). The suite has no
   * per-test limit, so a message that never comes would hang it unnamed.
   * Neither socket test reached vitest's 300 ms slow mark in any of 15 CI
   * baselines of this file (mutation runs 38695826318, 38696731844 and
   * 38701252739), so 10 s means the message is not coming.
   */
  const SOCKET_CEILING_MS = 10_000;

  /** `pending`, failing by name if it has not settled within the ceiling. */
  async function within<T>(pending: Promise<T>, what: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ceiling = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            `no ${what} within ${String(SOCKET_CEILING_MS / 1000)} s of asking`,
          ),
        );
      }, SOCKET_CEILING_MS);
    });
    try {
      return await Promise.race([pending, ceiling]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Opens a socket on `stub` and collects what it receives. `next` never
   * waits on a message that will not come: with nothing buffered it sends a
   * ping, and a socket's messages arrive in order, so a pong before any
   * snapshot means no snapshot was sent, and the test fails naming it (#341:
   * three mutants hung here before). A pong that never comes fails by name
   * at the ceiling.
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
      within(
        new Promise((resolve, reject) => {
          const have = received.shift();
          if (have !== undefined) {
            resolve(have);
            return;
          }
          waiter = { resolve, reject };
          socket.send('ping');
        }),
        'snapshot or pong',
      );
    /** Sends a ping and resolves on its pong, the snapshots left alone. */
    const ping = (): Promise<void> =>
      within(
        new Promise((resolve) => {
          pongs.push(resolve);
          socket.send('ping');
        }),
        'pong',
      );
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
    await inRoadmap((r) => r.changed(cardAdded()), stub);
    expect((await socket.next()).version).toBe(2);
  });

  it('refuses a request that is not a WebSocket upgrade', async () => {
    const response = await (
      await fresh()
    ).fetch('https://roadmap/api/roadmap/live');
    expect(response.status).toBe(426);
  });
});
