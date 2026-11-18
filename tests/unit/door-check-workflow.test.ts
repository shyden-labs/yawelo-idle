import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * The door check's workflow (#784 AC6). Its token reads PROD's zone, so it
 * lives in its own environment, `door-cron`, which admits main alone, and the
 * job runs only from main (global rule: an unattended job's production
 * credential, dispatched with --ref main). The daily dispatch from develop is
 * added with the 2026-11-15 go-live, when the doors exist to be read.
 */

interface Step {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}
interface Workflow {
  on: Record<string, { inputs?: Record<string, unknown> } | null>;
  permissions: Record<string, string>;
  jobs: Record<
    string,
    { if?: string; environment?: string | { name?: string }; steps?: Step[] }
  >;
}

const workflow = parse(
  readFileSync(
    new URL('../../.github/workflows/door-check.yml', import.meta.url),
    'utf8',
  ),
) as Workflow;
const check = workflow.jobs['check'];
const run = check?.steps?.find(
  (each) => each.name === "Read each door's last day and report a failing one",
);

describe('door-check.yml', () => {
  it('runs only by hand, with a planted failing door for the proof', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(Object.keys(workflow.on['workflow_dispatch']?.inputs ?? {})).toEqual(
      ['plant_failing_door'],
    );
  });

  it('may read the code and write issues, and nothing else', () => {
    expect(workflow.permissions).toEqual({
      contents: 'read',
      issues: 'write',
    });
  });

  it('runs only from main, in the door-cron environment', () => {
    expect(check?.if).toBe("github.ref == 'refs/heads/main'");
    expect(check?.environment).toBe('door-cron');
  });

  it("gives the check the analytics token, the run's own GitHub token and the plant", () => {
    expect(run?.env).toEqual({
      CLOUDFLARE_API_TOKEN: '${{ secrets.DOOR_ANALYTICS_TOKEN }}',
      GH_TOKEN: '${{ github.token }}',
      GITHUB_REPOSITORY: '${{ github.repository }}',
      PLANT_FAILING_DOOR: '${{ inputs.plant_failing_door }}',
    });
    expect(run?.run).toBe('node scripts/door-check.ts');
  });
});
