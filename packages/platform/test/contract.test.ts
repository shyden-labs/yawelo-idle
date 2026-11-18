import { describe, expect, it } from 'vitest';
import {
  PLATFORM_CONTRACT,
  type ContractCheck,
  type ContractSubject,
} from '../contract/index';
import { PLATFORM_MEMBERS, type Platform } from '../src/platform';

/**
 * The contract catches an incomplete implementation, and names what it lacks
 * (#124 AC2). Two fakes: one with no members at all, and one with every
 * member present but each wrong in the way a hurried shell might be.
 */

const noDriver = { hide() {}, show() {}, pageHide() {} };

/** No members at all. */
const empty = (): ContractSubject => ({
  platform: {} as Platform,
  driver: noDriver,
});

/** Every member present, each one wrong. */
function nearMiss(): ContractSubject {
  const store = new Map<string, Uint8Array>();
  const visibility = new Set<(visible: boolean) => void>();
  const pageHide = new Set<() => void>();
  const silent = { done: false, reason: '' } as const;
  return {
    platform: {
      storage: {
        // Loses the first byte, reads a missing key as empty, never
        // deletes, and lists keys in the order they were written.
        get: (key) =>
          Promise.resolve(store.get(key)?.slice(1) ?? new Uint8Array()),
        set: (key, bytes) => {
          store.set(key, bytes);
          return Promise.resolve();
        },
        delete: () => Promise.resolve(),
        keys: () => Promise.resolve([...store.keys()]),
      },
      notifications: {
        schedule: () => Promise.resolve(silent),
        cancel: () => Promise.resolve(silent),
      },
      achievements: { unlock: () => Promise.resolve(silent) },
      entitlements: { regions: () => [2, 1] },
      share: { share: () => Promise.resolve(silent) },
      haptics: { pulse: () => silent },
      lifecycle: {
        // Forwards every event, changed or not, and never unsubscribes.
        onVisibility: (listener) => {
          visibility.add(listener);
          return () => undefined;
        },
        onPageHide: (listener) => {
          pageHide.add(listener);
          return () => undefined;
        },
      },
    },
    driver: {
      hide: () => {
        for (const listener of visibility) listener(false);
      },
      show: () => {
        for (const listener of visibility) listener(true);
      },
      pageHide: () => {
        for (const listener of pageHide) listener();
      },
    },
  };
}

const cases = PLATFORM_CONTRACT.map(
  (check) => [`${check.member}: ${check.name}`, check] as const,
);

describe('the contract fails a platform with no members, naming the member (#124 AC2)', () => {
  it.each(cases)('%s', async (_label, check: ContractCheck) => {
    await expect(check.run(empty())).rejects.toThrow(
      new RegExp(`^${check.member}: `),
    );
  });
});

describe('the contract fails a platform whose every member is wrong, naming the member (#124 AC2)', () => {
  it.each(cases)('%s', async (_label, check: ContractCheck) => {
    await expect(check.run(nearMiss())).rejects.toThrow(
      new RegExp(`^${check.member}: `),
    );
  });
});

describe('the contract judges all seven members (#124 AC1)', () => {
  it('has at least one check for each member, in the spec’s order', () => {
    const judged = [...new Set(PLATFORM_CONTRACT.map(({ member }) => member))];
    expect(judged).toEqual([...PLATFORM_MEMBERS]);
  });
});
