import { describe, expect, it } from 'vitest';
import {
  onlyJob,
  stepNamed,
  workflow as readWorkflow,
  type Workflow,
  type WorkflowJob,
  type WorkflowStep,
} from './workflow-file';
import { runOf } from './workflow-steps';

/**
 * The schedule watch's workflow (#710 AC3): a missed day of a scheduled
 * workflow is noticed by something that does not hang on that schedule.
 * Every push to develop runs it, which needs no schedule at all, and so
 * does its own daily slot twelve and a half hours from owner-review's. It
 * reads GitHub's own record with the run's token, so it holds no stored
 * key and names no environment.
 */

const FILE = 'schedule-watch.yml';
const ID = 'schedule-watch';
const CHECK = 'Every scheduled workflow ran on time and passed';

const workflow = (): Workflow => readWorkflow(FILE);
const job = (): WorkflowJob => onlyJob(FILE, ID);
const step = (name: string): WorkflowStep => stepNamed(FILE, ID, name);

describe('schedule-watch.yml (#710)', () => {
  it('runs on every push to develop, once a day, and by hand', () => {
    expect(workflow().on).toEqual({
      push: { branches: ['develop'] },
      schedule: [{ cron: '47 14 * * *' }],
      workflow_dispatch: null,
    });
  });

  it('reads the repository and its runs, and writes only issues', () => {
    expect(workflow().permissions).toEqual({
      actions: 'read',
      contents: 'read',
      issues: 'write',
    });
  });

  it('queues its runs, so two pushes never open two issues for one outage', () => {
    expect(workflow().concurrency).toEqual({
      group: 'schedule-watch',
      'cancel-in-progress': false,
    });
  });

  it('is one job, with no environment, on the runner, under a limit', () => {
    const j = job();
    expect([
      Object.keys(workflow().jobs ?? {}),
      j.environment,
      j['runs-on'],
      j.container,
      j['timeout-minutes'],
    ]).toEqual([[ID], undefined, 'ubuntu-24.04', undefined, 5]);
  });

  it('runs its steps in order: checkout, node, the check', () => {
    expect(
      (job().steps ?? []).map((s) => s.name ?? s.uses?.split('@')[0]),
    ).toEqual(['actions/checkout', 'actions/setup-node', CHECK]);
  });

  it('runs the check with the run token alone', () => {
    const s = step(CHECK);
    expect([s.if, runOf(s), s.env]).toEqual([
      undefined,
      'node scripts/schedule-watch.ts "$GITHUB_REPOSITORY"',
      { GH_TOKEN: '${{ github.token }}' },
    ]);
  });

  it('checks out without leaving the token in the git config', () => {
    const checkout = (job().steps ?? []).find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with).toEqual({ 'persist-credentials': false });
  });
});
