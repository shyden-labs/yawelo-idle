import { describe, expect, it } from 'vitest';
import { progress, publicSnapshot, type BoardItem } from '../src/index';

/**
 * What the public roadmap may carry (#840; Shyden, 2026-11-02: "leave them
 * out of the file. i don't want any leaks in the public"): only the work up
 * to the first public release, only the fields the page reads, and only the
 * figures it shows.
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

const BOARD: BoardItem[] = [
  item({
    number: 1,
    title: 'Epic M1: Foundations',
    estimate: null,
    publicSummary: 'The ground the game stands on.',
  }),
  item({
    number: 2,
    title: 'Epic: Mobile stores',
    estimate: null,
    labels: ['post-launch'],
  }),
  item({
    number: 10,
    parent: 1,
    title: 'Internal: rework the D1 migration runner',
    publicTitle: 'Saves that never get lost',
    labels: ['tech-debt', 'waiting-on-shyden'],
  }),
  item({
    number: 11,
    parent: 1,
    state: 'CLOSED',
    stateReason: 'COMPLETED',
    closedAt: '2026-10-20T08:00:00Z',
    title: 'Internal: secret plan',
  }),
  item({ number: 12, parent: 2, title: 'Internal: store listing' }),
  item({ number: 13, labels: ['post-launch'], title: 'Internal: consoles' }),
  item({
    number: 14,
    state: 'CLOSED',
    stateReason: 'NOT_PLANNED',
    closedAt: '2026-10-21T00:00:00Z',
    title: 'Internal: dropped idea',
  }),
];

const READ = {
  version: 7,
  readAt: '2026-11-02T04:00:00.000Z',
  items: BOARD,
  progress: progress(BOARD, '2026-11-02'),
};

const served = (): string => JSON.stringify(publicSnapshot(READ));

describe('the public roadmap snapshot', () => {
  it('keeps the version and the time of the read', () => {
    expect(publicSnapshot(READ)).toMatchObject({
      version: 7,
      readAt: '2026-11-02T04:00:00.000Z',
    });
  });

  it('carries only the release’s epics and stories', () => {
    expect(publicSnapshot(READ).items.map((i) => i.number)).toEqual([
      1, 10, 11,
    ]);
  });

  it.each([
    ['a post-launch epic', 'Mobile stores'],
    ['a story under a post-launch epic', 'store listing'],
    ['a post-launch story', 'consoles'],
    ['a story closed as not planned', 'dropped idea'],
    ['a story’s raw title', 'Internal:'],
    ['a label', 'tech-debt'],
    ['the waiting label', 'waiting-on-shyden'],
    ['the post-launch label', 'post-launch'],
    ['the close-out lines', 'By tickets'],
  ])('names nothing of %s anywhere in what is served', (_case, needle) => {
    expect(served()).not.toContain(needle);
  });

  it('gives an epic its title and Public summary', () => {
    expect(publicSnapshot(READ).items[0]).toEqual({
      number: 1,
      epicTitle: 'Epic M1: Foundations',
      state: 'OPEN',
      closedAt: null,
      estimate: null,
      parent: null,
      publicTitle: null,
      publicSummary: 'The ground the game stands on.',
      waiting: false,
    });
  });

  it('gives a story its Public title and whether it waits on a decision, never its own title', () => {
    expect(publicSnapshot(READ).items[1]).toEqual({
      number: 10,
      epicTitle: null,
      state: 'OPEN',
      closedAt: null,
      estimate: 3,
      parent: 1,
      publicTitle: 'Saves that never get lost',
      publicSummary: null,
      waiting: true,
    });
  });

  it('gives the tickets figures the page shows', () => {
    expect(publicSnapshot(READ).progress.tickets).toEqual({
      closed: 1,
      total: 2,
      pace: READ.progress.tickets.pace,
    });
  });

  it('gives the effort figures the page shows', () => {
    expect(publicSnapshot(READ).progress.effort).toEqual({
      available: true,
      openPoints: 3,
      assumedClosed: 0,
      scoredMean: 3,
      pace: READ.progress.effort.available ? READ.progress.effort.pace : [],
    });
  });

  it('says only how many stories are scored while effort is unavailable', () => {
    const board = [...BOARD, item({ number: 15, parent: 1, estimate: null })];
    expect(
      publicSnapshot({
        ...READ,
        items: board,
        progress: progress(board, '2026-11-02'),
      }).progress.effort,
    ).toEqual({ available: false, scored: 1, open: 2 });
  });
});
