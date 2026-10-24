/**
 * Coverage runs the tests each suite's own CI step runs (#762 AC3). Each
 * suite step in build-and-test and each suite of the coverage measure writes
 * Vitest's JSON report; this compares them file by file, test by test, so a
 * test the coverage run fails to collect, or collects twice, fails CI instead
 * of shrinking the measured denominator unseen.
 *
 *   node scripts/coverage-same-tests.ts <full|docs-only>
 *
 * Run in the coverage-same-tests job, from the checkout both reports were
 * written in: their file names are absolute and read relative to the
 * working directory, where the reports are read too.
 */
import { readFileSync } from 'node:fs';
import { configDefaults, type ViteUserConfig } from 'vitest/config';
import { COVERAGE_SUITES, coverageConfigFile } from './coverage-config.ts';

/** Where each suite step in build-and-test writes its report. */
export const stepReport = (suite: string): string =>
  `test-reports/${suite}.json`;

/** Where the coverage measure writes each suite's report. */
export const coverageReport = (suite: string): string =>
  `coverage/tests/${suite}.json`;

/**
 * Vitest's reporters for a run that also writes its JSON report to `file`.
 * Vitest 5.0.3 defaults to `default` plus `github-actions` under Actions, and
 * naming any reporter replaces that list, so both are named again.
 */
export const reporterArgs = (file: string): string[] => [
  '--reporter=default',
  '--reporter=github-actions',
  '--reporter=json',
  `--outputFile.json=${file}`,
];

/** The `run:` of a suite's step in build-and-test. */
export const suiteStep = (suite: string): string =>
  `npm run test:${suite} -- ${reporterArgs(stepReport(suite)).join(' ')}`;

/** The suites build-and-test runs on a docs-only change (#360). */
const DOCS_ONLY_SUITES: readonly string[] = ['unit', 'guards'];

/** The suites to compare for a change's scope, or undefined for no scope. */
export function suitesFor(scope: string): readonly string[] | undefined {
  if (scope === 'full') return COVERAGE_SUITES.map(({ name }) => name);
  return scope === 'docs-only' ? DOCS_ONLY_SUITES : undefined;
}

type Excluding = { test?: { exclude?: readonly string[] } };

/**
 * The files a suite's coverage run leaves out on purpose: what its coverage
 * config excludes beyond its own config (BUDGET_TESTS today). A config with
 * no exclude list excludes Vitest's `defaults`, as Vitest reads it. A glob
 * here matches no reported file, so the comparison refuses it.
 */
export const leftOutOf = (
  suite: Excluding,
  coverage: Excluding,
  defaults: readonly string[],
): string[] =>
  (coverage.test?.exclude ?? defaults).filter(
    (entry) => !(suite.test?.exclude ?? defaults).includes(entry),
  );

interface FileTests {
  status: string;
  /** Each test as JSON `[status, ...ancestorTitles, title]`, and how often. */
  tests: Map<string, number>;
}

const isText = (value: unknown): value is string => typeof value === 'string';

/** A test result's key, or undefined when it is not one. */
function testKey(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null) return undefined;
  const { ancestorTitles, title, status } = result as Record<string, unknown>;
  if (!isText(title) || !isText(status) || !Array.isArray(ancestorTitles))
    return undefined;
  if (!ancestorTitles.every(isText)) return undefined;
  return JSON.stringify([status, ...ancestorTitles, title]);
}

/**
 * A Vitest JSON report's files, relative to `root`, with each one's status
 * and tests, or what makes it unreadable. `path` names the report.
 */
export function readReport(
  text: string | undefined,
  root: string,
  path: string,
): { files: Map<string, FileTests>; problems: string[] } {
  const files = new Map<string, FileTests>();
  const problems: string[] = [];
  if (text === undefined) return { files, problems: [`${path} is missing`] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { files, problems: [`${path} is not JSON`] };
  }
  const results = (parsed as { testResults?: unknown }).testResults;
  if (!Array.isArray(results))
    return { files, problems: [`${path} has no testResults list`] };
  const prefix = root.endsWith('/') ? root : `${root}/`;
  results.forEach((entry: unknown, i) => {
    const { name, status, assertionResults } = (entry ?? {}) as Record<
      string,
      unknown
    >;
    if (!isText(name)) {
      problems.push(`${path}: test file ${String(i)} has no name`);
      return;
    }
    if (!name.startsWith(prefix)) {
      problems.push(`${path}: ${name} is outside ${root}`);
      return;
    }
    const file = name.slice(prefix.length);
    if (files.has(file)) {
      problems.push(`${path}: ${file} is reported twice`);
      return;
    }
    if (!isText(status)) {
      problems.push(`${path}: ${file} has no status`);
      return;
    }
    if (!Array.isArray(assertionResults)) {
      problems.push(`${path}: ${file} has no assertionResults list`);
      return;
    }
    const tests = new Map<string, number>();
    assertionResults.forEach((result: unknown, j) => {
      const key = testKey(result);
      if (key === undefined)
        problems.push(
          `${path}: ${file}: test ${String(j)} is not a test result`,
        );
      else tests.set(key, (tests.get(key) ?? 0) + 1);
    });
    files.set(file, { status, tests });
  });
  if (files.size === 0 && problems.length === 0)
    problems.push(`${path} reports no test files: nothing to compare`);
  return { files, problems };
}

const total = (tests: ReadonlyMap<string, number>): number =>
  [...tests.values()].reduce((sum, n) => sum + n, 0);

const tally = (n: number): string => `${String(n)} test${n === 1 ? '' : 's'}`;

/** The tests `from` holds more often than `other`, one entry per copy. */
const beyond = (
  from: ReadonlyMap<string, number>,
  other: ReadonlyMap<string, number>,
): string[] =>
  [...from].flatMap(([key, n]) => {
    const [status, ...titles] = JSON.parse(key) as string[];
    const shown = `${String(status)} "${titles.join(' > ')}"`;
    return Array.from({ length: n - (other.get(key) ?? 0) }, () => shown);
  });

/** The first three, then how many more. */
const some = (tests: readonly string[]): string =>
  tests.length > 3
    ? `${tests.slice(0, 3).join(', ')} and ${String(tests.length - 3)} more`
    : tests.join(', ');

/**
 * Whether a suite's coverage run ran the tests its CI step ran: the same
 * files with the same status, each test as often, every file the coverage
 * config leaves out present in the step and absent from coverage. Counts
 * the files and tests compared.
 */
export function compareReports(
  reports: {
    suite: string;
    step: string | undefined;
    coverage: string | undefined;
    leftOut: readonly string[];
  },
  where: { root: string; stepPath: string; coveragePath: string },
): { files: number; tests: number; problems: string[] } {
  const { suite, leftOut } = reports;
  const step = readReport(reports.step, where.root, where.stepPath);
  const coverage = readReport(reports.coverage, where.root, where.coveragePath);
  if (step.problems.length > 0 || coverage.problems.length > 0)
    return {
      files: 0,
      tests: 0,
      problems: [...step.problems, ...coverage.problems],
    };
  const problems: string[] = [];
  for (const file of leftOut) {
    if (!step.files.has(file))
      problems.push(
        `${file}: left out of the coverage run, but the ${suite} step has no such file`,
      );
    else if (coverage.files.has(file))
      problems.push(`${file}: left out of the coverage run, yet it ran there`);
  }
  const compared = (file: string): boolean => !leftOut.includes(file);
  let files = 0;
  let tests = 0;
  for (const [file, ran] of [...step.files].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!compared(file)) continue;
    const measured = coverage.files.get(file);
    if (measured === undefined) {
      problems.push(
        `${file}: ${tally(total(ran.tests))} in the ${suite} step, and the coverage run has no such file`,
      );
      continue;
    }
    files += 1;
    tests += total(ran.tests);
    if (ran.status !== measured.status)
      problems.push(
        `${file}: ${ran.status} in the ${suite} step, ${measured.status} under coverage`,
      );
    const onlyRan = beyond(ran.tests, measured.tests);
    const onlyMeasured = beyond(measured.tests, ran.tests);
    if (onlyRan.length + onlyMeasured.length > 0)
      problems.push(
        [
          `${file}: ${tally(total(ran.tests))} in the ${suite} step, ${String(total(measured.tests))} under coverage`,
          ...(onlyRan.length > 0 ? [`only in the step: ${some(onlyRan)}`] : []),
          ...(onlyMeasured.length > 0
            ? [`only under coverage: ${some(onlyMeasured)}`]
            : []),
        ].join('; '),
      );
  }
  for (const [file, measured] of coverage.files)
    if (compared(file) && !step.files.has(file))
      problems.push(
        `${file}: ${tally(total(measured.tests))} under coverage, and the ${suite} step has no such file`,
      );
  return { files, tests, problems };
}

const readOrUndefined = (path: string): string | undefined => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

if (import.meta.main) {
  const scope = process.argv[2] ?? '';
  const suites = suitesFor(scope);
  if (suites === undefined) {
    console.error(
      `coverage-same-tests: name the change's scope, full or docs-only, not "${scope}"`,
    );
    process.exit(1);
  }
  let failed = false;
  for (const name of suites) {
    const own = COVERAGE_SUITES.find((s) => s.name === name)?.config ?? {};
    const measured = (
      (await import(
        new URL(`../${coverageConfigFile(name)}`, import.meta.url).href
      )) as {
        default: ViteUserConfig;
      }
    ).default;
    const { files, tests, problems } = compareReports(
      {
        suite: name,
        step: readOrUndefined(stepReport(name)),
        coverage: readOrUndefined(coverageReport(name)),
        leftOut: leftOutOf(own, measured, configDefaults.exclude),
      },
      {
        root: process.cwd(),
        stepPath: stepReport(name),
        coveragePath: coverageReport(name),
      },
    );
    if (problems.length > 0) {
      failed = true;
      console.error(
        `coverage-same-tests: the ${name} suite:\n  ${problems.join('\n  ')}`,
      );
    } else
      console.log(
        `coverage-same-tests: the ${name} suite: ${files.toLocaleString('en')} files, ${tests.toLocaleString('en')} tests, the same in its step and under coverage`,
      );
  }
  if (failed) process.exit(1);
}
