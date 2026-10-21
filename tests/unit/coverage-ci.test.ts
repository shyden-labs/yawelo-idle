import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { runOf } from './workflow-steps';

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
}

interface Job {
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

/**
 * The check (#728): a documents-only pull request proves nothing measured
 * changed (ruling, "Prove nothing changed"); any other measures and is
 * checked against the record and against the record at the merge base.
 */
describe('the coverage job judges every pull request (#728)', () => {
  const named = (name: string): Step | undefined =>
    steps().find((s) => s.name === name);

  it('checks out the whole history, so the merge base with develop is there', () => {
    const checkoutIn = (job: Job | undefined) =>
      (job?.steps ?? []).find((s) =>
        (s.uses ?? '').startsWith('actions/checkout@'),
      )?.with;
    // Beside build-and-test's, which needs only the commit and its parent.
    expect([
      checkoutIn(ci.jobs['build-and-test']),
      checkoutIn(ci.jobs['coverage']),
    ]).toEqual([{ 'fetch-depth': 2 }, { 'fetch-depth': 0 }]);
  });

  it('classifies the change as build-and-test does, before the install', () => {
    const classify = named('Classify the change as docs-only or full (#360)');
    expect([classify?.id, runOf(classify ?? {})]).toEqual([
      'classify',
      'node scripts/ci-scope.ts',
    ]);
  });

  it('measures and checks anything but a documents-only change', () => {
    const full = "${{ steps.classify.outputs.scope != 'docs-only' }}";
    const check = named('Check the record and the ratchet');
    expect([
      steps()[at('npm run test:coverage')[0] ?? -1]?.if,
      check?.if,
      runOf(check ?? {}),
    ]).toEqual([full, full, 'node scripts/coverage.ts check']);
  });

  it('proves a documents-only change measures nothing, and only then', () => {
    const proof = named('Prove a documents-only change measures nothing');
    expect([proof?.if, runOf(proof ?? {})]).toEqual([
      "${{ steps.classify.outputs.scope == 'docs-only' }}",
      'node scripts/coverage.ts docs-only',
    ]);
  });
});
