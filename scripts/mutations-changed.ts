/**
 * Which mutation files a pull request adds or changes, and the judge of its
 * changed non-unit tests (#649 spec §7, #619 AC2): every non-unit test the
 * pull request adds, changes or renames in must be a target of a mutation
 * file it adds or changes. `scripts/mutations-changed-cli.ts` reads the diff,
 * lists the suites and loads the mutation files; this module judges, so the
 * unit suite can load it.
 */
import { posix } from 'node:path';
import { onAllowlist } from './ci-scope.ts';
import { RECORD_FILE } from './coverage.ts';
import { MINIMUMS_DIR } from './minimums-method.ts';
import { UNIT_SUITE } from './mutate.ts';
import {
  FILE_SEPARATOR,
  isMutationFile,
  type MutationFile,
} from './mutation-file.ts';
import { FLOORS_DIR } from './record-floors.ts';

/**
 * The folders of counts CI writes, which the judge lists apart and asks no
 * mutation of (Shyden, 2026-10-18): the floors, the minimums, and the
 * coverage record (Shyden, 2026-10-22: "count it like floors", #728).
 * Here rather than in the CLI, so the unit suite can pin it without loading
 * the CLI's dynamic import of mutation files.
 */
export const RECORDED_DIRS: readonly string[] = [
  FLOORS_DIR,
  MINIMUMS_DIR,
  posix.dirname(RECORD_FILE),
];

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
    .filter(({ status, path }) => status !== 'D' && isMutationFile(path))
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
      mutations.flatMap(({ red }) => Object.keys(red).map(redTestFile)),
    ),
  );
}

/** The test file a `red` key names: the part before its first separator. */
const redTestFile = (key: string): string =>
  key.slice(0, key.indexOf(FILE_SEPARATOR));

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

/**
 * The judge's lines for `GITHUB_OUTPUT`: the count the run jobs' condition
 * reads and the files as the JSON list their matrix reads, never
 * word-split (#754). An empty list still writes both, so the required check
 * reports.
 */
export function githubOutput(files: readonly string[]): string {
  return `count=${String(files.length)}\nfiles=${JSON.stringify(files)}\n`;
}

/** How many non-unit tests, helpers and mutation files changed of how many paths judged: never a silent pass. */
export function summary(counts: {
  readonly tests: number;
  readonly helpers: number;
  readonly files: number;
  readonly judged: number;
}): string {
  return `${counted(counts.tests, 'non-unit test', 'non-unit tests')}, ${counted(counts.helpers, 'helper', 'helpers')} and ${counted(counts.files, 'mutation file', 'mutation files')} changed of ${String(counts.judged)} paths judged`;
}

/**
 * Whether `path` sits in a test folder (#659): `tests/` at the root, or a
 * `test/` or `tests/` folder directly inside a workspace that `workspaces`
 * (package.json's patterns: `<folder>` or `<folder>/*`) names.
 */
export function inTestFolder(
  path: string,
  workspaces: readonly string[],
): boolean {
  const roots = workspaces.map((pattern) => {
    const wildcard = pattern.endsWith('/*');
    const parent = (wildcard ? pattern.slice(0, -2) : pattern).split('/');
    if (parent.some((part) => !/^[A-Za-z0-9._-]+$/.test(part)))
      throw new Error(
        `package.json names the workspace ${pattern}, which is neither <folder> nor <folder>/*`,
      );
    return { parent, folder: parent.length + (wildcard ? 1 : 0) };
  });
  const parts = path.split('/');
  const testFolderAt = (folder: number): boolean =>
    parts[folder] === 'test' || parts[folder] === 'tests';
  return (
    parts[0] === 'tests' ||
    roots.some(
      ({ parent, folder }) =>
        parent.every((part, i) => parts[i] === part) && testFolderAt(folder),
    )
  );
}

/** A module the import follower reads (`tests/unit/helper-modules.ts`). */
const TYPESCRIPT = /\.[cm]?ts$/;
/** A module it does not read, so cannot judge. */
const JAVASCRIPT = /\.[cm]?js$/;

/**
 * The helpers among `changed` (#659 AC1): each file added, changed or
 * renamed in a test folder that no suite lists (`listed`), in diff order.
 * A TypeScript one is a helper a test imports; any other but JavaScript is
 * data a test may read from disk; a JavaScript one is refused by name, as
 * the import follower cannot read it. A file in one of the `recorded`
 * folders, whose counts CI alone writes and their own checks compare
 * exactly, is listed apart and judged no further (Shyden, 2026-10-18). A
 * mutation file is judged as one, never as a helper too (#670).
 */
export function changedHelpers(
  changed: readonly Changed[],
  listed: ReadonlySet<string>,
  workspaces: readonly string[],
  recorded: readonly string[],
): {
  helpers: string[];
  data: string[];
  recorded: string[];
  unreadable: string[];
} {
  const inTests = changed.filter(
    ({ status, path }) =>
      status !== 'D' && !listed.has(path) && inTestFolder(path, workspaces),
  );
  const isRecorded = (path: string): boolean =>
    recorded.some((folder) => path.startsWith(`${folder}/`));
  const candidates = inTests.filter(({ path }) => !isRecorded(path));
  return {
    recorded: inTests
      .filter(({ path }) => isRecorded(path))
      .map(({ path }) => path),
    helpers: candidates
      .filter(({ path }) => TYPESCRIPT.test(path) && !isMutationFile(path))
      .map(({ path }) => path),
    data: candidates
      .filter(({ path }) => !TYPESCRIPT.test(path) && !JAVASCRIPT.test(path))
      .map(({ path }) => path),
    unreadable: candidates
      .filter(({ path }) => JAVASCRIPT.test(path))
      .map(
        ({ path }) =>
          `${path}: a JavaScript file in a test folder, which the import follower does not read`,
      ),
  };
}

/**
 * Each file a row of `files` plants in, to the test files its rows predict
 * red. A file whose every row is predicted green is left out: a row that
 * stays green proves nothing.
 */
export function redByPlantedFile(
  files: readonly MutationFile[],
): Map<string, Set<string>> {
  const red = new Map<string, Set<string>>();
  for (const { mutations } of files)
    for (const row of mutations)
      for (const key of Object.keys(row.red)) {
        const tests = red.get(row.file) ?? new Set<string>();
        tests.add(redTestFile(key));
        red.set(row.file, tests);
      }
  return red;
}

/** How many tests a failure names before it says how many more. */
const NAMED_LOADERS = 5;

/**
 * Each changed helper a non-unit test loads (`loadedBy`) that no row of a
 * changed mutation file plants in and predicts red for one of those tests
 * (`planted`, from `redByPlantedFile`), named with the first five tests that
 * load it (#659 AC2). A helper no non-unit test loads passes (AC3).
 */
export function unprovedHelpers(
  helpers: readonly string[],
  loadedBy: ReadonlyMap<string, readonly string[]>,
  planted: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  return helpers.flatMap((helper) => {
    const loaders = loadedBy.get(helper) ?? [];
    const red = planted.get(helper);
    if (loaders.length === 0 || loaders.some((test) => red?.has(test)))
      return [];
    const more =
      loaders.length > NAMED_LOADERS
        ? `, and ${String(loaders.length - NAMED_LOADERS)} more`
        : '';
    return [
      `${helper}: loaded by ${counted(loaders.length, 'non-unit test', 'non-unit tests')} (${loaders.slice(0, NAMED_LOADERS).join(', ')}${more}); no row of a mutation file this pull request adds or changes plants in it and predicts one of them red`,
    ];
  });
}

/**
 * `loadedBy` with only the tests `nonUnit` lists among each file's loaders,
 * leaving out a file only unit tests load: those need no mutation (#659 AC3).
 */
export function nonUnitLoaders(
  loadedBy: ReadonlyMap<string, readonly string[]>,
  nonUnit: ReadonlyMap<string, string>,
): Map<string, string[]> {
  return new Map(
    [...loadedBy]
      .map(([file, loaders]): [string, string[]] => [
        file,
        loaders.filter((test) => nonUnit.has(test)),
      ])
      .filter(([, loaders]) => loaders.length > 0),
  );
}

/**
 * Each changed data file that no test, nor a helper one loads, names
 * (`readBy`, every suite's tests): it may still be read by a path built at
 * run time, so the judge cannot pass it as read by none.
 */
export function unnamedData(
  data: readonly string[],
  readBy: ReadonlyMap<string, readonly string[]>,
): string[] {
  return data
    .filter((path) => (readBy.get(path) ?? []).length === 0)
    .map(
      (path) =>
        `${path}: no test, nor a helper one loads, names it, so the judge cannot tell which tests read it`,
    );
}
