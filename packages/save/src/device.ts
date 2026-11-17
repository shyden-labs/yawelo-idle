import { z } from 'zod';

/**
 * The device's own identity (#163 AC5; spec §6.6): the `playerId` and token
 * the sync Worker gave this device when it registered, kept in the
 * platform's storage. The device registers only when it has none.
 */

/** What registration returned, and what is kept. */
export interface DeviceIdentity {
  readonly playerId: string;
  readonly token: string;
}

/** The platform storage this needs (`platform.storage`). */
export interface IdentityStorage {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, bytes: Uint8Array): Promise<void>;
}

/** The storage key the identity lives under. */
export const DEVICE_KEY = 'device';

const kept = z.strictObject({ playerId: z.string(), token: z.string() });

/** The identity kept in `bytes`, or undefined when they hold none. */
function read(bytes: Uint8Array | undefined): DeviceIdentity | undefined {
  if (bytes === undefined) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
  const parsed = kept.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

/**
 * This device's identity: the kept one, or a new registration, kept before
 * it is returned, when none is kept or what is kept is not an identity.
 */
export async function ensureDevice(
  storage: IdentityStorage,
  register: () => Promise<DeviceIdentity>,
): Promise<DeviceIdentity> {
  const known = read(await storage.get(DEVICE_KEY));
  if (known !== undefined) return known;
  const identity = await register();
  await storage.set(
    DEVICE_KEY,
    new TextEncoder().encode(JSON.stringify(identity)),
  );
  return identity;
}
