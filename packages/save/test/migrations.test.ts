import { describe, expect, it } from 'vitest';
import {
  CHAIN,
  checkChain,
  load,
  MIGRATIONS,
  save,
  SAVE_VERSION,
  type Chain,
  type Migration,
} from '../src/index.ts';
import { CONTENT_VERSION, newGame, throughJson } from './states.ts';

/**
 * The migration chain (#158 AC2, AC6). The app's own chain is checked here,
 * so a gap fails the build; the chain's rules are checked on chains built
 * for the test, since the app has no migration yet.
 */

/**
 * Measured 2026-11-15: version 1 is the first save shape, so the chain has
 * no step. Each new save version adds one migration and raises this by one.
 */
const MEASURED_MIGRATIONS = 0;

const step = (from: number): Migration => ({ from, migrate: (body) => ({ ...body }) });

describe("the app's chain", () => {
  it('has one migration per version below the current one', () => {
    expect(MIGRATIONS).toHaveLength(MEASURED_MIGRATIONS);
    expect(SAVE_VERSION).toBe(MEASURED_MIGRATIONS + 1);
  });

  it('has no gap', () => {
    expect(() => {
      checkChain(CHAIN);
    }).not.toThrow();
  });
});

describe('checkChain', () => {
  it('accepts a chain with a step from every version below the current one', () => {
    expect(() => {
      checkChain({ migrations: [step(1), step(2)], current: 3 });
    }).not.toThrow();
  });

  it('refuses a gap, naming the missing step', () => {
    expect(() => {
      checkChain({ migrations: [step(1), step(3)], current: 4 });
    }).toThrow('the save chain has no migration from version 2');
  });

  it('refuses a missing last step', () => {
    expect(() => {
      checkChain({ migrations: [step(1)], current: 3 });
    }).toThrow('the save chain has no migration from version 2');
  });

  it('refuses steps out of order', () => {
    expect(() => {
      checkChain({ migrations: [step(2), step(1)], current: 3 });
    }).toThrow('the save chain has no migration from version 1');
  });

  it('refuses a step from the current version or beyond', () => {
    expect(() => {
      checkChain({ migrations: [step(1), step(2)], current: 2 });
    }).toThrow('the save chain has a migration from version 2, at or past its current version 2');
  });

  it('refuses a current version below 1', () => {
    expect(() => {
      checkChain({ migrations: [], current: 0 });
    }).toThrow('the save chain must end at an integer version from 1, got 0');
  });
});

describe('loading through a chain', () => {
  /** A chain to version 3 that records the steps it runs, in order. */
  function recording(): { chain: Chain; ran: number[] } {
    const ran: number[] = [];
    const record = (from: number): Migration => ({
      from,
      migrate: (body) => {
        ran.push(from);
        return { ...body };
      },
    });
    return { chain: { migrations: [record(1), record(2)], current: 3 }, ran };
  }

  const stored = (saveVersion: number): unknown => ({
    ...(throughJson(save(newGame(), {}, CONTENT_VERSION)) as object),
    saveVersion,
  });

  it('runs every step from the save version, in order', () => {
    const { chain, ran } = recording();
    const result = load(stored(1), chain);
    expect(ran).toEqual([1, 2]);
    expect(result).toEqual({
      ok: true,
      save: { ...save(newGame(), {}, CONTENT_VERSION), saveVersion: 3 },
      migratedFrom: 1,
    });
  });

  it('runs only the steps above the save version', () => {
    const { chain, ran } = recording();
    load(stored(2), chain);
    expect(ran).toEqual([2]);
  });

  it('runs no step on a save at the current version', () => {
    const { chain, ran } = recording();
    load(stored(3), chain);
    expect(ran).toEqual([]);
  });

  it('refuses a migrated save that is not of the current shape', () => {
    const chain: Chain = {
      migrations: [{ from: 1, migrate: ({ settings: _dropped, ...body }) => body }],
      current: 2,
    };
    expect(load(stored(1), chain)).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['settings: Invalid input: expected object, received undefined'],
      },
    });
  });

  it('refuses to load through a chain with a gap', () => {
    expect(() => load(stored(1), { migrations: [], current: 2 })).toThrow(
      'the save chain has no migration from version 1',
    );
  });
});
