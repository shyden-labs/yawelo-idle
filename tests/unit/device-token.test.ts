import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  TOKEN_BYTES,
  authenticate,
  hashToken,
  newToken,
  registrationBody,
  sameHash,
  type FindPlayer,
  type RandomSource,
} from '../../apps/sync-worker/src/devices';

/**
 * Device identity (#163; spec §6.6, D6): the pure parts of registration and
 * authentication, run in Node. The route and its D1 rows are the sync
 * Worker's harness tests (apps/sync-worker/test/devices.test.ts).
 */

/** A random source that fills every byte with `value`. */
const filled =
  (value: number): RandomSource =>
  (bytes) =>
    bytes.fill(value);

describe('a device token (#163 AC1)', () => {
  it('carries 32 random bytes, as unpadded base64url', () => {
    expect(newToken(filled(0xff))).toBe(
      Buffer.alloc(32, 0xff).toString('base64url'),
    );
  });

  it('reads all 32 bytes from the random source', () => {
    let asked = 0;
    newToken((bytes) => {
      asked = bytes.length;
      return bytes.fill(0);
    });
    expect(asked).toBe(TOKEN_BYTES);
  });

  it('differs from call to call by default', () => {
    expect(newToken()).not.toBe(newToken());
  });
});

describe('the stored token hash (#163 AC1)', () => {
  it('is the SHA-256 of the token text, 32 bytes', async () => {
    const token = newToken(filled(7));
    expect(Buffer.from(await hashToken(token))).toEqual(
      createHash('sha256').update(token, 'utf8').digest(),
    );
  });
});

describe('sameHash (#163 AC2)', () => {
  const a = new Uint8Array(32).fill(1);

  it('matches equal hashes', () => {
    expect(sameHash(a, new Uint8Array(32).fill(1))).toBe(true);
  });

  it('refuses a hash that differs in its last byte', () => {
    const b = new Uint8Array(32).fill(1);
    b[31] = 2;
    expect(sameHash(a, b)).toBe(false);
  });

  it('refuses a hash of another length', () => {
    expect(sameHash(a, new Uint8Array(31).fill(1))).toBe(false);
  });

  it('refuses a longer hash that starts with the same bytes', () => {
    expect(sameHash(a, new Uint8Array(33).fill(1))).toBe(false);
  });
});

describe('a registration body (#163 AC3)', () => {
  it('accepts an empty object', () => {
    expect(registrationBody.safeParse({}).success).toBe(true);
  });

  it('refuses any field, so nothing personal is ever taken', () => {
    expect(registrationBody.safeParse({ name: 'Ana' }).success).toBe(false);
  });
});

describe('authenticate (#163 AC2)', () => {
  const token = (): string => newToken(filled(9));
  const find: FindPlayer = async (hash) => {
    const stored = await hashToken(token());
    return sameHash(hash, stored) ? 'player-1' : null;
  };

  it('finds the player of a known token', async () => {
    expect(await authenticate(`Bearer ${token()}`, find)).toEqual({
      ok: true,
      playerId: 'player-1',
    });
  });

  /** The status and body of a refused authorisation. */
  const refusal = async (authorization: string | null) => {
    const result = await authenticate(authorization, find);
    if (result.ok) throw new Error('was not refused');
    return [result.response.status, await result.response.text()];
  };

  it('refuses a wrong token with 401', async () => {
    expect((await refusal(`Bearer ${newToken(filled(1))}`))[0]).toBe(401);
  });

  it('answers a missing token exactly as a wrong one', async () => {
    expect(await refusal(null)).toEqual(
      await refusal(`Bearer ${newToken(filled(1))}`),
    );
  });

  it('answers a non-Bearer header exactly as a wrong token', async () => {
    expect(await refusal(`Basic ${token()}`)).toEqual(
      await refusal(`Bearer ${newToken(filled(1))}`),
    );
  });

  // A scheme as long as "Bearer " that is not Bearer: the token after it is
  // the right one, so only reading the scheme refuses it.
  it('refuses the right token behind another 7-character scheme', async () => {
    expect(await refusal(`Token1 ${token()}`)).toEqual(
      await refusal(`Bearer ${newToken(filled(1))}`),
    );
  });
});
