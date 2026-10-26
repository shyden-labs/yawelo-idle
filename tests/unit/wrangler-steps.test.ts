import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { PROD_WRANGLER_CONFIGS, WRANGLER_CONFIGS } from './wrangler-configs.ts';
import {
  WRANGLER_STEPS,
  assetsReported,
  describeMeant,
  describeRead,
  packageRoots,
  startingPoint,
  wranglerCalls,
  wranglerCallsIn,
} from './wrangler-steps.ts';

/**
 * The wrangler calls in the workflows, where npm starts each, and the parse's
 * refusals (#627). The integration suite runs each call's config lookup.
 */

const DEV = 'deploy-dev.yml / deploy / ';
const HOLDING = ['--config', 'apps/site/holding/wrangler.jsonc'];

/** Every call the workflows hold, and where npm starts it. */
const CALLS = [
  {
    step: `${DEV}Apply D1 migrations (before the Worker, so new code never meets an old schema)`,
    command: 'd1 migrations apply',
    from: 'apps/sync-worker',
    configArgs: ['--config', 'wrangler.deploy.jsonc'],
    start: 'the package root apps/sync-worker',
  },
  {
    step: `${DEV}Deploy the sync Worker, stamped with this commit`,
    command: 'deploy',
    from: 'apps/sync-worker',
    configArgs: ['--config', 'wrangler.deploy.jsonc'],
    start: 'the package root apps/sync-worker',
  },
  {
    step: `${DEV}Deploy the game Worker`,
    command: 'deploy',
    from: 'apps/web',
    configArgs: [],
    start: 'the package root apps/web',
  },
  {
    step: `${DEV}Deploy the holding page's dev copy`,
    command: 'deploy',
    from: '.',
    configArgs: ['--config', 'apps/site/holding-dev/wrangler.jsonc'],
    start: 'the repository root',
  },
  {
    step: `${DEV}Deploy the site Worker with its secrets`,
    command: 'deploy',
    from: 'apps/site',
    configArgs: [],
    start: 'the package root apps/site',
  },
  {
    step: `${DEV}Deploy the hostname adapter to production on Pages`,
    command: 'pages deploy',
    from: 'apps/dev-hosts',
    configArgs: [],
    start: 'the package root apps/dev-hosts',
  },
  {
    step: 'deploy-prod.yml / deploy / Deploy the holding page, tagged with this commit',
    command: 'deploy',
    from: '.',
    configArgs: HOLDING,
    start: 'the repository root',
  },
  {
    step: 'rollback-prod.yml / rollback / Find the version tagged with that commit',
    command: 'versions list',
    from: '.',
    configArgs: HOLDING,
    start: 'the repository root',
  },
  {
    step: 'rollback-prod.yml / rollback / Roll production back to it',
    command: 'rollback',
    from: '.',
    configArgs: HOLDING,
    start: 'the repository root',
  },
];

const ROOTS = [
  'apps/dev-hosts',
  'apps/site',
  'apps/sync-worker',
  'apps/web',
  'packages/bots',
  'packages/content',
  'packages/core',
  'packages/lockdown',
  'packages/progress',
  'packages/ui',
];

/** A one-job workflow's text around the given steps. */
const workflow = (
  steps: Record<string, unknown>[],
  extra: { defaults?: unknown; jobDefaults?: unknown } = {},
): string =>
  stringify({
    on: { push: null },
    ...(extra.defaults === undefined ? {} : { defaults: extra.defaults }),
    jobs: {
      ship: {
        'runs-on': 'ubuntu-24.04',
        ...(extra.jobDefaults === undefined
          ? {}
          : { defaults: extra.jobDefaults }),
        steps,
      },
    },
  });

describe('the wrangler calls in the workflows (#627)', () => {
  it('are exactly these, read from every workflow on disk', () => {
    expect(wranglerCalls('.')).toEqual(
      CALLS.map(({ step, command, from, configArgs }) => ({
        step,
        command,
        from,
        configArgs,
      })),
    );
  });

  it('are the calls the config table names, in the same order', () => {
    expect(WRANGLER_STEPS.map(({ step }) => step)).toEqual(
      CALLS.map(({ step }) => step),
    );
  });

  it.each(CALLS)('$step starts at $start', ({ step, from, start }) => {
    expect(startingPoint({ step, from }, ROOTS)).toBe(start);
  });

  it.each(CALLS)(
    '$step means a config wrangler-configs.ts lists, or one CI writes from it',
    ({ step }) => {
      const meant = WRANGLER_STEPS.find((each) => each.step === step);
      const listed: readonly string[] = [
        ...WRANGLER_CONFIGS,
        ...PROD_WRANGLER_CONFIGS,
      ];
      expect(listed).toContain(meant?.writtenFrom ?? meant?.config);
    },
  );
});

describe('where npm starts a wrangler call (#627 AC2)', () => {
  it('reads the package roots from the workspaces in package.json', () => {
    expect(packageRoots('.')).toEqual(ROOTS);
  });

  it("refuses the 2026-10-16 form, a subfolder of a package, by step and with npm's reason", () => {
    expect(() =>
      startingPoint(
        { step: 'planted / ship / Deploy', from: 'apps/site/holding-dev' },
        ROOTS,
      ),
    ).toThrow(
      "planted / ship / Deploy: apps/site/holding-dev is a subfolder of the package apps/site: npm runs npx at the package root, so wrangler reads apps/site's config, not apps/site/holding-dev's (deploy-dev run 38889757344)",
    );
  });

  it('refuses a folder outside every package, by step', () => {
    expect(() =>
      startingPoint({ step: 'planted / ship / Deploy', from: 'docs' }, ROOTS),
    ).toThrow(
      'planted / ship / Deploy: docs is neither the repository root nor a package root: npm runs npx at the nearest folder holding a package.json',
    );
  });
});

describe('the parse of a workflow (#627)', () => {
  it('reads --config=, -c, --env and -e as config arguments', () => {
    const text = workflow([
      {
        name: 'Deploy',
        run: 'npx wrangler deploy --config=a.jsonc -e dev --var "X:1"\nnpx wrangler rollback "$V" -c b.jsonc --env=prod --yes',
      },
    ]);
    expect(wranglerCallsIn('w.yml', text)).toEqual([
      {
        step: 'w.yml / ship / Deploy',
        command: 'deploy',
        from: '.',
        configArgs: ['--config=a.jsonc', '-e', 'dev'],
      },
      {
        step: 'w.yml / ship / Deploy',
        command: 'rollback',
        from: '.',
        configArgs: ['-c', 'b.jsonc', '--env=prod'],
      },
    ]);
  });

  it('reads ./apps/web/ as apps/web', () => {
    const text = workflow([
      {
        name: 'Deploy',
        'working-directory': './apps/web/',
        run: 'npx wrangler deploy',
      },
    ]);
    expect(wranglerCallsIn('w.yml', text)).toEqual([
      {
        step: 'w.yml / ship / Deploy',
        command: 'deploy',
        from: 'apps/web',
        configArgs: [],
      },
    ]);
  });

  it('passes over a wrangler config path and a shell comment, and finds the call beside them', () => {
    const text = workflow([
      {
        name: 'Bind',
        run: 'node scripts/d1-binding.ts db apps/a/wrangler.jsonc apps/a/wrangler.deploy.jsonc',
      },
      {
        name: 'Deploy',
        run: '# npx wrangler deploy from here once\nnpx wrangler pages deploy --branch main',
      },
    ]);
    expect(wranglerCallsIn('w.yml', text)).toEqual([
      {
        step: 'w.yml / ship / Deploy',
        command: 'pages deploy',
        from: '.',
        configArgs: [],
      },
    ]);
  });

  it('refuses npx with an option before wrangler, by step', () => {
    const text = workflow([
      { name: 'Deploy', run: 'npx --yes wrangler deploy' },
    ]);
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship / Deploy: wrangler is called in a form this guard cannot follow: npx --yes wrangler deploy',
    );
  });

  it('refuses npm exec wrangler, by step', () => {
    const text = workflow([
      { name: 'Deploy', run: 'npm exec wrangler deploy' },
    ]);
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship / Deploy: wrangler is called in a form this guard cannot follow: npm exec wrangler deploy',
    );
  });

  it('refuses wrangler run by its path, by step', () => {
    const text = workflow([
      { name: 'Deploy', run: 'node_modules/.bin/wrangler deploy' },
    ]);
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship / Deploy: wrangler is called in a form this guard cannot follow: node_modules/.bin/wrangler deploy',
    );
  });

  it('refuses a wrangler command it does not know, by step', () => {
    const text = workflow([{ name: 'Tail', run: 'npx wrangler tail' }]);
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship / Tail: a wrangler command this guard does not know: npx wrangler tail',
    );
  });

  it('refuses a line continued with a backslash, by step', () => {
    const text = workflow([
      { name: 'Deploy', run: 'npx wrangler deploy \\\n  --config a.jsonc' },
    ]);
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship / Deploy: a wrangler call continued on the next line: npx wrangler deploy \\',
    );
  });

  it('refuses the wrangler action, by step', () => {
    const text = workflow([
      { name: 'Deploy', uses: 'cloudflare/wrangler-action@v3' },
    ]);
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship / Deploy: uses cloudflare/wrangler-action@v3, which this guard cannot follow',
    );
  });

  it('refuses an unnamed step that calls wrangler', () => {
    const text = workflow([{ run: 'npx wrangler deploy' }]);
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship: an unnamed step calls wrangler',
    );
  });

  it('refuses a working directory built from an expression, by step', () => {
    const text = workflow([
      {
        name: 'Deploy',
        'working-directory': '${{ matrix.app }}',
        run: 'npx wrangler deploy',
      },
    ]);
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship / Deploy: working-directory is an expression: ${{ matrix.app }}',
    );
  });

  it('refuses a workflow-wide default working directory', () => {
    const text = workflow([{ name: 'Deploy', run: 'npx wrangler deploy' }], {
      defaults: { run: { 'working-directory': 'apps/web' } },
    });
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml: a default working-directory, which this guard cannot follow',
    );
  });

  it("refuses a job's default working directory", () => {
    const text = workflow([{ name: 'Deploy', run: 'npx wrangler deploy' }], {
      jobDefaults: { run: { 'working-directory': 'apps/web' } },
    });
    expect(() => wranglerCallsIn('w.yml', text)).toThrow(
      'w.yml / ship: a default working-directory, which this guard cannot follow',
    );
  });
});

describe('describing what a call reads (#627)', () => {
  it('describes a config read by its path, Worker name and assets, from the root', () => {
    expect(
      describeRead('/r', {
        cwd: '/r/apps/site',
        configPath: '/r/apps/site/wrangler.jsonc',
        name: 'yawelo-idle-site-dev',
        assets: '/r/apps/site/dist',
      }),
    ).toBe(
      'apps/site/wrangler.jsonc: yawelo-idle-site-dev, assets apps/site/dist',
    );
  });

  it('describes a config with no assets', () => {
    expect(
      describeRead('/r', {
        cwd: '/r/apps/a',
        configPath: '/r/apps/a/wrangler.jsonc',
        name: 'a',
        assets: null,
      }),
    ).toBe('apps/a/wrangler.jsonc: a, assets none');
  });

  it('describes a config named on the command line that is not on disk', () => {
    expect(
      describeRead('/r', {
        cwd: '/r/apps/a',
        missing: '/r/apps/a/wrangler.deploy.jsonc',
      }),
    ).toBe('apps/a/wrangler.deploy.jsonc (not on disk)');
  });

  it("describes the game Worker's config as wrangler reads it", () => {
    expect(describeMeant('.', { config: 'apps/web/wrangler.jsonc' })).toBe(
      'apps/web/wrangler.jsonc: yawelo-idle-web-dev, assets apps/web/dist',
    );
  });

  it('describes the Pages config with its output directory', () => {
    expect(
      describeMeant('.', { config: 'apps/dev-hosts/wrangler.jsonc' }),
    ).toBe(
      'apps/dev-hosts/wrangler.jsonc: yawelo-idle-dev-hosts, assets apps/dev-hosts/public',
    );
  });

  it('describes a config CI writes as not on disk', () => {
    expect(
      describeMeant('.', {
        config: 'apps/sync-worker/wrangler.deploy.jsonc',
        writtenFrom: 'apps/sync-worker/wrangler.jsonc',
      }),
    ).toBe('apps/sync-worker/wrangler.deploy.jsonc (not on disk)');
  });
});

describe('what a dry run reports (#627)', () => {
  it('reads the assets directory a dry run read', () => {
    expect(
      assetsReported(
        ' ⛅️ wrangler 4.148.0\n✨ Read 4 files from the assets directory /r/apps/web/dist\nTotal Upload: 1.24 KiB\n',
      ),
    ).toBe('/r/apps/web/dist');
  });

  it('reads the assets directory a dry run found missing, through colour codes', () => {
    const red = '\u001b[31m';
    const reset = '\u001b[0m';
    expect(
      assetsReported(
        `${red}✘ [ERROR]${reset} The directory specified by the "assets.directory" field in your configuration file does not exist:${reset}\n  /r/apps/site/dist-holding\n`,
      ),
    ).toBe('/r/apps/site/dist-holding');
  });

  it('reports nothing for a dry run with no assets', () => {
    expect(
      assetsReported('Total Upload: 9.10 KiB\n--dry-run: exiting now.\n'),
    ).toBeUndefined();
  });
});
