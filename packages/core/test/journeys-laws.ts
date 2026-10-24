import { expect } from 'vitest';
import { DAY_MS, wallMs, type WallMs } from '../src/clock.ts';
import type { Course, CultureCard, Encounter } from '../src/course.ts';
import { journeyStatus, startJourney } from '../src/journeys.ts';
import { understandingNow } from '../src/production.ts';
import { integrate, type Result } from '../src/sim.ts';
import { initialState, type GameState } from '../src/state.ts';

/**
 * The Journeys course and games (#30), and what a split of time with
 * Journeys in flight must satisfy. The unit suite checks chosen splits
 * (journeys.test.ts) and the properties suite random ones
 * (properties/journeys.test.ts, #543), through the same check.
 *
 * The courses are declared here, so they are checked against the `Course`
 * contract rather than sharing it.
 */

export const START: WallMs = wallMs(Date.UTC(2027, 0, 4));
export const FEAST_START = START + 14 * DAY_MS;
export const FEAST_END = FEAST_START + 7 * DAY_MS;

export const tea: Encounter = { id: 'tea', tags: ['food'], c0: 10, p0: 1 };

export function card(
  id: string,
  setId: string,
  extra: Partial<CultureCard> = {},
) {
  return {
    id,
    setId,
    tags: ['food'],
    bonus: 0.05,
    phrasePack: [],
    ...extra,
  } satisfies CultureCard;
}

export const pool = [
  card('satay', 'eats'),
  card('rendang', 'eats'),
  card('becak', 'rides', { tags: ['transport'] }),
  card('lebaran', 'rides', {
    festival: {
      windows: [{ startWallMs: FEAST_START, endWallMs: FEAST_END }],
    },
  }),
];

export function courseWith(cards: readonly CultureCard[]): Course {
  return {
    id: 'journeys-course',
    tags: ['food', 'transport'],
    regions: [
      {
        id: 'r0',
        destinations: [],
        encounters: [tea],
        cardSets: [
          { id: 'eats', bonus: 0.25 },
          { id: 'rides', bonus: 0.5 },
        ],
        cultureCards: cards,
        grammarNodes: [],
      },
    ],
  };
}

export const course = courseWith(pool);
/** Every Journey brings back the same card. */
export const solo = courseWith([card('solo', 'eats')]);

/** A game from `seed` owning 5 tea, with upgrade levels `upgrades`. */
export function game(
  seed = 1,
  upgrades: Readonly<Record<string, number>> = {},
  wall: number = START,
): GameState {
  return { ...initialState(wallMs(wall), seed), owned: { tea: 5 }, upgrades };
}

export function ok(result: Result): GameState {
  if (!result.ok) {
    throw new Error(`refused: ${JSON.stringify(result.rejection)}`);
  }
  return result.state;
}

/**
 * A game with three Journeys in flight: 2 h from simulated time 0, then 8 h
 * and 24 h from 1,234 ms, where the game stands.
 */
export function inFlight(): GameState {
  const three = game(1, { journeySlot2: 1, journeySlot3: 1 });
  let s = ok(startJourney(course, three, 0, '2h'));
  s = ok(startJourney(course, integrate(course, s, 1_234), 1, '8h'));
  return ok(startJourney(course, s, 2, '24h'));
}

/**
 * `out`'s next `a + b` ms split at `a` lands where the whole does: the state,
 * each slot's status and Understanding alike.
 */
export function checkJourneySplit(out: GameState, a: number, b: number): void {
  const split = integrate(course, integrate(course, out, a), b);
  const whole = integrate(course, out, a + b);
  expect(split).toEqual(whole);
  expect([0, 1, 2].map((slot) => journeyStatus(split, slot))).toEqual(
    [0, 1, 2].map((slot) => journeyStatus(whole, slot)),
  );
  expect(understandingNow(course, split)).toEqual(
    understandingNow(course, whole),
  );
}
