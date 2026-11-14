import { describe, it } from 'vitest';
import type {
  HapticStrength,
  Outcome,
  Platform,
  PLATFORM_MEMBERS,
} from '../src/platform';

/**
 * The contract every Platform implementation passes (#124 AC2): the web one
 * here, the Electron and Capacitor ones in M7. Each check is named after the
 * member it judges and fails with that member's name first, so an incomplete
 * implementation is reported by what it lacks.
 */

/** Plays the host's part: what a real browser or shell would do. */
export interface LifecycleDriver {
  /** The page becomes hidden (and the host says so). */
  hide(): void;
  /** The page becomes visible (and the host says so). */
  show(): void;
  /** The host announces that the page is being put away. */
  pageHide(): void;
}

export interface ContractSubject {
  readonly platform: Platform;
  readonly driver: LifecycleDriver;
}

type Member = (typeof PLATFORM_MEMBERS)[number];

export interface ContractCheck {
  readonly member: Member;
  readonly name: string;
  run(subject: ContractSubject): Promise<void>;
}

class ContractFailure extends Error {
  override name = 'ContractFailure';
}

const fail = (member: Member, what: string): never => {
  throw new ContractFailure(`${member}: ${what}`);
};

/** Runs `body`, reporting anything it throws under `member`'s name. */
async function judged(
  member: Member,
  body: () => Promise<void> | void,
): Promise<void> {
  try {
    await body();
  } catch (error) {
    if (error instanceof ContractFailure) throw error;
    fail(member, `threw ${String(error)}`);
  }
}

const sameBytes = (a: Uint8Array | undefined, b: readonly number[]): boolean =>
  a instanceof Uint8Array &&
  a.length === b.length &&
  a.every((value, index) => value === b[index]);

function assertOutcome(member: Member, call: string, value: unknown): void {
  const outcome = value as Partial<Outcome> | undefined;
  if (outcome?.done === true) return;
  if (
    outcome?.done === false &&
    'reason' in outcome &&
    typeof outcome.reason === 'string' &&
    outcome.reason.trim() !== ''
  )
    return;
  fail(
    member,
    `${call} returned ${JSON.stringify(value)}, not { done: true } or { done: false, reason: <why> }`,
  );
}

const STRENGTHS: readonly HapticStrength[] = ['light', 'medium', 'heavy'];

export const PLATFORM_CONTRACT: readonly ContractCheck[] = [
  {
    member: 'storage',
    name: 'stored bytes read back byte for byte',
    run: ({ platform }) =>
      judged('storage', async () => {
        await platform.storage.set('save', new Uint8Array([0, 1, 127, 255]));
        const read = await platform.storage.get('save');
        if (!sameBytes(read, [0, 1, 127, 255]))
          fail('storage', `read back ${String(read)}, not 0,1,127,255`);
      }),
  },
  {
    member: 'storage',
    name: 'a key never stored reads as undefined',
    run: ({ platform }) =>
      judged('storage', async () => {
        const read = await platform.storage.get('never-stored');
        if (read !== undefined)
          fail('storage', `a missing key read ${String(read)}`);
      }),
  },
  {
    member: 'storage',
    name: 'a second set replaces the first',
    run: ({ platform }) =>
      judged('storage', async () => {
        await platform.storage.set('save', new Uint8Array([1]));
        await platform.storage.set('save', new Uint8Array([2, 3]));
        const read = await platform.storage.get('save');
        if (!sameBytes(read, [2, 3]))
          fail('storage', `after two sets read ${String(read)}, not 2,3`);
      }),
  },
  {
    member: 'storage',
    name: 'changing the bytes after set leaves the stored copy alone',
    run: ({ platform }) =>
      judged('storage', async () => {
        const bytes = new Uint8Array([4, 5]);
        await platform.storage.set('save', bytes);
        bytes[0] = 9;
        const read = await platform.storage.get('save');
        if (!sameBytes(read, [4, 5]))
          fail('storage', `the stored copy changed to ${String(read)}`);
      }),
  },
  {
    member: 'storage',
    name: 'delete removes a key, and keys lists the rest sorted',
    run: ({ platform }) =>
      judged('storage', async () => {
        await platform.storage.set('b', new Uint8Array([1]));
        await platform.storage.set('a', new Uint8Array([1]));
        await platform.storage.set('c', new Uint8Array([1]));
        await platform.storage.delete('b');
        const keys = await platform.storage.keys();
        if (JSON.stringify(keys) !== JSON.stringify(['a', 'c']))
          fail('storage', `keys after delete were ${JSON.stringify(keys)}`);
        if ((await platform.storage.get('b')) !== undefined)
          fail('storage', 'a deleted key still reads');
      }),
  },
  {
    member: 'notifications',
    name: 'schedule and cancel each say what they did',
    run: ({ platform }) =>
      judged('notifications', async () => {
        assertOutcome(
          'notifications',
          'schedule',
          await platform.notifications.schedule({
            id: 'journey-back',
            title: 'Back from the journey',
            body: 'Your traveller has returned.',
            atMs: 1_800_000_000_000,
          }),
        );
        assertOutcome(
          'notifications',
          'cancel',
          await platform.notifications.cancel('journey-back'),
        );
      }),
  },
  {
    member: 'achievements',
    name: 'unlock says what it did',
    run: ({ platform }) =>
      judged('achievements', async () => {
        assertOutcome(
          'achievements',
          'unlock',
          await platform.achievements.unlock('first-word'),
        );
      }),
  },
  {
    member: 'entitlements',
    name: 'regions are distinct positive integers, ascending, region 1 first',
    run: ({ platform }) =>
      judged('entitlements', () => {
        const regions = platform.entitlements.regions();
        const valid =
          Array.isArray(regions) &&
          regions[0] === 1 &&
          regions.every(
            (region, index) =>
              Number.isInteger(region) &&
              (index === 0 || region > (regions[index - 1] ?? Infinity)),
          );
        if (!valid)
          fail('entitlements', `regions were ${JSON.stringify(regions)}`);
      }),
  },
  {
    member: 'share',
    name: 'share says what it did',
    run: ({ platform }) =>
      judged('share', async () => {
        assertOutcome(
          'share',
          'share',
          await platform.share.share({
            title: 'Yawelo Idle',
            text: 'A word learned today.',
            url: 'https://yawelo-idle.shyden.co.uk/',
          }),
        );
      }),
  },
  {
    member: 'haptics',
    name: 'pulse says what it did, at once, for every strength',
    run: ({ platform }) =>
      judged('haptics', () => {
        for (const strength of STRENGTHS)
          assertOutcome(
            'haptics',
            `pulse('${strength}')`,
            platform.haptics.pulse(strength),
          );
      }),
  },
  {
    member: 'lifecycle',
    name: 'visibility is delivered once per change, and not when nothing changed',
    run: ({ platform, driver }) =>
      judged('lifecycle', () => {
        const seen: boolean[] = [];
        const stop = platform.lifecycle.onVisibility((visible) => {
          seen.push(visible);
        });
        driver.hide();
        driver.hide();
        driver.show();
        driver.show();
        driver.hide();
        stop();
        if (JSON.stringify(seen) !== JSON.stringify([false, true, false]))
          fail(
            'lifecycle',
            `hide, hide, show, show, hide delivered ${JSON.stringify(seen)}, not [false,true,false]`,
          );
      }),
  },
  {
    member: 'lifecycle',
    name: 'an unsubscribed visibility listener hears nothing more, and a second unsubscribe is harmless',
    run: ({ platform, driver }) =>
      judged('lifecycle', () => {
        const seen: boolean[] = [];
        const stop = platform.lifecycle.onVisibility((visible) => {
          seen.push(visible);
        });
        driver.hide();
        stop();
        stop();
        driver.show();
        if (JSON.stringify(seen) !== JSON.stringify([false]))
          fail(
            'lifecycle',
            `after unsubscribing it still heard ${JSON.stringify(seen)}`,
          );
      }),
  },
  {
    member: 'lifecycle',
    name: 'page hide is delivered once per event until unsubscribed',
    run: ({ platform, driver }) =>
      judged('lifecycle', () => {
        let heard = 0;
        const stop = platform.lifecycle.onPageHide(() => {
          heard += 1;
        });
        driver.pageHide();
        driver.pageHide();
        stop();
        driver.pageHide();
        if (heard !== 2)
          fail(
            'lifecycle',
            `two page hides, then one unsubscribed, heard ${String(heard)}`,
          );
      }),
  },
];

/**
 * Registers one test per contract check against `make`, which builds a fresh
 * subject for each check.
 */
export function describePlatformContract(
  name: string,
  make: () => ContractSubject | Promise<ContractSubject>,
): void {
  describe(`${name} passes the Platform contract (#124 AC2)`, () => {
    it.each(
      PLATFORM_CONTRACT.map(
        (check) => [`${check.member}: ${check.name}`, check] as const,
      ),
    )('%s', async (_label, check) => {
      await check.run(await make());
    });
  });
}
