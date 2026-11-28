import { describe, expect, it, vi } from 'vitest';
import { privateJudge } from '../api/judge';
import { MAX_HOOK_BYTES } from './body';
import worker from './index';
import { HOOK_PATH } from './routes';

/**
 * The webhook's 413 against the private spec (#1107), in-process. The site
 * Worker's own `fetch` answers a body over 1 MiB, so the response judged is
 * the one the Worker builds, with no socket between: over the local harness
 * socket the server could close before the client finished sending
 * (`UND_ERR_SOCKET`, PR #1117's sonar-coverage run 45723745139), which is why
 * test/roadmap/private-contract.test.ts no longer sends one.
 */

// The roadmap's Durable Object class is the only workerd module the Worker
// imports; the hook never reaches it, so a bare stand-in is enough here.
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    readonly ctx: unknown;
    readonly env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

type Fetch = typeof worker.fetch;
type Env = Parameters<Fetch>[1];
type Context = Parameters<Fetch>[2];

/** The site Worker before the doors go live: the hook needs nothing else to refuse a size. */
const env = { DOOR_REQUIRED: 'false' } as unknown as Env;
const ctx = {} as Context;
const URL_OF_HOOK = `https://dev.yaweloidle.com${HOOK_PATH}`;

const CHUNK = 65_536;

/** A body with no declared length, `chunks` chunks of 64 KiB. */
const streamOf = (chunks: number): ReadableStream<Uint8Array> => {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === chunks) controller.close();
      else {
        sent += 1;
        controller.enqueue(new Uint8Array(CHUNK).fill(120));
      }
    },
  });
};

const post = (init: RequestInit): Promise<Response> =>
  worker.fetch(
    new Request(URL_OF_HOOK, {
      method: 'POST',
      ...init,
    }) as Parameters<Fetch>[0],
    env,
    ctx,
  );

describe('POST /hooks/github over 1 MiB, judged against the private spec (#1107)', () => {
  it('answers 413 as the spec says to a body with no declared length', async () => {
    const response = await post({
      body: streamOf(MAX_HOOK_BYTES / CHUNK + 1),
      duplex: 'half',
    } as RequestInit);
    expect(response.status).toBe(413);
    expect(await privateJudge.judged(HOOK_PATH, 'post', response)).toEqual([]);
  });

  it('answers 413 as the spec says to a declared length over the cap', async () => {
    const response = await post({
      body: 'x',
      headers: { 'Content-Length': String(MAX_HOOK_BYTES + 1) },
    });
    expect(response.status).toBe(413);
    expect(await privateJudge.judged(HOOK_PATH, 'post', response)).toEqual([]);
  });
});
