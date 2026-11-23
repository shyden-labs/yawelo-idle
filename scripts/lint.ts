/**
 * `npm run lint`: ESLint over the whole repository, in groups, one process
 * after another (#1081). One process for everything builds up to 27
 * TypeScript programs and peaked at 1.76 GB of live heap against Node's
 * ~2.04 GB default; it crashed the pre-push hook three times. Split like
 * this, the largest group peaks at 1.27 GB (three rounds, measured on #1081).
 *
 * The last run lints everything and ignores exactly what the earlier runs
 * took, so a new folder is linted without being listed here.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** The heavy groups, each its own process; the rest is linted last. */
export const GROUPS: readonly (readonly string[])[] = [
  ['apps/site'],
  ['tests', 'scripts'],
  ['packages/core'],
  ['apps/door', 'apps/sync-worker', 'apps/web'],
];

const ZERO_WARNINGS = ['--max-warnings', '0'];

/** The ESLint arguments of each run, in order. */
export function lintRuns(groups: readonly (readonly string[])[]): string[][] {
  const rest = groups
    .flat()
    .flatMap((path) => ['--ignore-pattern', `${path}/**`]);
  return [
    ...groups.map((paths) => [...ZERO_WARNINGS, ...paths]),
    [...ZERO_WARNINGS, '.', ...rest],
  ];
}

/** Runs every group, even after one fails, and fails if any did. */
function main(): number {
  // `bin/eslint.js` is not in ESLint's exports; its package.json is.
  const eslint = join(
    dirname(createRequire(import.meta.url).resolve('eslint/package.json')),
    'bin',
    'eslint.js',
  );
  let failed = 0;
  // A runtime population: the runs lintRuns builds.
  for (const args of lintRuns(GROUPS)) {
    const run = spawnSync(process.execPath, [eslint, ...args], {
      stdio: 'inherit',
    });
    if (run.status !== 0) {
      failed += 1;
      console.error(
        `lint: eslint ${args.join(' ')} failed (${run.error?.message ?? `status ${String(run.status)}, signal ${String(run.signal)}`})`,
      );
    }
  }
  return failed === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main();
