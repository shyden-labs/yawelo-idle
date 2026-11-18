/**
 * Names the next ticket from the project board, so the board, not a handover
 * file, decides what is worked on next (operator 2026-10-12, #576):
 *
 *   node scripts/board-next.ts <board-node-id> "<board title>"
 *
 * The highest `Priority` (P0 first) among open issues; within a level, what
 * is In Progress first, then what no open issue blocks, then the oldest, then
 * the lowest number. When that ticket is blocked, the walk follows its
 * "Blocked by" links to the open ticket on this board that can start, and
 * names the chain it walked (#772). An issue with open sub-issues is passed over: an epic's
 * work is its stories, so an epic is named only when it has none left open
 * (it needs breaking down). It refuses while any open issue has no Priority,
 * and while any open blocker sits below an issue it blocks, because a blocker
 * takes at least the level of what waits on it (operator 2026-10-13, #578).
 */
import { execFileSync } from 'node:child_process';
import {
  assertBoard,
  assertNamedByRepo,
} from '../packages/progress/src/index.ts';
import {
  type Gh,
  ownerAndName,
  REPO,
  repoIssuePages,
} from './board-progress.ts';
import { PRIORITY_LEVELS } from './board-setup.ts';

/** An open issue that blocks another, as GitHub's "Blocked by" link names it. */
export interface Blocker {
  number: number;
  /** `owner/name` of the blocker's repository. */
  repository: string;
}

export interface NextItem {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  createdAt: string;
  /** The board's Status option, e.g. "Todo" or "In Progress". */
  status: string | null;
  priority: string | null;
  /** `owner/name` of the issue's repository. */
  repository: string;
  /** The OPEN issues this one is blocked by. */
  blockedBy: Blocker[];
  /** Sub-issues not yet completed. */
  openSubIssues: number;
}

const LEVELS = PRIORITY_LEVELS;

/** Most blockers one read returns; an issue with more is refused, not cut short. */
const BLOCKERS_PER_READ = 50;

/** Refuses an open issue with no Priority, or one that is not P0 to P5. */
function assertScored(open: NextItem[]): void {
  const unscored = open.filter((i) => i.priority === null);
  if (unscored.length > 0) {
    throw new Error(
      `${String(unscored.length)} open tickets have no Priority: ${unscored
        .map((i) => `#${String(i.number)}`)
        .join(', ')}. Score them on the board first.`,
    );
  }
  for (const i of open) {
    if (!LEVELS.includes(i.priority as string)) {
      throw new Error(
        `#${String(i.number)} has Priority "${String(i.priority)}", which is not one of ${LEVELS.join(', ')}`,
      );
    }
  }
}

/** Each open issue keyed by `owner/name#number`, so another repository's #1 is never this one's. */
function byKey(open: NextItem[]): Map<string, NextItem> {
  return new Map(open.map((i) => [`${i.repository}#${String(i.number)}`, i]));
}

/**
 * Refuses every pair where an open blocker on this board has a lower level
 * than the issue it blocks. A blocker the board does not hold is passed over
 * here and named by `offBoardBlockers` (operator 2026-10-13).
 */
function assertBlockersInherit(open: NextItem[]): void {
  const onBoard = byKey(open);
  const low: string[] = [];
  for (const i of open) {
    for (const b of i.blockedBy) {
      const blocker = onBoard.get(`${b.repository}#${String(b.number)}`);
      if (blocker === undefined) continue;
      const [mine, theirs] = [i, blocker].map((x) =>
        LEVELS.indexOf(x.priority as string),
      );
      if ((theirs as number) > (mine as number)) {
        low.push(
          `#${String(blocker.number)} (${String(blocker.priority)}) blocks #${String(i.number)} (${String(i.priority)})`,
        );
      }
    }
  }
  if (low.length > 0) {
    throw new Error(
      `A blocker takes at least the level of what waits on it (#578): ${low.join('; ')}. Raise each blocker first.`,
    );
  }
}

/**
 * A note for each open blocker the board does not hold (another repository's
 * issue, or one never added). It never stops the pick: the operator ruled a
 * note, not a refusal (2026-10-13), and it is printed on stderr.
 */
export function offBoardBlockers(items: NextItem[]): string[] {
  const open = items.filter((i) => i.state === 'OPEN');
  const onBoard = byKey(open);
  return open.flatMap((i) =>
    i.blockedBy
      .map((b) => `${b.repository}#${String(b.number)}`)
      .filter((key) => !onBoard.has(key))
      .map(
        (key) =>
          `note: #${String(i.number)} is blocked by ${key}, which is not an open issue on this board`,
      ),
  );
}

/**
 * The board's order within everything open: Priority, then In Progress, then
 * unblocked, then the oldest, then the lowest number.
 */
function rankOf(i: NextItem): number[] {
  return [
    LEVELS.indexOf(i.priority as string),
    i.status === 'In Progress' ? 0 : 1,
    i.blockedBy.length === 0 ? 0 : 1,
    Date.parse(i.createdAt),
    i.number,
  ];
}

function byRank(a: NextItem, b: NextItem): number {
  const [ra, rb] = [rankOf(a), rankOf(b)];
  for (let k = 0; k < ra.length; k++) {
    if (ra[k] !== rb[k]) return (ra[k] as number) - (rb[k] as number);
  }
  return 0;
}

/** The top-ranked ticket, blocked or not, or `null` when nothing is open. */
export function nextTicket(items: NextItem[]): NextItem | null {
  const open = items.filter((i) => i.state === 'OPEN');
  assertScored(open);
  assertBlockersInherit(open);
  const sorted = open.filter((i) => i.openSubIssues === 0).sort(byRank);
  return sorted[0] ?? null;
}

/** Where work can start, and the tickets it unblocks, nearest first. */
export interface Start {
  ticket: NextItem;
  chain: NextItem[];
  /** Why no chain can start, when the ticket named is the blocked top one. */
  waiting: string | null;
}

const ref = (i: NextItem): string => `#${String(i.number)}`;

/**
 * The work that can start for the board's top ticket (#772): the ticket
 * itself when nothing blocks it, else the first open ticket on this board
 * that nothing blocks at the end of its "Blocked by" links, taking blockers
 * in the board's rank. A cycle is refused by name. When every chain ends off
 * this board or at an epic with open sub-issues, the top ticket is named as
 * before, with its blockers and why (`waiting`): an off-board blocker is a
 * note, never a refusal (operator 2026-10-13).
 */
export function nextStart(items: NextItem[]): Start | null {
  const top = nextTicket(items);
  if (top === null) return null;
  const onBoard = byKey(items.filter((i) => i.state === 'OPEN'));
  const ends: string[] = [];
  const walk = (current: NextItem, path: NextItem[]): NextItem[] | null => {
    const here = [...path, current];
    if (path.length > 0 && current.openSubIssues > 0) {
      ends.push(
        `${ref(current)} is an epic with open sub-issues, whose stories are the work`,
      );
      return null;
    }
    if (current.blockedBy.length === 0) return here;
    const blockers = current.blockedBy
      .map((b) => onBoard.get(`${b.repository}#${String(b.number)}`))
      .filter((b): b is NextItem => b !== undefined)
      .sort(byRank);
    if (blockers.length === 0) {
      const off = current.blockedBy
        .map((b) => `${b.repository}#${String(b.number)}`)
        .join(', ');
      ends.push(`${ref(current)} waits only on issues off this board (${off})`);
      return null;
    }
    for (const blocker of blockers) {
      const seen = here.indexOf(blocker);
      if (seen !== -1) {
        const loop = [...here.slice(seen), blocker].map(ref).join(' → ');
        throw new Error(
          `Blocked-by links form a cycle: ${loop}. Break it on the board.`,
        );
      }
      const found = walk(blocker, here);
      if (found !== null) return found;
    }
    return null;
  };
  const path = walk(top, []);
  if (path === null) {
    return { ticket: top, chain: [], waiting: ends[0] ?? null };
  }
  const ticket = path[path.length - 1] as NextItem;
  return { ticket, chain: path.slice(0, -1).reverse(), waiting: null };
}

export const NEXT_QUERY = `query($id: ID!, $endCursor: String) {
  node(id: $id) { ... on ProjectV2 { title
    items(first: 100, after: $endCursor) { totalCount pageInfo { hasNextPage endCursor }
      nodes {
        status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
        priority: fieldValueByName(name: "Priority") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
        content { __typename
          ... on DraftIssue { title }
          ... on PullRequest { title }
          ... on Issue { number title state createdAt repository { nameWithOwner }
            blockedBy(first: ${String(BLOCKERS_PER_READ)}) { totalCount
              nodes { number state repository { nameWithOwner } } }
            subIssuesSummary { total completed } }
        } } } } } }`;

interface RawNode {
  status: { name?: string } | null;
  priority: { name?: string } | null;
  content: {
    __typename: string;
    title?: string;
    number?: number;
    state?: 'OPEN' | 'CLOSED';
    createdAt?: string;
    repository?: { nameWithOwner: string };
    blockedBy?: {
      totalCount: number;
      nodes: Array<{
        number: number;
        state: string;
        repository: { nameWithOwner: string };
      }>;
    };
    subIssuesSummary?: { total: number; completed: number };
  } | null;
}

interface RawPage {
  data: { node: { title: string; items: { nodes: RawNode[] } } };
}

/**
 * The board's issues from the pages `gh api graphql --paginate --slurp`
 * returns for NEXT_QUERY, every page's title asserted first and the pages
 * proved to hold the whole board (#703). Anything that is not a whole issue
 * is refused by name, and so is an issue with more blockers than one read
 * returns.
 */
export function parseNextItems(pages: unknown[], title: string): NextItem[] {
  assertBoard(pages, title);
  const typed = pages as RawPage[];
  return typed.flatMap((page) =>
    page.data.node.items.nodes.map((node): NextItem => {
      const c = node.content;
      if (
        c?.__typename !== 'Issue' ||
        c.number === undefined ||
        c.title === undefined ||
        c.state === undefined ||
        c.createdAt === undefined ||
        c.repository === undefined ||
        c.blockedBy === undefined ||
        c.subIssuesSummary === undefined
      ) {
        throw new Error(
          `"${c?.title ?? '(no content)'}" is not an issue with a number, title, state and creation time: convert it, or remove it from the board`,
        );
      }
      if (c.blockedBy.totalCount > c.blockedBy.nodes.length) {
        throw new Error(
          `#${String(c.number)} has ${String(c.blockedBy.totalCount)} blockers, more than the ${String(BLOCKERS_PER_READ)} one read returns`,
        );
      }
      return {
        number: c.number,
        title: c.title,
        state: c.state,
        createdAt: c.createdAt,
        status: node.status?.name ?? null,
        priority: node.priority?.name ?? null,
        repository: c.repository.nameWithOwner,
        blockedBy: c.blockedBy.nodes
          .filter((b) => b.state === 'OPEN')
          .map((b) => ({
            number: b.number,
            repository: b.repository.nameWithOwner,
          })),
        openSubIssues: c.subIssuesSummary.total - c.subIssuesSummary.completed,
      };
    }),
  );
}

const USAGE =
  'usage: node scripts/board-next.ts <board-node-id> "<board title>" [owner/repo]';

/**
 * The line naming the next ticket on the board `args` names
 * (`<node-id> <title> [owner/repo]`, the repository defaulting to this one),
 * and a note for each blocker the board does not hold. The board's issues are
 * checked against the issues the repository names on it before any ticket
 * is named, so a short listing never picks one (#751).
 */
export function boardNext(
  args: readonly string[],
  gh: Gh,
): { line: string; notes: string[] } {
  const [id, title, repo = REPO] = args;
  if (id === undefined || title === undefined) throw new Error(USAGE);
  ownerAndName(repo);
  // Before the board is read: an issue filed after it is left out of the
  // cross-check (#877).
  const readStartedAt = new Date();
  const out = gh([
    'api',
    'graphql',
    '--paginate',
    '--slurp',
    '-f',
    `query=${NEXT_QUERY}`,
    '-f',
    `id=${id}`,
  ]);
  const pages = JSON.parse(out) as unknown[];
  const items = parseNextItems(pages, title);
  assertNamedByRepo(pages, repoIssuePages(gh, repo), id, repo, readStartedAt);
  const notes = offBoardBlockers(items);
  const start = nextStart(items);
  if (start === null) return { line: 'Next: nothing is open.', notes };
  const { ticket: next, chain, waiting } = start;
  const unblocks = chain.map((i) => `, which blocks ${ref(i)}`).join('');
  const blocked =
    waiting === null
      ? ''
      : `, blocked by ${next.blockedBy.map((b) => `#${String(b.number)}`).join(', ')}`;
  const why =
    waiting === null ? '' : ` Nothing it waits on can start: ${waiting}.`;
  return {
    line: `Next: #${String(next.number)} ${next.title} (${String(next.priority)}, ${next.status ?? 'no status'}${blocked})${unblocks}.${why}`,
    notes,
  };
}

if (import.meta.main) {
  const { line, notes } = boardNext(process.argv.slice(2), (args) =>
    execFileSync('gh', args, { encoding: 'utf8' }),
  );
  for (const note of notes) process.stderr.write(`${note}\n`);
  process.stdout.write(`${line}\n`);
}
