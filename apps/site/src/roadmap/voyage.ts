import type { BoardItem } from '@yawelo-idle/progress';

/**
 * The voyage map's model (#827, #342 split): the roadmap snapshot's items as
 * islands, one per epic, each story on its parent epic's island (R4, measured
 * on #826: every parented story's parent is an epic). Only plain words leave
 * this module: an epic's name and Public summary, a story's Public title. A
 * story's raw title never does (Shyden, 2026-10-24).
 */

export type IslandStatus =
  'done' | 'part done' | 'not started' | 'after launch';

export interface Island {
  epic: number;
  /** The epic's title without the word "Epic", e.g. "M1: Core simulation". */
  name: string;
  /** The epic's Public summary, or null when unset. */
  summary: string | null;
  status: IslandStatus;
  /** Closed stories with a Public title, newest first. */
  built: { number: number; title: string }[];
  /** Open stories with a Public title, in issue order, with their points. */
  left: { number: number; title: string; points: number | null }[];
  /** Stories without a Public title: counted, never named. */
  behindTheScenes: number;
  ticketsLeft: number;
  pointsLeft: number;
}

export interface Voyage {
  islands: Island[];
  /** Post-launch epics: the "Beyond launch" cluster. */
  beyond: Island[];
  /** The epic the ship is at: the first island not done; null when all are. */
  shipAt: number | null;
  /** Stories with no epic on the board: in the totals, on no island. */
  other: { ticketsLeft: number; pointsLeft: number; built: number };
}

/** The same rule as packages/progress: an epic's title starts with "Epic". */
const isEpic = (item: BoardItem): boolean => /^Epic\b/.test(item.title);

const isPostLaunch = (item: BoardItem): boolean =>
  item.labels.includes('post-launch');

/** Closed as not planned or as a duplicate: neither built nor left. */
const isDropped = (item: BoardItem): boolean =>
  item.state === 'CLOSED' &&
  (item.stateReason === 'NOT_PLANNED' || item.stateReason === 'DUPLICATE');

/** An epic's milestone number ("Epic M3: …" is 3), or null when it has none. */
function milestone(title: string): number | null {
  const match = /^Epic M(\d+)\b/.exec(title);
  return match === null ? null : Number(match[1]);
}

/**
 * Delivery order: milestones by number, then epics with no milestone by
 * issue number (a default until Shyden places them).
 */
function byDelivery(a: BoardItem, b: BoardItem): number {
  const ma = milestone(a.title);
  const mb = milestone(b.title);
  if (ma !== null && mb !== null) return ma - mb || a.number - b.number;
  if (ma !== null) return -1;
  if (mb !== null) return 1;
  return a.number - b.number;
}

function statusOf(epic: BoardItem, stories: BoardItem[]): IslandStatus {
  if (isPostLaunch(epic)) return 'after launch';
  if (epic.state === 'CLOSED') return 'done';
  const closed = stories.filter((s) => s.state === 'CLOSED').length;
  if (closed === 0) return 'not started';
  return closed === stories.length ? 'done' : 'part done';
}

const newestFirst = (a: BoardItem, b: BoardItem): number =>
  (b.closedAt ?? '').localeCompare(a.closedAt ?? '') || b.number - a.number;

function islandOf(epic: BoardItem, stories: BoardItem[]): Island {
  const open = stories.filter((s) => s.state === 'OPEN');
  const named = (s: BoardItem): s is BoardItem & { publicTitle: string } =>
    s.publicTitle !== null;
  return {
    epic: epic.number,
    name: epic.title.replace(/^Epic\b\s*:?\s*/, ''),
    summary: epic.publicSummary,
    status: statusOf(epic, stories),
    built: stories
      .filter((s) => s.state === 'CLOSED')
      .sort(newestFirst)
      .filter(named)
      .map((s) => ({ number: s.number, title: s.publicTitle })),
    left: open
      .filter(named)
      .sort((a, b) => a.number - b.number)
      .map((s) => ({
        number: s.number,
        title: s.publicTitle,
        points: s.estimate,
      })),
    behindTheScenes: stories.filter((s) => !named(s)).length,
    ticketsLeft: open.length,
    pointsLeft: open.reduce((sum, s) => sum + (s.estimate ?? 0), 0),
  };
}

/** The voyage the snapshot's `items` draw. */
export function voyage(items: BoardItem[]): Voyage {
  const epics = items.filter(isEpic).sort(byDelivery);
  const epicNumbers = new Set(epics.map((e) => e.number));
  const stories = items.filter((i) => !isEpic(i) && !isDropped(i));
  const storiesOf = (epic: number) => stories.filter((s) => s.parent === epic);

  const all = epics.map((e) => islandOf(e, storiesOf(e.number)));
  const islands = all.filter((i) => i.status !== 'after launch');
  const beyond = all.filter((i) => i.status === 'after launch');

  const orphans = stories.filter(
    (s) => s.parent === null || !epicNumbers.has(s.parent),
  );
  const orphansOpen = orphans.filter((s) => s.state === 'OPEN');
  return {
    islands,
    beyond,
    shipAt: islands.find((i) => i.status !== 'done')?.epic ?? null,
    other: {
      ticketsLeft: orphansOpen.length,
      pointsLeft: orphansOpen.reduce((sum, s) => sum + (s.estimate ?? 0), 0),
      built: orphans.length - orphansOpen.length,
    },
  };
}

/** Which of the copy's status labels names each status. */
export const STATUS_COPY: Record<
  IslandStatus,
  'done' | 'partDone' | 'notStarted' | 'afterLaunch'
> = {
  done: 'done',
  'part done': 'partDone',
  'not started': 'notStarted',
  'after launch': 'afterLaunch',
};

/** `text` with each `{name}` replaced by `values[name]`; an unknown name stays. */
export function fill(text: string, values: Record<string, number>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/** A story's or epic's page on GitHub. */
export const issueUrl = (number: number): string =>
  `https://github.com/shyden-labs/yawelo-idle/issues/${String(number)}`;
