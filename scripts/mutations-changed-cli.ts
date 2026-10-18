/**
 * `node scripts/mutations-changed-cli.ts` (#649 spec §7, #619 AC2 and AC4):
 * the `mutations` workflow's first job. Reads `git diff --name-status
 * <BASE>...HEAD`, lists every suite (unless the change is docs-only), loads
 * each mutation file the pull request adds or changes, and fails naming each
 * changed non-unit test that none of them targets. It always prints how many
 * paths it judged, and writes `count` and `files` (space-separated) to
 * `GITHUB_OUTPUT` for the job that runs the files.
 *
 * The entry lives apart from `mutations-changed.ts` because it imports each
 * mutation file by a path known only at run time, and the whole-repo guards
 * follow every import of the files the suites load, refusing one they cannot
 * read; no test loads this file (as `mutate-cli.ts`).
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { asMutationFile, type MutationFile } from './mutation-file.ts';
import {
  mutationFilesIn,
  needsListings,
  nonUnitTests,
  readNameStatus,
  summary,
  testsPredictedRed,
  unprovedTests,
} from './mutations-changed.ts';
import { SUITES, suiteFiles } from './record-floors.ts';

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
  const nonUnit = needsListings(changed)
    ? nonUnitTests(listings())
    : new Map<string, string>();
  const tests = changed.filter(
    ({ status, path }) => status !== 'D' && nonUnit.has(path),
  );
  console.log(
    summary({
      tests: tests.length,
      files: files.length,
      judged: changed.length,
    }),
  );
  if (!needsListings(changed))
    console.log('  docs only: no suite listed, as no test can be among them');
  for (const { path } of tests) console.log(`  test: ${path}`);
  for (const file of files) console.log(`  mutation file: ${file}`);
  const unproved = unprovedTests(changed, nonUnit, predictedRed);
  if (unproved.length > 0) {
    console.error(
      `✗ ${String(unproved.length)} changed non-unit test${unproved.length === 1 ? '' : 's'} with no mutation file (#619):\n  ${unproved.join('\n  ')}`,
    );
    process.exitCode = 1;
  }
  appendFileSync(
    output,
    `count=${String(files.length)}\nfiles=${files.join(' ')}\n`,
  );
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
