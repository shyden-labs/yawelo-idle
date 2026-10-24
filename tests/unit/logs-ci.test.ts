import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import logs from '../../vitest.logs.config.ts';
import { runOf } from './workflow-steps.ts';

/**
 * The logs suite stays wired (#84, spec §5.12). Shyden, 2026-10-16:
 * "separate test suite for logging and auditing. run in ci as a
 * pre-requisite to a release", and "for now, you can create the workflow
 * that the release pipeline will call later". So its workflow is started by
 * hand on the release ref or called by the release pipeline (#252), and no
 * pull request runs it. Its time limit is held in suite-limits.test.ts. The
 * workflows are read as parsed YAML, so a comment naming a command cannot
 * stand in for a step.
 */

interface Step {
  name?: string;
  // YAML may type it otherwise: read it through runOf.
  run?: unknown;
  uses?: string;
}
interface Workflow {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, { steps?: Step[] }>;
}

const workflow = (file: string): Workflow =>
  parse(readFileSync(`.github/workflows/${file}`, 'utf8')) as Workflow;
const stepsOf = (w: Workflow): Step[] =>
  Object.values(w.jobs).flatMap((j) => j.steps ?? []);

describe('the logs workflow (spec §5.12)', () => {
  it('starts only by hand or from the release pipeline, never on a pull request or a push', () => {
    expect(Object.keys(workflow('logs.yml').on)).toEqual([
      'workflow_dispatch',
      'workflow_call',
    ]);
  });

  it('reads the repository and nothing more', () => {
    expect(workflow('logs.yml').permissions).toEqual({ contents: 'read' });
  });

  it('installs as CI does, a warning failing it, then runs the logs suite once', () => {
    const steps = stepsOf(workflow('logs.yml'));
    const install = steps.findIndex(
      (s) => runOf(s) === 'scripts/fail-on-warnings.sh npm ci',
    );
    const suite = steps.flatMap((s, i) =>
      runOf(s) === 'npm run test:logs' ? [i] : [],
    );
    expect(install, 'install step').toBeGreaterThan(-1);
    expect(suite, 'test:logs step').toHaveLength(1);
    expect(suite[0]).toBeGreaterThan(install);
    expect(steps[suite[0] ?? -1]?.name).toBe(
      'Logs (the event log’s checks, before a release)',
    );
  });

  it('pins the same actions at the same SHAs as ci.yml', () => {
    const uses = (file: string): string[] =>
      stepsOf(workflow(file)).flatMap((s) => (s.uses ? [s.uses] : []));
    const logsUses = uses('logs.yml');
    expect(logsUses).toHaveLength(2);
    expect(uses('ci.yml')).toEqual(expect.arrayContaining(logsUses));
  });
});

// That no pull request runs the logs suite is suite-limits.test.ts's exact
// list of every suite step across ci.yml, deploy-dev.yml and logs.yml: a
// test:logs step anywhere but logs.yml makes that list unequal.

describe('the logs suite’s config', () => {
  it('is what npm run test:logs runs: each package’s logs folder and nothing else', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:logs']).toBe(
      'vitest run -c vitest.logs.config.ts',
    );
    expect(logs.test?.include).toEqual(['packages/*/logs/**/*.test.ts']);
  });

  it('seeds every file from the one seeding home, as the properties suite does (#84)', () => {
    expect(logs.test?.setupFiles).toEqual(['tests/properties-setup.ts']);
  });
});
