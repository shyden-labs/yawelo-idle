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
import { buildKey } from '../support/covered-harness.ts';
import {
  coveredStartWorker,
  type StartWorker,
} from '../support/covered-start-worker.ts';

/**
 * #1093 AC2: the door suite starts its Worker with wrangler's
 * `unstable_startWorker`, not the test harness, so it is counted through this
 * wrapper. wrangler is stood in here; the wrapper's files go to a temporary
 * folder.
 */

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DOOR_CONFIG = join(REPO, 'apps/door/wrangler.jsonc');
const KEY = 'apps__door__wrangler';

type Input = Parameters<StartWorker>[0];
type Call = { method: string; input?: Input; name?: string };

/** A stand-in `unstable_startWorker` recording each call. */
function fakeStart(counts: string) {
  const calls: Call[] = [];
  const worker = {
    fetch: () => Promise.resolve(new Response('ok')),
    dispose: () => {
      calls.push({ method: 'dispose' });
      return Promise.resolve();
    },
    raw: {
      runtimes: [
        {
          mf: {
            getWorker: (name: string) => {
              calls.push({ method: 'getWorker', name });
              return Promise.resolve({
                coverage: () => Promise.resolve(counts),
              });
            },
          },
        },
      ],
    },
  };
  const start = ((input: Input) => {
    calls.push({ method: 'start', input });
    return Promise.resolve(worker);
  }) as unknown as StartWorker;
  return { calls, start, worker };
}

/** A coverage folder holding the door's instrumented build. */
function coverageDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'covered-start-worker-'));
  const build = join(dir, 'build', buildKey(DOOR_CONFIG, REPO));
  mkdirSync(join(build, 'instrumented'), { recursive: true });
  writeFileSync(
    join(build, 'worker.json'),
    JSON.stringify({ name: 'yawelo-idle-door' }),
  );
  writeFileSync(join(build, 'instrumented', 'index.js'), '');
  writeFileSync(join(build, 'instrumented', 'index.js.map'), '{}');
  return dir;
}

const INPUT = {
  config: DOOR_CONFIG,
  bindings: { A: { type: 'plain_text', value: '1' } },
  dev: { watch: false, inspector: false },
} as unknown as Input;

describe('coveredStartWorker', () => {
  it('is unstable_startWorker unchanged when no coverage folder is set', async () => {
    const { calls, start, worker } = fakeStart('{}');
    const started = await coveredStartWorker(INPUT, { start, dir: undefined });
    expect(started).toBe(worker);
    expect(calls).toEqual([{ method: 'start', input: INPUT }]);
  });

  it('starts the Worker from its instrumented build, unbundled, keeping every other option', async () => {
    const { calls, start } = fakeStart('{}');
    const dir = coverageDir();
    await coveredStartWorker(INPUT, { start, dir });
    const instrumented = join(dir, 'build', KEY, 'instrumented');
    expect(calls).toEqual([
      {
        method: 'start',
        input: {
          ...INPUT,
          entrypoint: join(instrumented, 'index.js'),
          build: {
            bundle: false,
            findAdditionalModules: true,
            moduleRoot: instrumented,
          },
        },
      },
    ]);
  });

  it('refuses a Worker with no instrumented build, naming the config and the build command', () => {
    const { start } = fakeStart('{}');
    const dir = mkdtempSync(join(tmpdir(), 'covered-start-worker-'));
    expect(() => coveredStartWorker(INPUT, { start, dir })).toThrow(
      'no instrumented build for apps/door/wrangler.jsonc: run node scripts/worker-coverage-build.ts',
    );
  });

  it('refuses a Worker named by no config, which has no build to serve', () => {
    const { start } = fakeStart('{}');
    expect(() =>
      coveredStartWorker({ ...INPUT, config: undefined } as Input, {
        start,
        dir: coverageDir(),
      }),
    ).toThrow('a counted Worker is started from its config');
  });

  it('saves the Worker counts under its build key before it is disposed', async () => {
    const { calls, start } = fakeStart('{"door.ts":{}}');
    const dir = coverageDir();
    const started = await coveredStartWorker(INPUT, { start, dir });
    await started.dispose();
    expect(calls.slice(1)).toEqual([
      { method: 'getWorker', name: 'yawelo-idle-door' },
      { method: 'dispose' },
    ]);
    const raw = join(dir, 'raw', KEY);
    const files = readdirSync(raw);
    expect(files).toHaveLength(1);
    expect(readFileSync(join(raw, files[0] ?? ''), 'utf8')).toBe(
      '{"door.ts":{}}',
    );
  });
});
