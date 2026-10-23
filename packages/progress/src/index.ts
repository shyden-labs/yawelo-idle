/**
 * Progress from the project board, twice: by tickets and by effort (story
 * points in the board's `Estimate` field), each with its measured pace over
 * the last 7 days and the ETA that pace gives. Every session close-out
 * quotes these two lines, then adds what the pace cannot know: outside waits
 * (operator sign-offs, store review, devices) and any assumed change of pace.
 *
 * One home for this maths (website spec §5.2 item 7): scripts/board-progress.ts
 * prints the close-out lines from it, and the site Worker's roadmap (#341)
 * reads the same functions, so the two cannot disagree. Ported from
 * shyden-labs/repo-template's scripts/board-progress.ts (0a7829f) in #340,
 * which also fixed what that source let through: an empty scope, an Estimate
 * off the points scale, a story closed as not planned, a cut-off label list
 * and a day of floating-point error in the ETA.
 *
 * Pure functions over a board snapshot: no I/O and no clock (`today` is
 * passed in), so it runs in Node and in workerd alike.
 *
 * Left out of scope: epics (an epic is the sum of its stories), anything
 * labelled `post-launch` (not part of release-ready), and stories closed as
 * not planned or as duplicates (neither done nor left to do).
 */

export interface BoardItem {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  /** GitHub's reason for the state: null while an issue has never closed. */
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'DUPLICATE' | 'REOPENED' | null;
  createdAt: string;
  closedAt: string | null;
  estimate: number | null;
  labels: string[];
}

export interface TicketProgress {
  closed: number;
  total: number;
  epics: number;
  postLaunch: number;
  notPlanned: number;
  /**
   * Closures per UTC day over the 7 days ending today, oldest first; fewer
   * days while the board's oldest story is younger than that, because days
   * before the project existed are not working days.
   */
  pace: number[];
}

export type EffortProgress =
  | { available: false; scored: number; open: number }
  | {
      available: true;
      closedPoints: number;
      openPoints: number;
      /** In-scope stories still open, each of them scored. */
      openStories: number;
      /** Closed stories with no estimate, counted at the scored closed mean. */
      assumedClosed: number;
      scoredMean: number;
      /** Points closed per UTC day over the same window, oldest first. */
      pace: number[];
    };

export interface Progress {
  tickets: TicketProgress;
  effort: EffortProgress;
}

const WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;
/** Story points (global rule, 2026-10-04): anything larger is an epic to split. */
const POINTS = [1, 2, 3, 5, 8, 13];

const isEpic = (item: BoardItem): boolean => /^Epic\b/.test(item.title);
const isPostLaunch = (item: BoardItem): boolean =>
  item.labels.includes('post-launch');
const isNotPlanned = (item: BoardItem): boolean =>
  item.state === 'CLOSED' &&
  (item.stateReason === 'NOT_PLANNED' || item.stateReason === 'DUPLICATE');

/** Whether a board item counts towards release-ready. */
export function inScope(item: BoardItem): boolean {
  return !isEpic(item) && !isPostLaunch(item) && !isNotPlanned(item);
}

/** The UTC days of the window ending `today`, oldest first, none before `since`. */
function windowDays(today: string, since: string): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: WINDOW_DAYS }, (_, i) =>
    new Date(end - (WINDOW_DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  ).filter((day) => day >= since);
}

function perDay(
  closed: BoardItem[],
  days: string[],
  weight: (item: BoardItem) => number,
): number[] {
  return days.map((day) =>
    closed
      .filter((item) => item.closedAt?.slice(0, 10) === day)
      .reduce((sum, item) => sum + weight(item), 0),
  );
}

export function progress(items: BoardItem[], today: string): Progress {
  const scope = items.filter(inScope);
  if (scope.length === 0) {
    throw new Error('the board has no in-scope stories: nothing to measure');
  }
  for (const item of scope) {
    if (item.estimate !== null && !POINTS.includes(item.estimate)) {
      throw new Error(
        `#${String(item.number)} has Estimate ${String(item.estimate)}: a story is 1, 2, 3, 5, 8 or 13 points, and anything larger is an epic to split`,
      );
    }
  }
  const closed = scope.filter((item) => item.state === 'CLOSED');
  const open = scope.filter((item) => item.state === 'OPEN');
  // `since` is never after `today`, so the window always holds today.
  const since = items
    .map((item) => item.createdAt.slice(0, 10))
    .reduce((a, b) => (b < a ? b : a), today);
  const days = windowDays(today, since);
  const tickets: TicketProgress = {
    closed: closed.length,
    total: scope.length,
    epics: items.filter(isEpic).length,
    postLaunch: items.filter((item) => !isEpic(item) && isPostLaunch(item))
      .length,
    notPlanned: items.filter(
      (item) => !isEpic(item) && !isPostLaunch(item) && isNotPlanned(item),
    ).length,
    pace: perDay(closed, days, () => 1),
  };
  const scoredOpen = open.filter((item) => item.estimate !== null);
  if (scoredOpen.length < open.length) {
    return {
      tickets,
      effort: {
        available: false,
        scored: scoredOpen.length,
        open: open.length,
      },
    };
  }
  const scoredClosed = closed.filter((item) => item.estimate !== null);
  const scoredMean =
    scoredClosed.length === 0
      ? 0
      : scoredClosed.reduce((sum, item) => sum + (item.estimate ?? 0), 0) /
        scoredClosed.length;
  const points = (item: BoardItem): number => item.estimate ?? scoredMean;
  return {
    tickets,
    effort: {
      available: true,
      closedPoints: closed.reduce((sum, item) => sum + points(item), 0),
      openPoints: open.reduce((sum, item) => sum + points(item), 0),
      openStories: open.length,
      assumedClosed: closed.length - scoredClosed.length,
      scoredMean,
      pace: perDay(closed, days, points),
    },
  };
}

const plural = (n: number, word: string): string =>
  `${String(n)} ${word}${n === 1 ? '' : 's'}`;

/** `n` stories of a kind: `1 open story`, `2 closed stories`. */
const stories = (n: number, kind: string): string =>
  `${String(n)} ${kind} ${n === 1 ? 'story' : 'stories'}`;

const sumOf = (pace: number[]): number => pace.reduce((a, b) => a + b, 0);

/** The ETA at the window's mean daily pace, or why there is none. */
function eta(remaining: number, pace: number[], today: string): string {
  const closed = sumOf(pace);
  if (closed === 0) {
    return `ETA at that pace: none, nothing closed in the last ${plural(pace.length, 'day')}.`;
  }
  // remaining ÷ (closed ÷ days) as one division: dividing by the rounded mean
  // put a whole number of days a hair above itself, and its ceiling a day late.
  const days = Math.ceil((remaining * pace.length) / closed);
  const date = new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY_MS);
  return `ETA at that pace: ${date.toISOString().slice(0, 10)}, before outside waits.`;
}

/** The two close-out lines: by tickets, then by effort. */
export function formatLines(p: Progress, today: string): [string, string] {
  const t = p.tickets;
  const leftOut =
    t.notPlanned === 0
      ? `${plural(t.epics, 'epic')} and ${String(t.postLaunch)} post-launch`
      : `${plural(t.epics, 'epic')}, ${String(t.postLaunch)} post-launch and ${String(t.notPlanned)} closed as not planned`;
  const tickets =
    `By tickets: ${String(Math.round((100 * t.closed) / t.total))}% complete ` +
    `(${String(t.closed)} of ${String(t.total)} in-scope stories closed; ${leftOut} left out). ` +
    `Measured pace ${(sumOf(t.pace) / t.pace.length).toFixed(2)} a day over the last ${plural(t.pace.length, 'day')} (${t.pace.join(', ')}). ` +
    eta(t.total - t.closed, t.pace, today);
  const e = p.effort;
  if (!e.available) {
    return [
      tickets,
      `By effort: unavailable, ${String(e.scored)} of ${String(e.open)} open tickets scored`,
    ];
  }
  const total = e.closedPoints + e.openPoints;
  const assumed =
    e.assumedClosed === 0
      ? ''
      : `; ${stories(e.assumedClosed, 'closed')} unscored, counted at the scored mean of ${e.scoredMean.toFixed(1)} points (assumed)`;
  // Points remaining, never a percentage (global rule, 2026-10-12; #567).
  const effort =
    `By effort: ${plural(Math.round(e.openPoints), 'point')} remaining across ${stories(e.openStories, 'open')} ` +
    `(${String(Math.round(e.closedPoints))} of ${String(Math.round(total))} points closed${assumed}). ` +
    `Measured pace ${(sumOf(e.pace) / e.pace.length).toFixed(2)} points a day over the last ${plural(e.pace.length, 'day')} ` +
    `(${e.pace.map((n) => String(Math.round(n))).join(', ')}). ` +
    eta(e.openPoints, e.pace, today);
  return [tickets, effort];
}

const LABELS_PER_ISSUE = 20;
/**
 * Every item of a board with what the maths reads, 100 to a page, and each
 * card's id and last change and each issue's last change, which the live
 * roadmap checks a read against the webhook that caused it (#689).
 */
export const BOARD_QUERY = `query($id: ID!, $endCursor: String) {
  node(id: $id) { ... on ProjectV2 { title
    items(first: 100, after: $endCursor) { totalCount pageInfo { hasNextPage endCursor }
      nodes { id updatedAt
        estimate: fieldValueByName(name: "Estimate") { ... on ProjectV2ItemFieldNumberValue { number } }
        content { __typename
          ... on DraftIssue { title }
          ... on PullRequest { title }
          ... on Issue { number title state stateReason createdAt closedAt updatedAt
            repository { nameWithOwner }
            labels(first: ${String(LABELS_PER_ISSUE)}) { totalCount nodes { name } } }
        } } } } } }`;

interface RawNode {
  estimate: { number: number } | null;
  content: {
    __typename: string;
    title?: string;
    number?: number;
    state?: 'OPEN' | 'CLOSED';
    stateReason?: BoardItem['stateReason'];
    createdAt?: string;
    closedAt?: string | null;
    labels?: { totalCount: number; nodes: { name: string }[] };
    repository?: { nameWithOwner: string };
  } | null;
}
interface RawPage {
  data: {
    node: { title: string; items: { totalCount?: unknown; nodes: RawNode[] } };
  };
}

/** A page as it may come back: a wrong node id gives `node: null` or `{}`. */
interface UncheckedPage {
  data?: { node?: { items?: { nodes?: unknown } } | null };
}

/** A page's board, refused by name when the page holds none. */
function boardOf(page: unknown): RawPage['data']['node'] {
  const board = (page as UncheckedPage | null)?.data?.node;
  if (board?.items === undefined || !Array.isArray(board.items.nodes)) {
    throw new Error(
      'a page came back without the board’s items: is the node id a project board?',
    );
  }
  return board as RawPage['data']['node'];
}

/** A board item the roadmap leaves off (#341), by kind, with what it is called. */
export interface Dropped {
  kind: 'draft' | 'pull request' | 'another repository';
  label: string;
}

/** Why an item is not one of `repo`'s issues: the message `parseItems` refuses it with. */
type NotAnIssue = Dropped & { refusal: string };

/**
 * An item no policy can place (no content, or a kind GitHub may add). It
 * carries the item's kind so the roadmap can refuse it without its title,
 * which the close-out script's message names.
 */
class UnclassifiableItem extends Error {
  // A declared field, not a parameter property: Node's own TypeScript loader
  // runs scripts/board-progress.ts, and it strips types without transforming.
  readonly kind: string;

  constructor(kind: string, message: string) {
    super(message);
    this.kind = kind;
  }
}

const notAnIssue = (title: string, kind: 'draft item' | 'item'): string =>
  `${kind} "${title}" is not an issue: convert it, or remove it from the board`;

/**
 * One reading of a board item for both policies (#341): one of `repo`'s
 * issues, or something the close-out script refuses and the roadmap drops.
 * Anything else (no content, a kind GitHub may add, a malformed issue) is
 * refused by name here, under either policy.
 */
function classify(node: RawNode, repo: string): BoardItem | NotAnIssue {
  const c = node.content;
  if (c?.__typename === 'DraftIssue') {
    const title = c.title ?? '';
    return {
      kind: 'draft',
      label: title,
      refusal: notAnIssue(title, 'draft item'),
    };
  }
  if (c?.__typename === 'PullRequest') {
    const title = c.title ?? '';
    return {
      kind: 'pull request',
      label: title,
      refusal: notAnIssue(title, 'item'),
    };
  }
  if (c?.__typename !== 'Issue') {
    throw new UnclassifiableItem(
      c?.__typename ?? '(no content)',
      notAnIssue(c?.title ?? '(no content)', 'item'),
    );
  }
  if (
    c.number === undefined ||
    c.title === undefined ||
    c.state === undefined ||
    c.createdAt === undefined
  ) {
    throw new Error(
      'an issue on the board came back without its number, title, state or creation time',
    );
  }
  if (c.repository === undefined) {
    throw new Error(`#${String(c.number)} came back without its repository`);
  }
  const owner = c.repository.nameWithOwner;
  if (owner !== repo) {
    return {
      kind: 'another repository',
      label: `${owner}#${String(c.number)} ${c.title}`,
      refusal: `#${String(c.number)} is an issue of ${owner}, not ${repo}: remove it from the board`,
    };
  }
  const labels = c.labels ?? { totalCount: 0, nodes: [] };
  if (labels.totalCount > labels.nodes.length) {
    throw new Error(
      `#${String(c.number)} has ${String(labels.totalCount)} labels and ${String(labels.nodes.length)} were read: raise labels(first:) in BOARD_QUERY`,
    );
  }
  return {
    number: c.number,
    title: c.title,
    state: c.state,
    stateReason: c.stateReason ?? null,
    createdAt: c.createdAt,
    closedAt: c.closedAt ?? null,
    estimate: node.estimate?.number ?? null,
    labels: labels.nodes.map((l) => l.name),
  };
}

const isIssue = (read: BoardItem | NotAnIssue): read is BoardItem =>
  !('refusal' in read);

/**
 * `repo`'s issues on the board, for the close-out script: anything else is
 * refused by name, so the operator fixes the board rather than reading a
 * count that quietly left something out.
 */
export function parseItems(pages: unknown[], repo: string): BoardItem[] {
  return pages.flatMap((page) =>
    boardOf(page).items.nodes.map((node) => {
      const read = classify(node, repo);
      if (isIssue(read)) return read;
      throw new Error(read.refusal);
    }),
  );
}

/**
 * `classify`, refusing an unclassifiable item by its kind alone: the roadmap
 * publishes its read error, and an item's title must never be shown.
 */
function classifyForRoadmap(
  node: RawNode,
  repo: string,
): BoardItem | NotAnIssue {
  try {
    return classify(node, repo);
  } catch (error) {
    if (error instanceof UnclassifiableItem)
      throw new Error(
        `an item of kind ${error.kind} is on the board, which the roadmap cannot classify: nothing read`,
        { cause: error },
      );
    throw error;
  }
}

/**
 * `repo`'s issues on the board, for the public roadmap (#341): drafts, pull
 * requests and other repositories' issues are left off and listed, so one
 * stray card never takes the page down; anything unclassifiable is still
 * refused, by its kind. On a board `parseItems` accepts, both give the same items.
 */
export function roadmapItems(
  pages: unknown[],
  repo: string,
): { items: BoardItem[]; dropped: Dropped[] } {
  const items: BoardItem[] = [];
  const dropped: Dropped[] = [];
  for (const page of pages) {
    for (const node of boardOf(page).items.nodes) {
      const read = classifyForRoadmap(node, repo);
      if (isIssue(read)) items.push(read);
      else dropped.push({ kind: read.kind, label: read.label });
    }
  }
  return { items, dropped };
}

/**
 * Refuse pages that are not all of the board asked for (#341): each page's
 * title is checked, the second and later included, before anything is read
 * from them, and then that the pages hold every item the board has (#703).
 * The close-out script, the roadmap Worker, board-next and board-orphans all
 * call it.
 */
export function assertBoard(pages: unknown[], title: string): void {
  const boards = pages.map(boardOf);
  for (const board of boards) assertTitle(board.title, title);
  assertWhole(boards);
}

/**
 * Refuse a read short of the board (#703): every page carries GitHub's count
 * of the board's items, and the pages together must hold exactly that many.
 * Pages are read one after another, so a card added or removed between two
 * of them makes their counts differ: that is named as a change, since
 * nothing is wrong and the next read is whole.
 */
function assertWhole(boards: RawPage['data']['node'][]): void {
  if (boards.length === 0)
    throw new Error('no page of the board came back: nothing read');
  const counts = boards.map((board) => board.items.totalCount);
  if (!counts.every((count) => Number.isInteger(count)))
    throw new Error(
      'a page came back without the board’s item count (items.totalCount): nothing read',
    );
  const seen = [...new Set(counts)];
  if (seen.length > 1)
    throw new Error(
      `the board changed while it was read (its pages report ${seen.join(', then ')} items): nothing read`,
    );
  const total = Number(counts[0]);
  const read = boards.reduce((sum, board) => sum + board.items.nodes.length, 0);
  if (read !== total)
    throw new Error(
      `the board has ${String(total)} items and ${String(read)} were read: nothing read`,
    );
}

const BOARDS_PER_ISSUE = 10;
/**
 * The repository's issues, 100 to a page, each with the boards it is on
 * (#751): the surface a board's listing is checked against, since the
 * listing's own count shrinks with it. Archived cards are left out, as the
 * board's listing leaves them out.
 */
export const REPO_ISSUES_QUERY = `query($owner: String!, $name: String!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    issues(first: 100, after: $endCursor) { totalCount pageInfo { hasNextPage endCursor }
      nodes { number
        projectItems(first: ${String(BOARDS_PER_ISSUE)}, includeArchived: false) { totalCount nodes { project { id } } } } } } }`;

interface RepoIssue {
  number: number;
  projectItems: {
    totalCount: number;
    nodes: { project: { id: string } | null }[];
  };
}
interface RepoIssues {
  totalCount?: unknown;
  nodes: RepoIssue[];
}

/** A page's issues, refused by name when the page holds none. */
function issuesOf(page: unknown): RepoIssues {
  const issues = (
    page as {
      data?: { repository?: { issues?: { nodes?: unknown } } | null };
    } | null
  )?.data?.repository?.issues;
  if (issues === undefined || !Array.isArray(issues.nodes)) {
    throw new Error(
      'a page came back without the repository’s issues: is the repository right?',
    );
  }
  return issues as RepoIssues;
}

/**
 * The issues the repository names on the board, from pages proved to hold
 * every issue, as assertWhole proves a board's pages (#703).
 */
function namedOnBoard(repoPages: unknown[], boardId: string): Set<number> {
  if (repoPages.length === 0)
    throw new Error(
      'no page of the repository’s issues came back: nothing read',
    );
  const pages = repoPages.map(issuesOf);
  const counts = pages.map((page) => page.totalCount);
  if (!counts.every((count) => Number.isInteger(count)))
    throw new Error(
      'a page of the repository’s issues came back without their count (issues.totalCount): nothing read',
    );
  const seen = [...new Set(counts)];
  if (seen.length > 1)
    throw new Error(
      `the repository’s issues changed while they were read (its pages report ${seen.join(', then ')}): nothing read`,
    );
  const issues = pages.flatMap((page) => page.nodes);
  if (issues.length !== Number(counts[0]))
    throw new Error(
      `the repository has ${String(counts[0])} issues and ${String(issues.length)} were read: nothing read`,
    );
  const named = new Set<number>();
  for (const issue of issues) {
    const items = issue.projectItems;
    if (items.totalCount > items.nodes.length)
      throw new Error(
        `#${String(issue.number)} is on ${String(items.totalCount)} boards and ${String(items.nodes.length)} were read: raise projectItems(first:) in REPO_ISSUES_QUERY: nothing read`,
      );
    if (items.nodes.some((item) => item.project?.id === boardId))
      named.add(issue.number);
  }
  return named;
}

const NAMED_IN_A_REFUSAL = 10;

/** Issue numbers for a refusal: the first ten, and how many more. */
function listed(numbers: number[]): string {
  const shown = numbers
    .slice(0, NAMED_IN_A_REFUSAL)
    .map((number) => `#${String(number)}`)
    .join(', ');
  const more = numbers.length - NAMED_IN_A_REFUSAL;
  return more > 0 ? `${shown} and ${String(more)} more` : shown;
}

/**
 * Refuse a board whose listing is not every issue the repository names on
 * it (#751). The board's pages and the repository's are read from two
 * GitHub surfaces (ProjectV2.items and Repository.issues), and compared as
 * sets of issue numbers, so a listing short of the board is refused even
 * when its own count agrees with it. Only `repo`'s issues are compared:
 * drafts, pull requests and other repositories' issues are parseItems'.
 */
export function assertNamedByRepo(
  boardPages: unknown[],
  repoPages: unknown[],
  boardId: string,
  repo: string,
): void {
  const named = namedOnBoard(repoPages, boardId);
  if (named.size === 0)
    throw new Error(
      `the repository’s own issues (Repository.issues) name no issue on board ${boardId}: nothing read`,
    );
  const carded = new Set(
    boardPages
      .map(boardOf)
      .flatMap((board) => board.items.nodes)
      .flatMap(({ content }) =>
        content?.__typename === 'Issue' &&
        content.repository?.nameWithOwner === repo &&
        content.number !== undefined
          ? [content.number]
          : [],
      ),
  );
  const byNumber = (a: number, b: number): number => a - b;
  const missing = [...named].filter((n) => !carded.has(n)).sort(byNumber);
  const extra = [...carded].filter((n) => !named.has(n)).sort(byNumber);
  if (missing.length === 0 && extra.length === 0) return;
  const parts = [
    `the board lists ${String(carded.size)} of ${repo}’s issues and the repository’s own issues (Repository.issues) name ${String(named.size)} on it`,
  ];
  if (missing.length > 0)
    parts.push(`missing from the board’s listing: ${listed(missing)}`);
  if (extra.length > 0)
    parts.push(
      `on the board but named by no issue: ${listed(extra)} (a card added or removed between the two reads shows this way too)`,
    );
  throw new Error(`${parts.join('; ')}: nothing read`);
}

/** Refuse to read a board other than the one asked for. */
export function assertTitle(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(
      `the board is "${actual}", not "${expected}": nothing read`,
    );
  }
}

/**
 * The two close-out lines from the pages `gh api graphql --paginate --slurp`
 * returns for BOARD_QUERY, with every page's board title asserted first.
 */
export function closeOutLines(
  pages: unknown[],
  title: string,
  repo: string,
  today: string,
): [string, string] {
  assertBoard(pages, title);
  return formatLines(progress(parseItems(pages, repo), today), today);
}
