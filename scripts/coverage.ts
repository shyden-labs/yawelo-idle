/**
 * Coverage (#728, #795): `npm run test:coverage` measures every suite
 * pull-request CI runs, joins them, and fails below one overall threshold
 * for statements and one for branches, or when any statement, branch arm or
 * function of a Svelte screen goes untested (#802, #804).
 *
 *   node scripts/coverage.ts
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import libCoverage from 'istanbul-lib-coverage';
import type { CoverageMapData, FileCoverageData } from 'istanbul-lib-coverage';
import { buildKey } from '../tests/support/covered-harness.ts';
import { COVERAGE_SUITES, coverageConfigFile } from './coverage-config.ts';
import { WORKER_CONFIGS } from './worker-coverage-build.ts';

/**
 * The overall thresholds, in percent: the figures measured in CI by #1093
 * (run 45354626088 on b98f93ba: statements 1,718 of 28,883 untested, 94.0%;
 * branches 1,399 of 7,905, 82.3%), rounded down. Those runs did NOT count
 * the Worker suites: the gate joined the Vitest suites only, so every
 * Worker statement was untested in them (#1103, which joins the Worker
 * suites and re-measures these from its first CI run). They were 85 and 76 from #798's run 41089966299,
 * before the Worker suites joined the report. Raise them as coverage
 * grows; lower one only in the change that removes tested code, saying so.
 */
export const THRESHOLDS = { statements: 94, branches: 82 } as const;

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

/** A path named from the repo root, as the Worker reports name theirs. */
function fromRoot(path: string, repoRoot: string): string {
  return isAbsolute(path)
    ? relative(repoRoot, path).split(sep).join('/')
    : path;
}

/**
 * The one map the gate judges (#1103): the Vitest suites' maps joined, as
 * they always were, and each Worker bundle's map beside them. A file more
 * than one loader saw (the Vitest suites, which count a Worker's source as
 * never run, and each bundle that serves it) is judged by the one that ran
 * most of its statements, then of its branch arms, the first seen (the
 * Vitest suites) on a full tie. Two loaders' counts
 * of one file are never added together (#733): their statement maps differ.
 */
export function judgedMaps(
  vitest: readonly CoverageMapData[],
  workers: readonly CoverageMapData[],
  repoRoot: string,
): CoverageMapData {
  // Each file as plain data named from the root (an entry may be a
  // FileCoverage instance, whose spread would lose its methods).
  const named = (map: CoverageMapData): FileCoverageData[] =>
    Object.values(map).map((entry) => {
      const data = libCoverage.createFileCoverage(entry).data;
      return { ...data, path: fromRoot(data.path, repoRoot) };
    });
  const joined = libCoverage.createCoverageMap({});
  for (const map of vitest)
    for (const data of named(map)) joined.addFileCoverage(data);
  const judged = joined.toJSON();
  const count = (hits: readonly number[]): number =>
    hits.filter((n) => n > 0).length;
  const ran = (data: FileCoverageData): [number, number] => [
    count(Object.values(data.s)),
    count(Object.values(data.b).flat()),
  ];
  const more = (
    [statements, arms]: [number, number],
    [heldStatements, heldArms]: [number, number],
  ): boolean =>
    statements > heldStatements ||
    (statements === heldStatements && arms > heldArms);
  for (const map of workers)
    for (const data of named(map)) {
      const held = judged[data.path];
      if (
        held === undefined ||
        more(ran(data), ran(libCoverage.createFileCoverage(held).data))
      )
        judged[data.path] = data;
    }
  return judged;
}

/**
 * Each Worker config's map, as `scripts/worker-coverage-report.ts` wrote it
 * under `out` (`worker-<key>/coverage-final.json`). A config with none is
 * refused, naming it: its code would otherwise count as never run.
 */
export function workerMaps(
  out: string,
  configs: readonly string[],
): CoverageMapData[] {
  return configs.map((config) => {
    const file = join(
      out,
      `worker-${buildKey(join('/', config), '/')}`,
      'coverage-final.json',
    );
    if (!existsSync(file))
      throw new Error(
        `no Worker coverage for ${config}: did \`npm run test:worker:coverage\` run?`,
      );
    return JSON.parse(readFileSync(file, 'utf8')) as CoverageMapData;
  });
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
  // The Worker suites run in workerd, which Vitest's coverage cannot see:
  // their counts come from each Worker's instrumented bundle (#1093), and
  // the gate judges Worker code by them (#1103).
  console.log('coverage: the Worker suites');
  const workerRun = spawnSync('npm', ['run', 'test:worker:coverage'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      WORKER_COVERAGE_DIR: mkdtempSync(join(tmpdir(), 'worker-coverage-')),
    },
  });
  const workerFailure = suiteFailure('Worker', workerRun);
  if (workerFailure !== undefined) die(workerFailure);
  const maps = COVERAGE_SUITES.map(
    ({ name }) =>
      JSON.parse(
        readFileSync(join('coverage', name, 'coverage-final.json'), 'utf8'),
      ) as CoverageMapData,
  );
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const totals = totalsOf([
    judgedMaps(maps, workerMaps('coverage', WORKER_CONFIGS), repoRoot),
  ]);
  console.log(
    `coverage: every suite joined, Worker code judged by its Worker suites\n` +
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
