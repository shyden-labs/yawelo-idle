import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_TIMEOUT_MINUTES, scanTimeouts } from './workflow-timeouts';

/**
 * Every job stops within minutes when a step hangs (#44). GitHub's default is
 * 360 minutes, and on 2026-10-01 a starved `apt-get` held a run for 35. The
 * fixtures pin the scanner's behaviour on each shape a job can take; the last
 * block runs it over this repo's real workflows.
 */

const workflow = (jobs: string) => `name: x\non:\n  push:\njobs:\n${jobs}`;

const job = (id: string, extra = '') =>
  `  ${id}:\n    runs-on: ubuntu-latest\n${extra}    steps:\n      - run: npm test\n`;

const problems = (source: string) =>
  scanTimeouts('w.yml', source).findings.map((f) => `${f.where}: ${f.problem}`);

describe('scanTimeouts', () => {
  it('accepts a job with a timeout inside the bound', () => {
    const scan = scanTimeouts(
      'w.yml',
      workflow(job('build', '    timeout-minutes: 15\n')),
    );
    expect(scan.checked).toBe(1);
    expect(scan.findings).toEqual([]);
  });

  it(`accepts the bound itself, ${String(MAX_TIMEOUT_MINUTES)} minutes`, () => {
    expect(
      problems(
        workflow(
          job('build', `    timeout-minutes: ${String(MAX_TIMEOUT_MINUTES)}\n`),
        ),
      ),
    ).toEqual([]);
  });

  it('pins the bound at 30 minutes', () => {
    expect(MAX_TIMEOUT_MINUTES).toBe(30);
  });

  it('flags a job with no timeout, which GitHub runs for 360 minutes', () => {
    expect(problems(workflow(job('build')))).toEqual([
      'w.yml: jobs.build: no timeout-minutes, so a hung step runs for 360 minutes',
    ]);
  });

  it('is not satisfied by a comment naming timeout-minutes', () => {
    expect(
      problems(workflow(job('build', '    # timeout-minutes: 15\n'))),
    ).toEqual([
      'w.yml: jobs.build: no timeout-minutes, so a hung step runs for 360 minutes',
    ]);
  });

  it.each([
    ['above the bound', '31', 'timeout-minutes 31 is above 30'],
    ['zero', '0', 'timeout-minutes 0 is not a whole number from 1 to 30'],
    [
      'a fraction',
      '2.5',
      'timeout-minutes 2.5 is not a whole number from 1 to 30',
    ],
    [
      'an expression, which nothing can check',
      "'${{ inputs.minutes }}'",
      'timeout-minutes "${{ inputs.minutes }}" is not a whole number from 1 to 30',
    ],
  ])('flags a timeout that is %s', (_label, value, problem) => {
    expect(
      problems(workflow(job('build', `    timeout-minutes: ${value}\n`))),
    ).toEqual([`w.yml: jobs.build: ${problem}`]);
  });

  it('flags a step timeout above its job’s, which could never fire', () => {
    const source = workflow(
      '  build:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    steps:\n      - name: Slow\n        run: x\n        timeout-minutes: 12\n',
    );
    expect(problems(source)).toEqual([
      'w.yml: jobs.build: step "Slow" has timeout-minutes 12, above its job’s 10',
    ]);
  });

  it('accepts a call to a local reusable workflow, whose own jobs carry the timeouts', () => {
    const scan = scanTimeouts(
      'w.yml',
      workflow('  test:\n    uses: ./.github/workflows/ci.yml\n'),
    );
    expect(scan.calls).toEqual(['./.github/workflows/ci.yml']);
    expect(scan.findings).toEqual([]);
  });

  it('flags a call to a remote reusable workflow, whose timeouts this repo cannot see', () => {
    expect(
      problems(
        workflow('  test:\n    uses: org/repo/.github/workflows/t.yml@abc\n'),
      ),
    ).toEqual([
      'w.yml: jobs.test: calls org/repo/.github/workflows/t.yml@abc, whose jobs this repo cannot check for timeouts',
    ]);
  });
});

describe('this repo’s workflows stop every job within minutes', () => {
  // Read inside each test, not in the describe body: a throw at collection
  // time fails the file as "no tests" instead of naming the broken assertion.
  const dir = '.github/workflows';
  const files = () => readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  const scanAll = () =>
    files().map((file) => ({
      file,
      scan: scanTimeouts(file, readFileSync(join(dir, file), 'utf8')),
    }));

  it('checks every job it finds (liveness)', () => {
    const scans = scanAll();
    // Measured 2 workflows at b2a6f3f (#82). Lower it only in the commit that removes one.
    expect(scans.length, 'positive control: workflows found').toBeGreaterThan(
      1,
    );
    // Measured 4 at b2a6f3f (#82): 3 jobs judged and 1 reusable-workflow call.
    expect(
      scans.reduce((n, { scan }) => n + scan.checked + scan.calls.length, 0),
      'jobs judged, counted as jobs, not files',
    ).toBeGreaterThan(3);
    expect(
      scans.filter(({ scan }) => scan.checked + scan.calls.length === 0),
      'every workflow has a job the scan looked at',
    ).toEqual([]);
  });

  it('every reusable-workflow call names a workflow that is scanned here', () => {
    const scanned = files().map((f) => `./${dir}/${f}`);
    const calls = scanAll().flatMap(({ scan }) => scan.calls);
    expect(calls.filter((call) => !scanned.includes(call))).toEqual([]);
  });

  it('every job has a timeout of at most 30 minutes', () => {
    expect(scanAll().flatMap(({ scan }) => scan.findings)).toEqual([]);
  });
});
