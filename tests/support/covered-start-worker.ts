/**
 * wrangler's `unstable_startWorker`, with the Worker counted when the Worker
 * suites run under coverage (#1093 AC2). The door suite starts its Worker this
 * way, not through the test harness, because it needs `outboundService` and
 * `structuredLogsHandler`, which the harness does not take.
 *
 * With WORKER_COVERAGE_DIR unset this is `unstable_startWorker` unchanged.
 * With it set, the Worker is served, unbundled, from the instrumented build
 * `scripts/worker-coverage-build.ts` left in `<dir>/build/<key>/`, and
 * `dispose()` first saves its counts to `<dir>/raw/<key>/`, as
 * tests/support/covered-harness.ts does for the harness's Workers.
 */
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { unstable_startWorker } from 'wrangler';
// Without the extension: the door's tsconfig, which type-checks this file
// through its suite, does not allow importing .ts paths.
import { buildKey } from './covered-harness';

export type StartWorker = typeof unstable_startWorker;
type Input = Parameters<StartWorker>[0];
type Started = Awaited<ReturnType<StartWorker>>;

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The runtime wrangler's own harness reads a Worker's exports from. */
type Runtime = {
  mf: { getWorker(name: string): Promise<{ coverage(): Promise<string> }> };
};

/**
 * `unstable_startWorker(input)`, counting the Worker when `dir` (by default
 * WORKER_COVERAGE_DIR) is set.
 */
export function coveredStartWorker(
  input: Input,
  deps: { start: StartWorker; dir?: string | undefined },
): ReturnType<StartWorker> {
  const dir = 'dir' in deps ? deps.dir : process.env.WORKER_COVERAGE_DIR;
  if (dir === undefined) return deps.start(input);

  if (typeof input.config !== 'string') {
    throw new Error('a counted Worker is started from its config');
  }
  const configFile = resolve(input.config);
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
  const instrumented = join(build, 'instrumented');
  // The one bundle with a source map, as the build left it.
  const files = readdirSync(instrumented);
  const bundles = files.filter(
    (file) => file.endsWith('.js') && files.includes(`${file}.map`),
  );
  const [bundle] = bundles;
  if (bundles.length !== 1 || bundle === undefined) {
    throw new Error(
      `expected one bundle with a source map in ${instrumented}, found ${String(bundles.length)}`,
    );
  }

  return deps
    .start({
      ...input,
      entrypoint: join(instrumented, bundle),
      build: {
        ...input.build,
        bundle: false,
        findAdditionalModules: true,
        moduleRoot: instrumented,
      },
    })
    .then((worker: Started): Started => {
      const disposeWorker = worker.dispose.bind(worker);
      worker.dispose = async (): Promise<void> => {
        const [runtime] = worker.raw.runtimes as unknown as Runtime[];
        if (runtime === undefined) throw new Error(`${name} has no runtime`);
        const api = await runtime.mf.getWorker(name);
        const raw = join(dir, 'raw', key);
        mkdirSync(raw, { recursive: true });
        writeFileSync(join(raw, `${randomUUID()}.json`), await api.coverage());
        await disposeWorker();
      };
      return worker;
    });
}
