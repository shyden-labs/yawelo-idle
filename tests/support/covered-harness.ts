/**
 * wrangler's test harness, with each Worker counted when the Worker suites
 * run under coverage (#1093).
 *
 * With WORKER_COVERAGE_DIR unset this is `createTestHarness` unchanged. With
 * it set, each Worker named by a config is served from the instrumented build
 * `scripts/worker-coverage-build.ts` left in `<dir>/build/<key>/`, and
 * `close()` first saves every Worker's counts to `<dir>/raw/<key>/`, one file
 * per close, for `scripts/worker-coverage-report.ts` to add up.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { createTestHarness } from 'wrangler';

export type HarnessFactory = typeof createTestHarness;
type Harness = ReturnType<HarnessFactory>;
type Options = NonNullable<Parameters<HarnessFactory>[0]>;
type WorkerInput = Options['workers'][number];

// From the file path, not a URL: the Workers' tsconfigs type URL as the
// runtime's, which node:url does not take.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** A config's build folder name: its path from the repo root, `/` as `__`. */
export function buildKey(configFile: string, repoRoot: string): string {
  return relative(repoRoot, configFile)
    .split(sep)
    .join('__')
    .replace(/\.jsonc?$/, '');
}

type Counted = { key: string; name: string };

/**
 * `createTestHarness(options)`, counting each Worker when `dir` (by default
 * WORKER_COVERAGE_DIR) is set.
 */
export function coveredHarness(
  options: Options | undefined,
  deps: { create: HarnessFactory; dir?: string | undefined },
): Harness {
  const dir = 'dir' in deps ? deps.dir : process.env.WORKER_COVERAGE_DIR;
  if (dir === undefined) return deps.create(options);

  const counted = new Map<string, Counted>();
  const instrumented = (input: WorkerInput, root: string): WorkerInput => {
    if (!('configPath' in input) || input.prebuiltWorkerDir !== undefined) {
      return input;
    }
    const configFile = resolve(root, String(input.configPath));
    const key = buildKey(configFile, REPO);
    const build = join(dir, 'build', key);
    const described = join(build, 'worker.json');
    if (!existsSync(described)) {
      throw new Error(
        `no instrumented build for ${relative(REPO, configFile).split(sep).join('/')}: run node scripts/worker-coverage-build.ts`,
      );
    }
    const { name } = JSON.parse(readFileSync(described, 'utf8')) as {
      name: string;
    };
    counted.set(key, { key, name });
    return { ...input, prebuiltWorkerDir: join(build, 'instrumented') };
  };
  const mapped = (next: Options): Options => ({
    ...next,
    workers: next.workers.map((input) =>
      instrumented(input, next.root ?? process.cwd()),
    ),
  });

  const inner = deps.create(
    options === undefined ? undefined : mapped(options),
  );
  /** Every counted Worker's counts, one new file each. */
  const save = async (): Promise<void> => {
    for (const { key, name } of counted.values()) {
      const api = (await inner.getWorker(name).getExport()) as unknown as {
        coverage(): Promise<string>;
      };
      const raw = join(dir, 'raw', key);
      mkdirSync(raw, { recursive: true });
      writeFileSync(join(raw, `${randomUUID()}.json`), await api.coverage());
    }
  };
  // wrangler's harness is a plain object (wrangler-dist/cli.js), so the
  // spread keeps its other members.
  return {
    ...inner,
    listen: () => inner.listen(),
    getWorker: (...args: Parameters<Harness['getWorker']>) =>
      inner.getWorker(...args),
    reset: async () => {
      // A reset restarts the Workers, and their counts with them.
      await save();
      await inner.reset();
    },
    update: (next) =>
      inner.update(
        typeof next === 'function'
          ? (current: Options) => mapped(next(current))
          : mapped(next),
      ),
    close: async () => {
      await save();
      await inner.close();
    },
  };
}
