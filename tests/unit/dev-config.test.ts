import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { isIgnored } from './tracked-files';
import {
  readDeployConfig,
  WRANGLER_CONFIGS,
  type DeployConfig,
} from './wrangler-configs';
import { runOf } from './workflow-steps';
import { DOORS } from '../../apps/door/worker/door';

/**
 * The dev deploy configs (four Workers, #429, #784), read the way wrangler reads them
 * (comments stripped, defaults applied), so no comment can satisfy or trip a
 * guard (#39 AC2, AC7).
 */
const ROOT = new URL('../..', import.meta.url).pathname;

/**
 * The non-PROD account's workers.dev subdomain, assigned by Cloudflare from
 * the account's name and read from the account 2026-11-16 (#784): DEV's
 * Workers live there, beside TEST only, never in the production account.
 */
const DEV_WORKERS_SUBDOMAIN = 'yawelo-idle-non-prod';

// The five by name: that they are every wrangler config in the repo walks
// the tree, a guard (#530, tests/guards/wrangler-configs.test.ts).
// Read on first use, inside a test, not at collection.
let read: { file: string; config: DeployConfig }[] | undefined;
const configs = (): { file: string; config: DeployConfig }[] =>
  (read ??= WRANGLER_CONFIGS.map((file) => ({
    file,
    config: readDeployConfig(join(ROOT, file)),
  })));

/** The dev door that reaches `worker` (apps/door/worker/door.ts, #1013). */
function devHost(worker: string): string {
  const found = [...DOORS].find(([, door]) => door.worker === worker);
  if (found === undefined) throw new Error(`no dev door reaches ${worker}`);
  return found[0];
}

function byName(name: string): DeployConfig {
  const found = configs().find(({ config }) => config.name === name);
  if (found === undefined) throw new Error(`no wrangler config named ${name}`);
  return found.config;
}

describe('the dev Workers’ deploy configs', () => {
  it('serves the site Worker on workers.dev with no route, gate first (#332)', () => {
    const site = byName('yawelo-idle-site-dev');
    expect(site.routes).toBeUndefined();
    expect(site.main).toMatch(/apps\/site\/worker\/index\.ts$/);
    expect(site.assets).toMatchObject({
      binding: 'ASSETS',
      run_worker_first: true,
      not_found_handling: '404-page',
    });
  });

  it('reads the roadmap from the one board, into a SQLite Durable Object, on visit, with no schedule (#341, #1074)', () => {
    const site = byName('yawelo-idle-site-dev');
    expect(site.vars).toMatchObject({
      ROADMAP_BOARD_ID: 'PVT_kwDOEOcG584BlRWb',
      ROADMAP_BOARD_TITLE: 'Yawelo Idle Stories',
      ROADMAP_REPO: 'shyden-labs/yawelo-idle',
    });
    expect(site.durable_objects).toEqual({
      bindings: [{ name: 'ROADMAP', class_name: 'Roadmap' }],
    });
    expect(site.migrations).toEqual([
      { tag: 'v1', new_sqlite_classes: ['Roadmap'] },
    ]);
    expect(site.triggers).toEqual({});
  });

  it('reads the board as the read-only App yawelo-idle-roadmap, by its id (#341 AC8)', () => {
    // The id GitHub gave the App at creation, read back on its settings page
    // (2026-10-13); its private key is a Worker secret from the deploy.
    expect(byName('yawelo-idle-site-dev').vars).toMatchObject({
      ROADMAP_APP_ID: '5294556',
    });
  });

  it('reaches the game only through the site Worker’s GAME binding (#332)', () => {
    expect(byName('yawelo-idle-site-dev').services).toContainEqual({
      binding: 'GAME',
      service: 'yawelo-idle-web-dev',
    });
    const game = byName('yawelo-idle-web-dev');
    expect(game.workers_dev).toBe(false);
    expect(game.routes).toBeUndefined();
  });

  it('binds the game and the holding page’s dev copy, and nothing else, to the site Worker (#332, #673)', () => {
    expect(byName('yawelo-idle-site-dev').services).toEqual([
      { binding: 'GAME', service: byName('yawelo-idle-web-dev').name },
      { binding: 'HOLDING', service: byName('yawelo-idle-holding-dev').name },
    ]);
  });

  it('runs the game’s script before its files, so every response carries the CSP (#123, #332)', () => {
    const game = byName('yawelo-idle-web-dev');
    expect(game.main).toMatch(/apps\/web\/worker\/index\.ts$/);
    expect(game.assets).toEqual({
      directory: './dist',
      binding: 'ASSETS',
      run_worker_first: true,
    });
  });

  it('runs the holding page’s dev copy’s script before its files, so its door check sees every request (#784 AC4)', () => {
    const holding = byName('yawelo-idle-holding-dev');
    expect(holding.main).toMatch(/apps\/site\/worker\/holding\.ts$/);
    expect(holding.assets).toEqual({
      directory: '../dist-holding-dev',
      binding: 'ASSETS',
      run_worker_first: true,
      not_found_handling: '404-page',
    });
  });

  it('admits every request to the holding page’s dev copy until the doors go live, as the other origins do (#784 AC4)', () => {
    expect(byName('yawelo-idle-holding-dev').vars).toEqual({
      DOOR_REQUIRED: 'false',
    });
  });

  it('serves the sync Worker on workers.dev with no route (#395)', () => {
    expect(byName('yawelo-idle-sync-dev').routes).toBeUndefined();
  });

  it('keeps each public dev Worker’s workers.dev address, the holding page’s dev copy’s too for its door, and the game at none, with no preview URLs (#395, #332, #429, #768, #784)', () => {
    expect(
      configs()
        .map(({ config }) => [
          config.name,
          config.workers_dev,
          config.preview_urls,
        ])
        .sort(),
    ).toEqual([
      ['yawelo-idle-holding-dev', true, false],
      ['yawelo-idle-site-dev', true, false],
      ['yawelo-idle-sync-dev', true, false],
      ['yawelo-idle-web-dev', false, false],
    ]);
  });

  it('verifies dev at the origins’ own addresses in the dev account, standing in for the door with its secret (#429, #332, #1078)', () => {
    const verify = verifySteps().find(
      (step) => runOf(step) === 'node scripts/verify-dev.ts',
    );
    const own = (worker: string) =>
      `https://${byName(worker).name}.${DEV_WORKERS_SUBDOMAIN}.workers.dev`;
    // CI never goes through a door (#784 AC1b): once the doors check the
    // DEV pass, no CI request could pass them.
    expect(verify?.env).toMatchObject({
      DEV_WEB_URL: `${own('yawelo-idle-site-dev')}/`,
      DEV_SITE_URL: `${own('yawelo-idle-site-dev')}/`,
      DEV_SYNC_URL: own('yawelo-idle-sync-dev'),
      DEV_GAME_URL: `${own('yawelo-idle-web-dev')}/`,
      DEV_DOOR_SECRET: '${{ secrets.DEV_DOOR_SECRET }}',
    });
    expect(
      Object.values(verify?.env ?? {}).filter((value) =>
        [...DOORS.keys()].some((host) => String(value).includes(host)),
      ),
      'no door address',
    ).toEqual([]);
  });

  it('checks the dev hostnames against the real Workers straight after verify-dev, with the login and the webhook secret (#816)', () => {
    const steps = verifySteps();
    const at = steps.findIndex(
      (step) => runOf(step) === 'node scripts/verify-dev.ts',
    );
    expect(at).toBeGreaterThanOrEqual(0);
    const next = steps[at + 1] ?? {};
    expect(runOf(next)).toBe('node scripts/verify-dev-hosts.ts');
    expect(next.env).toEqual({
      DEV_BASIC_AUTH_PASSWORD: '${{ secrets.DEV_BASIC_AUTH_PASSWORD }}',
      ROADMAP_WEBHOOK_SECRET: '${{ secrets.ROADMAP_WEBHOOK_SECRET }}',
    });
  });

  it('names the site’s dev hostname as the dev environment’s address, in both jobs (#429)', () => {
    const workflow = parse(
      readFileSync(join(ROOT, '.github/workflows/deploy-dev.yml'), 'utf8'),
    ) as { jobs: Record<string, { environment?: unknown }> };
    const dev = {
      name: 'dev',
      url: `https://${devHost('yawelo-idle-site-dev')}`,
    };
    expect(workflow.jobs['deploy']?.environment).toEqual(dev);
    expect(workflow.jobs['verify']?.environment).toEqual(dev);
  });

  it('verifies the holding page’s dev copy at its dev hostname (#768)', () => {
    const verify = jobSteps('verify-holding').find(
      (step) => runOf(step) === 'node scripts/verify-prod.ts --dev-copy',
    );
    expect(verify?.env).toMatchObject({
      DEV_HOLDING_URL: `https://${devHost('yawelo-idle-holding-dev')}`,
    });
  });

  it('reaches a dev Worker this repo deploys from every dev door (#429, #784, #1013)', () => {
    expect(
      [...DOORS.values()]
        .filter((door) => door.environment === 'dev')
        .map((door) => byName(door.worker).name),
    ).toEqual([
      'yawelo-idle-site-dev',
      'yawelo-idle-sync-dev',
      'yawelo-idle-holding-dev',
    ]);
  });

  it('declares no secret as a plain var (the password is a Worker secret)', () => {
    const declared = configs().flatMap(({ file, config }) =>
      Object.keys(config.vars).map((name) => ({ file, name })),
    );
    expect(declared).toContainEqual({
      file: 'apps/sync-worker/wrangler.jsonc',
      name: 'COMMIT',
    });
    const secrets = declared.filter(({ name }) =>
      /PASSWORD|SECRET|TOKEN|KEY/i.test(name),
    );
    expect(secrets).toEqual([]);
  });
});

/** The deploy job's steps, read as parsed YAML so no comment counts. */
interface Step {
  id?: string;
  name?: string;
  uses?: string;
  run?: unknown;
  'working-directory'?: string;
  env?: Record<string, unknown>;
}
/** A deploy-dev.yml job's steps. */
const jobSteps = (job: 'deploy' | 'verify' | 'verify-holding'): Step[] => {
  const workflow = parse(
    readFileSync(join(ROOT, '.github/workflows/deploy-dev.yml'), 'utf8'),
  ) as { jobs: Record<string, { steps?: Step[] }> };
  const steps = workflow.jobs[job]?.steps;
  if (steps === undefined) throw new Error(`deploy-dev.yml: no ${job} steps`);
  return steps;
};
const deploySteps = (): Step[] => jobSteps('deploy');
const verifySteps = (): Step[] => jobSteps('verify');

describe('the dev D1 database, created by the pipeline (#357 AC1)', () => {
  const DATABASE = 'yawelo-idle-dev';
  /** Written at deploy beside wrangler.jsonc by scripts/d1-binding.ts. */
  const DEPLOY_CONFIG = 'wrangler.deploy.jsonc';

  it('is bound by name alone, with no id copied in by hand', () => {
    expect(byName('yawelo-idle-sync-dev').d1_databases).toEqual([
      { binding: 'DB', database_name: DATABASE, migrations_dir: 'migrations' },
    ]);
  });

  it('is created in Asia Pacific, from the root, before its migrations are applied', () => {
    const runs = deploySteps().map((step) => ({
      run: runOf(step),
      cwd: step['working-directory'],
    }));
    const create = runs.findIndex(
      ({ run }) => run === `node scripts/ensure-d1.ts ${DATABASE} apac`,
    );
    const migrate = runs.findIndex(
      ({ run }) =>
        run ===
        `npx --no wrangler d1 migrations apply ${DATABASE} --remote --config ${DEPLOY_CONFIG}`,
    );
    expect(create).toBeGreaterThanOrEqual(0);
    expect(runs[create]?.cwd).toBeUndefined();
    expect(migrate).toBeGreaterThan(create);
    expect(runs[migrate]?.cwd).toBe('apps/sync-worker');
  });

  it('is bound by id at deploy: resolved after it exists, then read by the migrations and the sync deploy (#391)', () => {
    const runs = deploySteps().map((step) => ({
      run: runOf(step),
      cwd: step['working-directory'],
    }));
    const create = runs.findIndex(
      ({ run }) => run === `node scripts/ensure-d1.ts ${DATABASE} apac`,
    );
    const bind = runs.findIndex(
      ({ run }) =>
        run ===
        `node scripts/d1-binding.ts ${DATABASE} apps/sync-worker/wrangler.jsonc apps/sync-worker/${DEPLOY_CONFIG}`,
    );
    const migrate = runs.findIndex(({ run }) =>
      run.startsWith(`npx --no wrangler d1 migrations apply ${DATABASE} `),
    );
    const deploy = runs.findIndex(
      ({ run }) =>
        run ===
        `npx --no wrangler deploy --config ${DEPLOY_CONFIG} --var "COMMIT:\${GITHUB_SHA}" --secrets-file "$SECRETS_FILE"`,
    );
    expect(create).toBeGreaterThanOrEqual(0);
    expect(bind).toBeGreaterThan(create);
    expect(runs[bind]?.cwd).toBeUndefined();
    expect(migrate).toBeGreaterThan(bind);
    expect(deploy).toBeGreaterThan(migrate);
    expect(runs[deploy]?.cwd).toBe('apps/sync-worker');
  });

  it('keeps the generated deploy config, which holds the id, out of git (#391)', () => {
    // As git check-ignore answers, read in-process (#491); the same answers
    // from git itself are compared in tests/integration/tracked-files.test.ts.
    expect(isIgnored(`apps/sync-worker/${DEPLOY_CONFIG}`, ROOT)).toBe(true);
    expect(isIgnored('apps/sync-worker/wrangler.jsonc', ROOT)).toBe(false);
  });
});

describe('the dev Cloudflare tokens, proven and held only where they are used (#395, #784)', () => {
  /**
   * The non-PROD account's token: DEV's Workers and D1 (#784 AC2). Wrangler
   * reads the CLOUDFLARE_ names, so each step maps them to the NONPROD_
   * environment secrets.
   */
  const NONPROD = {
    CLOUDFLARE_API_TOKEN: '${{ secrets.NONPROD_CLOUDFLARE_API_TOKEN }}',
    CLOUDFLARE_ACCOUNT_ID: '${{ secrets.NONPROD_CLOUDFLARE_ACCOUNT_ID }}',
  };

  it('is not in the deploy job’s own env, so npm ci and the build never hold it', () => {
    const workflow = parse(
      readFileSync(join(ROOT, '.github/workflows/deploy-dev.yml'), 'utf8'),
    ) as { jobs: Record<string, { env?: Record<string, unknown> }> };
    expect(Object.keys(workflow.jobs['deploy']?.env ?? {})).toEqual([
      'WRANGLER_SEND_METRICS',
    ]);
  });

  it('are held by exactly the steps that call Cloudflare, each account’s reach check first', () => {
    const holds = (run: string, token = NONPROD) => ({
      run,
      env: expect.objectContaining(token) as unknown,
    });
    expect(
      deploySteps()
        .filter((step) =>
          Object.keys(step.env ?? {}).some((name) =>
            name.startsWith('CLOUDFLARE_'),
          ),
        )
        .map((step) => ({ run: runOf(step), env: step.env })),
    ).toEqual([
      holds('node scripts/token-reach.ts'),
      holds('node scripts/ensure-d1.ts yawelo-idle-dev apac'),
      holds(
        'node scripts/d1-binding.ts yawelo-idle-dev apps/sync-worker/wrangler.jsonc apps/sync-worker/wrangler.deploy.jsonc',
      ),
      holds(
        'npx --no wrangler d1 migrations apply yawelo-idle-dev --remote --config wrangler.deploy.jsonc',
      ),
      holds(
        'npx --no wrangler deploy --config wrangler.deploy.jsonc --var "COMMIT:${GITHUB_SHA}" --secrets-file "$SECRETS_FILE"',
      ),
      holds('npx --no wrangler deploy'),
      // The holding page's dev copy (#621 AC8), named from the repository
      // root: from its subfolder, npx would run wrangler at apps/site, which
      // reads the dev site's config (deploy-dev run 38889757344). Before
      // the site Worker, whose HOLDING binding names it (#673).
      holds(
        'npx --no wrangler deploy --config apps/site/holding-dev/wrangler.jsonc',
      ),
      holds('npx --no wrangler deploy --secrets-file "$SECRETS_FILE"'),
    ]);
  });

  it('is proven to reach its account alone before any step that uses it', () => {
    const first = deploySteps().find(
      (step) =>
        step.env?.['CLOUDFLARE_API_TOKEN'] === NONPROD.CLOUDFLARE_API_TOKEN,
    );
    expect(first === undefined ? undefined : runOf(first)).toBe(
      'node scripts/token-reach.ts',
    );
  });
});

describe('the sync Worker’s secrets, uploaded by the deploy (#164 AC2)', () => {
  it('are written from the dev environment secrets, then deployed with the sync Worker', () => {
    const steps = deploySteps();
    const write = steps.findIndex(
      (step) =>
        runOf(step) ===
        'path="$(node scripts/sync-secrets.ts)"\necho "path=$path" >> "$GITHUB_OUTPUT"',
    );
    const deploy = steps.findIndex((step) =>
      runOf(step).startsWith(
        'npx --no wrangler deploy --config wrangler.deploy.jsonc ',
      ),
    );
    expect({
      written: write >= 0,
      id: steps[write]?.id,
      env: steps[write]?.env,
      deployedAfter: deploy > write,
      file: steps[deploy]?.env?.['SECRETS_FILE'],
    }).toEqual({
      written: true,
      id: 'sync-secrets',
      env: {
        DEV_DOOR_SECRET: '${{ secrets.DEV_DOOR_SECRET }}',
        DEV_RATE_KEY: '${{ secrets.DEV_RATE_KEY }}',
      },
      deployedAfter: true,
      file: '${{ steps.sync-secrets.outputs.path }}',
    });
  });
});

describe('the dev secrets, uploaded by the deploy (#357, #341)', () => {
  it('is written from the dev environment secret, then deployed with the site Worker (#332)', () => {
    const steps = deploySteps();
    // The script names the file's path itself (SonarCloud S8707 on #943):
    // a failed write stops the step, and the path goes to the deploy.
    const write = steps.findIndex(
      (step) =>
        runOf(step) ===
        'path="$(node scripts/dev-secrets.ts)"\necho "path=$path" >> "$GITHUB_OUTPUT"',
    );
    const deploy = steps.findIndex(
      (step) =>
        runOf(step) ===
        'npx --no wrangler deploy --secrets-file "$SECRETS_FILE"',
    );
    expect(steps[write]?.id).toBe('site-secrets');
    expect(steps[deploy]?.env?.['SECRETS_FILE']).toBe(
      '${{ steps.site-secrets.outputs.path }}',
    );
    expect(write).toBeGreaterThanOrEqual(0);
    expect(steps[write]?.env).toEqual({
      DEV_PASSWORD: '${{ secrets.DEV_BASIC_AUTH_PASSWORD }}',
      ROADMAP_WEBHOOK_SECRET: '${{ secrets.ROADMAP_WEBHOOK_SECRET }}',
      ROADMAP_APP_KEY: '${{ secrets.ROADMAP_APP_KEY }}',
      DEV_DOOR_SECRET: '${{ secrets.DEV_DOOR_SECRET }}',
    });
    expect(deploy).toBeGreaterThan(write);
    expect(steps[deploy]?.['working-directory']).toBe('apps/site');
  });
});

describe('the game and the site, deployed in binding order (#332 AC7)', () => {
  const deployIn = (dir: string) =>
    deploySteps().findIndex(
      (step) =>
        step['working-directory'] === dir &&
        runOf(step).startsWith('npx --no wrangler deploy'),
    );
  /** The holding page's dev copy, deployed from the repository root (#621 AC8). */
  const holdingDeploy = () =>
    deploySteps().findIndex(
      (step) =>
        runOf(step) ===
        'npx --no wrangler deploy --config apps/site/holding-dev/wrangler.jsonc',
    );

  it('deploys the game before the site, whose GAME binding names it', () => {
    const game = deployIn('apps/web');
    expect(game).toBeGreaterThanOrEqual(0);
    expect(deployIn('apps/site')).toBeGreaterThan(game);
  });

  it('builds each app, stamped with this commit, before deploying it', () => {
    const builds = deploySteps().flatMap((step, index) =>
      step.env?.['YAWELO_IDLE_COMMIT'] === '${{ github.sha }}'
        ? [{ index, run: runOf(step) }]
        : [],
    );
    expect(builds.map(({ run }) => run)).toEqual([
      'npm run build --workspace @yawelo-idle/web',
      // The holding page, whose dev copy is deployed from it (#621 AC8)
      // before the site Worker that binds it (#673).
      'npm run build:holding --workspace @yawelo-idle/site',
      'npm run build --workspace @yawelo-idle/site',
    ]);
    expect(builds[0]?.index).toBeLessThan(deployIn('apps/web'));
    expect(builds[1]?.index).toBeLessThan(holdingDeploy());
    expect(builds[2]?.index).toBeLessThan(deployIn('apps/site'));
  });

  it('deploys the holding page’s dev copy before the site Worker that binds it (#673)', () => {
    expect(holdingDeploy()).toBeGreaterThanOrEqual(0);
    expect(holdingDeploy()).toBeLessThan(deployIn('apps/site'));
  });
});

describe('the roadmap, judged once the deployed code has checked the board (#708)', () => {
  interface Job {
    needs?: string | string[];
    'timeout-minutes'?: number;
    environment?: unknown;
    outputs?: Record<string, string>;
    steps?: (Step & { id?: string; 'timeout-minutes'?: number })[];
  }
  const jobs = (): Record<string, Job> =>
    (
      parse(
        readFileSync(join(ROOT, '.github/workflows/deploy-dev.yml'), 'utf8'),
      ) as { jobs: Record<string, Job> }
    ).jobs;
  const roadmapStep = () =>
    jobs()['verify-roadmap']?.steps?.find(
      (step) => runOf(step) === 'node scripts/verify-roadmap.ts',
    );

  it('stamps the deploy time, to the millisecond, as the deploy job’s last step', () => {
    const last = jobs()['deploy']?.steps?.at(-1);
    expect(last?.id).toBe('deployed');
    expect(runOf(last ?? {})).toBe(
      'echo "at=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" >> "$GITHUB_OUTPUT"',
    );
    expect(jobs()['deploy']?.outputs).toEqual({
      'deployed-at': '${{ steps.deployed.outputs.at }}',
    });
  });

  it('runs in its own job after the deploy, in the dev environment, at its own limit', () => {
    const job = jobs()['verify-roadmap'];
    expect(job?.needs).toBe('deploy');
    expect(job?.environment).toStrictEqual({
      name: 'dev',
      url: 'https://dev.yaweloidle.com',
    });
    // 12 minutes of looks, under the step's 13 and the job's 15.
    expect(roadmapStep()?.['timeout-minutes']).toBe(13);
    expect(job?.['timeout-minutes']).toBe(15);
  });

  it('hands the check the deploy time, the front door and the password', () => {
    expect(roadmapStep()?.env).toStrictEqual({
      DEV_WEB_URL: 'https://dev.yaweloidle.com/',
      DEV_BASIC_AUTH_PASSWORD: '${{ secrets.DEV_BASIC_AUTH_PASSWORD }}',
      DEPLOYED_AT: '${{ needs.deploy.outputs.deployed-at }}',
    });
  });
});
