/**
 * Which mutation files a pull request adds or changes, and the judge of its
 * changed non-unit tests (#649 spec §7, #619 AC2): every non-unit test the
 * pull request adds, changes or renames in must be a target of a mutation
 * file it adds or changes. `scripts/mutations-changed-cli.ts` reads the diff,
 * lists the suites and loads the mutation files; this module judges, so the
 * unit suite can load it.
 */
import { onAllowlist } from './ci-scope.ts';
import { UNIT_SUITE } from './mutate.ts';
import { FILE_SEPARATOR, type MutationFile } from './mutation-file.ts';

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

/**
 * Each file a non-unit suite lists, to that suite, from `listings` (suite
 * name to the files it lists), refusing a file two suites list.
 */
export function nonUnitTests(
  listings: ReadonlyMap<string, readonly string[]>,
): Map<string, string> {
  const suiteOf = new Map<string, string>();
  for (const [suite, files] of listings) {
    if (suite === UNIT_SUITE) continue;
    for (const file of files) {
      const other = suiteOf.get(file);
      if (other !== undefined)
        throw new Error(`${file} is listed by ${other} and ${suite}`);
      suiteOf.set(file, suite);
    }
  }
  return suiteOf;
}

/**
 * The test files some row of `files` predicts red: the `<file>` of each
 * `red` key. A target whose every row is predicted green is not among them,
 * since a row that stays green proves nothing about it.
 */
export function testsPredictedRed(files: readonly MutationFile[]): Set<string> {
  return new Set(
    files.flatMap(({ mutations }) =>
      mutations.flatMap(({ red }) =>
        Object.keys(red).map((key) =>
          key.slice(0, key.indexOf(FILE_SEPARATOR)),
        ),
      ),
    ),
  );
}

/**
 * Each non-unit test among `changed` that exists after the change and that
 * no row of a changed mutation file predicts red, in diff order.
 */
export function unprovedTests(
  changed: readonly Changed[],
  nonUnit: ReadonlyMap<string, string>,
  predictedRed: ReadonlySet<string>,
): string[] {
  return changed.flatMap(({ status, path }) => {
    const suite = nonUnit.get(path);
    return status === 'D' || suite === undefined || predictedRed.has(path)
      ? []
      : [
          `${path} (${suite}): no row of a mutation file this pull request adds or changes predicts it red`,
        ];
  });
}

/**
 * Whether the judge must list the suites: a change of only HANDOVER.md and
 * Markdown under docs/ (build-and-test's docs-only fast path, #360) holds no
 * test, so the check passes at once with nothing installed.
 */
export function needsListings(changed: readonly Changed[]): boolean {
  return changed.some(({ path }) => !onAllowlist(path));
}

const counted = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** How many non-unit tests and mutation files changed of how many paths judged: never a silent pass. */
export function summary(counts: {
  readonly tests: number;
  readonly files: number;
  readonly judged: number;
}): string {
  return `${counted(counts.tests, 'non-unit test', 'non-unit tests')} and ${counted(counts.files, 'mutation file', 'mutation files')} changed of ${String(counts.judged)} paths judged`;
}
