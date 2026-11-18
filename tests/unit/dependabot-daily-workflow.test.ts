import { describe, expect, it } from 'vitest';
import { onlyJob, workflow } from './workflow-file';

/**
 * The daily Dependabot check (#458 AC4), pinned as parsed YAML. Its logic is
 * tested in dependabot-check.test.ts. A dispatch may plant a failed run: the
 * planted failure that proves an issue opens on GitHub itself (AC3).
 */

const FILE = 'dependabot-daily.yml';

describe('the daily Dependabot check (#458)', () => {
  it('runs daily and on a dispatch that may plant a failed run', () => {
    expect(workflow(FILE).on).toEqual({
      schedule: [{ cron: '53 1 * * *' }],
      workflow_dispatch: {
        inputs: {
          plant_failure: {
            description:
              'Planted failure (#458 AC3): add a failed run of the first ecosystem before judging',
            required: false,
            default: '',
          },
        },
      },
    });
  });

  it('runs only on develop, within five minutes', () => {
    const job = onlyJob(FILE, 'check');
    expect(job.if).toBe("github.ref == 'refs/heads/develop'");
    expect(job['timeout-minutes']).toBe(5);
  });

  it('may read runs and write issues, nothing more', () => {
    expect(workflow(FILE).permissions).toEqual({
      actions: 'read',
      contents: 'read',
      issues: 'write',
    });
  });

  it('installs without running any install script', () => {
    const runs = (onlyJob(FILE, 'check').steps ?? []).map((step) => step.run);
    expect(runs).toContain('npm ci --ignore-scripts');
    expect(runs).not.toContain('npm ci');
  });

  it('never carries on after an error', () => {
    const job = onlyJob(FILE, 'check');
    expect(job['continue-on-error']).toBeUndefined();
    for (const step of job.steps ?? [])
      expect(step['continue-on-error']).toBeUndefined();
  });

  it('runs the tested script with the run’s own token and the plant', () => {
    const last = onlyJob(FILE, 'check').steps?.at(-1);
    expect(last?.run).toBe('node scripts/dependabot-check.ts');
    expect(last?.env).toEqual({
      GH_TOKEN: '${{ github.token }}',
      GITHUB_REPOSITORY: '${{ github.repository }}',
      PLANT_FAILURE: '${{ inputs.plant_failure }}',
    });
  });
});
