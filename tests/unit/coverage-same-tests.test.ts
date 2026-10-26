import { describe, expect, it } from 'vitest';
import {
  COVERAGE_CONFIGS,
  compareReports,
  coverageReport,
  leftOutOf,
  readReport,
  reporterArgs,
  stepReport,
  suiteStep,
  suitesFor,
} from '../../scripts/coverage-same-tests.ts';

/**
 * Coverage runs the tests each suite's own CI step runs (#762 AC3): both
 * write Vitest's JSON report, and the comparison reads them file by file,
 * test by test. The CLI that reads the files is a process, tested in
 * tests/integration/coverage-same-tests.test.ts.
 */

const ROOT = '/w/repo';

interface Test {
  titles: string[];
  status?: string;
}

/** A Vitest JSON report: each file's absolute path, status and tests. */
const report = (
  files: Record<string, readonly Test[]>,
  status: Record<string, string> = {},
): string =>
  JSON.stringify({
    numTotalTests: 0,
    testResults: Object.entries(files).map(([file, tests]) => ({
      name: `${ROOT}/${file}`,
      status: status[file] ?? 'passed',
      message: '',
      assertionResults: tests.map(({ titles, status: s }) => ({
        ancestorTitles: titles.slice(0, -1),
        title: titles.at(-1),
        fullName: titles.join(' '),
        status: s ?? 'passed',
      })),
    })),
  });

const A: Test = { titles: ['reader', 'reads a file'] };
const B: Test = { titles: ['reader', 'refuses a gap'] };
const C: Test = { titles: ['writes'] };

describe('the reported command each suite step runs (#762 AC3)', () => {
  it('keeps the reporters Vitest gives CI and adds the JSON report', () => {
    // Vitest 5.0.3 defaults to default + github-actions under Actions
    // (dist/chunks/defaults): naming any reporter replaces that list.
    expect(reporterArgs('test-reports/unit.json')).toEqual([
      '--reporter=default',
      '--reporter=github-actions',
      '--reporter=json',
      '--outputFile.json=test-reports/unit.json',
    ]);
  });

  it('spells the unit step, its report under test-reports', () => {
    expect(suiteStep('unit')).toBe(
      'npm run test:unit -- --reporter=default --reporter=github-actions --reporter=json --outputFile.json=test-reports/unit.json',
    );
  });

  it.each([
    ['step', 'guards', 'test-reports/guards.json'],
    ['coverage', 'guards', 'coverage/tests/guards.json'],
  ] as const)('puts the %s report of %s at %s', (kind, suite, path) => {
    expect((kind === 'step' ? stepReport : coverageReport)(suite)).toBe(path);
  });
});

describe('the suites compared for each scope (#762 AC3)', () => {
  it('compares every suite under coverage on a full change', () => {
    expect(suitesFor('full')).toEqual([
      'unit',
      'guards',
      'integration',
      'properties',
      'pacing',
    ]);
  });

  it('compares the two suites a docs-only change runs', () => {
    expect(suitesFor('docs-only')).toEqual(['unit', 'guards']);
  });

  it.each([[''], ['Full'], ['docs']])(
    'knows no scope spelled "%s"',
    (scope) => {
      expect(suitesFor(scope)).toBeUndefined();
    },
  );
});

describe('the files a coverage run leaves out on purpose (#762 AC3)', () => {
  it('reads a coverage config for every suite under coverage, and no other', () => {
    expect(Object.keys(COVERAGE_CONFIGS)).toEqual([
      'unit',
      'guards',
      'integration',
      'properties',
      'pacing',
    ]);
  });

  it('is what the coverage config excludes beyond its suite config', () => {
    expect(
      leftOutOf(
        { test: { exclude: ['**/node_modules/**'] } },
        { test: { exclude: ['**/node_modules/**', 'p/perf.test.ts'] } },
        ['d/**'],
      ),
    ).toEqual(['p/perf.test.ts']);
  });

  // Measured 2026-10-24: the pacing suite config has no exclude list and its
  // coverage config spells Vitest's defaults out before BUDGET_TESTS.
  it('reads a suite config with no exclude list as excluding the defaults', () => {
    expect(
      leftOutOf({}, { test: { exclude: ['d/**', 'p/perf.test.ts'] } }, [
        'd/**',
      ]),
    ).toEqual(['p/perf.test.ts']);
  });

  it('reads a coverage config with no exclude list as excluding the defaults', () => {
    expect(
      leftOutOf({ test: { exclude: ['e/**'] } }, {}, ['d/**', 'e/**']),
    ).toEqual(['d/**']);
  });
});

describe('reading a report (#762 AC3)', () => {
  it('reads each file, relative to the root, with its status and tests', () => {
    const read = readReport(
      report(
        { 'a.test.ts': [A, B], 'b.test.ts': [C] },
        { 'b.test.ts': 'failed' },
      ),
      ROOT,
      'r.json',
    );
    expect({ files: [...read.files.keys()], problems: read.problems }).toEqual({
      files: ['a.test.ts', 'b.test.ts'],
      problems: [],
    });
    expect(read.files.get('a.test.ts')?.status).toBe('passed');
    expect(read.files.get('b.test.ts')?.status).toBe('failed');
    expect(read.files.get('a.test.ts')).toEqual({
      status: 'passed',
      tests: new Map([
        ['["passed","reader","reads a file"]', 1],
        ['["passed","reader","refuses a gap"]', 1],
      ]),
    });
  });

  it('reads a root given with its trailing slash as the same root', () => {
    const read = readReport(report({ 'a.test.ts': [A] }), `${ROOT}/`, 'r.json');
    expect([...read.files.keys()]).toEqual(['a.test.ts']);
  });

  it('counts two tests of one name as two', () => {
    const read = readReport(report({ 'a.test.ts': [A, A] }), ROOT, 'r.json');
    expect(read.files.get('a.test.ts')).toEqual({
      status: 'passed',
      tests: new Map([['["passed","reader","reads a file"]', 2]]),
    });
  });

  it('tells titles apart that the full name would join alike', () => {
    const read = readReport(
      report({
        'a.test.ts': [{ titles: ['a b', 'c'] }, { titles: ['a', 'b c'] }],
      }),
      ROOT,
      'r.json',
    );
    expect(read.files.get('a.test.ts')?.tests.size).toBe(2);
  });

  it.each([
    ['a missing report', undefined, 'r.json is missing'],
    ['text that is not JSON', '{', 'r.json is not JSON'],
    ['a report with no file list', '{}', 'r.json has no testResults list'],
    [
      'a report with no files',
      report({}),
      'r.json reports no test files: nothing to compare',
    ],
    [
      'a file with no name',
      JSON.stringify({ testResults: [{ assertionResults: [] }] }),
      'r.json: test file 0 has no name',
    ],
    [
      'a file entry that is null',
      JSON.stringify({ testResults: [null] }),
      'r.json: test file 0 has no name',
    ],
    [
      'a test entry that is null',
      JSON.stringify({
        testResults: [
          {
            name: `${ROOT}/a.test.ts`,
            status: 'passed',
            assertionResults: [null],
          },
        ],
      }),
      'r.json: a.test.ts: test 0 is not a test result',
    ],
    [
      'a file outside the root',
      JSON.stringify({
        testResults: [
          {
            name: '/elsewhere/a.test.ts',
            status: 'passed',
            assertionResults: [],
          },
        ],
      }),
      'r.json: /elsewhere/a.test.ts is outside /w/repo',
    ],
    [
      'a file with no status',
      JSON.stringify({
        testResults: [{ name: `${ROOT}/a.test.ts`, assertionResults: [] }],
      }),
      'r.json: a.test.ts has no status',
    ],
    [
      'a file with no test list',
      JSON.stringify({
        testResults: [{ name: `${ROOT}/a.test.ts`, status: 'passed' }],
      }),
      'r.json: a.test.ts has no assertionResults list',
    ],
    [
      'a test with no title',
      JSON.stringify({
        testResults: [
          {
            name: `${ROOT}/a.test.ts`,
            status: 'passed',
            assertionResults: [{ ancestorTitles: [], status: 'passed' }],
          },
        ],
      }),
      'r.json: a.test.ts: test 0 is not a test result',
    ],
    [
      'a test whose titles are not text',
      JSON.stringify({
        testResults: [
          {
            name: `${ROOT}/a.test.ts`,
            status: 'passed',
            assertionResults: [
              { ancestorTitles: [1], title: 'x', status: 'passed' },
            ],
          },
        ],
      }),
      'r.json: a.test.ts: test 0 is not a test result',
    ],
    [
      'a test with no status',
      JSON.stringify({
        testResults: [
          {
            name: `${ROOT}/a.test.ts`,
            status: 'passed',
            assertionResults: [{ ancestorTitles: [], title: 'x' }],
          },
        ],
      }),
      'r.json: a.test.ts: test 0 is not a test result',
    ],
    [
      'a file reported twice',
      JSON.stringify({
        testResults: [
          { name: `${ROOT}/a.test.ts`, status: 'passed', assertionResults: [] },
          { name: `${ROOT}/a.test.ts`, status: 'passed', assertionResults: [] },
        ],
      }),
      'r.json: a.test.ts is reported twice',
    ],
  ] as const)('refuses %s', (_label, text, problem) => {
    expect(readReport(text, ROOT, 'r.json').problems).toEqual([problem]);
  });
});

describe('comparing a suite step with its coverage run (#762 AC3)', () => {
  const compare = (
    step: string | undefined,
    coverage: string | undefined,
    leftOut: readonly string[] = [],
  ) =>
    compareReports(
      { suite: 'unit', step, coverage, leftOut },
      { root: ROOT, stepPath: 's.json', coveragePath: 'c.json' },
    );

  it('passes the same tests in the same files, counting both', () => {
    const same = report({ 'a.test.ts': [A, B], 'b.test.ts': [C] });
    expect(compare(same, same)).toEqual({ files: 2, tests: 3, problems: [] });
  });

  it('passes a file the coverage run leaves out on purpose, and only that file', () => {
    expect(
      compare(
        report({ 'a.test.ts': [A], 'perf.test.ts': [B, C] }),
        report({ 'a.test.ts': [A] }),
        ['perf.test.ts'],
      ),
    ).toEqual({ files: 1, tests: 1, problems: [] });
  });

  it.each([
    [
      'a file the step ran and coverage did not',
      report({ 'a.test.ts': [A], 'b.test.ts': [B, C] }),
      report({ 'a.test.ts': [A] }),
      [
        'b.test.ts: 2 tests in the unit step, and the coverage run has no such file',
      ],
      [],
    ],
    [
      'a file coverage ran and the step did not',
      report({ 'a.test.ts': [A] }),
      report({ 'a.test.ts': [A], 'b.test.ts': [B] }),
      ['b.test.ts: 1 test under coverage, and the unit step has no such file'],
      [],
    ],
    [
      'a test the coverage run lost',
      report({ 'a.test.ts': [A, B] }),
      report({ 'a.test.ts': [A] }),
      [
        'a.test.ts: 2 tests in the unit step, 1 under coverage; only in the step: passed "reader > refuses a gap"',
      ],
      [],
    ],
    [
      'one copy of a twice-named test lost',
      report({ 'a.test.ts': [A, A] }),
      report({ 'a.test.ts': [A] }),
      [
        'a.test.ts: 2 tests in the unit step, 1 under coverage; only in the step: passed "reader > reads a file"',
      ],
      [],
    ],
    [
      'a test only the coverage run collected',
      report({ 'a.test.ts': [A] }),
      report({ 'a.test.ts': [A, B] }),
      [
        'a.test.ts: 1 test in the unit step, 2 under coverage; only under coverage: passed "reader > refuses a gap"',
      ],
      [],
    ],
    [
      'a test swapped for another, the count kept',
      report({ 'a.test.ts': [A, B] }),
      report({ 'a.test.ts': [A, C] }),
      [
        'a.test.ts: 2 tests in the unit step, 2 under coverage; only in the step: passed "reader > refuses a gap"; only under coverage: passed "writes"',
      ],
      [],
    ],
    [
      'a test that failed only under coverage',
      report({ 'a.test.ts': [A] }),
      report({ 'a.test.ts': [{ ...A, status: 'failed' }] }),
      [
        'a.test.ts: 1 test in the unit step, 1 under coverage; only in the step: passed "reader > reads a file"; only under coverage: failed "reader > reads a file"',
      ],
      [],
    ],
    [
      'a file that failed only under coverage',
      report({ 'a.test.ts': [A] }),
      report({ 'a.test.ts': [A] }, { 'a.test.ts': 'failed' }),
      ['a.test.ts: passed in the unit step, failed under coverage'],
      [],
    ],
    [
      'a left-out file the coverage run ran after all',
      report({ 'a.test.ts': [A], 'perf.test.ts': [B] }),
      report({ 'a.test.ts': [A], 'perf.test.ts': [B] }),
      ['perf.test.ts: left out of the coverage run, yet it ran there'],
      ['perf.test.ts'],
    ],
  ] as const)('refuses %s', (_label, step, coverage, problems, leftOut) => {
    expect(compare(step, coverage, leftOut).problems).toEqual(problems);
  });

  it('refuses a left-out file the step did not run, so the list cannot go stale', () => {
    const same = report({ 'a.test.ts': [A] });
    expect(compare(same, same, ['perf.test.ts']).problems).toEqual([
      'perf.test.ts: left out of the coverage run, but the unit step has no such file',
    ]);
  });

  it('names the first three tests each side lacks, then how many more', () => {
    const tests = (n: number, prefix: string): Test[] =>
      Array.from({ length: n }, (_, i) => ({
        titles: [`${prefix}${String(i)}`],
      }));
    expect(
      compare(
        report({ 'a.test.ts': tests(5, 's') }),
        report({ 'a.test.ts': tests(4, 'c') }),
      ).problems,
    ).toEqual([
      'a.test.ts: 5 tests in the unit step, 4 under coverage; only in the step: passed "s0", passed "s1", passed "s2" and 2 more; only under coverage: passed "c0", passed "c1", passed "c2" and 1 more',
    ]);
  });

  it('reports each unreadable side by its path, and compares nothing', () => {
    expect(compare(undefined, '{')).toEqual({
      files: 0,
      tests: 0,
      problems: ['s.json is missing', 'c.json is not JSON'],
    });
  });
});
