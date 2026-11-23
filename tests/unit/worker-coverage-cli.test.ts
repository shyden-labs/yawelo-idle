import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  WORKER_CONFIGS,
  main as build,
} from '../../scripts/worker-coverage-build.ts';
import { main as report } from '../../scripts/worker-coverage-report.ts';
import { buildKey } from '../support/covered-harness.ts';

/**
 * #1093: the two steps round the Worker suites. The build makes each
 * config's instrumented bundle (wrangler's dry run stood in); the report
 * turns the counts the suites saved into one lcov per config.
 */

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURES = join(REPO, 'tests/unit/fixtures/worker-coverage');

/** A repo-like folder holding one config, named `name`. */
function world(name = 'fixture-worker') {
  const root = mkdtempSync(join(tmpdir(), 'worker-coverage-cli-'));
  const config = 'apps/fixture/wrangler.jsonc';
  mkdirSync(join(root, 'apps/fixture'), { recursive: true });
  writeFileSync(
    join(root, config),
    `{\n  // the fixture\n  "name": "${name}",\n  "main": "w.ts",\n}\n`,
  );
  return { root, config, dir: join(root, 'coverage/.workers') };
}

/** A stand-in for wrangler's dry run that writes `files` from the fixtures. */
function dryRun(files: readonly string[]) {
  const runs: string[][] = [];
  const run = (args: readonly string[]): void => {
    runs.push([...args]);
    const out = args[args.indexOf('--outdir') + 1];
    if (out === undefined) throw new Error('no --outdir');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'README.md'), 'dry run');
    for (const file of files) {
      copyFileSync(
        join(FIXTURES, file.endsWith('.map') ? 'bundle.js.map' : 'bundle.js'),
        join(out, file),
      );
    }
  };
  return { runs, run };
}

describe('worker-coverage-build', () => {
  it('dry-runs each config into its build folder', () => {
    const { root, config, dir } = world();
    const { runs, run } = dryRun(['index.js', 'index.js.map']);

    build({ configs: [config], dir, repo: root, run });

    const key = buildKey(join(root, config), root);
    expect(runs).toEqual([
      [
        'npx',
        '--no',
        'wrangler',
        'deploy',
        '--dry-run',
        '--outdir',
        join(dir, 'build', key, 'raw'),
        '--config',
        join(root, config),
      ],
    ]);
  });

  it('leaves the instrumented bundle beside the dry run other files, and the Worker name', () => {
    const { root, config, dir } = world('yawelo-idle-fixture');
    const { run } = dryRun(['index.js', 'index.js.map']);

    build({ configs: [config], dir, repo: root, run });

    const built = join(dir, 'build', buildKey(join(root, config), root));
    expect(
      readFileSync(join(built, 'instrumented/index.js'), 'utf8'),
    ).toContain('coverage() {');
    expect(existsSync(join(built, 'instrumented/README.md'))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(built, 'worker.json'), 'utf8')),
    ).toEqual({
      name: 'yawelo-idle-fixture',
    });
  });

  it('instruments the bundle with a source map, leaving any other script as the dry run wrote it', () => {
    const { root, config, dir } = world();
    const { run } = dryRun(['index.js', 'index.js.map', 'chunk.js']);

    build({ configs: [config], dir, repo: root, run });

    const built = join(dir, 'build', buildKey(join(root, config), root));
    expect(readFileSync(join(built, 'instrumented/chunk.js'), 'utf8')).toBe(
      readFileSync(join(FIXTURES, 'bundle.js'), 'utf8'),
    );
  });

  it.each([
    ['no bundle', ['README.md']],
    ['two bundles', ['index.js', 'index.js.map', 'other.js', 'other.js.map']],
  ])('refuses a dry run with %s, naming the config', (_case, files) => {
    const { root, config, dir } = world();
    const { run } = dryRun(files.filter((file) => file !== 'README.md'));

    expect(() => {
      build({ configs: [config], dir, repo: root, run });
    }).toThrow(`expected one bundle with a source map from ${config}`);
  });

  it('builds every config the Worker suites serve through the harness', () => {
    expect([...WORKER_CONFIGS].sort()).toEqual([
      'apps/site/wrangler.jsonc',
      'apps/site/wrangler.roadmap-test.jsonc',
      'apps/sync-worker/wrangler.injected.jsonc',
      'apps/sync-worker/wrangler.jsonc',
      'apps/web/wrangler.jsonc',
    ]);
  });
});

describe('worker-coverage-report', () => {
  it('writes one lcov per config from the counts its suites saved', async () => {
    const { root, config, dir } = world();
    const { run } = dryRun(['index.js', 'index.js.map']);
    build({ configs: [config], dir, repo: root, run });
    const key = buildKey(join(root, config), root);
    // Counts as the instrumented Worker reports them. The fixture's map names
    // its source beside the bundle, so the counts name the fixture's path.
    const counts = await countsFor(join(FIXTURES, 'bundle.js'));
    mkdirSync(join(dir, 'raw', key), { recursive: true });
    writeFileSync(join(dir, 'raw', key, 'one.json'), counts);

    await report({
      configs: [config],
      dir,
      repo: REPO,
      out: join(root, 'coverage'),
    });

    const lcov = readFileSync(
      join(root, 'coverage', `worker-${key}`, 'lcov.info'),
      'utf8',
    );
    expect(lcov).toContain(
      'SF:tests/unit/fixtures/worker-coverage/fixture-worker.ts\n',
    );
  });

  it('refuses a config whose suites saved no counts, naming it', async () => {
    const { root, config, dir } = world();

    await expect(
      report({
        configs: [config],
        dir,
        repo: root,
        out: join(root, 'coverage'),
      }),
    ).rejects.toThrow(
      `no counts for ${config}: did its Worker suite run under coverage?`,
    );
  });

  it('is read by Sonar, one report per config', () => {
    const properties = readFileSync(
      join(REPO, 'sonar-project.properties'),
      'utf8',
    );
    const paths =
      /^sonar\.javascript\.lcov\.reportPaths=(.*)$/m
        .exec(properties)?.[1]
        ?.split(',') ?? [];

    expect(paths).toEqual(
      expect.arrayContaining(
        WORKER_CONFIGS.map(
          (config) =>
            `coverage/worker-${buildKey(join(REPO, config), REPO)}/lcov.info`,
        ),
      ),
    );
  });
});

/** The counts of one /a request through the instrumented fixture bundle. */
async function countsFor(bundlePath: string): Promise<string> {
  const { instrumentWorker } = await import('../../scripts/worker-coverage.ts');
  const code = readFileSync(join(FIXTURES, 'bundle.js'), 'utf8');
  const map = JSON.parse(
    readFileSync(join(FIXTURES, 'bundle.js.map'), 'utf8'),
  ) as object;
  const runnable = instrumentWorker(code, map, bundlePath).replace(
    "import { WorkerEntrypoint as __yaweloEntrypoint } from 'cloudflare:workers';",
    'class __yaweloEntrypoint { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }',
  );
  const loaded = (await import(
    /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(runnable).toString('base64')}`
  )) as {
    default: new (
      ctx: unknown,
      env: unknown,
    ) => {
      fetch(request: Request): Response;
      coverage(): string;
    };
  };
  const worker = new loaded.default({}, {});
  worker.fetch(new Request('https://x/a'));
  const all = JSON.parse(worker.coverage()) as Record<string, unknown>;
  return JSON.stringify({ [bundlePath]: all[bundlePath] });
}
