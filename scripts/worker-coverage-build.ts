/**
 * Builds each Worker the Worker suites serve, instrumented for coverage
 * (#1093): wrangler's dry run bundles the config, `instrumentWorker` counts
 * the bundle, and the Worker's name is kept for the harness to read its counts
 * by. tests/support/covered-harness.ts serves these builds when
 * WORKER_COVERAGE_DIR names the same folder.
 *
 *   node scripts/worker-coverage-build.ts   (WORKER_COVERAGE_DIR set)
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type ParseError } from 'jsonc-parser';
import { buildKey } from '../tests/support/covered-harness.ts';
import { instrumentWorker } from './worker-coverage.ts';

/** Every config the Worker suites serve through wrangler's test harness. */
export const WORKER_CONFIGS: readonly string[] = [
  'apps/site/wrangler.jsonc',
  'apps/site/wrangler.roadmap-test.jsonc',
  'apps/sync-worker/wrangler.jsonc',
  'apps/sync-worker/wrangler.injected.jsonc',
  'apps/web/wrangler.jsonc',
];

export type BuildDeps = {
  configs: readonly string[];
  /** The coverage folder, WORKER_COVERAGE_DIR. */
  dir: string;
  repo: string;
  run: (args: readonly string[]) => void;
};

/** The Worker's name, from its config. */
function workerName(configFile: string): string {
  const errors: ParseError[] = [];
  const parsed = parse(readFileSync(configFile, 'utf8'), errors, {
    allowTrailingComma: true,
  }) as { name?: unknown } | undefined;
  if (errors.length > 0 || typeof parsed?.name !== 'string') {
    throw new Error(`${configFile} names no Worker`);
  }
  return parsed.name;
}

export function main({ configs, dir, repo, run }: BuildDeps): void {
  for (const config of configs) {
    const configFile = join(repo, config);
    const build = join(dir, 'build', buildKey(configFile, repo));
    const raw = join(build, 'raw');
    const instrumented = join(build, 'instrumented');
    rmSync(build, { recursive: true, force: true });
    run([
      'npx',
      '--no',
      'wrangler',
      'deploy',
      '--dry-run',
      '--outdir',
      raw,
      '--config',
      configFile,
    ]);

    const files = existsSync(raw) ? readdirSync(raw) : [];
    const bundles = files.filter(
      (file) => file.endsWith('.js') && files.includes(`${file}.map`),
    );
    const [bundle] = bundles;
    if (bundles.length !== 1 || bundle === undefined) {
      throw new Error(
        `expected one bundle with a source map from ${config}, found ${String(bundles.length)}`,
      );
    }
    cpSync(raw, instrumented, { recursive: true });
    const bundlePath = join(raw, bundle);
    writeFileSync(
      join(instrumented, bundle),
      instrumentWorker(
        readFileSync(bundlePath, 'utf8'),
        JSON.parse(readFileSync(`${bundlePath}.map`, 'utf8')) as object,
        bundlePath,
      ),
    );
    writeFileSync(
      join(build, 'worker.json'),
      JSON.stringify({ name: workerName(configFile) }),
    );
  }
}

if (import.meta.main) {
  const dir = process.env.WORKER_COVERAGE_DIR;
  if (dir === undefined) {
    throw new Error('set WORKER_COVERAGE_DIR to the coverage folder');
  }
  main({
    configs: WORKER_CONFIGS,
    dir: resolve(dir),
    repo: fileURLToPath(new URL('..', import.meta.url)),
    run: ([command, ...args]) => {
      if (command === undefined) throw new Error('no command');
      execFileSync(command, args, { stdio: 'inherit' });
    },
  });
}
