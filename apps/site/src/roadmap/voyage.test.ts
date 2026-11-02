import { describe, expect, it } from 'vitest';
import type { BoardItem } from '@yawelo-idle/progress';
import { fill, issueUrl, STATUS_COPY, voyage } from './voyage';

/**
 * The voyage map's model (#827): the snapshot's items as islands, one per
 * epic, each story on its parent's island (R4, measured on #826).
 */

function item(over: Partial<BoardItem> & { number: number }): BoardItem {
  return {
    title: `Story ${String(over.number)}`,
    state: 'OPEN',
    stateReason: null,
    createdAt: '2026-10-01T00:00:00Z',
    closedAt: null,
    estimate: 3,
    labels: [],
    parent: null,
    publicTitle: null,
    publicSummary: null,
    ...over,
  };
}

const epic = (number: number, title: string, over: Partial<BoardItem> = {}) =>
  item({ number, title, estimate: null, ...over });

const closed = (
  number: number,
  parent: number,
  closedAt = '2026-10-20T00:00:00Z',
  over: Partial<BoardItem> = {},
) =>
  item({
    number,
    parent,
    state: 'CLOSED',
    stateReason: 'COMPLETED',
    closedAt,
    ...over,
  });

describe('voyage: the islands (#827)', () => {
  it('makes one island per epic, named without the "Epic" word', () => {
    const { islands } = voyage([epic(6, 'Epic M1: Core simulation')]);
    expect(islands.map((i) => [i.epic, i.name])).toEqual([
      [6, 'M1: Core simulation'],
    ]);
  });

  it('orders milestone epics by their M number, not their issue number', () => {
    const { islands } = voyage([
      epic(17, 'Epic M2: Content'),
      epic(6, 'Epic M1: Core'),
      epic(5, 'Epic M0: Repo'),
    ]);
    expect(islands.map((i) => i.epic)).toEqual([5, 6, 17]);
  });

  it('reads two-digit milestone numbers as numbers', () => {
    const { islands } = voyage([
      epic(20, 'Epic M10: Later'),
      epic(21, 'Epic M9: Sooner'),
    ]);
    expect(islands.map((i) => i.epic)).toEqual([21, 20]);
  });

  it('puts a milestone before an unnumbered epic listed first', () => {
    const { islands } = voyage([
      epic(3, 'Epic: Website'),
      epic(50, 'Epic M0: Repo'),
    ]);
    expect(islands.map((i) => i.epic)).toEqual([50, 3]);
  });

  it('puts a milestone before an unnumbered epic listed second', () => {
    const { islands } = voyage([
      epic(50, 'Epic M0: Repo'),
      epic(3, 'Epic: Website'),
    ]);
    expect(islands.map((i) => i.epic)).toEqual([50, 3]);
  });

  it('orders two epics of the same milestone by issue number', () => {
    const { islands } = voyage([
      epic(9, 'Epic M1: Second'),
      epic(6, 'Epic M1: First'),
    ]);
    expect(islands.map((i) => i.epic)).toEqual([6, 9]);
  });

  it('puts epics with no milestone after the milestones, by issue number', () => {
    const { islands } = voyage([
      epic(452, 'Epic: Analytics'),
      epic(331, 'Epic: Website'),
      epic(12, 'Epic M8: Stores'),
    ]);
    expect(islands.map((i) => i.epic)).toEqual([12, 331, 452]);
  });

  it('puts post-launch epics in the Beyond launch cluster, not the islands', () => {
    const { islands, beyond } = voyage([
      epic(327, 'Epic post-launch: consoles', { labels: ['post-launch'] }),
      epic(6, 'Epic M1: Core'),
    ]);
    expect(islands.map((i) => i.epic)).toEqual([6]);
    expect(beyond.map((i) => [i.epic, i.status])).toEqual([
      [327, 'after launch'],
    ]);
  });

  it('shows the epic’s Public summary as its blurb', () => {
    const { islands } = voyage([
      epic(6, 'Epic M1: Core', { publicSummary: 'The heart of the game.' }),
    ]);
    expect(islands[0]?.summary).toBe('The heart of the game.');
  });

  it('gives an epic with no Public summary no blurb', () => {
    const { islands } = voyage([epic(6, 'Epic M1: Core')]);
    expect(islands[0]?.summary).toBeNull();
  });
});

describe('voyage: each island’s status (#827)', () => {
  const status = (items: BoardItem[]) => voyage(items).islands[0]?.status;

  it('is done when every story is closed', () => {
    expect(status([epic(6, 'Epic M1: Core'), closed(30, 6)])).toBe('done');
  });

  it('is done when the epic itself is closed', () => {
    expect(
      status([
        epic(5, 'Epic M0: Repo', {
          state: 'CLOSED',
          stateReason: 'COMPLETED',
          closedAt: '2026-10-10T00:00:00Z',
        }),
      ]),
    ).toBe('done');
  });

  it('is part done when some stories are closed and some open', () => {
    expect(
      status([
        epic(6, 'Epic M1: Core'),
        closed(30, 6),
        item({ number: 31, parent: 6 }),
      ]),
    ).toBe('part done');
  });

  it('is not started when no story is closed', () => {
    expect(
      status([epic(6, 'Epic M1: Core'), item({ number: 31, parent: 6 })]),
    ).toBe('not started');
  });

  it('is not started for an open epic with no stories', () => {
    expect(status([epic(6, 'Epic M1: Core')])).toBe('not started');
  });

  it('leaves out stories closed as not planned', () => {
    expect(
      status([
        epic(6, 'Epic M1: Core'),
        closed(30, 6),
        closed(31, 6, '2026-10-21T00:00:00Z', { stateReason: 'NOT_PLANNED' }),
      ]),
    ).toBe('done');
  });

  it('leaves out stories closed as duplicates', () => {
    expect(
      status([
        epic(6, 'Epic M1: Core'),
        item({ number: 31, parent: 6 }),
        closed(32, 6, '2026-10-21T00:00:00Z', { stateReason: 'DUPLICATE' }),
      ]),
    ).toBe('not started');
  });
});

describe('voyage: the ship (#827)', () => {
  it('sits at the first island not done', () => {
    const { shipAt } = voyage([
      epic(5, 'Epic M0: Repo'),
      closed(30, 5),
      epic(6, 'Epic M1: Core'),
      item({ number: 31, parent: 6 }),
      epic(7, 'Epic M3: Web'),
    ]);
    expect(shipAt).toBe(6);
  });

  it('is nowhere when every island is done', () => {
    const { shipAt } = voyage([epic(5, 'Epic M0: Repo'), closed(30, 5)]);
    expect(shipAt).toBeNull();
  });
});

describe('voyage: an island’s panel (#827)', () => {
  const island = (items: BoardItem[]) => voyage(items).islands[0];

  it('lists what’s built by Public title, newest first, with each issue', () => {
    const built = island([
      epic(6, 'Epic M1: Core'),
      closed(30, 6, '2026-10-01T00:00:00Z', { publicTitle: 'Older' }),
      closed(31, 6, '2026-10-05T00:00:00Z', { publicTitle: 'Newer' }),
    ])?.built;
    expect(built).toEqual([
      { number: 31, title: 'Newer' },
      { number: 30, title: 'Older' },
    ]);
  });

  it('lists stories closed at the same moment by higher issue number first', () => {
    const built = island([
      epic(6, 'Epic M1: Core'),
      closed(30, 6, '2026-10-05T00:00:00Z', { publicTitle: 'A' }),
      closed(31, 6, '2026-10-05T00:00:00Z', { publicTitle: 'B' }),
    ])?.built;
    expect(built?.map((b) => b.number)).toEqual([31, 30]);
  });

  it('lists a closed story with no close time last', () => {
    const built = island([
      epic(6, 'Epic M1: Core'),
      closed(30, 6, '2026-10-05T00:00:00Z', {
        publicTitle: 'No time',
        closedAt: null,
      }),
      closed(31, 6, '2026-10-01T00:00:00Z', { publicTitle: 'Timed' }),
    ])?.built;
    expect(built?.map((b) => b.number)).toEqual([31, 30]);
  });

  it('lists a closed story with no close time last, whichever comes first', () => {
    const built = island([
      epic(6, 'Epic M1: Core'),
      closed(31, 6, '2026-10-01T00:00:00Z', { publicTitle: 'Timed' }),
      closed(30, 6, '2026-10-05T00:00:00Z', {
        publicTitle: 'No time',
        closedAt: null,
      }),
    ])?.built;
    expect(built?.map((b) => b.number)).toEqual([31, 30]);
  });

  it('lists what’s left by Public title with its points', () => {
    const left = island([
      epic(6, 'Epic M1: Core'),
      item({
        number: 31,
        parent: 6,
        publicTitle: 'Save in the cloud',
        estimate: 5,
      }),
    ])?.left;
    expect(left).toEqual([
      { number: 31, title: 'Save in the cloud', points: 5 },
    ]);
  });

  it('lists what’s left in issue order', () => {
    const left = island([
      epic(6, 'Epic M1: Core'),
      item({ number: 40, parent: 6, publicTitle: 'B' }),
      item({ number: 33, parent: 6, publicTitle: 'A' }),
    ])?.left;
    expect(left?.map((l) => l.number)).toEqual([33, 40]);
  });

  it('counts stories with no Public title as behind the scenes, never naming them', () => {
    const shown = island([
      epic(6, 'Epic M1: Core'),
      closed(30, 6),
      item({ number: 31, parent: 6 }),
      item({ number: 32, parent: 6, publicTitle: 'Named' }),
    ]);
    expect(shown?.behindTheScenes).toBe(2);
    expect(JSON.stringify(shown)).not.toContain('Story 30');
    expect(JSON.stringify(shown)).not.toContain('Story 31');
  });

  it('never carries a story’s raw title', () => {
    const shown = island([
      epic(6, 'Epic M1: Core'),
      closed(30, 6, '2026-10-01T00:00:00Z', { publicTitle: 'Plain' }),
    ]);
    expect(JSON.stringify(shown)).not.toContain('Story 30');
  });

  it('counts tickets and points left', () => {
    const shown = island([
      epic(6, 'Epic M1: Core'),
      closed(30, 6),
      item({ number: 31, parent: 6, estimate: 5 }),
      item({ number: 32, parent: 6, estimate: 8 }),
    ]);
    expect([shown?.ticketsLeft, shown?.pointsLeft]).toEqual([2, 13]);
  });

  it('counts an unscored open story as a ticket with no points', () => {
    const shown = island([
      epic(6, 'Epic M1: Core'),
      item({ number: 31, parent: 6, estimate: null }),
    ]);
    expect([shown?.ticketsLeft, shown?.pointsLeft]).toEqual([1, 0]);
  });
});

describe('voyage: work with no epic (#827, R4)', () => {
  it('is counted as other work, on no island', () => {
    const { islands, other } = voyage([
      epic(6, 'Epic M1: Core'),
      item({ number: 40, estimate: 2 }),
      closed(41, 0, '2026-10-01T00:00:00Z', { parent: null }),
    ]);
    expect(islands[0]?.ticketsLeft).toBe(0);
    expect(other).toEqual({ ticketsLeft: 1, pointsLeft: 2, built: 1 });
  });

  it('counts a story whose parent is not an epic on the board as other work', () => {
    const { other } = voyage([item({ number: 40, parent: 999, estimate: 3 })]);
    expect(other).toEqual({ ticketsLeft: 1, pointsLeft: 3, built: 0 });
  });

  it('counts unscored other work as a ticket with no points', () => {
    const { other } = voyage([item({ number: 40, estimate: null })]);
    expect(other).toEqual({ ticketsLeft: 1, pointsLeft: 0, built: 0 });
  });

  it('leaves not-planned work out of other work', () => {
    const { other } = voyage([
      closed(41, 0, '2026-10-01T00:00:00Z', {
        parent: null,
        stateReason: 'NOT_PLANNED',
      }),
    ]);
    expect(other).toEqual({ ticketsLeft: 0, pointsLeft: 0, built: 0 });
  });
});

describe('fill (#827)', () => {
  it('puts each value in its place', () => {
    expect(fill('{n} stories and {points} points', { n: 2, points: 8 })).toBe(
      '2 stories and 8 points',
    );
  });

  it('leaves an unknown name as it was written', () => {
    expect(fill('{n} and {missing}', { n: 1 })).toBe('1 and {missing}');
  });

  it('writes zero as 0', () => {
    expect(fill('{n} points', { n: 0 })).toBe('0 points');
  });
});

describe('STATUS_COPY (#827)', () => {
  it('names each status’s label', () => {
    expect(STATUS_COPY).toEqual({
      done: 'done',
      'part done': 'partDone',
      'not started': 'notStarted',
      'after launch': 'afterLaunch',
    });
  });
});

describe('issueUrl (#827)', () => {
  it('links to the issue on GitHub', () => {
    expect(issueUrl(331)).toBe(
      'https://github.com/shyden-labs/yawelo-idle/issues/331',
    );
  });
});
