// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import {
  publicItems,
  type BoardItem,
  type Progress,
} from '@yawelo-idle/progress';
import { COPY } from '../copy';
import RoadmapSummary from './RoadmapSummary.svelte';
import type { Island, Voyage } from './voyage';

/**
 * The roadmap's summary screen (#828), mounted in jsdom the #806 way: both
 * estimates with their ETAs, what's left by island with its totals, what
 * shipped, what waits on decisions, and a clock counting from the read.
 */
const copy = COPY.en.voyage.summary;
const READ_AT = '2026-11-02T04:00:00.000Z';

const island = (
  epic: number,
  name: string,
  tickets: number,
  points: number,
): Island => ({
  epic,
  name,
  milestone: null,
  summary: null,
  status: 'part done',
  built: [],
  left: [],
  behindTheScenes: 0,
  ticketsLeft: tickets,
  pointsLeft: points,
});

const MAP: Voyage = {
  islands: [
    island(1, 'M1: Foundations', 1, 2),
    island(2, 'M2: First words', 3, 13),
  ],
  shipAt: 1,
  other: { ticketsLeft: 2, pointsLeft: 5, built: 0 },
};

const EFFORT = {
  available: true as const,
  closedPoints: 600,
  openPoints: 1177.4,
  openStories: 273,
  assumedClosed: 0,
  scoredMean: 3.5,
  pace: [6, 0, 9, 10, 0, 12, 4],
};

const PROGRESS: Progress = {
  tickets: {
    closed: 157,
    total: 430,
    epics: 12,
    postLaunch: 4,
    notPlanned: 3,
    pace: [2, 0, 3, 4, 0, 5, 3],
  },
  effort: EFFORT,
};

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

const waiting = (number: number, publicTitle: string | null = null) =>
  item({ number, labels: ['waiting-on-shyden'], publicTitle });

const shipped = item({
  number: 50,
  state: 'CLOSED',
  stateReason: 'COMPLETED',
  closedAt: '2026-10-30T09:00:00Z',
  publicTitle: 'Words come back on time',
});

let mounted: ReturnType<typeof mount> | undefined;

const show = (
  over: { items?: BoardItem[]; progress?: Progress; map?: Voyage } = {},
): { root: HTMLElement; app: ReturnType<typeof mount> } => {
  const target = document.createElement('div');
  document.body.append(target);
  const app = mount(RoadmapSummary, {
    target,
    props: {
      map: over.map ?? MAP,
      items: publicItems(over.items ?? [shipped]),
      progress: over.progress ?? PROGRESS,
      readAt: READ_AT,
      copy,
      unnamed: COPY.en.voyage,
      copyLang: 'en',
    },
  });
  mounted = app;
  flushSync();
  return { root: target, app };
};

const view = (
  over: { items?: BoardItem[]; progress?: Progress; map?: Voyage } = {},
) => show(over).root;

const text = (root: HTMLElement, selector: string): string[] =>
  [...root.querySelectorAll(selector)].map((e) =>
    e.textContent.trim().replace(/\s+/g, ' '),
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse(READ_AT) + 3_000);
});

afterEach(() => {
  if (mounted !== undefined) void unmount(mounted);
  mounted = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('the roadmap summary', () => {
  it('gives the tickets estimate with its bar, ETA and confidence', () => {
    const root = view();
    expect([
      text(root, '.tickets p'),
      root.querySelector('.tickets progress')?.getAttribute('value'),
    ]).toEqual([
      [
        '37% of stories done (157 of 430)',
        'At the last week’s pace, done around 2027-02-23 (medium confidence)',
      ],
      '37',
    ]);
  });

  it('gives the effort estimate as points left, with its ETA and no share', () => {
    const root = view();
    expect([
      text(root, '.effort p'),
      root.querySelector('.effort progress'),
    ]).toEqual([
      [
        '1177 points of work left',
        'At the last week’s pace, done around 2027-05-23 (medium confidence)',
      ],
      null,
    ]);
  });

  it('says what is measured and what is assumed', () => {
    expect(text(view(), '.measured')).toEqual([copy.measured]);
  });

  it('says how many finished stories it counted at the mean', () => {
    const root = view({
      progress: { ...PROGRESS, effort: { ...EFFORT, assumedClosed: 2 } },
    });
    expect(text(root, '.assumed')).toEqual([
      '2 finished stories were never sized; each counts as the average, 3.5 points.',
    ]);
  });

  it('says nothing of assumed stories when every finished one was sized', () => {
    expect(view().querySelector('.assumed')).toBeNull();
  });

  it('says effort is unavailable until every open story is sized', () => {
    const root = view({
      progress: {
        ...PROGRESS,
        effort: { available: false, scored: 200, open: 273 },
      },
    });
    expect(text(root, '.effort p')).toEqual([
      'Points left: not every story is sized yet (200 of 273)',
    ]);
  });

  it('gives no date when nothing finished in the last week', () => {
    const root = view({
      progress: {
        ...PROGRESS,
        tickets: { ...PROGRESS.tickets, pace: [0, 0, 0, 0, 0, 0, 0] },
      },
    });
    expect(text(root, '.tickets .eta')).toEqual([
      'No date yet: nothing was finished in the last week',
    ]);
  });

  it("lists what's left by island, most points first, with other work and the total", () => {
    const root = view();
    expect(
      [...root.querySelectorAll('.whats-left tr')].map((tr) =>
        [...tr.children].map((c) => c.textContent.trim()),
      ),
    ).toEqual([
      ['Island', 'Stories', 'Points'],
      ['M2: First words', '3', '13'],
      ['M1: Foundations', '1', '2'],
      ['Other work', '2', '5'],
      ['Total', '6', '20'],
    ]);
  });

  it('lists what shipped, linked, with its day', () => {
    const root = view();
    expect([
      text(root, '.shipped a'),
      root.querySelector('.shipped a')?.getAttribute('href'),
      root.querySelector('.shipped time')?.getAttribute('datetime'),
    ]).toEqual([
      ['Words come back on time'],
      'https://github.com/shyden-labs/yawelo-idle/issues/50',
      '2026-10-30',
    ]);
  });

  it('says nothing has shipped yet when nothing has', () => {
    const root = view({ items: [] });
    expect([
      root.querySelector('.shipped'),
      text(root, 'p').includes('Nothing shipped yet.'),
    ]).toEqual([null, true]);
  });

  it('says nothing waits on a decision when nothing does', () => {
    const root = view();
    expect([
      root.querySelector('.waiting'),
      text(root, 'p').includes('Nothing is waiting on a decision.'),
    ]).toEqual([null, true]);
  });

  it('lists the decisions waiting, by plain title, and counts the rest', () => {
    const root = view({
      items: [waiting(60, 'The launch copy'), waiting(61)],
    });
    expect([text(root, '.waiting a'), text(root, '.waiting .unnamed')]).toEqual(
      [['The launch copy'], ['1 not yet described']],
    );
  });

  it('counts unnamed decisions when none is named', () => {
    const root = view({ items: [waiting(62)] });
    expect([
      text(root, '.waiting li'),
      root.querySelector('.waiting a'),
    ]).toEqual([['1 not yet described'], null]);
  });

  it('lists named decisions alone when every one has a title', () => {
    const root = view({ items: [waiting(63, 'Where M9 sits')] });
    expect([text(root, '.waiting li'), root.querySelector('.unnamed')]).toEqual(
      [['Where M9 sits'], null],
    );
  });

  it('counts the seconds since the board was read', () => {
    expect(text(view(), '.updated')).toEqual(['Updated 3 s ago']);
  });

  it('keeps counting each second', () => {
    const root = view();
    vi.advanceTimersByTime(2_000);
    flushSync();
    expect(text(root, '.updated')).toEqual(['Updated 5 s ago']);
  });

  it('stops its clock when it leaves the page', () => {
    const { app } = show();
    const running = vi.getTimerCount();
    void unmount(app);
    mounted = undefined;
    expect([running, vi.getTimerCount()]).toEqual([1, 0]);
  });

  it('names an island with no Public title by its milestone (#844)', () => {
    const root = view({
      map: {
        ...MAP,
        islands: [{ ...island(4, 'unused', 1, 3), name: null, milestone: 4 }],
      },
    });
    expect(text(root, '.whats-left tbody th')[0]).toBe('Milestone 4');
  });
});
