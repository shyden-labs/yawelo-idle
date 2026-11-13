import { describe, expect, it } from 'vitest';
import { onlyJob, workflow } from './workflow-file';

/**
 * The daily dev-behind-develop check and deploy-dev's dispatch (#497 AC1,
 * AC3, AC4), pinned as parsed YAML. The check's logic is tested in
 * dev-behind-develop.test.ts.
 */

const FILE = 'dev-behind-develop.yml';
const DEVELOP_ONLY = "github.ref == 'refs/heads/develop'";

describe('deploy-dev can be dispatched on develop alone (#497 AC3)', () => {
  it('runs on a push to develop and on a dispatch', () => {
    expect(workflow('deploy-dev.yml').on).toEqual({
      push: { branches: ['develop'] },
      workflow_dispatch: null,
    });
  });

  // A push deploys develop alone (above); a run started by hand deploys the
  // branch it is started on, since anything can deploy to dev (#961).
  it('runs its first job on whichever branch it is started on (#961)', () => {
    expect(workflow('deploy-dev.yml').jobs?.['test']?.if).toBeUndefined();
  });
});

describe('the daily dev-behind-develop check (#497 AC1, AC4)', () => {
  it('runs daily and on a dispatch that may stand in the served commit', () => {
    expect(workflow(FILE).on).toEqual({
      schedule: [{ cron: '17 1 * * *' }],
      workflow_dispatch: {
        inputs: {
          stand_in_served: {
            description:
              'Planted failure (#497 AC2): report this commit as the one dev serves',
            required: false,
            default: '',
          },
        },
      },
    });
  });

  it('runs only on develop', () => {
    expect(onlyJob(FILE, 'check').if).toBe(DEVELOP_ONLY);
  });

  // /health needs no password, so the check holds no stored secret and
  // names no environment: AC4's environment is needed only for a credential.
  it('names no environment and reads only the run’s own token', () => {
    const job = onlyJob(FILE, 'check');
    expect(job.environment).toBeUndefined();
    expect(job.steps?.at(-1)?.env).toEqual({
      DEV_SYNC_URL: 'https://dev-api.yawelo-idle.shyden.co.uk',
      GITHUB_TOKEN: '${{ github.token }}',
      STAND_IN_SERVED: '${{ inputs.stand_in_served }}',
    });
  });

  it('may read runs and write issues, nothing more', () => {
    expect(workflow(FILE).permissions).toEqual({
      actions: 'read',
      contents: 'read',
      issues: 'write',
    });
  });

  it('runs the tested script', () => {
    expect(onlyJob(FILE, 'check').steps?.at(-1)?.run).toBe(
      'node scripts/dev-behind-develop.ts',
    );
  });
});
