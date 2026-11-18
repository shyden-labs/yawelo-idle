import { describe, expect, it, vi } from 'vitest';
import {
  charactersLeft,
  counted,
  DAILY_CHARACTERS,
  LOCK_CEILING_MS,
  limitFor,
  parseLedger,
  QuotaRefused,
  quotaDay,
  withLock,
  type LedgerDeps,
  type LedgerPaths,
} from '../../scripts/google-ledger';

/**
 * The shared Google Cloud Translation ledger and lock (#638), kept the same
 * way by every project on this machine: characters per Google day (midnight
 * Pacific), never a request that would pass the day's limit, every write
 * atomic, and one read-back at a time under a lock. The file system, clock
 * and process table are stood in.
 */

const PATHS: LedgerPaths = {
  ledger: '/home/.config/shyden/google-translate-ledger.json',
  lock: '/home/.config/shyden/google-translate.lock',
};

const DAY = '2026-11-09';
/** 2026-11-10 01:00 WIB is 2026-11-09 10:00 in Los Angeles. */
const NOW = new Date('2026-11-09T18:00:00Z');

interface World {
  deps: LedgerDeps;
  files: Map<string, string>;
  slept: number[];
  renames: [string, string][];
}

/** An in-memory machine: files, a clock that moves only when slept, live pids. */
function world(
  files: Record<string, string> = {},
  live: readonly number[] = [],
): World {
  const map = new Map(Object.entries(files));
  const slept: number[] = [];
  const renames: [string, string][] = [];
  let clock = NOW.getTime();
  const deps: LedgerDeps = {
    pid: 4242,
    worktree: '/repos/yawelo-idle-638',
    now: () => new Date(clock),
    sleep: (ms) => {
      slept.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    alive: (pid) => live.includes(pid),
    read: (path) => Promise.resolve(map.get(path)),
    create: (path, text) => {
      if (map.has(path)) return Promise.resolve(false);
      map.set(path, text);
      return Promise.resolve(true);
    },
    write: (path, text) => {
      map.set(path, text);
      return Promise.resolve();
    },
    rename: (from, to) => {
      const text = map.get(from);
      if (text === undefined) throw new Error(`no ${from}`);
      map.delete(from);
      map.set(to, text);
      renames.push([from, to]);
      return Promise.resolve();
    },
    remove: (path) => {
      map.delete(path);
      return Promise.resolve();
    },
  };
  return { deps, files: map, slept, renames };
}

const ledger = (entries: Record<string, number>) => JSON.stringify(entries);
const holder = (pid: number) =>
  JSON.stringify({
    pid,
    worktree: '/repos/shyden.co.uk',
    started: '2026-11-09T17:59:00.000Z',
  });

describe('the Google day (#638)', () => {
  it('is the date in Los Angeles, not UTC or Jakarta', () => {
    expect(quotaDay(NOW)).toBe('2026-11-09');
  });

  it('turns at midnight Pacific', () => {
    expect(quotaDay(new Date('2026-11-10T08:00:00Z'))).toBe('2026-11-10');
  });

  it('has not turned a minute before', () => {
    expect(quotaDay(new Date('2026-11-10T07:59:00Z'))).toBe('2026-11-09');
  });
});

describe('the ledger file (#638 AC4)', () => {
  it('reads a day’s characters', () => {
    expect(parseLedger(ledger({ [DAY]: 120 }))).toEqual({ [DAY]: 120 });
  });

  it('reads a recorded raise of a day’s limit', () => {
    expect(
      parseLedger(ledger({ [DAY]: 120, [`${DAY} limit`]: 20_000 })),
    ).toEqual({ [DAY]: 120, [`${DAY} limit`]: 20_000 });
  });

  it('reads an empty file as an empty ledger', () => {
    expect(parseLedger('')).toEqual({});
  });

  it('refuses a fractional count, naming its key', () => {
    expect(() => parseLedger(ledger({ [DAY]: 1.5 }))).toThrow(
      `ledger: ${DAY} is not a whole number`,
    );
  });

  it('refuses a negative count', () => {
    expect(() => parseLedger(ledger({ [DAY]: -1 }))).toThrow(
      `ledger: ${DAY} is not a whole number`,
    );
  });

  it('refuses a count written as text', () => {
    expect(() => parseLedger('{"2026-11-09":"5"}')).toThrow(
      `ledger: ${DAY} is not a whole number`,
    );
  });

  it('refuses a key that is neither a day nor a day’s limit', () => {
    expect(() => parseLedger(ledger({ 'tomorrow limit': 5 }))).toThrow(
      'ledger: unknown key "tomorrow limit"',
    );
  });

  it('refuses a file that is not an object', () => {
    expect(() => parseLedger('[1]')).toThrow('ledger: not an object');
  });
});

describe('a day’s limit (#638 AC4)', () => {
  it('is 16,000 characters by default', () => {
    expect(limitFor({}, DAY)).toBe(DAILY_CHARACTERS);
    expect(DAILY_CHARACTERS).toBe(16_000);
  });

  it('is a recorded raise on its own day', () => {
    expect(limitFor({ [`${DAY} limit`]: 20_000 }, DAY)).toBe(20_000);
  });

  it('is the default again the next day', () => {
    expect(limitFor({ [`${DAY} limit`]: 20_000 }, '2026-11-10')).toBe(16_000);
  });

  it('leaves what is not yet spent', () => {
    expect(charactersLeft({ [DAY]: 15_000 }, DAY)).toBe(1_000);
  });

  it('leaves nothing, never less, once spent past it', () => {
    expect(charactersLeft({ [DAY]: 17_000 }, DAY)).toBe(0);
  });
});

describe('the lock (#638 AC2)', () => {
  it('is created exclusively, naming this run', async () => {
    const { deps, files } = world();
    let inside: string | undefined;
    await withLock(PATHS, deps, () => {
      inside = files.get(PATHS.lock);
      return Promise.resolve();
    });
    expect(JSON.parse(inside ?? '{}')).toEqual({
      pid: 4242,
      worktree: '/repos/yawelo-idle-638',
      started: NOW.toISOString(),
    });
  });

  it('is removed when the run ends', async () => {
    const { deps, files } = world();
    await withLock(PATHS, deps, () => Promise.resolve());
    expect(files.has(PATHS.lock)).toBe(false);
  });

  it('is removed when the run fails', async () => {
    const { deps, files } = world();
    await expect(
      withLock(PATHS, deps, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(files.has(PATHS.lock)).toBe(false);
  });

  it('waits for a live holder in one-second steps', async () => {
    const { deps, files, slept } = world({ [PATHS.lock]: holder(77) }, [77]);
    const sleep = deps.sleep;
    let steps = 0;
    deps.sleep = async (ms) => {
      steps += 1;
      if (steps === 3) files.delete(PATHS.lock);
      await sleep(ms);
    };
    await withLock(PATHS, deps, () => Promise.resolve());
    expect(slept).toEqual([1_000, 1_000, 1_000]);
  });

  it('gives up at ten minutes, naming the holder', async () => {
    const { deps, slept } = world({ [PATHS.lock]: holder(77) }, [77]);
    await expect(
      withLock(PATHS, deps, () => Promise.resolve()),
    ).rejects.toThrow(
      'google-translate.lock: held by pid 77 (/repos/shyden.co.uk, since 2026-11-09T17:59:00.000Z) for 10 minutes',
    );
    expect(slept.reduce((a, b) => a + b, 0)).toBe(LOCK_CEILING_MS);
    expect(LOCK_CEILING_MS).toBe(600_000);
  });

  it('never runs the work it gave up on', async () => {
    const { deps } = world({ [PATHS.lock]: holder(77) }, [77]);
    const work = vi.fn(() => Promise.resolve());
    await expect(withLock(PATHS, deps, work)).rejects.toThrow();
    expect(work).not.toHaveBeenCalled();
  });

  it('takes over a lock whose pid no longer runs, without waiting', async () => {
    const { deps, slept } = world({ [PATHS.lock]: holder(77) }, []);
    const work = vi.fn(() => Promise.resolve());
    await withLock(PATHS, deps, work);
    expect(work).toHaveBeenCalledOnce();
    expect(slept).toEqual([]);
  });

  it('takes over a lock it cannot read', async () => {
    const { deps } = world({ [PATHS.lock]: 'not json' }, []);
    const work = vi.fn(() => Promise.resolve());
    await withLock(PATHS, deps, work);
    expect(work).toHaveBeenCalledOnce();
  });
});

describe('a counted request (#638 AC3)', () => {
  it('sends, then adds its characters to the day', async () => {
    const { deps, files } = world({ [PATHS.ledger]: ledger({ [DAY]: 100 }) });
    const send = vi.fn(() => Promise.resolve('ok'));
    expect(await counted(PATHS, deps, 50, send)).toBe('ok');
    expect(JSON.parse(files.get(PATHS.ledger) ?? '')).toEqual({ [DAY]: 150 });
  });

  it('starts a day the ledger has not seen, keeping the others', async () => {
    const { deps, files } = world({
      [PATHS.ledger]: ledger({ '2026-11-08': 900 }),
    });
    await counted(PATHS, deps, 50, () => Promise.resolve('ok'));
    expect(JSON.parse(files.get(PATHS.ledger) ?? '')).toEqual({
      '2026-11-08': 900,
      [DAY]: 50,
    });
  });

  it('starts a ledger that does not exist yet', async () => {
    const { deps, files } = world();
    await counted(PATHS, deps, 50, () => Promise.resolve('ok'));
    expect(JSON.parse(files.get(PATHS.ledger) ?? '')).toEqual({ [DAY]: 50 });
  });

  it('writes through <ledger>.<pid>.tmp renamed over the ledger', async () => {
    const { deps, renames } = world();
    await counted(PATHS, deps, 50, () => Promise.resolve('ok'));
    expect(renames).toEqual([[`${PATHS.ledger}.4242.tmp`, PATHS.ledger]]);
  });

  it('reads the ledger again after sending, keeping what another run wrote meanwhile', async () => {
    const { deps, files } = world({ [PATHS.ledger]: ledger({ [DAY]: 100 }) });
    await counted(PATHS, deps, 50, () => {
      files.set(PATHS.ledger, ledger({ [DAY]: 1_000 }));
      return Promise.resolve('ok');
    });
    expect(JSON.parse(files.get(PATHS.ledger) ?? '')).toEqual({ [DAY]: 1_050 });
  });

  it('sends a request that reaches the limit exactly', async () => {
    const { deps } = world({ [PATHS.ledger]: ledger({ [DAY]: 15_950 }) });
    const send = vi.fn(() => Promise.resolve('ok'));
    await counted(PATHS, deps, 50, send);
    expect(send).toHaveBeenCalledOnce();
  });

  it('refuses a request that would pass the limit, sending nothing', async () => {
    const { deps, files } = world({
      [PATHS.ledger]: ledger({ [DAY]: 15_951 }),
    });
    const send = vi.fn(() => Promise.resolve('ok'));
    await expect(counted(PATHS, deps, 50, send)).rejects.toThrow(
      `Google read-back: 50 characters would pass ${DAY}'s limit of 16000 (15951 spent)`,
    );
    expect(send).not.toHaveBeenCalled();
    expect(JSON.parse(files.get(PATHS.ledger) ?? '')).toEqual({
      [DAY]: 15_951,
    });
  });

  it('honours a recorded raise when judging', async () => {
    const { deps } = world({
      [PATHS.ledger]: ledger({ [DAY]: 15_951, [`${DAY} limit`]: 20_000 }),
    });
    const send = vi.fn(() => Promise.resolve('ok'));
    await counted(PATHS, deps, 50, send);
    expect(send).toHaveBeenCalledOnce();
  });

  it('marks the day spent when Google refuses for quota, and says so', async () => {
    const { deps, files } = world({ [PATHS.ledger]: ledger({ [DAY]: 100 }) });
    await expect(
      counted(PATHS, deps, 50, () => Promise.reject(new QuotaRefused('403'))),
    ).rejects.toThrow(QuotaRefused);
    expect(JSON.parse(files.get(PATHS.ledger) ?? '')).toEqual({
      [DAY]: 16_000,
    });
  });

  it('still counts a request that failed another way, since Google may have read it', async () => {
    const { deps, files } = world({ [PATHS.ledger]: ledger({ [DAY]: 100 }) });
    await expect(
      counted(PATHS, deps, 50, () => Promise.reject(new Error('network'))),
    ).rejects.toThrow('network');
    expect(JSON.parse(files.get(PATHS.ledger) ?? '')).toEqual({ [DAY]: 150 });
  });
});
