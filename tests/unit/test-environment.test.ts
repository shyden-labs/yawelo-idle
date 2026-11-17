import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { readDeployConfig } from './wrangler-configs';

/**
 * TEST (#784 AC2, AC5; Shyden, 2026-11-17): each frozen release/* cut is
 * deployed to TEST, in the non-PROD account, before the same cut goes to
 * PROD. TEST holds exactly what PROD deploys, which today is the holding page
 * alone, as its locked-down copy (crawlers blocked, noindex) at its own
 * workers.dev address. Its deploy key is limited to TEST's own Workers.
 */
const ROOT = new URL('../../', import.meta.url).pathname;
const WORKFLOW = join(ROOT, '.github/workflows/deploy-test.yml');
const TEST_ORIGIN =
  'https://yawelo-idle-holding-test.yawelo-idle-non-prod.workers.dev';

interface Step {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}
interface Job {
  needs?: string | string[];
  uses?: string;
  environment?: { name?: string; url?: string } | string;
  steps?: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<string, Job>;
}

const workflow = (): Workflow =>
  parse(readFileSync(WORKFLOW, 'utf8')) as Workflow;

function job(name: string): Job {
  const found = workflow().jobs[name];
  if (found === undefined) throw new Error(`deploy-test.yml: no ${name} job`);
  return found;
}

const runs = (name: string): string[] =>
  (job(name).steps ?? []).flatMap((each) =>
    each.run === undefined ? [] : [each.run],
  );

const secretsOf = (name: string): string[] =>
  [
    ...new Set(
      (job(name).steps ?? []).flatMap((each) =>
        Object.values(each.env ?? {}).flatMap((value) =>
          [...value.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1] ?? ''),
        ),
      ),
    ),
  ].sort();

describe("TEST's holding page config (#784 AC2)", () => {
  const holding = () =>
    readDeployConfig(join(ROOT, 'apps/site/holding-test/wrangler.jsonc'));
  const devCopy = () =>
    readDeployConfig(join(ROOT, 'apps/site/holding-dev/wrangler.jsonc'));

  it('is named for TEST', () => {
    expect(holding().name).toBe('yawelo-idle-holding-test');
  });

  it('is the dev copy in every other setting: same script, files, address and door switch', () => {
    expect({ ...holding(), name: 'any' }).toEqual({
      ...devCopy(),
      name: 'any',
    });
  });
});

describe('the TEST deploy (#784 AC5)', () => {
  it('runs on a push to a release/* cut and by hand, and on nothing else', () => {
    expect(workflow().on).toEqual({
      push: { branches: ['release/**'] },
      workflow_dispatch: null,
    });
  });

  it('never runs two deploys at once, nor cancels one', () => {
    expect(workflow().concurrency).toEqual({
      group: 'deploy-test',
      'cancel-in-progress': false,
    });
  });

  it('runs the whole build-and-test suite on the cut first', () => {
    expect(job('test').uses).toBe('./.github/workflows/ci.yml');
    expect(job('deploy').needs).toBe('test');
  });

  it('deploys in the test environment, at its workers.dev address', () => {
    expect(job('deploy').environment).toEqual({
      name: 'test',
      url: `${TEST_ORIGIN}/`,
    });
  });

  it("reads TEST's own key and the non-PROD account, and no other secret", () => {
    expect(secretsOf('deploy')).toEqual([
      'NONPROD_CLOUDFLARE_ACCOUNT_ID',
      'TEST_CLOUDFLARE_API_TOKEN',
    ]);
  });

  it("proves the key reaches the non-PROD account alone, then builds and deploys TEST's holding page", () => {
    const all = runs('deploy');
    expect(all.slice(all.indexOf('npm ci'))).toEqual([
      'npm ci',
      'node scripts/token-reach.ts',
      'npm run build:holding --workspace @yawelo-idle/site',
      'node scripts/holding-dev.ts',
      'npx --no wrangler deploy --config apps/site/holding-test/wrangler.jsonc --tag "$GITHUB_SHA" --message "release cut $GITHUB_SHA"',
    ]);
  });

  it("verifies TEST's workers.dev address serves this commit, noindex, crawlers blocked", () => {
    const verify = job('verify');
    expect(verify.needs).toBe('deploy');
    const check = (verify.steps ?? []).find(
      (each) => each.run === 'node scripts/verify-prod.ts --dev-copy',
    );
    expect(check?.env).toEqual({
      DEV_HOLDING_URL: TEST_ORIGIN,
      EXPECTED_SHA: '${{ github.sha }}',
    });
    expect(secretsOf('verify')).toEqual([]);
  });
});
