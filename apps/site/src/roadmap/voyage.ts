import type { PublicItem } from '@yawelo-idle/progress';

/**
 * The voyage map's model (#827, #342 split): the roadmap snapshot's items as
 * islands, one per epic, each story on its parent epic's island (R4, measured
 * on #826: every parented story's parent is an epic). Only plain words leave
 * this module: an epic's name and Public summary, a story's Public title. A
 * story's raw title never does (Shyden, 2026-10-24).
 */

export type IslandStatus = 'done' | 'part done' | 'not started';

export interface Island {
  epic: number;
  /**
   * The epic's Public title, or null when unset: never its ticket title
   * (#844). `islandName` gives what the page shows.
   */
  name: string | null;
  /** The epic's milestone number, for the name shown while it has none. */
  milestone: number | null;
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
  /** The epic the ship is at: the first island not done; null when all are. */
  shipAt: number | null;
  /** Stories with no epic on the board: in the totals, on no island. */
  other: { ticketsLeft: number; pointsLeft: number; built: number };
}

const isEpic = (item: PublicItem): boolean => item.epic;

/**
 * Delivery order: milestones by number, then epics with no milestone by
 * issue number (a default until Shyden places them).
 */
function byDelivery(a: PublicItem, b: PublicItem): number {
  const ma = a.milestone;
  const mb = b.milestone;
  if (ma !== null && mb !== null) return ma - mb || a.number - b.number;
  if (ma !== null) return -1;
  if (mb !== null) return 1;
  return a.number - b.number;
}

function statusOf(epic: PublicItem, stories: PublicItem[]): IslandStatus {
  if (epic.state === 'CLOSED') return 'done';
  const closed = stories.filter((s) => s.state === 'CLOSED').length;
  if (closed === 0) return 'not started';
  return closed === stories.length ? 'done' : 'part done';
}

const newestFirst = (a: PublicItem, b: PublicItem): number =>
  (b.closedAt ?? '').localeCompare(a.closedAt ?? '') || b.number - a.number;

function islandOf(epic: PublicItem, stories: PublicItem[]): Island {
  const open = stories.filter((s) => s.state === 'OPEN');
  const named = (s: PublicItem): s is PublicItem & { publicTitle: string } =>
    s.publicTitle !== null;
  return {
    epic: epic.number,
    name: epic.publicTitle,
    milestone: epic.milestone,
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
export function voyage(items: PublicItem[]): Voyage {
  // The Worker sends only the work up to the first public release, its
  // stories in the close-out's scope (#838, #840): all of it is drawn.
  const epics = items.filter(isEpic).sort(byDelivery);
  const epicNumbers = new Set(epics.map((e) => e.number));
  const stories = items.filter((i) => !isEpic(i));
  const storiesOf = (epic: number) => stories.filter((s) => s.parent === epic);

  const islands = epics.map((e) => islandOf(e, storiesOf(e.number)));

  const orphans = stories.filter(
    (s) => s.parent === null || !epicNumbers.has(s.parent),
  );
  const orphansOpen = orphans.filter((s) => s.state === 'OPEN');
  return {
    islands,
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
  'done' | 'partDone' | 'notStarted'
> = {
  done: 'done',
  'part done': 'partDone',
  'not started': 'notStarted',
};

/** `text` with each `{name}` replaced by `values[name]`; an unknown name stays. */
export function fill(
  text: string,
  values: Record<string, number | string>,
): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/** A story's or epic's page on GitHub. */
export const issueUrl = (number: number): string =>
  `https://github.com/shyden-labs/yawelo-idle/issues/${String(number)}`;

/** How the page names an island whose epic has no Public title yet (#844). */
export interface UnnamedCopy {
  /** With a milestone, e.g. "Milestone {n}". */
  unnamedIsland: string;
  /** With none. */
  unnamedNoMilestone: string;
}

/** The name the page shows for an island: its Public title, or a placeholder. */
export function islandName(
  island: { name: string | null; milestone: number | null },
  copy: UnnamedCopy,
): string {
  if (island.name !== null) return island.name;
  if (island.milestone !== null)
    return fill(copy.unnamedIsland, { n: island.milestone });
  return copy.unnamedNoMilestone;
}
