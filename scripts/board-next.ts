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
import { assertTitle } from '../packages/progress/src/index.ts';
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

/**
 * Refuses a blocker that is not an open issue on this board, then every pair
 * where the blocker's level is below the level of the issue it blocks.
 */
function assertBlockersInherit(open: NextItem[]): void {
  const byKey = new Map(
    open.map((i) => [`${i.repository}#${String(i.number)}`, i]),
  );
  const low: string[] = [];
  for (const i of open) {
    for (const b of i.blockedBy) {
      const key = `${b.repository}#${String(b.number)}`;
      const blocker = byKey.get(key);
      if (blocker === undefined) {
        throw new Error(
          `#${String(i.number)} is blocked by ${key}, which is not an open issue on this board: add it, or remove the link`,
        );
      }
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
    items(first: 100, after: $endCursor) { pageInfo { hasNextPage endCursor }
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
 * returns for NEXT_QUERY, every page's title asserted first. Anything that
 * is not a whole issue is refused by name, and so is an issue with more
 * blockers than one read returns.
 */
export function parseNextItems(pages: unknown[], title: string): NextItem[] {
  const typed = pages as RawPage[];
  for (const page of typed) assertTitle(page.data.node.title, title);
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

/** The line naming the next ticket on the board `args` names (`<node-id> <title>`). */
export function boardNext(args: readonly string[], gh: Gh): string {
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
  const next = nextTicket(parseNextItems(JSON.parse(out) as unknown[], title));
  if (next === null) return 'Next: nothing is open.';
  const blocked =
    next.blockedBy.length > 0
      ? `, blocked by ${next.blockedBy.map((b) => `#${String(b.number)}`).join(', ')}`
      : '';
  return `Next: #${String(next.number)} ${next.title} (${String(next.priority)}, ${next.status ?? 'no status'}${blocked}).`;
}

if (import.meta.main) {
  const line = boardNext(process.argv.slice(2), (args) =>
    execFileSync('gh', args, { encoding: 'utf8' }),
  );
  process.stdout.write(`${line}\n`);
}
