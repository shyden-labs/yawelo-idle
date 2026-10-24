import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { runOf } from './workflow-steps.ts';
import { COVERAGE_SUITES } from '../../scripts/coverage-config.ts';
import {
  coverageReport,
  stepReport,
  suiteStep,
  suitesFor,
} from '../../scripts/coverage-same-tests.ts';

/**
 * The coverage job (#728): every suite pull-request CI runs, under coverage,
 * in a job of its own on every pull request, with the report kept. Read as
 * parsed YAML, so a comment naming a command cannot stand in for a step. Its
 * one limit is held in suite-limits.test.ts.
 */
interface Step {
  id?: string;
  name?: string;
  run?: unknown;
  uses?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}

interface Job {
  needs?: unknown;
  if?: string;
  outputs?: Record<string, string>;
  env?: Record<string, string>;
  'runs-on'?: string;
  'timeout-minutes'?: unknown;
  container?: { image?: string; options?: string };
  steps?: Step[];
}

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
  jobs: Record<string, Job>;
};
const job = (): Job => ci.jobs['coverage'] ?? {};
const steps = (): Step[] => job().steps ?? [];
const at = (command: string): number[] =>
  steps().flatMap((s, i) => (runOf(s) === command ? [i] : []));

describe('the coverage job (#728)', () => {
  it('runs in the image and user the build-and-test job runs in', () => {
    const build = ci.jobs['build-and-test'];
    expect(job().container).toEqual(build?.container);
    expect(job()['runs-on']).toBe(build?.['runs-on']);
  });

  it('installs as build-and-test does, a warning failing it', () => {
    expect(at('scripts/fail-on-warnings.sh npm ci')).toHaveLength(1);
  });

  it('measures every suite once, after the install', () => {
    const [install] = at('scripts/fail-on-warnings.sh npm ci');
    const measure = at('npm run test:coverage');
    expect(measure).toHaveLength(1);
    expect(measure[0]).toBeGreaterThan(install ?? Infinity);
    // The upload reads this step's outcome by its id.
    expect(steps()[measure[0] ?? -1]?.id).toBe('measure');
  });

  it('keeps the report after a measure that ran, and fails when it is missing', () => {
    const [measure] = at('npm run test:coverage');
    const uploads = steps().flatMap((s, i) =>
      (s.uses ?? '').startsWith('actions/upload-artifact@') ? [i] : [],
    );
    expect(uploads).toHaveLength(1);
    const [upload] = uploads;
    expect(upload).toBeGreaterThan(measure ?? Infinity);
    const step = steps()[upload ?? -1];
    expect(step?.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
    expect(step?.if).toBe(
      "${{ !cancelled() && (steps.measure.outcome == 'success' || steps.measure.outcome == 'failure') }}",
    );
    expect(step?.with).toEqual({
      name: 'coverage',
      path: 'coverage/',
      'if-no-files-found': 'error',
    });
  });
});

/** The suites under coverage, written out: a test checks it against the module. */
const SUITES = [
  'unit',
  'guards',
  'integration',
  'properties',
  'pacing',
] as const;
const DOCS_ONLY_SKIP = "${{ steps.classify.outputs.scope != 'docs-only' }}";

/**
 * The jobs this section reads, typed as present: a job or a step list
 * missing from ci.yml throws in the test that reads it, so no fallback
 * stands in for one (a fallback is a branch no test takes).
 */
interface ReadJob {
  needs?: unknown;
  if?: string;
  outputs?: Record<string, string>;
  'runs-on'?: string;
  container?: { image?: string; options?: string };
  steps: Step[];
}
const jobs = (
  parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
    jobs: Record<'build-and-test' | 'coverage-same-tests', ReadJob>;
  }
).jobs;
const build = (): Step[] => jobs['build-and-test'].steps;
const buildAt = (command: string): number[] =>
  build().flatMap((s, i) => (runOf(s) === command ? [i] : []));
const running = (command: string): Step[] =>
  build().filter((s) => runOf(s) === command);
const same = (): ReadJob => jobs['coverage-same-tests'];
const isAction = (action: string) => (s: Step) =>
  String(s.uses).startsWith(`actions/${action}@`);
const usesAt = (action: string): number[] =>
  same().steps.flatMap((s, i) => (isAction(action)(s) ? [i] : []));
const COMPARE = 'node scripts/coverage-same-tests.ts "$SCOPE"';

describe('each suite step writes its test report (#762 AC3)', () => {
  it('names every suite under coverage', () => {
    expect(COVERAGE_SUITES.map(({ name }) => name)).toEqual([...SUITES]);
  });

  it.each(SUITES)('the %s step runs once, writing its report', (suite) => {
    expect(buildAt(suiteStep(suite))).toHaveLength(1);
  });

  it.each(SUITES)(
    'the %s step runs on a docs-only change exactly when its report is compared then',
    (suite) => {
      const compared = suitesFor('docs-only')?.includes(suite);
      expect(running(suiteStep(suite)).map((s) => s.if)).toEqual([
        compared ? undefined : DOCS_ONLY_SKIP,
      ]);
    },
  );

  it('tells the comparison which suites ran, from the classify step', () => {
    expect(jobs['build-and-test'].outputs).toEqual({
      scope: '${{ steps.classify.outputs.scope }}',
    });
    expect(build().filter((s) => s.id === 'classify')).toHaveLength(1);
  });

  it('uploads the reports once, after every suite step, when the unit step ran', () => {
    const isUpload = (s: Step): boolean =>
      isAction('upload-artifact')(s) && s.with?.['name'] === 'test-reports';
    const last = Math.max(
      ...SUITES.flatMap((suite) => buildAt(suiteStep(suite))),
    );
    expect(build().findIndex(isUpload)).toBeGreaterThan(last);
    expect(running(suiteStep('unit')).map((s) => s.id)).toEqual(['unit']);
    expect(
      build()
        .filter(isUpload)
        .map((s) => ({ if: s.if, with: s.with })),
    ).toEqual([
      {
        if: "${{ !cancelled() && (steps.unit.outcome == 'success' || steps.unit.outcome == 'failure') }}",
        with: {
          name: 'test-reports',
          path: 'test-reports/',
          'if-no-files-found': 'error',
        },
      },
    ]);
  });

  it.each(SUITES)(
    "the %s reports land under the two uploads' paths",
    (suite) => {
      expect(stepReport(suite)).toBe(`test-reports/${suite}.json`);
      expect(coverageReport(suite)).toBe(`coverage/tests/${suite}.json`);
    },
  );
});

describe('the coverage-same-tests job (#762 AC3)', () => {
  it('waits for both jobs and runs after either fails, unless the run is cancelled', () => {
    expect(same().needs).toEqual(['build-and-test', 'coverage']);
    expect(same().if).toBe('${{ !cancelled() }}');
  });

  it('runs in the image, user and runner both reports were written in', () => {
    expect(same().container).toEqual(jobs['build-and-test'].container);
    expect(same()['runs-on']).toBe(jobs['build-and-test']['runs-on']);
  });

  it('installs as build-and-test does, a warning failing it', () => {
    expect(
      same().steps.filter(
        (s) => runOf(s) === 'scripts/fail-on-warnings.sh npm ci',
      ),
    ).toHaveLength(1);
  });

  it.each([
    ['test-reports', 'test-reports'],
    ['coverage', 'coverage'],
  ])('downloads the %s artifact into %s', (name, path) => {
    expect(
      same()
        .steps.filter(
          (s) => isAction('download-artifact')(s) && s.with?.['name'] === name,
        )
        .map((s) => s.with),
    ).toEqual([{ name, path }]);
  });

  it('compares the reports for the scope build-and-test ran, after both downloads', () => {
    expect(usesAt('download-artifact')).toHaveLength(2);
    expect(same().steps.findIndex((s) => runOf(s) === COMPARE)).toBeGreaterThan(
      Math.max(...usesAt('download-artifact')),
    );
    expect(
      same()
        .steps.filter((s) => runOf(s) === COMPARE)
        .map((s) => s.env),
    ).toEqual([{ SCOPE: '${{ needs.build-and-test.outputs.scope }}' }]);
  });
});
