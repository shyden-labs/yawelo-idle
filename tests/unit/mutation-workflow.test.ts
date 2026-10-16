import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { runOf } from './workflow-steps';

/**
 * The core mutation run's workflow (#36 AC2, AC4, AC5): every pull request
 * runs it in a job of its own, which branch protection requires by its name.
 * scripts/ci-scope.ts judges whether the change touches anything the run
 * reads; when it says `skip`, every later step skips and the job passes, so
 * the check still reports. Any other output, or none, runs Stryker. The HTML
 * report is uploaded after a run that passed or failed.
 */

const FILE = '.github/workflows/mutation.yml';

interface Step {
  readonly name?: string;
  readonly id?: string;
  readonly if?: string;
  readonly uses?: string;
  readonly run?: unknown;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly with?: Readonly<Record<string, unknown>>;
  readonly 'timeout-minutes'?: number;
}

interface Job {
  readonly 'runs-on'?: string;
  readonly 'timeout-minutes'?: number;
  readonly environment?: unknown;
  readonly container?: unknown;
  readonly steps?: readonly Step[];
}

interface Workflow {
  readonly name?: string;
  readonly on?: unknown;
  readonly permissions?: unknown;
  readonly jobs?: Readonly<Record<string, Job>>;
}

const workflow = (): Workflow => parse(readFileSync(FILE, 'utf8')) as Workflow;

/** The workflow's one job, refusing any other shape. */
function job(): Job {
  const jobs = workflow().jobs ?? {};
  if (Object.keys(jobs).join() !== 'mutation')
    throw new Error(`${FILE} holds jobs ${Object.keys(jobs).join(', ')}`);
  return jobs['mutation'] as Job;
}

/** The step called `name`, refusing a missing or doubled one. */
function step(name: string): Step {
  const found = (job().steps ?? []).filter((s) => s.name === name);
  if (found.length !== 1)
    throw new Error(
      `${FILE} holds ${String(found.length)} steps named "${name}"`,
    );
  return found[0] as Step;
}

const UNLESS_SKIPPED = "${{ steps.classify.outputs.mutation != 'skip' }}";
const STRYKER = 'Mutation testing (Stryker, a score under 90 fails it)';
const SURVIVORS =
  'No undetected mutant but the listed equivalents (the score may not drop)';
const AFTER_STRYKER =
  "${{ !cancelled() && steps.classify.outputs.mutation != 'skip' && (steps.mutation.outcome == 'success' || steps.mutation.outcome == 'failure') }}";

describe('mutation.yml (#36)', () => {
  it('runs on every pull request, so its required check always reports (AC2, AC4)', () => {
    expect([workflow().name, workflow().on]).toEqual([
      'mutation',
      { pull_request: null },
    ]);
  });

  it('reads the repository and writes nothing', () => {
    expect(workflow().permissions).toEqual({ contents: 'read' });
  });

  it('is one job, mutation, the context branch protection requires (AC4)', () => {
    expect(Object.keys(workflow().jobs ?? {})).toEqual(['mutation']);
  });

  it('runs on the runner, under the 30-minute job cap (#44), in no environment', () => {
    const j = job();
    expect([
      j['runs-on'],
      j['timeout-minutes'],
      j.container,
      j.environment,
    ]).toEqual(['ubuntu-24.04', 30, undefined, undefined]);
  });

  it('runs its steps in order: checkout, node, classify, install, Stryker, survivors, upload', () => {
    expect(
      (job().steps ?? []).map((s) => s.name ?? s.uses?.split('@')[0]),
    ).toEqual([
      'actions/checkout',
      'actions/setup-node',
      'Classify the change (#360, #36)',
      'Install (a warning fails it)',
      STRYKER,
      SURVIVORS,
      'Upload the mutation report',
    ]);
  });

  it('checks out the merge commit and its parent, without leaving the token in the git config', () => {
    const checkout = (job().steps ?? []).find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with).toEqual({
      'fetch-depth': 2,
      'persist-credentials': false,
    });
  });

  it('sets up the Node in .nvmrc, with npm’s cache', () => {
    const node = (job().steps ?? []).find((s) =>
      s.uses?.startsWith('actions/setup-node@'),
    );
    expect(node?.with).toEqual({
      'node-version-file': '.nvmrc',
      cache: 'npm',
    });
  });

  it('classifies the change with the event’s name, before any install', () => {
    const s = step('Classify the change (#360, #36)');
    expect([s.id, s.if, runOf(s)]).toEqual([
      'classify',
      undefined,
      'node scripts/ci-scope.ts',
    ]);
    expect(s.env).toEqual({ EVENT: '${{ github.event_name }}' });
  });

  it('installs unless the classifier said skip, failing on a warning', () => {
    const s = step('Install (a warning fails it)');
    expect([s.if, runOf(s)]).toEqual([
      UNLESS_SKIPPED,
      'scripts/fail-on-warnings.sh npm ci',
    ]);
  });

  it('runs Stryker unless the classifier said skip, failing on a warning, under its one limit', () => {
    const s = step(STRYKER);
    expect([s.id, s.if, runOf(s), s['timeout-minutes']]).toEqual([
      'mutation',
      UNLESS_SKIPPED,
      'scripts/fail-on-warnings.sh npm run test:mutation',
      25,
    ]);
  });

  it('checks the undetected mutants against the list after a Stryker run that passed or failed (Shyden, 2026-10-16)', () => {
    const s = step(SURVIVORS);
    expect([s.if, runOf(s)]).toEqual([
      AFTER_STRYKER,
      'node scripts/mutation-survivors.ts',
    ]);
  });

  it('uploads the HTML report after a Stryker run that passed or failed, and fails when there is none (AC5)', () => {
    const s = step('Upload the mutation report');
    expect(s.if).toBe(AFTER_STRYKER);
    expect(s.uses?.split('@')[0]).toBe('actions/upload-artifact');
    expect(s.with).toEqual({
      name: 'mutation-report',
      path: 'reports/mutation/',
      'if-no-files-found': 'error',
    });
  });
});
