/**
 * `node scripts/mutations-changed.ts` (#649, spec §7): which mutation files a
 * pull request adds or changes, for the `mutations` workflow to run through
 * the runner. Reads `git diff --name-status <BASE>...HEAD`, prints how many
 * paths it judged, and writes `count` and `files` (space-separated) to
 * `GITHUB_OUTPUT`. #619 extends it into the judge of changed non-unit tests.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

/** One path a diff names, with git's status letter (a rename: its new path). */
export interface Changed {
  readonly status: string;
  readonly path: string;
}

/** Reads `git diff --name-status` output, refusing a line it cannot read. */
export function readNameStatus(text: string): Changed[] {
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [code, ...paths] = line.split('\t');
      const path = paths.at(-1);
      if (code === undefined || code === '' || path === undefined)
        throw new Error(
          `git diff --name-status printed a line it cannot read: ${line}`,
        );
      return { status: code.charAt(0), path };
    });
}

/** A mutation file's path as the workflow passes it on: nothing a shell could read as more. */
const MUTATION_FILE = /^tests\/mutations\/[A-Za-z0-9._-]+\.ts$/;

/**
 * The mutation files among `changed` that exist after the change (added,
 * changed or renamed in), refusing one whose name holds anything but
 * letters, digits, `.`, `_` and `-`.
 */
export function mutationFilesIn(changed: readonly Changed[]): string[] {
  return changed
    .filter(
      ({ status, path }) =>
        status !== 'D' &&
        path.startsWith('tests/mutations/') &&
        path.endsWith('.ts'),
    )
    .map(({ path }) => {
      if (!MUTATION_FILE.test(path))
        throw new Error(
          `${path} is not a mutation file name the workflow passes on (tests/mutations/<letters, digits, . _ ->.ts)`,
        );
      return path;
    });
}

/** `<n> mutation file(s) changed of <m> paths judged`: never a silent pass. */
export function summary(files: readonly string[], judged: number): string {
  return `${String(files.length)} mutation file${files.length === 1 ? '' : 's'} changed of ${String(judged)} paths judged`;
}

function main(): void {
  const base = process.env.BASE;
  const output = process.env.GITHUB_OUTPUT;
  if (base === undefined || base === '' || output === undefined)
    throw new Error('BASE and GITHUB_OUTPUT must be set');
  const diff = spawnSync(
    'git',
    ['diff', '--name-status', '-M', `${base}...HEAD`],
    { encoding: 'utf8' },
  );
  if (diff.status !== 0)
    throw new Error(`git diff failed: ${diff.stderr.trim()}`);
  const changed = readNameStatus(diff.stdout);
  const files = mutationFilesIn(changed);
  console.log(summary(files, changed.length));
  for (const file of files) console.log(`  ${file}`);
  appendFileSync(
    output,
    `count=${String(files.length)}\nfiles=${files.join(' ')}\n`,
  );
}

if (import.meta.main) main();
