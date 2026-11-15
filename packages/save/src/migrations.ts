/**
 * The migration chain (#158 AC2). `SAVE_VERSION` is the shape this app
 * writes. Each older version has exactly one migration to the next, listed
 * in order, so loading a version-N save runs N's step, then N+1's, and so on
 * up to the current one. `checkChain` refuses a gap, a repeat or a step out
 * of order, and its unit test runs it on `MIGRATIONS`, so a broken chain
 * fails the build.
 */

/** The save shape this app writes. */
export const SAVE_VERSION = 1;

/** One step: a version-`from` save's body to version `from + 1`'s. */
export interface Migration {
  readonly from: number;
  /** Takes the body (the save without `saveVersion`) and returns the next one's. */
  readonly migrate: (
    body: Readonly<Record<string, unknown>>,
  ) => Record<string, unknown>;
}

/** Every migration, oldest first. Version 1 is the first: there are none yet. */
export const MIGRATIONS: readonly Migration[] = [];

/** A chain to load through: its migrations and the version it ends at. */
export interface Chain {
  readonly migrations: readonly Migration[];
  readonly current: number;
}

/** This app's chain. */
export const CHAIN: Chain = { migrations: MIGRATIONS, current: SAVE_VERSION };

/** Throws, naming the fault, unless `chain` has one step from each version below `current`, in order. */
export function checkChain(chain: Chain): void {
  const { migrations, current } = chain;
  if (!Number.isSafeInteger(current) || current < 1) {
    throw new RangeError(
      `the save chain must end at an integer version from 1, got ${String(current)}`,
    );
  }
  for (let from = 1; from < current; from += 1) {
    if (migrations[from - 1]?.from !== from) {
      throw new RangeError(
        `the save chain has no migration from version ${String(from)}`,
      );
    }
  }
  const extra = migrations[current - 1];
  if (extra !== undefined) {
    throw new RangeError(
      `the save chain has a migration from version ${String(extra.from)}, at or past its current version ${String(current)}`,
    );
  }
}
