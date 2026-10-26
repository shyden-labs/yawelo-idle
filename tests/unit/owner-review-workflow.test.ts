import { describe, expect, it } from 'vitest';
import {
  onlyJob,
  stepNamed,
  workflow as readWorkflow,
  type Workflow,
  type WorkflowJob,
  type WorkflowStep,
} from './workflow-file.ts';
import { runOf } from './workflow-steps.ts';

/**
 * The daily owner-review check's workflow (#687 AC5): once a day, on
 * develop, in the `dev` environment that holds the read-only roadmap App's
 * key (Shyden, 2026-10-20: "Widen the roadmap key", asked twice), under a
 * limit. The App reads branch protection; the run's own token writes the
 * issue, so the key stays read-only.
 */

const FILE = 'owner-review.yml';
const ID = 'owner-review';
const CHECK = 'Develop still asks Shyden to review the twin list';
const MINT = 'Mint the settings token (read-only roadmap App)';

const workflow = (): Workflow => readWorkflow(FILE);
const job = (): WorkflowJob => onlyJob(FILE, ID);
const step = (name: string): WorkflowStep => stepNamed(FILE, ID, name);

describe('owner-review.yml (#687)', () => {
  it('runs once a day, and by hand', () => {
    expect(workflow().on).toEqual({
      schedule: [{ cron: '17 2 * * *' }],
      workflow_dispatch: null,
    });
  });

  it('reads the repository and writes only issues', () => {
    expect(workflow().permissions).toEqual({
      contents: 'read',
      issues: 'write',
    });
  });

  it('is one job, in the dev environment, on the runner, under a limit', () => {
    const j = job();
    expect([
      Object.keys(workflow().jobs ?? {}),
      j.environment,
      j['runs-on'],
      j.container,
      j['timeout-minutes'],
    ]).toEqual([[ID], 'dev', 'ubuntu-24.04', undefined, 5]);
  });

  it('runs its steps in order: checkout, node, mint, the check', () => {
    expect(
      (job().steps ?? []).map((s) => s.name ?? s.uses?.split('@')[0]),
    ).toEqual(['actions/checkout', 'actions/setup-node', MINT, CHECK]);
  });

  it('mints a token for this repository alone, reading its settings and nothing else', () => {
    const s = step(MINT);
    expect([s.if, s.id, s.uses]).toEqual([
      undefined,
      'admin-token',
      'actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1',
    ]);
    expect(s.with).toEqual({
      'client-id': 'Iv23liVLjRN8twjcTmN0',
      'private-key': '${{ secrets.ROADMAP_APP_KEY }}',
      owner: 'shyden-labs',
      repositories: 'yawelo-idle',
      'permission-administration': 'read',
    });
  });

  it('runs the check even after a failed mint, so a missing token is reported in the issue', () => {
    const s = step(CHECK);
    expect([s.if, runOf(s)]).toEqual([
      '${{ !cancelled() }}',
      'node scripts/owner-review.ts "$GITHUB_REPOSITORY"',
    ]);
    expect(s.env).toEqual({
      ADMIN_TOKEN: '${{ steps.admin-token.outputs.token }}',
      GH_TOKEN: '${{ github.token }}',
    });
  });

  it('checks out without leaving the token in the git config', () => {
    const checkout = (job().steps ?? []).find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with).toEqual({ 'persist-credentials': false });
  });
});
