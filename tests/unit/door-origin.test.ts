import { describe, expect, it, vi } from 'vitest';
import {
  DOOR_HOST_HEADER,
  DOOR_SECRET_HEADER,
  DOORS,
} from '../../apps/door/worker/door';
import { doorOf, type Equal } from '../../apps/door/worker/origin';

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
