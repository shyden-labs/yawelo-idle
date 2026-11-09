import { describe, expect, it, vi } from 'vitest';
import {
  DOOR_HOST_HEADER,
  DOOR_SECRET_HEADER,
  DOORS,
} from '../../apps/door/worker/door';
import { doorOf, refusal, type Equal } from '../../apps/door/worker/origin';

/**
 * How an origin knows a request came through its door (#784 AC4): the door
 * secret it carries matches the origin's own, and only then is the door's
 * name believed. The comparison is the runtime's constant-time one, handed
 * the SHA-256 digest of each side so it always sees two 32-byte values,
 * whatever a caller sent. Here it is mocked with a plain byte comparison.
 * Door hosts come from DOORS, never written out (#784 AC1b).
 */

const SECRET = 'the-dev-door-secret';
const [SITE_DEV] = [...DOORS.keys()];
if (SITE_DEV === undefined) throw new Error('no doors');

const sameBytes: Equal = (a, b) => {
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  return (
    left.length === right.length && left.every((byte, i) => byte === right[i])
  );
};

const request = (headers: Record<string, string>) =>
  new Request('https://origin.example.workers.dev/', { headers });

const through = (secret: string, door: string = SITE_DEV) =>
  request({ [DOOR_SECRET_HEADER]: secret, [DOOR_HOST_HEADER]: door });

describe('a request through the door (#784 AC4)', () => {
  it('is believed, naming its door, when its secret matches', async () => {
    expect(await doorOf(through(SECRET), SECRET, sameBytes)).toBe(SITE_DEV);
  });

  it('compares the two secrets’ SHA-256 digests, 32 bytes each, never the secrets', async () => {
    const equal = vi.fn<Equal>(sameBytes);
    await doorOf(through('short'), SECRET, equal);
    expect(equal).toHaveBeenCalledOnce();
    const [given, own] = equal.mock.calls[0] ?? [];
    expect(new Uint8Array(given ?? new ArrayBuffer(0)).length).toBe(32);
    expect(new Uint8Array(own ?? new ArrayBuffer(0)).length).toBe(32);
  });
});

describe('a request not believed (#784 AC4)', () => {
  it('is refused when its secret is wrong', async () => {
    expect(await doorOf(through('not-it'), SECRET, sameBytes)).toBeUndefined();
  });

  it('is refused when it carries no secret', async () => {
    expect(
      await doorOf(
        request({ [DOOR_HOST_HEADER]: SITE_DEV }),
        SECRET,
        sameBytes,
      ),
    ).toBeUndefined();
  });

  it('is refused when it carries no secret, whatever text the origin’s secret is', async () => {
    expect(
      await doorOf(
        request({ [DOOR_HOST_HEADER]: SITE_DEV }),
        'null',
        sameBytes,
      ),
    ).toBeUndefined();
  });

  it('is refused when the origin has no secret', async () => {
    expect(await doorOf(through(SECRET), undefined, sameBytes)).toBeUndefined();
  });

  it('is refused when the origin’s secret is empty, even sent empty', async () => {
    expect(await doorOf(through(''), '', sameBytes)).toBeUndefined();
  });

  it('is refused when the secret matches but no door is named', async () => {
    expect(
      await doorOf(
        request({ [DOOR_SECRET_HEADER]: SECRET }),
        SECRET,
        sameBytes,
      ),
    ).toBeUndefined();
  });
});

/**
 * Each origin answers only through its door once the doors are live (#784
 * AC4; Shyden, 2026-11-09: TEST and DEV refuse a request without the secret,
 * 403). Until the go-live on 2026-11-15 the deploy sets DOOR_REQUIRED to
 * "false", so today's dev addresses keep working; any other value, or none,
 * requires the door, so a forgotten setting fails closed.
 */
describe('refusal (#784 AC4)', () => {
  const live = { DOOR_REQUIRED: 'true', DOOR_SECRET: SECRET };

  it('admits a request through the door, its secret matching', async () => {
    expect(await refusal(through(SECRET), live, sameBytes)).toBeUndefined();
  });

  it('admits a request with the secret that names no door, as CI sends', async () => {
    expect(
      await refusal(request({ [DOOR_SECRET_HEADER]: SECRET }), live, sameBytes),
    ).toBeUndefined();
  });

  it('refuses a request with no secret, 403, never stored', async () => {
    const refused = await refusal(request({}), live, sameBytes);
    expect(refused?.status).toBe(403);
    expect(refused?.headers.get('cache-control')).toBe('no-store');
    expect(await refused?.text()).toBe('forbidden');
  });

  it('refuses a request with the wrong secret, 403', async () => {
    expect((await refusal(through('not-it'), live, sameBytes))?.status).toBe(
      403,
    );
  });

  it('requires the door when DOOR_REQUIRED is unset', async () => {
    expect(
      (await refusal(request({}), { DOOR_SECRET: SECRET }, sameBytes))?.status,
    ).toBe(403);
  });

  it('requires the door for any value but exactly "false"', async () => {
    expect(
      (
        await refusal(
          request({}),
          { DOOR_REQUIRED: 'FALSE', DOOR_SECRET: SECRET },
          sameBytes,
        )
      )?.status,
    ).toBe(403);
  });

  it('admits every request while DOOR_REQUIRED is "false", before the go-live', async () => {
    expect(
      await refusal(request({}), { DOOR_REQUIRED: 'false' }, sameBytes),
    ).toBeUndefined();
  });

  it('answers 500 naming DOOR_SECRET when the door is required and the origin has none', async () => {
    const refused = await refusal(
      through(SECRET),
      { DOOR_REQUIRED: 'true' },
      sameBytes,
    );
    expect(refused?.status).toBe(500);
    expect(refused?.headers.get('cache-control')).toBe('no-store');
    expect(await refused?.text()).toBe('origin not configured: DOOR_SECRET');
  });

  it('answers 500 when the origin’s secret is empty, even sent empty', async () => {
    expect(
      (
        await refusal(
          through(''),
          { DOOR_REQUIRED: 'true', DOOR_SECRET: '' },
          sameBytes,
        )
      )?.status,
    ).toBe(500);
  });
});
