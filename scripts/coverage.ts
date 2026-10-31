/**
 * Coverage (#728, #795): `npm run test:coverage` measures every suite
 * pull-request CI runs, joins them, and fails below one overall threshold
 * for statements and one for branches, or when any statement, branch arm or
 * function of a Svelte screen goes untested (#802, #804).
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
 * Whether a logical branch is one Svelte's compiler added rather than one
 * written in the screen (#806): it compiles every `{value}` in the markup to
 * `${value ?? ''}`, whose second arm no test can take for a value that is
 * never null. The source from the branch's start to the end of its line
 * then holds no logical operator. One written there (`??`, `||`, `&&`) is
 * judged, even when the line also holds a plain `{value}`.
 */
export function compilerMade(
  branch: { type: string; loc: { start: { line: number; column: number } } },
  lines: readonly string[],
): boolean {
  if (branch.type !== 'binary-expr') return false;
  const { line, column } = branch.loc.start;
  return !/\?\?|\|\||&&/.test((lines[line - 1] ?? '').slice(column));
}

/**
 * Everything in a Svelte screen no suite ran (#802, #804; Shyden, 2026-10-31:
 * "behaviour must be teste always"): each statement, branch arm and function,
 * as `path:line: what`, by file and then line. Every screen is held to all
 * of it, but for the branches its compiler adds (`compilerMade`). An entry with no function at all is named too, since it cannot
 * show a render.
 */
export function untestedScreens(
  maps: readonly CoverageMapData[],
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): string[] {
  const joined = libCoverage.createCoverageMap({});
  for (const map of maps) joined.merge(map);
  return joined
    .files()
    .filter((path) => path.endsWith('.svelte'))
    .sort()
    .flatMap((path) => {
      const { data } = joined.fileCoverageFor(path);
      let source: string[] | undefined;
      const lines = (): string[] => (source ??= read(path).split('\n'));
      if (Object.keys(data.fnMap).length === 0)
        return [`${path}:1: no component function, so no render shows`];
      const found: [number, string][] = [
        ...Object.entries(data.fnMap)
          .filter(([id]) => data.f[id] === 0)
          .map(([, fn]): [number, string] => [
            fn.decl.start.line,
            `function ${fn.name} never called`,
          ]),
        ...Object.entries(data.statementMap)
          .filter(([id]) => data.s[id] === 0)
          .map(([, loc]): [number, string] => [
            loc.start.line,
            'statement never run',
          ]),
        ...Object.entries(data.branchMap).flatMap(([id, branch]) =>
          branch.type === 'binary-expr' && compilerMade(branch, lines())
            ? []
            : branch.locations.flatMap((loc, arm): [number, string][] =>
                data.b[id]?.[arm] === 0
                  ? [
                      [
                        loc.start.line,
                        `branch arm ${String(arm + 1)} of ${String(branch.locations.length)} never taken`,
                      ],
                    ]
                  : [],
              ),
        ),
      ];
      return found
        .sort((x, y) => x[0] - y[0])
        .map(([line, what]) => `${path}:${String(line)}: ${what}`);
    });
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
  const untested = untestedScreens(maps);
  if (untested.length > 0)
    die(
      `every screen's behaviour is tested in full (#804); untested:\n  ${untested.join('\n  ')}`,
    );
}

if (import.meta.main) measure();
