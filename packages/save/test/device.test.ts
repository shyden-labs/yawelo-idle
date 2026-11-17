import { describe, expect, it } from 'vitest';
import {
  DEVICE_KEY,
  ensureDevice,
  type DeviceIdentity,
  type IdentityStorage,
} from '../src/device';

/**
 * The device keeps its identity and registers only when it has none
 * (#163 AC5): storage and registration stood in.
 */

const ME: DeviceIdentity = { playerId: 'player-1', token: 'a'.repeat(43) };

/** A storage that starts with `initial` under the device key, if given. */
function memory(initial?: Uint8Array): IdentityStorage & {
  readonly kept: Map<string, Uint8Array>;
} {
  const kept = new Map<string, Uint8Array>();
  if (initial !== undefined) kept.set(DEVICE_KEY, initial);
  return {
    kept,
    get: (key) => Promise.resolve(kept.get(key)),
    set: (key, bytes) => {
      kept.set(key, bytes);
      return Promise.resolve();
    },
  };
}

const bytesOf = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value));

/** A registration that counts its calls and answers `ME`. */
function counting() {
  let calls = 0;
  return {
    register: () => {
      calls += 1;
      return Promise.resolve(ME);
    },
    calls: () => calls,
  };
}

describe('ensureDevice (#163 AC5)', () => {
  it('registers once when nothing is kept, and keeps what it got', async () => {
    const storage = memory();
    const { register, calls } = counting();
    expect(await ensureDevice(storage, register)).toEqual(ME);
    expect({
      calls: calls(),
      kept: JSON.parse(
        new TextDecoder().decode(storage.kept.get(DEVICE_KEY)),
      ) as unknown,
    }).toEqual({ calls: 1, kept: ME });
  });

  it('uses the kept identity without registering again', async () => {
    const { register, calls } = counting();
    const kept = { playerId: 'player-7', token: 'b'.repeat(43) };
    expect(await ensureDevice(memory(bytesOf(kept)), register)).toEqual(kept);
    expect(calls()).toBe(0);
  });

  it('registers again when what is kept is not an identity', async () => {
    const { register, calls } = counting();
    expect(
      await ensureDevice(memory(bytesOf({ playerId: 'p' })), register),
    ).toEqual(ME);
    expect(calls()).toBe(1);
  });

  it('registers again when what is kept is not JSON', async () => {
    const { register, calls } = counting();
    await ensureDevice(memory(new Uint8Array([0xff, 0x00])), register);
    expect(calls()).toBe(1);
  });
});
