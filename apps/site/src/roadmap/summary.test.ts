import { describe, expect, it } from 'vitest';
import {
  progress,
  publicItems,
  type BoardItem,
  type Progress,
} from '@yawelo-idle/progress';
import {
  estimates,
  recentlyShipped as shippedOf,
  secondsAgo,
  waitingOnDecisions as waitingOf,
  whatsLeft,
} from './summary';
import { voyage as draw } from './voyage';

/** Each board read as the page reads it: through what the Worker serves (#840). */
const voyage = (items: BoardItem[]) => draw(publicItems(items));
const recentlyShipped = (items: BoardItem[]) => shippedOf(publicItems(items));
const waitingOnDecisions = (items: BoardItem[]) =>
  waitingOf(publicItems(items));

/**
 * The roadmap's summary (#828): what's left by epic, both estimates, what
 * shipped recently, how old the snapshot is, and what waits on decisions.
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

const done = (
  number: number,
  closedAt: string,
  over: Partial<BoardItem> = {},
): BoardItem =>
  item({
    number,
    state: 'CLOSED',
    stateReason: 'COMPLETED',
    closedAt,
    publicTitle: `Shipped ${String(number)}`,
    ...over,
  });

const BOARD: BoardItem[] = [
  item({ number: 1, title: 'Epic M1: Foundations', estimate: null }),
  item({ number: 2, title: 'Epic M2: First words', estimate: null }),
  item({ number: 3, title: 'Epic M3: Prestige', estimate: null }),
  item({ number: 10, parent: 1, estimate: 2 }),
  item({ number: 11, parent: 2, estimate: 8 }),
  item({ number: 12, parent: 2, estimate: null }),
  done(13, '2026-10-20T00:00:00Z', { parent: 3 }),
  item({ number: 14, estimate: 5 }),
  item({ number: 15, parent: 99, estimate: 1 }),
];

describe("what's left", () => {
  const left = whatsLeft(voyage(BOARD));

  it('lists every epic, most points left first, then by issue number', () => {
    expect(left.rows.map((r) => [r.epic, r.tickets, r.points])).toEqual([
      [2, 2, 8],
      [1, 1, 2],
      [3, 0, 0],
    ]);
  });

  it('names each epic as its island does', () => {
    expect(left.rows.map((r) => r.name)).toEqual([
      'M2: First words',
      'M1: Foundations',
      'M3: Prestige',
    ]);
  });

  it('gives the islands’ own figures', () => {
    const map = voyage(BOARD);
    expect(left.rows.map((r) => [r.epic, r.tickets, r.points]).sort()).toEqual(
      map.islands.map((i) => [i.epic, i.ticketsLeft, i.pointsLeft]).sort(),
    );
  });

  it('orders islands with equal points by issue number', () => {
    const tied = whatsLeft(
      voyage([
        item({ number: 5, title: 'Epic M2: Later', estimate: null }),
        item({ number: 6, title: 'Epic M1: Sooner', estimate: null }),
        item({ number: 20, parent: 6, estimate: 3 }),
        item({ number: 21, parent: 5, estimate: 3 }),
      ]),
    );
    expect(tied.rows.map((r) => r.epic)).toEqual([5, 6]);
  });

  it('counts the other work on no island', () => {
    expect(left.other).toEqual({ tickets: 2, points: 6 });
  });

  it('totals every row and the other work', () => {
    expect(left.total).toEqual({ tickets: 5, points: 16 });
  });

  it('totals what the effort line counts, post-launch stories left out (#838)', () => {
    const board = [
      // Every open story scored, so the effort line is available.
      ...BOARD.map((i) => (i.number === 12 ? { ...i, estimate: 1 } : i)),
      item({
        number: 4,
        title: 'Epic: Mobile stores',
        estimate: null,
        labels: ['post-launch'],
      }),
      item({ number: 16, parent: 4, estimate: 13 }),
      item({ number: 17, parent: 2, estimate: 5, labels: ['post-launch'] }),
      item({ number: 18, estimate: 8, labels: ['post-launch'] }),
    ];
    const { total } = whatsLeft(voyage(board));
    expect(progress(board, '2026-11-02').effort).toMatchObject({
      available: true,
      openStories: total.tickets,
      openPoints: total.points,
    });
  });

  it('leaves post-launch epics off the rows and out of the totals', () => {
    const board = [
      ...BOARD,
      item({
        number: 4,
        title: 'Epic: Mobile stores',
        estimate: null,
        labels: ['post-launch'],
      }),
      item({ number: 16, parent: 4, estimate: 13 }),
    ];
    const left = whatsLeft(voyage(board));
    expect([left.rows.length, left.total]).toEqual([
      3,
      { tickets: 5, points: 16 },
    ]);
  });
});

const PROGRESS: Progress = {
  tickets: {
    closed: 157,
    total: 430,
    epics: 12,
    postLaunch: 4,
    notPlanned: 3,
    pace: [2, 0, 3, 4, 0, 5, 3],
  },
  effort: {
    available: true,
    closedPoints: 600,
    openPoints: 1177.4,
    openStories: 273,
    assumedClosed: 2,
    scoredMean: 3.5,
    pace: [6, 0, 9, 10, 0, 12, 4],
  },
};

describe('the two estimates', () => {
  const both = estimates(PROGRESS, '2026-11-02');

  it('gives tickets as a share closed, rounded as the close-out rounds it', () => {
    expect([
      both.tickets.percent,
      both.tickets.closed,
      both.tickets.total,
    ]).toEqual([37, 157, 430]);
  });

  it('dates the tickets ETA from their pace, with its confidence', () => {
    // 273 left at 17 in 7 days: ceil(273 × 7 ÷ 17) = 113 days.
    expect([both.tickets.eta, both.tickets.confidence]).toEqual([
      '2027-02-23',
      'medium',
    ]);
  });

  it('gives effort as whole points remaining, never a share', () => {
    expect(both.effort).toMatchObject({ available: true, pointsLeft: 1177 });
    expect(Object.keys(both.effort)).not.toContain('percent');
  });

  it('dates the effort ETA from its pace, with its confidence', () => {
    // 1177.4 left at 41 in 7 days: ceil(1177.4 × 7 ÷ 41) = 202 days.
    expect(both.effort).toMatchObject({
      eta: '2027-05-23',
      confidence: 'medium',
    });
  });

  it('says how many closed stories it assumed the mean for', () => {
    expect(both.effort).toMatchObject({ assumedClosed: 2, scoredMean: 3.5 });
  });

  it('gives no ETA when nothing closed in the window', () => {
    const still = estimates(
      {
        ...PROGRESS,
        tickets: { ...PROGRESS.tickets, pace: [0, 0, 0, 0, 0, 0, 0] },
      },
      '2026-11-02',
    );
    expect([still.tickets.eta, still.tickets.confidence]).toEqual([
      null,
      'low',
    ]);
  });

  it('says effort is unavailable, with how many are scored, until every open story is', () => {
    const unscored = estimates(
      { ...PROGRESS, effort: { available: false, scored: 200, open: 273 } },
      '2026-11-02',
    );
    expect(unscored.effort).toEqual({
      available: false,
      scored: 200,
      open: 273,
    });
  });

  it('gives no tickets share on an empty board', () => {
    const empty = estimates(
      { ...PROGRESS, tickets: { ...PROGRESS.tickets, closed: 0, total: 0 } },
      '2026-11-02',
    );
    expect(empty.tickets.percent).toBe(0);
  });
});

describe('recently shipped', () => {
  it('lists closed stories with a Public title, newest first', () => {
    const board = [
      done(20, '2026-10-01T00:00:00Z'),
      done(21, '2026-10-03T00:00:00Z'),
      done(22, '2026-10-02T00:00:00Z'),
    ];
    expect(recentlyShipped(board).map((s) => s.number)).toEqual([21, 22, 20]);
  });

  it('keeps the last 10', () => {
    const board = Array.from({ length: 12 }, (_, i) =>
      done(100 + i, `2026-10-${String(10 + i)}T00:00:00Z`),
    );
    expect(recentlyShipped(board).map((s) => s.number)).toEqual([
      111, 110, 109, 108, 107, 106, 105, 104, 103, 102,
    ]);
  });

  it('gives each its Public title and closing day', () => {
    expect(recentlyShipped([done(30, '2026-10-05T12:00:00Z')])).toEqual([
      { number: 30, title: 'Shipped 30', closedAt: '2026-10-05' },
    ]);
  });

  it('leaves out stories with no Public title', () => {
    expect(
      recentlyShipped([
        done(31, '2026-10-05T00:00:00Z', { publicTitle: null }),
      ]),
    ).toEqual([]);
  });

  it('leaves out stories closed as not planned or as duplicates', () => {
    expect(
      recentlyShipped([
        done(32, '2026-10-05T00:00:00Z', { stateReason: 'NOT_PLANNED' }),
        done(33, '2026-10-05T00:00:00Z', { stateReason: 'DUPLICATE' }),
      ]),
    ).toEqual([]);
  });

  it('leaves out epics', () => {
    expect(
      recentlyShipped([
        done(34, '2026-10-05T00:00:00Z', { title: 'Epic M1: Foundations' }),
      ]),
    ).toEqual([]);
  });

  it('leaves out post-launch stories, labelled or under a post-launch epic', () => {
    expect(
      recentlyShipped([
        item({
          number: 4,
          title: 'Epic: Stores',
          labels: ['post-launch'],
          estimate: null,
        }),
        done(38, '2026-10-05T00:00:00Z', { labels: ['post-launch'] }),
        done(39, '2026-10-05T00:00:00Z', { parent: 4 }),
      ]),
    ).toEqual([]);
  });

  it('leaves out open stories', () => {
    expect(
      recentlyShipped([item({ number: 35, publicTitle: 'Soon' })]),
    ).toEqual([]);
  });

  it('breaks a tie on closing time by the newer issue', () => {
    const at = '2026-10-05T00:00:00Z';
    expect(
      recentlyShipped([done(36, at), done(37, at)]).map((s) => s.number),
    ).toEqual([37, 36]);
  });
});

describe('waiting on decisions', () => {
  const waiting = (number: number, over: Partial<BoardItem> = {}): BoardItem =>
    item({ number, labels: ['waiting-on-shyden'], ...over });

  it('lists open issues labelled waiting-on-shyden by Public title', () => {
    expect(
      waitingOnDecisions([
        waiting(41, { publicTitle: 'Where the website sits' }),
        waiting(40, { publicTitle: 'The launch copy' }),
      ]),
    ).toEqual({
      named: [
        { number: 40, title: 'The launch copy' },
        { number: 41, title: 'Where the website sits' },
      ],
      unnamed: 0,
    });
  });

  it('counts those with no Public title', () => {
    expect(waitingOnDecisions([waiting(42), waiting(43)])).toEqual({
      named: [],
      unnamed: 2,
    });
  });

  it('leaves out post-launch decisions', () => {
    expect(
      waitingOnDecisions([
        item({
          number: 4,
          title: 'Epic: Stores',
          labels: ['post-launch', 'waiting-on-shyden'],
          estimate: null,
        }),
        waiting(46, { labels: ['waiting-on-shyden', 'post-launch'] }),
        waiting(47, { parent: 4 }),
      ]),
    ).toEqual({ named: [], unnamed: 0 });
  });

  it('leaves out closed issues and unlabelled ones', () => {
    expect(
      waitingOnDecisions([
        waiting(44, { state: 'CLOSED', closedAt: '2026-10-05T00:00:00Z' }),
        item({ number: 45, publicTitle: 'Not waiting' }),
      ]),
    ).toEqual({ named: [], unnamed: 0 });
  });
});

describe('updated ago', () => {
  const readAt = '2026-11-02T04:00:00.000Z';

  it('counts whole seconds since the snapshot was read', () => {
    expect(secondsAgo(readAt, Date.parse(readAt) + 12_900)).toBe(12);
  });

  it('never counts below zero when the clock is behind the server', () => {
    expect(secondsAgo(readAt, Date.parse(readAt) - 5_000)).toBe(0);
  });
});
