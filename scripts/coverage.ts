/**
 * Coverage (#728, #795): `npm run test:coverage` measures every suite
 * pull-request CI runs, joins them, and fails below one overall threshold
 * for statements and one for branches, or when a Svelte component is never
 * rendered by a test (#802).
 *
 *   node scripts/coverage.ts
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import libCoverage from 'istanbul-lib-coverage';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import { COVERAGE_SUITES, coverageConfigFile } from './coverage-config.ts';

/**
 * The overall thresholds, in percent: the figures measured in CI with
 * Svelte counted (#798, run 41089966299: statements 2,720 of 19,234
 * untested, 85.86%; branches 1,275 of 5,542, 76.99%), rounded down. Develop at f4a9bd3 measured 88.3% and 81.2% before #795
 * removed machinery better tested than the rest. Raise them as coverage
 * grows; lower one only in the change that removes tested code, saying so.
 */
export const THRESHOLDS = { statements: 85, branches: 76 } as const;

export interface Count {
  untested: number;
  total: number;
}

export interface Totals {
  statements: Count;
  branches: Count;
}

/** Why a suite's run left nothing to measure, or nothing. */
export function suiteFailure(
  name: string,
  run: { error?: Error; status: number | null },
): string | undefined {
  if (run.error !== undefined)
    return `the ${name} suite did not start: ${run.error.message}`;
  if (run.status !== 0)
    return `the ${name} suite failed (exit ${String(run.status)}): nothing measured`;
  return undefined;
}

const share = ({ untested, total }: Count): number =>
  total === 0 ? 100 : (100 * (total - untested)) / total;

/**
 * A count as the run prints it: the share run, rounded down to a tenth so
 * the figure printed is never above the one judged, then both counts.
 */
export const percent = (count: Count): string =>
  `${(Math.floor(share(count) * 10) / 10).toFixed(1)}% run (${count.untested.toLocaleString('en')} of ${count.total.toLocaleString('en')} untested)`;

/** Each measure below its threshold, named with both figures. */
export const shortfalls = (
  totals: Totals,
  thresholds: Readonly<Record<keyof Totals, number>> = THRESHOLDS,
): string[] =>
  (['statements', 'branches'] as const)
    .filter((measure) => share(totals[measure]) < thresholds[measure])
    .map(
      (measure) =>
        `${measure}: ${percent(totals[measure])}, below the ${String(thresholds[measure])}% threshold`,
    );

/** The joined totals of several suites' coverage maps. */
export function totalsOf(maps: readonly CoverageMapData[]): Totals {
  const joined = libCoverage.createCoverageMap({});
  for (const map of maps) joined.merge(map);
  const summary = joined.getCoverageSummary();
  return {
    statements: {
      untested: summary.statements.total - summary.statements.covered,
      total: summary.statements.total,
    },
    branches: {
      untested: summary.branches.total - summary.branches.covered,
      total: summary.branches.total,
    },
  };
}

/**
 * Every Svelte file whose component no suite rendered (#802): no function in
 * its joined entry was ever called. An entry with no function at all is
 * named too, since it cannot show a render.
 */
export function unrenderedComponents(
  maps: readonly CoverageMapData[],
): string[] {
  const joined = libCoverage.createCoverageMap({});
  for (const map of maps) joined.merge(map);
  return joined
    .files()
    .filter((path) => path.endsWith('.svelte'))
    .filter((path) => {
      const calls = Object.values(joined.fileCoverageFor(path).f);
      return calls.length === 0 || calls.every((n) => n === 0);
    })
    .sort();
}

const die = (message: string): never => {
  console.error(`coverage: ${message}`);
  process.exit(1);
};

function measure(): void {
  for (const { name } of COVERAGE_SUITES) {
    console.log(`coverage: the ${name} suite`);
    const run = spawnSync(
      'npx',
      ['vitest', 'run', '-c', coverageConfigFile(name)],
      { stdio: 'inherit' },
    );
    const failure = suiteFailure(name, run);
    if (failure !== undefined) die(failure);
  }
  const maps = COVERAGE_SUITES.map(
    ({ name }) =>
      JSON.parse(
        readFileSync(join('coverage', name, 'coverage-final.json'), 'utf8'),
      ) as CoverageMapData,
  );
  const totals = totalsOf(maps);
  console.log(
    `coverage: every suite joined\n` +
      `  statements: ${percent(totals.statements)}\n` +
      `  branches: ${percent(totals.branches)}`,
  );
  const below = shortfalls(totals);
  if (below.length > 0) die(`below threshold:\n  ${below.join('\n  ')}`);
  const unrendered = unrenderedComponents(maps);
  if (unrendered.length > 0)
    die(
      `every screen needs a test that renders it (#802); none renders:\n  ${unrendered.join('\n  ')}`,
    );
}

if (import.meta.main) measure();
