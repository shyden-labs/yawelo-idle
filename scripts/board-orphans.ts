/**
 * The pull-request gate's orphan check (#580): a ticket is In Progress only
 * while a branch or an open pull request names it (operator 2026-10-13, every
 * project: "if a ticket is not in progress then it should not be marked as in
 * progress"):
 *
 *   node scripts/board-orphans.ts <board-node-id> "<board title>" <owner/repo>
 *
 * with PR_NUMBER, PR_AUTHOR, BOARD_TOKEN and GH_TOKEN in the environment.
 *
 * An open pull request names ticket N by `#N` in its title or body, or by
 * `/N-` in its branch. A remote branch names it by `/N-` while it has no
 * closed pull request, with no time limit (operator 2026-10-13: "Branch
 * counts until its PR closes"), and while one of its pull requests merged,
 * until the ticket closes: merged work waits for its dev deploy to be checked
 * before the ticket is closed by hand, and is not abandoned (operator
 * 2026-10-16). A branch whose pull requests all closed without merging
 * names nothing. Merged branches are deleted at merge (#701), so a merged
 * pull request whose branch, in this repository, has `/N-` names N the same
 * way until the ticket closes (#702). Its title and body do not: merged
 * history keeps every mention, and 77 of 302 open tickets had one (measured
 * 2026-10-20), so a ticket left In Progress would never be flagged.
 *
 * The board is read with the read-only roadmap App's token (BOARD_TOKEN), and
 * the branches and pull requests, which are public, with the run's own token
 * (operator 2026-10-15). Anything it cannot read fails it by name, and each
 * read carries a known positive: the board holds items, the branches hold
 * `develop`, the open pull requests hold this one, the closed pull requests
 * hold the merged one develop's head came from. The board's listing is also
 * checked against the issues the repository names on it, read from a second
 * surface with the board's token, since the listing's own count shrinks with
 * it (#751). It reads the board for
 * every author, Dependabot included (#661: a check is green only when it
 * ran); Dependabot's runs get no environment secrets, so theirs read the key
 * from the repository's Dependabot secret.
 */
import { execFileSync } from 'node:child_process';
import { assertNamedByRepo } from '../packages/progress/src/index.ts';
import { NEXT_QUERY, type NextItem, parseNextItems } from './board-next.ts';
import { type Gh, repoIssuePages } from './board-progress.ts';
import { entries, isRecord, read } from './gh-reads.ts';

/** The pull-request author whose runs read Dependabot secrets, not environment ones. */
const DEPENDABOT = 'dependabot[bot]';

/** `gh` with the board's token, and `gh` with the run's own token. */
export interface OrphanReads {
  board: Gh;
  repo: Gh;
}

interface Pull {
  number: number;
  title: string;
  body: string | null;
  branch: string;
}

const USAGE =
  'usage: node scripts/board-orphans.ts <board-node-id> "<board title>" <owner/repo>';

const IN_PROGRESS = 'In Progress';

/** A closed pull request: merged or not, and the branch it came from. */
interface ClosedPull {
  number: number;
  merged: boolean;
  mergeCommit: string | null;
  branch: string;
  /** The head branch's repository, `null` when it was deleted. */
  headRepo: string | null;
}

/**
 * The branch names, and develop's head commit (`null` with no develop, which
 * the caller refuses), the closed pull requests' known positive.
 */
function parseBranches(out: string): {
  names: string[];
  developSha: string | null;
} {
  const list = entries(out);
  const names = list.map((e) => {
    if (!isRecord(e) || typeof e.name !== 'string')
      throw new Error('an entry has no name');
    return e.name;
  });
  const develop = list.find((e) => isRecord(e) && e.name === 'develop');
  if (!isRecord(develop)) return { names, developSha: null };
  const commit = develop.commit;
  if (!isRecord(commit) || typeof commit.sha !== 'string')
    throw new Error('develop has no commit SHA');
  return { names, developSha: commit.sha };
}

function parseClosedPulls(out: string): ClosedPull[] {
  return entries(out).map((e) => {
    const head = isRecord(e) ? e.head : undefined;
    const headRepo = isRecord(head) ? head.repo : undefined;
    if (
      !isRecord(e) ||
      !Number.isInteger(e.number) ||
      !(typeof e.merged_at === 'string' || e.merged_at === null) ||
      !(
        typeof e.merge_commit_sha === 'string' || e.merge_commit_sha === null
      ) ||
      !isRecord(head) ||
      typeof head.ref !== 'string' ||
      !(
        headRepo === null ||
        (isRecord(headRepo) && typeof headRepo.full_name === 'string')
      )
    )
      throw new Error(
        'an entry has no number, merged_at, merge_commit_sha, head branch and head repository',
      );
    return {
      number: e.number as number,
      merged: e.merged_at !== null,
      mergeCommit: e.merge_commit_sha,
      branch: head.ref,
      headRepo: isRecord(headRepo) ? (headRepo.full_name as string) : null,
    };
  });
}

function parsePulls(out: string): Pull[] {
  return entries(out).map((e) => {
    const head = isRecord(e) ? e.head : undefined;
    if (
      !isRecord(e) ||
      !Number.isInteger(e.number) ||
      typeof e.title !== 'string' ||
      !(typeof e.body === 'string' || e.body === null) ||
      !isRecord(head) ||
      typeof head.ref !== 'string'
    )
      throw new Error('an entry has no number, title, body and branch');
    return {
      number: e.number as number,
      title: e.title,
      body: e.body,
      branch: head.ref,
    };
  });
}

const plural = (n: number, one: string, many: string) =>
  `${String(n)} ${n === 1 ? one : many}`;

/** Whether `branch` names ticket `n`: `/n-`, so `/120-` never names #12. */
const branchNames = (branch: string, n: number) =>
  branch.includes(`/${String(n)}-`);

/** Whether `text` names ticket `n` as `#n`, never `#120` or `other/repo#n`. */
const textNames = (text: string, n: number) =>
  new RegExp(`(?<![\\w/#])#${String(n)}(?!\\d)`).test(text);

/**
 * Whether the gate passes, and the lines it prints: a summary with every
 * read's size, then each ticket In Progress with what names it, or each
 * orphan. Throws, naming what it could not read, when it cannot look.
 */
export function boardOrphans(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  gh: OrphanReads,
): { ok: boolean; lines: string[] } {
  const [id, title, repo] = args;
  if (id === undefined || title === undefined || repo === undefined)
    throw new Error(USAGE);
  const prNumber = Number(env.PR_NUMBER);
  if (!Number.isInteger(prNumber) || prNumber <= 0)
    throw new Error('PR_NUMBER is not a pull request number');
  if (!env.BOARD_TOKEN)
    throw new Error(
      env.PR_AUTHOR === DEPENDABOT
        ? "no board token: BOARD_TOKEN is empty, so the board cannot be read (Dependabot's runs read the repository's Dependabot secret ROADMAP_APP_KEY, #661)"
        : "no board token: BOARD_TOKEN is empty, so the board cannot be read (the board-read environment's ROADMAP_APP_KEY, #580)",
    );

  const board = read('the board', () => {
    const pages = JSON.parse(
      gh.board([
        'api',
        'graphql',
        '--paginate',
        '--slurp',
        '-f',
        `query=${NEXT_QUERY}`,
        '-f',
        `id=${id}`,
      ]),
    ) as unknown[];
    return { pages, items: parseNextItems(pages, title) };
  });
  const { items } = board;
  if (items.length === 0)
    throw new Error('the board read holds no items, so nothing was judged');
  // The issues' boards need the board's token; the run's own cannot read them.
  const issuePages = read('the repository’s issues', () =>
    repoIssuePages(gh.board, repo),
  );
  read('the board', () => {
    assertNamedByRepo(board.pages, issuePages, id, repo);
  });
  const { names: branches, developSha } = read('the branches', () =>
    parseBranches(
      gh.repo([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repo}/branches?per_page=100`,
      ]),
    ),
  );
  if (!branches.includes('develop'))
    throw new Error(
      'the branches read holds no develop, so it is not the whole list',
    );
  const pulls = read('the open pull requests', () =>
    parsePulls(
      gh.repo([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repo}/pulls?state=open&per_page=100`,
      ]),
    ),
  );
  if (!pulls.some((p) => p.number === prNumber))
    throw new Error(
      `the open pull requests read does not hold this one, #${String(prNumber)}, so it is not the whole list`,
    );
  const merged = read('the closed pull requests', () =>
    parseClosedPulls(
      gh.repo([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repo}/pulls?state=closed&per_page=100`,
      ]),
    ),
  ).filter((p) => p.merged);
  if (!merged.some((p) => p.mergeCommit === developSha))
    throw new Error(
      `the closed pull requests read holds no merged pull request for develop's head ${String(developSha)}, so it is not the whole list`,
    );

  const owner = repo.split('/')[0] as string;
  /**
   * How `branch` stands by its closed pull requests: none closed, one
   * merged, or every one closed without merging (abandoned).
   */
  const branchState = (branch: string): 'unclosed' | 'merged' | 'abandoned' =>
    read(`the closed pull requests of ${branch}`, () => {
      const closed = entries(
        gh.repo([
          'api',
          '--paginate',
          '--slurp',
          `repos/${repo}/pulls?state=closed&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=100`,
        ]),
      ).map((e) => {
        if (!isRecord(e) || !('merged_at' in e))
          throw new Error('an entry has no merged_at');
        return e.merged_at !== null;
      });
      if (closed.length === 0) return 'unclosed';
      return closed.some((merged) => merged) ? 'merged' : 'abandoned';
    });

  /** What names `ticket`, or `null` for an orphan. */
  const namer = (ticket: NextItem): string | null => {
    const n = ticket.number;
    const pull = pulls.find(
      (p) =>
        textNames(p.title, n) ||
        textNames(p.body ?? '', n) ||
        branchNames(p.branch, n),
    );
    if (pull !== undefined) return `pull request #${String(pull.number)}`;
    for (const branch of branches.filter((b) => branchNames(b, n))) {
      const state = branchState(branch);
      if (state === 'unclosed') return `branch ${branch}`;
      if (state === 'merged')
        return `branch ${branch} (merged, awaiting close)`;
    }
    const landed = merged.find(
      (p) => p.headRepo === repo && branchNames(p.branch, n),
    );
    if (landed !== undefined)
      return `pull request #${String(landed.number)} (merged, awaiting close)`;
    return null;
  };

  const inProgress = items.filter(
    (i) => i.state === 'OPEN' && i.status === IN_PROGRESS,
  );
  for (const i of inProgress) {
    if (i.repository !== repo)
      throw new Error(
        `${i.repository}#${String(i.number)} is In Progress, and this check reads only ${repo}'s branches and pull requests`,
      );
  }
  const named = inProgress.map((i) => ({ ticket: i, by: namer(i) }));
  const orphans = named.filter((x) => x.by === null).map((x) => x.ticket);
  const sizes = `Read ${plural(items.length, 'board item', 'board items')}, ${plural(branches.length, 'branch', 'branches')}, ${plural(pulls.length, 'open pull request', 'open pull requests')}, ${plural(merged.length, 'merged pull request', 'merged pull requests')}.`;
  if (orphans.length > 0) {
    return {
      ok: false,
      lines: [
        `${plural(orphans.length, 'orphan', 'orphans')}: In Progress, but no branch or open pull request names it. Move each back to Todo, or push its branch. ${sizes}`,
        ...orphans.map((o) => `#${String(o.number)} ${o.title}`),
      ],
    };
  }
  return {
    ok: true,
    lines: [
      `No orphans: ${plural(inProgress.length, 'ticket', 'tickets')} In Progress, each named. ${sizes}`,
      ...named.map((x) => `#${String(x.ticket.number)}: ${String(x.by)}`),
    ],
  };
}

if (import.meta.main) {
  /** `gh` with `token` as its credential. */
  const ghWith =
    (token: string | undefined): Gh =>
    (args) =>
      execFileSync('gh', args, {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: token ?? '' },
        maxBuffer: 64 * 1024 * 1024,
      });
  try {
    const { ok, lines } = boardOrphans(process.argv.slice(2), process.env, {
      board: ghWith(process.env.BOARD_TOKEN),
      repo: ghWith(process.env.GH_TOKEN),
    });
    for (const line of lines) process.stdout.write(`${line}\n`);
    if (!ok) {
      process.stdout.write(`::error::${lines[0] ?? 'orphans found'}\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stdout.write(
      `::error::${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
