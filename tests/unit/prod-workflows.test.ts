import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * The production release and rollback workflows (#621 AC4, AC6, AC7), read
 * as parsed YAML so no comment counts. Every secret living in an environment
 * is workflow-secrets.test.ts's; SHA pins are supply-chain's; job timeouts
 * are workflow-timeouts'. These pin what is particular to production.
 */
const WORKFLOWS = new URL('../../.github/workflows/', import.meta.url).pathname;

interface Step {
  name?: string;
  run?: string;
  'working-directory'?: string;
  env?: Record<string, string>;
}
interface Job {
  needs?: string | string[];
  if?: string;
  uses?: string;
  environment?: { name?: string } | string;
  steps?: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<string, Job>;
}

const workflow = (file: string): Workflow =>
  parse(readFileSync(join(WORKFLOWS, file), 'utf8')) as Workflow;

function job(file: string, name: string): Job {
  const found = workflow(file).jobs[name];
  if (found === undefined) throw new Error(`${file}: no ${name} job`);
  return found;
}

function step(file: string, jobName: string, name: string): Step {
  const found = job(file, jobName).steps?.find((each) => each.name === name);
  if (found === undefined)
    throw new Error(`${file} ${jobName}: no step "${name}"`);
  return found;
}

const environmentOf = (each: Job): string | undefined =>
  typeof each.environment === 'string'
    ? each.environment
    : each.environment?.name;

describe('the production release (#621 AC4)', () => {
  it('runs on a push to main and by hand, and on nothing else', () => {
    expect(workflow('deploy-prod.yml').on).toEqual({
      push: { branches: ['main'] },
      workflow_dispatch: null,
    });
  });

  it('runs the whole build-and-test suite on the released commit first', () => {
    expect(job('deploy-prod.yml', 'test').uses).toBe(
      './.github/workflows/ci.yml',
    );
    expect(job('deploy-prod.yml', 'deploy').needs).toBe('test');
  });

  it('deploys only from main, in the production environment Shyden approves', () => {
    const deploy = job('deploy-prod.yml', 'deploy');
    expect(deploy.if).toBe("github.ref == 'refs/heads/main'");
    expect(environmentOf(deploy)).toBe('production');
  });

  it('proves the token reaches the production account alone before building', () => {
    const names = (job('deploy-prod.yml', 'deploy').steps ?? []).map(
      (each) => each.name,
    );
    expect(
      names.indexOf(
        'Prove the production token reaches the production account alone',
      ),
    ).toBeLessThan(
      names.indexOf('Build the holding page, stamped with this commit'),
    );
    expect(
      step(
        'deploy-prod.yml',
        'deploy',
        'Prove the production token reaches the production account alone',
      ).run,
    ).toBe('node scripts/token-reach.ts');
  });

  it('builds the holding page stamped with the released commit', () => {
    const build = step(
      'deploy-prod.yml',
      'deploy',
      'Build the holding page, stamped with this commit',
    );
    expect(build.run).toBe(
      'npm run build:holding --workspace @yawelo-idle/site',
    );
    expect(build.env).toEqual({ YAWELO_IDLE_COMMIT: '${{ github.sha }}' });
  });

  it('deploys the holding config, tagged with the commit so a rollback can find it', () => {
    const deploy = step(
      'deploy-prod.yml',
      'deploy',
      'Deploy the holding page, tagged with this commit',
    );
    expect(deploy['working-directory']).toBe('apps/site/holding');
    expect(deploy.run).toBe(
      'npx wrangler deploy --tag "$GITHUB_SHA" --message "release $GITHUB_SHA"',
    );
  });

  it('builds the released holding page for the verify to compare with', () => {
    const build = step(
      'deploy-prod.yml',
      'verify',
      'Build the holding page this commit released',
    );
    expect(build.run).toBe(
      'npm run build:holding --workspace @yawelo-idle/site',
    );
    expect(build.env).toEqual({ YAWELO_IDLE_COMMIT: '${{ github.sha }}' });
  });

  it('verifies the live page from outside after the deploy', () => {
    expect(job('deploy-prod.yml', 'verify').needs).toBe('deploy');
    const verify = step(
      'deploy-prod.yml',
      'verify',
      'Verify production serves this commit, its headers, 404 pages and the video',
    );
    expect(verify.run).toBe('node scripts/verify-prod.ts');
    expect(verify.env).toEqual({
      PROD_URL: 'https://yawelo-idle.shyden.co.uk',
      EXPECTED_SHA: '${{ github.sha }}',
    });
  });
});

describe('the production rollback (#621 AC6)', () => {
  it('runs only by hand, with the commit to return to', () => {
    expect(Object.keys(workflow('rollback-prod.yml').on)).toEqual([
      'workflow_dispatch',
    ]);
  });

  it('rolls back only from main, in the production environment Shyden approves', () => {
    const rollback = job('rollback-prod.yml', 'rollback');
    expect(rollback.if).toBe("github.ref == 'refs/heads/main'");
    expect(environmentOf(rollback)).toBe('production');
  });

  it('finds the version by its commit tag, passing the commit through the environment', () => {
    const find = step(
      'rollback-prod.yml',
      'rollback',
      'Find the version tagged with that commit',
    );
    expect(find.env?.['COMMIT']).toBe('${{ inputs.commit }}');
    expect(find.run).toContain(
      'node ../../../scripts/prod-version.ts "$RUNNER_TEMP/versions.json" "$COMMIT"',
    );
  });

  it('builds the page of the commit it returned to, for the verify to compare with', () => {
    const build = step(
      'rollback-prod.yml',
      'verify',
      'Build the holding page that commit released',
    );
    expect(build.env).toEqual({ YAWELO_IDLE_COMMIT: '${{ inputs.commit }}' });
  });

  it('verifies production serves the commit it returned to', () => {
    const verify = step(
      'rollback-prod.yml',
      'verify',
      'Verify production serves the commit it was rolled back to',
    );
    expect(verify.env?.['EXPECTED_SHA']).toBe('${{ inputs.commit }}');
  });
});

describe('deploys and rollbacks never overlap (#621)', () => {
  it.each(['deploy-prod.yml', 'rollback-prod.yml'])(
    '%s queues in the deploy-prod group',
    (file) => {
      expect(workflow(file).concurrency).toEqual({
        group: 'deploy-prod',
        'cancel-in-progress': false,
      });
    },
  );
});

describe('dev can never deploy production (#621 AC7)', () => {
  it('names the production environment only in the two production workflows', () => {
    // runtime population: the workflows on disk, so a new one is judged too.
    const files = readdirSync(WORKFLOWS)
      .filter((file) => /\.ya?ml$/.test(file))
      .sort();
    const naming = files.filter((file) =>
      Object.values(workflow(file).jobs).some(
        (each) => environmentOf(each) === 'production',
      ),
    );
    expect(files).toContain('deploy-dev.yml');
    expect(naming).toEqual(['deploy-prod.yml', 'rollback-prod.yml']);
  });
});
