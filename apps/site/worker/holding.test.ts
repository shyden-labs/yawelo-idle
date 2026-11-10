import { describe, expect, it, vi } from 'vitest';
import { DOOR_SECRET_HEADER } from '../../door/worker/door';
import { serveHolding, type HoldingEnv } from './holding';

/**
 * The holding page's dev copy behind its door (#784 AC4), with its files
 * stood in: the real Worker in front of its real door is proved in
 * apps/door/test/door-in-front.test.ts.
 */
const SECRET = 'the-dev-door-secret';

/** A byte-for-byte comparison, standing in for the runtime's. */
const sameBytes = (a: ArrayBuffer, b: ArrayBuffer): boolean =>
  new Uint8Array(a).join() === new Uint8Array(b).join();

const page = (): Response => new Response('<html>holding</html>');

const holding = (vars: Omit<HoldingEnv, 'ASSETS'>) => {
  const fetch = vi.fn((_request: Request) => Promise.resolve(page()));
  return { env: { ...vars, ASSETS: { fetch } }, fetch };
};

const request = (headers: Record<string, string> = {}): Request =>
  new Request('https://yawelo-idle-holding-dev.example/', { headers });

describe('serveHolding (#784 AC4)', () => {
  const live = { DOOR_REQUIRED: 'true', DOOR_SECRET: SECRET };

  it('serves its files to a request carrying the door secret, the request untouched', async () => {
    const { env, fetch } = holding(live);
    const admitted = request({ [DOOR_SECRET_HEADER]: SECRET });
    const response = await serveHolding(admitted, env, sameBytes);
    expect({
      status: response.status,
      body: await response.text(),
      passed: fetch.mock.calls.map(([sent]) => sent),
    }).toEqual({
      status: 200,
      body: '<html>holding</html>',
      passed: [admitted],
    });
  });

  it('refuses a request without the secret, 403, never reaching its files', async () => {
    const { env, fetch } = holding(live);
    const response = await serveHolding(request(), env, sameBytes);
    expect({
      status: response.status,
      body: await response.text(),
      files: fetch.mock.calls.length,
    }).toEqual({ status: 403, body: 'forbidden', files: 0 });
  });

  it('refuses a request with a wrong secret, 403, never reaching its files', async () => {
    const { env, fetch } = holding(live);
    const response = await serveHolding(
      request({ [DOOR_SECRET_HEADER]: 'not-the-secret' }),
      env,
      sameBytes,
    );
    expect({ status: response.status, files: fetch.mock.calls.length }).toEqual(
      { status: 403, files: 0 },
    );
  });

  it('serves every request while DOOR_REQUIRED is "false", before the go-live', async () => {
    const { env, fetch } = holding({ DOOR_REQUIRED: 'false' });
    const response = await serveHolding(request(), env, sameBytes);
    expect({ status: response.status, files: fetch.mock.calls.length }).toEqual(
      { status: 200, files: 1 },
    );
  });
});
