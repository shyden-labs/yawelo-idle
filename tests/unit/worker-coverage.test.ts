import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CoverageMapData, FileCoverageData } from 'istanbul-lib-coverage';
import { describe, expect, it } from 'vitest';
import { instrumentWorker, lcovFrom } from '../../scripts/worker-coverage.ts';

/**
 * #1093: a Worker run by wrangler's test harness is counted by an
 * istanbul-instrumented bundle, read over the harness's RPC. These tests run
 * the instrumented code in this process, with the runtime's WorkerEntrypoint
 * stood in, so nothing outside the test starts.
 */

const FIXTURES = fileURLToPath(
  new URL('fixtures/worker-coverage/', import.meta.url),
);
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const BUNDLE = `${FIXTURES}bundle.js`;
const code = readFileSync(BUNDLE, 'utf8');
const map = JSON.parse(readFileSync(`${BUNDLE}.map`, 'utf8')) as object;

const ENTRYPOINT_IMPORT =
  "import { WorkerEntrypoint as __yaweloEntrypoint } from 'cloudflare:workers';";
const STAND_IN =
  'class __yaweloEntrypoint { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }';

type Entrypoint = {
  fetch(request: Request): Promise<Response> | Response;
  scheduled?(controller: unknown): unknown;
  coverage(): string;
};
type Loaded = {
  default: new (ctx: unknown, env: unknown) => Entrypoint;
  Counter?: new () => { hello(): string };
};

let loads = 0;
/** Runs instrumented code as a module, each load under its own bundle path. */
async function load(instrumented: string): Promise<Loaded> {
  expect(instrumented).toContain(ENTRYPOINT_IMPORT);
  const runnable = instrumented.replace(ENTRYPOINT_IMPORT, STAND_IN);
  loads += 1;
  return (await import(
    /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(`${runnable}\n// load ${String(loads)}`).toString('base64')}`
  )) as Loaded;
}

let paths = 0;
const uniquePath = (): string => {
  paths += 1;
  return `${FIXTURES}bundle-${String(paths)}.js`;
};

describe('instrumentWorker', () => {
  it('serves the bundle default export through an entrypoint that counts each statement it runs', async () => {
    const path = uniquePath();
    const worker = new (await load(instrumentWorker(code, map, path))).default(
      {},
      {},
    );

    expect(await (await worker.fetch(new Request('https://x/a'))).text()).toBe(
      'a',
    );
    expect(await (await worker.fetch(new Request('https://x/a'))).text()).toBe(
      'a',
    );
    expect(await (await worker.fetch(new Request('https://x/b'))).text()).toBe(
      'other',
    );

    const coverage = JSON.parse(worker.coverage()) as CoverageMapData;
    expect(Object.keys(coverage)).toContain(path);
    const branches = Object.values(coverage[path]?.b ?? {});
    expect(branches).toContainEqual([2, 1]);
  });

  it('forwards scheduled to the bundle when the bundle has it', async () => {
    const worker = new (
      await load(instrumentWorker(code, map, uniquePath()))
    ).default({}, {});

    expect(worker.scheduled?.({})).toBe('ran');
  });

  it('has no scheduled handler when the bundle has none', async () => {
    const bare = [
      'var bare_default = { fetch() { return new Response("bare"); } };',
      'export {',
      '  bare_default as default',
      '};',
    ].join('\n');
    const Default = (
      await load(instrumentWorker(bare, undefined, uniquePath()))
    ).default;

    expect('scheduled' in Default.prototype).toBe(false);
    expect(
      await (await new Default({}, {}).fetch(new Request('https://x/'))).text(),
    ).toBe('bare');
  });

  it('keeps the bundle other exports, such as a Durable Object class', async () => {
    const loaded = await load(instrumentWorker(code, map, uniquePath()));

    expect(loaded.Counter && new loaded.Counter().hello()).toBe('hi');
  });

  it('keeps the other exports when the default export comes first in the list', async () => {
    const first = [
      'var first_default = { fetch() { return new Response("first"); } };',
      'class Later { hello() { return "later"; } }',
      'export {',
      '  first_default as default,',
      '  Later',
      '};',
    ].join('\n');
    const loaded = (await load(
      instrumentWorker(first, undefined, uniquePath()),
    )) as Loaded & { Later: new () => { hello(): string } };

    expect(new loaded.Later().hello()).toBe('later');
    expect(
      await (
        await new loaded.default({}, {}).fetch(new Request('https://x/'))
      ).text(),
    ).toBe('first');
  });

  it.each([
    ['none', 'var a = 1;\nexport { a };', 0],
    [
      'two',
      'var a = {};\nvar b = {};\nexport { a as default };\nexport { b as default };',
      2,
    ],
  ])(
    'refuses a bundle with %s default export lists, naming the count',
    (_name, bundle, count) => {
      const path = uniquePath();
      expect(() => instrumentWorker(bundle, undefined, path)).toThrow(
        `expected one default export in ${path}, found ${String(count)}`,
      );
    },
  );
});

describe('lcovFrom', () => {
  async function covered(
    paths: readonly string[],
  ): Promise<Record<string, FileCoverageData>> {
    const path = uniquePath();
    const worker = new (await load(instrumentWorker(code, map, path))).default(
      {},
      {},
    );
    for (const p of paths) await worker.fetch(new Request(`https://x${p}`));
    const all = JSON.parse(worker.coverage()) as Record<
      string,
      FileCoverageData
    >;
    const mine = all[path];
    if (!mine) throw new Error(`no coverage for ${path}`);
    return { [path]: mine };
  }

  it('maps the bundle counts back to the source file, named from the repo root', async () => {
    const lcov = await lcovFrom([await covered(['/a'])], REPO);

    expect(lcov).toContain(
      'SF:tests/unit/fixtures/worker-coverage/fixture-worker.ts\n',
    );
    // Line 14 runs for /a; line 16 (the other path) does not.
    expect(lcov).toContain('DA:14,1\n');
    expect(lcov).toContain('DA:16,0\n');
  });

  it('adds the counts of several runs of one bundle', async () => {
    const lcov = await lcovFrom(
      [await covered(['/a']), await covered(['/b', '/b'])].map((data) => {
        // Two runs of one bundle carry the same path (#1093: one bundle, one
        // statement map): rename the second to the first.
        const [path, file] = Object.entries(data)[0] ?? [];
        return path && file ? { [BUNDLE]: { ...file, path: BUNDLE } } : {};
      }),
      REPO,
    );

    expect(lcov).toContain('DA:14,1\n');
    expect(lcov).toContain('DA:16,2\n');
  });

  it('leaves out every file outside the repo and every file under node_modules', async () => {
    const data = await covered(['/a']);
    const [path, file] = Object.entries(data)[0] ?? [];
    if (!path || !file) throw new Error('no coverage');
    const elsewhere = (sources: string[]): CoverageMapData => ({
      [path]: {
        ...file,
        inputSourceMap: {
          ...((file as { inputSourceMap?: object }).inputSourceMap ?? {}),
          sources,
        },
      } as FileCoverageData,
    });

    expect(
      await lcovFrom(
        [elsewhere(['../../../../node_modules/zod/index.js'])],
        REPO,
      ),
    ).toBe('');
    expect(await lcovFrom([elsewhere(['/elsewhere/worker.ts'])], REPO)).toBe(
      '',
    );
  });
});
