/**
 * `node scripts/mutations-changed-cli.ts` (#649 spec §7, #619 AC2 and AC4,
 * #659): the `mutations` workflow's first job. Reads `git diff --name-status
 * <BASE>...HEAD`, lists every suite (unless the change is docs-only), loads
 * each mutation file the pull request adds or changes, and fails naming each
 * changed non-unit test that none of them predicts red, and each changed
 * test-folder helper a non-unit test loads, or data file it names, that
 * none of them plants in and predicts red for one of those tests. It always prints how many paths it
 * judged, and writes `count` and `files` (a JSON list) to `GITHUB_OUTPUT`
 * for the jobs that run the files, one each (#754).
 *
 * The entry lives apart from `mutations-changed.ts` because it imports each
 * mutation file by a path known only at run time, and the whole-repo guards
 * follow every import of the files the suites load, refusing one they cannot
 * read; no test loads this file (as `mutate-cli.ts`).
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { asMutationFile, type MutationFile } from './mutation-file.ts';
import {
  changedHelpers,
  githubOutput,
  mutationFilesIn,
  needsListings,
  nonUnitLoaders,
  nonUnitTests,
  RECORDED_DIRS,
  readNameStatus,
  redByPlantedFile,
  summary,
  testsPredictedRed,
  unnamedData,
  unprovedHelpers,
  unprovedTests,
} from './mutations-changed.ts';
import { SUITES, suiteFiles } from './record-floors.ts';
import { committableFiles } from '../tests/unit/tracked-files.ts';

/** Every suite's files, repository-relative, by suite name. */
function listings(): Map<string, readonly string[]> {
  return new Map(
    SUITES.map((entry) => {
      const [command, ...args] = entry.list;
      if (command === undefined)
        throw new Error(`${entry.name} has no list command`);
      const listed = spawnSync(command, args, {
        cwd: entry.cwd,
        encoding: 'utf8',
      });
      if (listed.status !== 0)
        throw new Error(
          `${entry.list.join(' ')} failed in ${entry.cwd}: ${listed.stderr.trim()}`,
        );
      return [entry.name, suiteFiles(entry, listed.stdout)];
    }),
  );
}

/** package.json's workspace patterns, refusing a file that names none. */
function workspaces(): string[] {
  const { workspaces: patterns } = JSON.parse(
    readFileSync('package.json', 'utf8'),
  ) as { readonly workspaces?: unknown };
  if (
    !Array.isArray(patterns) ||
    !patterns.every((p): p is string => typeof p === 'string')
  )
    throw new Error('package.json names no workspaces as a list of strings');
  return patterns;
}

/**
 * Each helper `tests` load, and each of `data` they name, to those tests,
 * through the import follower the collection-calls guard uses (#554), and
 * what it cannot follow. Loaded only here: the follower needs the installed
 * TypeScript compiler, which a docs-only change never installs.
 */
async function loaders(
  tests: readonly string[],
  data: readonly string[],
): Promise<{
  loadedBy: ReadonlyMap<string, readonly string[]>;
  readBy: ReadonlyMap<string, readonly string[]>;
  unresolved: readonly string[];
}> {
  const committable = new Set(committableFiles());
  const { dataReaders, helperLoaders } =
    await import('../tests/unit/helper-modules.ts');
  const source = (path: string): string | undefined =>
    committable.has(path) ? readFileSync(path, 'utf8') : undefined;
  const { loadedBy, unresolved } = helperLoaders(tests, source);
  return { loadedBy, readBy: dataReaders(tests, source, data), unresolved };
}

async function main(): Promise<void> {
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
  const loaded: MutationFile[] = [];
  for (const file of files) {
    const module = (await import(pathToFileURL(resolve(file)).href)) as {
      readonly default?: unknown;
    };
    loaded.push(asMutationFile(module.default));
  }
  const predictedRed = testsPredictedRed(loaded);
  const listedBySuite = needsListings(changed)
    ? listings()
    : new Map<string, readonly string[]>();
  const nonUnit = nonUnitTests(listedBySuite);
  const tests = changed.filter(
    ({ status, path }) => status !== 'D' && nonUnit.has(path),
  );
  const listed = new Set([...listedBySuite.values()].flat());
  const { helpers, data, recorded, unreadable } = needsListings(changed)
    ? changedHelpers(changed, listed, workspaces(), RECORDED_DIRS)
    : { helpers: [], data: [], recorded: [], unreadable: [] };
  // Every suite's tests: a file only unit tests use needs no mutation, but a
  // data file no test names at all fails (unnamedData).
  const { loadedBy, readBy, unresolved } =
    helpers.length + data.length > 0
      ? await loaders([...listed].sort(), data)
      : {
          loadedBy: new Map<string, readonly string[]>(),
          readBy: new Map<string, readonly string[]>(),
          unresolved: [],
        };
  const used = nonUnitLoaders(new Map([...loadedBy, ...readBy]), nonUnit);
  console.log(
    summary({
      tests: tests.length,
      helpers: helpers.length + data.length + unreadable.length,
      files: files.length,
      judged: changed.length,
    }),
  );
  if (!needsListings(changed))
    console.log('  docs only: no suite listed, as no test can be among them');
  for (const { path } of tests) console.log(`  test: ${path}`);
  for (const helper of [...helpers, ...data]) {
    const by = used.get(helper)?.length ?? 0;
    console.log(
      `  helper: ${helper} (used by ${by === 0 ? 'no non-unit test' : `${String(by)} non-unit test${by === 1 ? '' : 's'}`})`,
    );
  }
  for (const path of recorded)
    console.log(`  recorded counts, left out (Shyden, 2026-10-18): ${path}`);
  for (const file of files) console.log(`  mutation file: ${file}`);
  const failures: [string, readonly string[]][] = [
    [
      'changed non-unit test with no mutation file (#619)',
      unprovedTests(changed, nonUnit, predictedRed),
    ],
    [
      'changed helper with no mutation planted in it (#659)',
      unprovedHelpers([...helpers, ...data], used, redByPlantedFile(loaded)),
    ],
    ['changed data file no test names (#659)', unnamedData(data, readBy)],
    ['changed helper the import follower cannot read (#659)', unreadable],
    ['import the follower cannot follow (#659)', unresolved],
  ];
  for (const [what, found] of failures)
    if (found.length > 0) {
      console.error(
        `✗ ${String(found.length)} × ${what}:\n  ${found.join('\n  ')}`,
      );
      process.exitCode = 1;
    }
  appendFileSync(output, githubOutput(files));
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
