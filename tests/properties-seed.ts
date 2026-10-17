/**
 * The properties suite's one seeding home (#84, spec §5.11).
 *
 * Every property draws fresh cases on every run (Shyden, 2026-10-12: "don't
 * repeat."). A property that fails prints the seed that replays it, but a
 * reach count is judged after `fc.assert` has returned, and an unseeded
 * run's seed is lost, so a count under its measured minimum could not be
 * reproduced. So `tests/properties-setup.ts` picks a fresh seed for each test
 * file, hands it to fast-check, and remembers it here for the checker
 * (`tests/minimums.ts`) to name. A person replaying a run sets
 * `PROPERTIES_SEED`; no workflow or config ever does (the measured-minimums
 * guard refuses it).
 */
import { randomInt } from 'node:crypto';

/** Set by a person to replay a run at the seed a breach named. */
export const SEED_ENV = 'PROPERTIES_SEED';

const INT32 = 2 ** 31;

/** A fresh seed: any 32-bit integer, as fast-check takes. */
export const freshSeed = (): number => randomInt(-INT32, INT32);

/**
 * The seed a file runs at: the one `replay` names, or a fresh one. A replay
 * that is not a 32-bit integer is refused, never read as fresh: a typo would
 * otherwise replay nothing and pass.
 */
export function chooseSeed(
  replay: string | undefined,
  fresh: () => number = freshSeed,
): number {
  if (replay === undefined) return fresh();
  const seed = Number(replay);
  if (!/^-?\d+$/.test(replay) || seed < -INT32 || seed >= INT32)
    throw new Error(`${SEED_ENV}=${replay} is not a 32-bit integer seed`);
  return seed;
}

let current: number | undefined;

/** Remember the seed this file runs at, for a breach to name. */
export const rememberSeed = (seed: number): void => {
  current = seed;
};

/** The seed this file runs at, or undefined outside the properties suite. */
export const currentSeed = (): number | undefined => current;
