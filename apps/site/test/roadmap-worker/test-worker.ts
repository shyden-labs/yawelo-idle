/**
 * The site Worker as the roadmap tests run it (#341), in wrangler's own
 * harness (#506): the real handler and the real `Roadmap`, with two test-only
 * changes no deploy has. Its config, wrangler.roadmap-test.jsonc, is held
 * equal to wrangler.jsonc but for name and main.
 *
 * - Every `fetch` to api.github.com goes to the fake GitHub the test file runs
 *   in Node (`TEST_FAKE_GITHUB`, its address), carrying the address it was
 *   meant for, so nothing reaches GitHub and the fake judges what GitHub would.
 * - `Roadmap.now()` reads a clock a test sets (`setClock`), kept in the
 *   object's own storage so an eviction cannot reset it; unset, it is the
 *   real clock.
 * - A fetch or a cron event finishes once its `waitUntil` work has settled.
 * - `verifySignature` is callable over RPC, so its tests run it where it
 *   runs: `crypto.subtle.timingSafeEqual` is workerd's, not Node's.
 */
import { env, WorkerEntrypoint } from 'cloudflare:workers';
import site, { Roadmap as SiteRoadmap } from '../../worker/index';
import { verifySignature } from '../../worker/webhook';
import { MEANT_FOR } from '../github-fake/contract';

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const meant = new URL(request.url);
  if (meant.hostname !== 'api.github.com') return realFetch(request);
  const fake = (env as { TEST_FAKE_GITHUB?: string }).TEST_FAKE_GITHUB;
  if (fake === undefined)
    throw new Error('TEST_FAKE_GITHUB is not set: no request may reach GitHub');
  const forwarded = new Request(
    new URL(`${meant.pathname}${meant.search}`, fake),
    request,
  );
  forwarded.headers.set(MEANT_FOR, request.url);
  return realFetch(forwarded);
};

const CLOCK = 'test-clock';

export class Roadmap extends SiteRoadmap {
  override now(): number {
    return this.ctx.storage.kv.get<number>(CLOCK) ?? super.now();
  }

  /** Moves this object's clock to `at` (ms since the epoch). */
  setClock(at: number): void {
    this.ctx.storage.kv.put(CLOCK, at);
  }
}

/**
 * `ctx` with every `waitUntil` promise also collected, so the handler below
 * can finish only once that work has settled, as `waitOnExecutionContext`
 * let the in-workerd tests wait: a test then reads what a webhook's read did,
 * or that it did nothing, with no poll.
 */
function tracking(ctx: ExecutionContext): {
  ctx: ExecutionContext;
  settled: () => Promise<unknown>;
} {
  const pending: Promise<unknown>[] = [];
  const tracked = new Proxy(ctx, {
    get(target, key) {
      if (key === 'waitUntil')
        return (promise: Promise<unknown>) => {
          pending.push(promise);
          target.waitUntil(promise);
        };
      const value: unknown = Reflect.get(target, key);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return { ctx: tracked, settled: () => Promise.allSettled(pending) };
}

type SiteEnv = Parameters<typeof site.fetch>[1];

export default class TestSite extends WorkerEntrypoint<SiteEnv> {
  override async fetch(request: Request): Promise<Response> {
    const work = tracking(this.ctx);
    const response = await site.fetch(
      request as Parameters<typeof site.fetch>[0],
      this.env,
      work.ctx,
    );
    await work.settled();
    return response;
  }

  override async scheduled(controller: ScheduledController): Promise<void> {
    const work = tracking(this.ctx);
    site.scheduled(controller, this.env, work.ctx);
    await work.settled();
  }

  verifySignature(
    ...args: Parameters<typeof verifySignature>
  ): ReturnType<typeof verifySignature> {
    return verifySignature(...args);
  }
}
