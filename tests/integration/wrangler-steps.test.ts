import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ConfigRead,
  type WranglerCall,
  WRANGLER_STEPS,
  assetsOf,
  assetsReported,
  describeMeant,
  describeRead,
  wranglerCalls,
} from '../unit/wrangler-steps.ts';

/**
 * Every wrangler call in the workflows reads the config it means (#627).
 *
 * Each call's config lookup runs under `npm exec` from the step's own
 * directory, as the step runs `npx wrangler`: npm starts the command at the
 * package root, which is how deploy-dev run 38889757344 published the dev site
 * in place of the holding page's dev copy. wrangler's own reader reports the
 * config path, the Worker name and the assets directory; a dry run never
 * prints the name (measured 2026-10-17, on #627). Each deploy of a tracked
 * config is also dry-run the same way, and the assets directory it reports
 * must be the one meant.
 *
 * No Cloudflare key and no telemetry: nothing here reaches an account.
 */

const ROOT = resolve('.');
const PROBE = resolve('tests/integration/read-wrangler-config.ts');

/** The environment a call runs in here: no Cloudflare key, no telemetry. */
function stepEnvironment(extra: Record<string, string>): NodeJS.ProcessEnv {
  const environment = { ...process.env, ...extra };
  delete environment.CLOUDFLARE_API_TOKEN;
  delete environment.CLOUDFLARE_ACCOUNT_ID;
  environment.WRANGLER_SEND_METRICS = 'false';
  return environment;
}

/** wrangler's config lookup, run under npm where the step runs it. */
function readUnderNpm(
  call: Pick<WranglerCall, 'from' | 'configArgs'>,
): ConfigRead {
  const result = spawnSync('npm', ['exec', '--no', '-c', `node "${PROBE}"`], {
    cwd: join(ROOT, call.from),
    env: stepEnvironment({
      WRANGLER_STEP_ARGS: JSON.stringify(call.configArgs),
    }),
    encoding: 'utf8',
  });
  if (result.status !== 0)
    throw new Error(
      `the probe failed in ${call.from} (exit ${String(result.status)}): ${result.stderr}`,
    );
  const last = result.stdout.trim().split('\n').at(-1) ?? '';
  return JSON.parse(last) as ConfigRead;
}

/** `npx wrangler deploy --dry-run` with the call's config arguments, where the step runs it. */
function dryRun(call: Pick<WranglerCall, 'from' | 'configArgs'>): string {
  const result = spawnSync(
    'npx',
    ['wrangler', 'deploy', '--dry-run', ...call.configArgs],
    { cwd: join(ROOT, call.from), env: stepEnvironment({}), encoding: 'utf8' },
  );
  return `${result.stdout}${result.stderr}`;
}

/** The call a step makes, from the workflows on disk. */
function callAt(step: string): WranglerCall {
  const found = wranglerCalls(ROOT).filter((call) => call.step === step);
  if (found.length !== 1)
    throw new Error(`${step}: ${String(found.length)} calls, not one`);
  return found[0] as WranglerCall;
}

/** The deploys of a tracked config, each dry-run as its step runs it. */
const DRY_RUNS = [
  'deploy-dev.yml / deploy / Deploy the game Worker',
  "deploy-dev.yml / deploy / Deploy the holding page's dev copy",
  'deploy-dev.yml / deploy / Deploy the site Worker with its secrets',
  'deploy-prod.yml / deploy / Deploy the holding page, tagged with this commit',
];

describe('every wrangler call reads the config it means (#627)', () => {
  it.each(WRANGLER_STEPS)('$step reads $config', (meant) => {
    expect(describeRead(ROOT, readUnderNpm(callAt(meant.step)))).toBe(
      describeMeant(ROOT, meant),
    );
  });

  it('dry-runs every deploy of a tracked config', () => {
    expect(DRY_RUNS).toEqual(
      WRANGLER_STEPS.filter(
        ({ step, writtenFrom }) =>
          writtenFrom === undefined && callAt(step).command === 'deploy',
      ).map(({ step }) => step),
    );
  });

  it.each(DRY_RUNS)(
    '%s: a dry run reports the assets directory it means',
    (step) => {
      const meant = WRANGLER_STEPS.find((each) => each.step === step);
      if (meant === undefined) throw new Error(`${step}: not in the table`);
      expect(assetsReported(dryRun(callAt(step)))).toBe(assetsOf(ROOT, meant));
    },
  );
});

describe('the planted controls (#627 AC3)', () => {
  const SITE = { config: 'apps/site/wrangler.jsonc' };
  const HOLDING_DEV = { config: 'apps/site/holding-dev/wrangler.jsonc' };

  it("the holding page's dev copy and the dev site are told apart", () => {
    expect(describeMeant(ROOT, SITE)).toBe(
      'apps/site/wrangler.jsonc: yawelo-idle-site-dev, assets apps/site/dist',
    );
    expect(describeMeant(ROOT, HOLDING_DEV)).toBe(
      'apps/site/holding-dev/wrangler.jsonc: yawelo-idle-holding-dev, assets apps/site/dist-holding-dev',
    );
  });

  it('the 2026-10-16 form, from the subfolder with no --config, reads the dev site', () => {
    expect(
      describeRead(
        ROOT,
        readUnderNpm({ from: 'apps/site/holding-dev', configArgs: [] }),
      ),
    ).toBe(describeMeant(ROOT, SITE));
  });

  it('the same form dry-runs the dev site: its assets, not the dev copy', () => {
    expect(
      assetsReported(dryRun({ from: 'apps/site/holding-dev', configArgs: [] })),
    ).toBe(assetsOf(ROOT, SITE));
  });

  it('the subfolder with --config wrangler.jsonc still reads the dev site (#628)', () => {
    expect(
      describeRead(
        ROOT,
        readUnderNpm({
          from: 'apps/site/holding-dev',
          configArgs: ['--config', 'wrangler.jsonc'],
        }),
      ),
    ).toBe(describeMeant(ROOT, SITE));
  });

  it('the repository-root form with --config reads the dev copy', () => {
    expect(
      describeRead(
        ROOT,
        readUnderNpm({
          from: '.',
          configArgs: ['--config', 'apps/site/holding-dev/wrangler.jsonc'],
        }),
      ),
    ).toBe(describeMeant(ROOT, HOLDING_DEV));
  });
});
