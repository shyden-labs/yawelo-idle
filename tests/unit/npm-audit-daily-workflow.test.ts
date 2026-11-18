import { describe, expect, it } from 'vitest';
import { onlyJob, workflow } from './workflow-file';

/**
 * The daily audit of develop (#720 AC3), pinned as parsed YAML. Its logic is
 * tested in npm-audit-daily.test.ts. A dispatch may plant a real vulnerable
 * package in the run's own lockfile: the planted failure that proves an
 * issue opens on GitHub itself.
 */

const FILE = 'npm-audit-daily.yml';

describe('the daily audit of develop (#720 AC3)', () => {
  it('runs daily and on a dispatch that may plant a package', () => {
    expect(workflow(FILE).on).toEqual({
      schedule: [{ cron: '41 1 * * *' }],
      workflow_dispatch: {
        inputs: {
          plant_package: {
            description:
              'Planted failure (#720 AC3): add this package@version to the lockfile before the audit',
            required: false,
            default: '',
          },
        },
      },
    });
  });

  it('runs only on develop', () => {
    expect(onlyJob(FILE, 'audit').if).toBe(
      "github.ref == 'refs/heads/develop'",
    );
  });

  it('may write issues, nothing more', () => {
    expect(workflow(FILE).permissions).toEqual({
      contents: 'read',
      issues: 'write',
    });
  });

  it('plants only when asked, without running install scripts', () => {
    const plant = onlyJob(FILE, 'audit').steps?.at(-2);
    expect(plant?.if).toBe("inputs.plant_package != ''");
    expect(plant?.env).toEqual({ PLANT: '${{ inputs.plant_package }}' });
    expect(plant?.run).toBe(
      'npm install --package-lock-only --ignore-scripts -- "$PLANT"',
    );
  });

  it('runs the tested script with the run’s own token', () => {
    const last = onlyJob(FILE, 'audit').steps?.at(-1);
    expect(last?.run).toBe('node scripts/npm-audit.ts --daily');
    expect(last?.env).toEqual({
      GH_TOKEN: '${{ github.token }}',
      GITHUB_REPOSITORY: '${{ github.repository }}',
    });
  });
});
