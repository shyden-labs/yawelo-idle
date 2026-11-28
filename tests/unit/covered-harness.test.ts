import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildKey,
  coveredHarness,
  type HarnessFactory,
} from '../support/covered-harness.ts';

/**
 * #1093: the Worker suites read their Worker's counts through this wrapper
 * round wrangler's test harness. wrangler's harness is stood in here; the
 * wrapper's files go to a temporary folder.
 */

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SITE = join(REPO, 'apps/site');

type Options = Parameters<HarnessFactory>[0];
type Call = { method: string; options?: Options; name?: string };

/** A stand-in harness recording each call, whose Workers report `counts`. */
function fakeHarness(counts: Record<string, string>) {
  const calls: Call[] = [];
  const create: HarnessFactory = (options) => {
    calls.push({ method: 'create', options });
    return {
      listen: () => {
        calls.push({ method: 'listen' });
        return Promise.resolve({ url: new URL('http://127.0.0.1:1') });
      },
      update: (next: Options | ((current: Options) => Options)) => {
        calls.push({
          method: 'update',
          options: typeof next === 'function' ? next({ workers: [] }) : next,
        });
        return Promise.resolve();
      },
      getWorker: (name?: string) => {
        calls.push({ method: 'getWorker', name });
        return {
          getExport: () =>
            Promise.resolve({
              coverage: () => Promise.resolve(counts[name ?? ''] ?? '{}'),
            }),
        };
      },
      close: () => {
        calls.push({ method: 'close' });
        return Promise.resolve();
      },
      reset: () => {
        calls.push({ method: 'reset' });
        return Promise.resolve();
      },
    } as unknown as ReturnType<HarnessFactory>;
  };
  return { calls, create };
}

/** A coverage folder holding builds for the named configs. */
function coverageDir(configs: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'covered-harness-'));
  for (const [configPath, name] of Object.entries(configs)) {
    const build = join(dir, 'build', buildKey(join(REPO, configPath), REPO));
    mkdirSync(build, { recursive: true });
    writeFileSync(join(build, 'worker.json'), JSON.stringify({ name }));
  }
  return dir;
}

const SITE_OPTIONS = {
  root: SITE,
  workers: [
    { configPath: './wrangler.jsonc', vars: { A: '1' } },
    { configPath: '../web/wrangler.jsonc' },
  ],
};

describe('buildKey', () => {
  it('names a config from the repo root, its folders joined by double underscores', () => {
    expect(
      buildKey(join(REPO, 'apps/site/wrangler.roadmap-test.jsonc'), REPO),
    ).toBe('apps__site__wrangler.roadmap-test');
  });
});

describe('coveredHarness', () => {
  it('is wrangler harness unchanged when no coverage folder is set', () => {
    const { calls, create } = fakeHarness({});

    coveredHarness(SITE_OPTIONS, { create, dir: undefined });

    expect(calls).toEqual([{ method: 'create', options: SITE_OPTIONS }]);
  });

  it('serves each Worker from its instrumented build, keeping every other option', () => {
    const dir = coverageDir({
      'apps/site/wrangler.jsonc': 'site',
      'apps/web/wrangler.jsonc': 'web',
    });
    const { calls, create } = fakeHarness({});

    coveredHarness(SITE_OPTIONS, { create, dir });

    expect(calls[0]?.options).toEqual({
      root: SITE,
      workers: [
        {
          configPath: './wrangler.jsonc',
          vars: { A: '1' },
          prebuiltWorkerDir: join(
            dir,
            'build/apps__site__wrangler/instrumented',
          ),
        },
        {
          configPath: '../web/wrangler.jsonc',
          prebuiltWorkerDir: join(
            dir,
            'build/apps__web__wrangler/instrumented',
          ),
        },
      ],
    });
  });

  it('serves the Workers an update names from their instrumented builds', async () => {
    const dir = coverageDir({ 'apps/site/wrangler.jsonc': 'site' });
    const { calls, create } = fakeHarness({});
    const server = coveredHarness(undefined, { create, dir });

    await server.update({
      root: SITE,
      workers: [{ configPath: './wrangler.jsonc' }],
    });

    expect(calls.at(-1)?.options?.workers[0]).toEqual({
      configPath: './wrangler.jsonc',
      prebuiltWorkerDir: join(dir, 'build/apps__site__wrangler/instrumented'),
    });
  });

  it('refuses a Worker with no instrumented build, naming the config and the build command', () => {
    const dir = coverageDir({});
    const { create } = fakeHarness({});

    expect(() => coveredHarness(SITE_OPTIONS, { create, dir })).toThrow(
      'no instrumented build for apps/site/wrangler.jsonc: run node scripts/worker-coverage-build.ts',
    );
  });

  it('saves each Worker counts under its build key before it closes', async () => {
    const dir = coverageDir({
      'apps/site/wrangler.jsonc': 'site',
      'apps/web/wrangler.jsonc': 'web',
    });
    const { calls, create } = fakeHarness({ site: '{"s":1}', web: '{"w":2}' });
    const server = coveredHarness(SITE_OPTIONS, { create, dir });
    await server.listen();

    await server.close();

    const saved = (key: string) =>
      readdirSync(join(dir, 'raw', key)).map((file) =>
        readFileSync(join(dir, 'raw', key, file), 'utf8'),
      );
    expect(saved('apps__site__wrangler')).toEqual(['{"s":1}']);
    expect(saved('apps__web__wrangler')).toEqual(['{"w":2}']);
    expect(calls.map((call) => call.method).slice(-1)).toEqual(['close']);
    expect(
      calls.filter((call) => call.method === 'getWorker').map((c) => c.name),
    ).toEqual(['site', 'web']);
  });

  it('saves the counts before a reset, which restarts the Workers', async () => {
    const dir = coverageDir({ 'apps/site/wrangler.jsonc': 'site' });
    const { calls, create } = fakeHarness({ site: '{"s":3}' });
    const options = {
      root: SITE,
      workers: [{ configPath: './wrangler.jsonc' }],
    };

    await coveredHarness(options, { create, dir }).reset();

    expect(readdirSync(join(dir, 'raw/apps__site__wrangler'))).toHaveLength(1);
    expect(calls.map((call) => call.method).slice(-2)).toEqual([
      'getWorker',
      'reset',
    ]);
  });

  it('forwards every other harness member to wrangler harness', () => {
    const dir = coverageDir({});
    const members = ['fetch', 'getLogs', 'clearLogs', 'debug'] as const;
    const seen: string[] = [];
    const inner = Object.fromEntries(
      members.map((member) => [
        member,
        () => {
          seen.push(member);
          return member;
        },
      ]),
    );
    const server = coveredHarness(undefined, {
      create: () => inner as unknown as ReturnType<HarnessFactory>,
      dir,
    }) as unknown as Record<(typeof members)[number], () => string>;

    expect(members.map((member) => server[member]())).toEqual(members);
    expect(seen).toEqual(members);
  });

  it('keeps each close a file of its own, so several test files add up', async () => {
    const dir = coverageDir({ 'apps/site/wrangler.jsonc': 'site' });
    const { create } = fakeHarness({ site: '{}' });
    const options = {
      root: SITE,
      workers: [{ configPath: './wrangler.jsonc' }],
    };

    await coveredHarness(options, { create, dir }).close();
    await coveredHarness(options, { create, dir }).close();

    expect(readdirSync(join(dir, 'raw/apps__site__wrangler'))).toHaveLength(2);
  });
});
