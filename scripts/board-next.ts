/**
 * Names the next ticket from the project board, so the board, not a handover
 * file, decides what is worked on next (operator 2026-10-12, #576):
 *
 *   node scripts/board-next.ts <board-node-id> "<board title>"
 *
 * The highest `Priority` (P0 first) among open issues; within a level, what
 * is In Progress first, then what no open issue blocks, then the oldest, then
 * the lowest number. An issue with open sub-issues is passed over: an epic's
 * work is its stories, so an epic is named only when it has none left open
 * (it needs breaking down). It refuses while any open issue has no Priority,
 * and while any open blocker sits below an issue it blocks, because a blocker
 * takes at least the level of what waits on it (operator 2026-10-13, #578).
 */
import { execFileSync } from 'node:child_process';
import { assertBoard } from '../packages/progress/src/index.ts';
import type { Gh } from './board-progress.ts';
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

/** The next ticket, or `null` when nothing is open. */
export function nextTicket(items: NextItem[]): NextItem | null {
  const open = items.filter((i) => i.state === 'OPEN');
  assertScored(open);
  assertBlockersInherit(open);
  const rank = (i: NextItem): number[] => [
    LEVELS.indexOf(i.priority as string),
    i.status === 'In Progress' ? 0 : 1,
    i.blockedBy.length === 0 ? 0 : 1,
    Date.parse(i.createdAt),
    i.number,
  ];
  const sorted = open
    .filter((i) => i.openSubIssues === 0)
    .sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      for (let k = 0; k < ra.length; k++) {
        if (ra[k] !== rb[k]) return (ra[k] as number) - (rb[k] as number);
      }
      return 0;
    });
  return sorted[0] ?? null;
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
  'usage: node scripts/board-next.ts <board-node-id> "<board title>"';

/**
 * The line naming the next ticket on the board `args` names
 * (`<node-id> <title>`), and a note for each blocker the board does not hold.
 */
export function boardNext(
  args: readonly string[],
  gh: Gh,
): { line: string; notes: string[] } {
  const [id, title] = args;
  if (id === undefined || title === undefined) throw new Error(USAGE);
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
  const items = parseNextItems(JSON.parse(out) as unknown[], title);
  const notes = offBoardBlockers(items);
  const next = nextTicket(items);
  if (next === null) return { line: 'Next: nothing is open.', notes };
  const blocked =
    next.blockedBy.length > 0
      ? `, blocked by ${next.blockedBy.map((b) => `#${String(b.number)}`).join(', ')}`
      : '';
  return {
    line: `Next: #${String(next.number)} ${next.title} (${String(next.priority)}, ${next.status ?? 'no status'}${blocked}).`,
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
