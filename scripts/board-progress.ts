/**
 * Prints the two close-out lines for a project board: by tickets, then by
 * effort (#340). Every session close-out quotes them, then adds the outside
 * waits the pace cannot know.
 *
 * Usage: node scripts/board-progress.ts <board-node-id> "<board title>" [owner/repo]
 *
 * Only the repository's own issues count: a draft, a pull request or another
 * repository's issue on the board is refused by name (#341), so the close-out
 * and the roadmap Worker count the same stories. The repository defaults to
 * this one.
 *
 * A thin wrapper: it reads the board through `gh` (the agent's App, by the
 * router), takes today from the clock and prints what packages/progress
 * gives, which is the same module the roadmap Worker reads (#341). The title
 * is asserted on every page before anything is printed, and the board's
 * issues are checked against the issues the repository names on it, a read
 * from another GitHub surface, since the board's own count shrinks with a
 * short listing (#751).
 */
import { execFileSync } from 'node:child_process';
import {
  assertNamedByRepo,
  BOARD_QUERY,
  closeOutLines,
  REPO_ISSUES_QUERY,
} from '../packages/progress/src/index.ts';

/** Runs `gh` with these arguments and returns what it prints. */
export type Gh = (args: readonly string[]) => string;

/** The repository a board reader reads when none is given. */
export const REPO = 'shyden-labs/yawelo-idle';

/** The repository's owner and name, refused unless written `owner/name`. */
export function ownerAndName(repo: string): [string, string] {
  const parts = repo.split('/');
  const [owner, name] = parts;
  if (parts.length !== 2 || !owner || !name)
    throw new Error(`the repository is "${repo}", not owner/name`);
  return [owner, name];
}

/**
 * Every page of the repository's issues, each with the boards it is on
 * (#751), read through `gh` for assertNamedByRepo.
 */
export function repoIssuePages(gh: Gh, repo: string): unknown[] {
  const [owner, name] = ownerAndName(repo);
  return JSON.parse(
    gh([
      'api',
      'graphql',
      '--paginate',
      '--slurp',
      '-f',
      `query=${REPO_ISSUES_QUERY}`,
      '-f',
      `owner=${owner}`,
      '-f',
      `name=${name}`,
    ]),
  ) as unknown[];
}

const USAGE =
  'usage: node scripts/board-progress.ts <board-node-id> "<board title>" [owner/repo]';

/**
 * The close-out lines for the board `args` names (`<node-id> <title>
 * [owner/repo]`, the repository defaulting to this one), read through `gh`, as
 * of `today` (YYYY-MM-DD). Throws the usage line before calling `gh` when the
 * id or title is missing, and whatever `gh`, the title check or the
 * repository cross-check throws, so no line is ever given for a board not
 * read whole.
 */
export function boardProgress(
  args: readonly string[],
  gh: Gh,
  today: string,
): string[] {
  const [id, title, repo = REPO] = args;
  if (id === undefined || title === undefined) throw new Error(USAGE);
  ownerAndName(repo);
  const out = gh([
    'api',
    'graphql',
    '--paginate',
    '--slurp',
    '-f',
    `query=${BOARD_QUERY}`,
    '-f',
    `id=${id}`,
  ]);
  const pages = JSON.parse(out) as unknown[];
  const lines = closeOutLines(pages, title, repo, today);
  assertNamedByRepo(pages, repoIssuePages(gh, repo), id, repo);
  return lines;
}

if (import.meta.main) {
  const lines = boardProgress(
    process.argv.slice(2),
    (args) => execFileSync('gh', args, { encoding: 'utf8' }),
    new Date().toISOString().slice(0, 10),
  );
  process.stdout.write(`${lines.join('\n')}\n`);
}
