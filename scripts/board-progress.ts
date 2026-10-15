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
 * is asserted on every page before anything is printed.
 */
import { execFileSync } from 'node:child_process';
import { BOARD_QUERY, closeOutLines } from '../packages/progress/src/index.ts';

/** Runs `gh` with these arguments and returns what it prints. */
export type Gh = (args: readonly string[]) => string;

const REPO = 'shyden-labs/yawelo-idle';

const USAGE =
  'usage: node scripts/board-progress.ts <board-node-id> "<board title>" [owner/repo]';

/**
 * The close-out lines for the board `args` names (`<node-id> <title>
 * [owner/repo]`, the repository defaulting to this one), read through `gh`, as
 * of `today` (YYYY-MM-DD). Throws the usage line before calling `gh` when the
 * id or title is missing, and whatever `gh` or the title check throws, so no
 * line is ever given for a board not read whole.
 */
export function boardProgress(
  args: readonly string[],
  gh: Gh,
  today: string,
): string[] {
  const [id, title, repo = REPO] = args;
  if (id === undefined || title === undefined) throw new Error(USAGE);
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
  return closeOutLines(JSON.parse(out) as unknown[], title, repo, today);
}

if (import.meta.main) {
  const lines = boardProgress(
    process.argv.slice(2),
    (args) => execFileSync('gh', args, { encoding: 'utf8' }),
    new Date().toISOString().slice(0, 10),
  );
  process.stdout.write(`${lines.join('\n')}\n`);
}
