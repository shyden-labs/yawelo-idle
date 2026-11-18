/**
 * States for the save tests, built from `@yawelo-idle/core` alone (never
 * core's own test files by path, which a clean copy of the repository
 * resolves to a second, incompatible core): a new game; a rich one, with
 * plenty of every currency at region 2's first destination, where every
 * event type has something it can do; and a played one, which has accepted
 * an event of every type, so every field holds something other than its
 * starting value.
 */
import {
  apply,
  initialState,
  Num,
  wallMs,
  type Course,
  type GameEvent,
  type GameState,
  type WallMs,
} from '@yawelo-idle/core';
import { syntheticCourse } from '@yawelo-idle/core/fixtures/synthetic-course';

export const CONTENT_VERSION = 'synthetic-1';
export const START: WallMs = wallMs(Date.UTC(2027, 0, 4, 8));
export const MINUTE_MS = 60_000;

let built: Course | undefined;

/** The synthetic course every save test plays. */
export function course(): Course {
  built ??= syntheticCourse(1);
  return built;
}

export function newGame(): GameState {
  return initialState(START, 7);
}

/** Region 2's first destination, with plenty of every currency. */
export function rich(): GameState {
  const destination = course().regions[0]?.destinations.length ?? 0;
  const base = initialState(START, 34);
  return {
    ...base,
    anchor: { sim: base.sim, understanding: Num.toTuple(Num.from(1e40)) },
    insight: Num.toTuple(Num.from(1e12)),
    stamps: 1000,
    stampsEarned: 1000,
    destination,
    reached: destination,
  };
}

/** `event` applied to `state`; throws naming the refusal. */
function accepted(state: GameState, event: GameEvent): GameState {
  const result = apply(course(), state, event);
  if (!result.ok) {
    throw new Error(
      `${event.type} was refused: ${JSON.stringify(result.rejection)}`,
    );
  }
  return result.state;
}

/** Words a sail needs held (the synthetic course's goal, measured 2026-11-15). */
const WORDS_TO_SAIL = 16;

/**
 * A rich game after accepted events of every type, ending with a sail. The
 * first word picked up falls due 4 minutes later, so its review waits.
 */
export function played(): GameState {
  const c = course();
  const encounter = c.regions[0]?.encounters[0]?.id ?? '';
  const node = c.regions[0]?.grammarNodes[0]?.id ?? '';
  let state = rich();
  let seq = 0;
  let minute = 0;
  /** Applies the event `minutes` after the last, at the next seq. */
  const next = (minutes: number, fields: Record<string, unknown>): void => {
    seq += 1;
    minute += minutes;
    state = accepted(state, {
      ...fields,
      seq,
      wallMs: wallMs(START + minute * MINUTE_MS),
    } as unknown as GameEvent);
  };
  next(1, { type: 'resume' });
  next(1, { type: 'listen' });
  next(1, { type: 'buyEncounter', id: encounter, count: 3 });
  for (let picked = 0; picked < WORDS_TO_SAIL; picked += 1) {
    next(0, { type: 'pickUpWord' });
  }
  const word = Object.keys(state.words)[0] ?? '';
  next(5, {
    type: 'answerReview',
    itemId: word,
    correct: true,
    latencyMs: 2500,
    promptType: 'choice',
  });
  next(1, { type: 'answerPractice', itemId: word });
  next(1, { type: 'buyUpgrade', id: 'offlineCap' });
  next(1, { type: 'startJourney', slot: 0, durationId: '2h' });
  next(121, { type: 'collectJourney', slot: 0 });
  next(1, { type: 'buyGrammarNode', id: node });
  next(1, { type: 'setAutomation', enabled: true, intervalMs: 10_000 });
  next(1, { type: 'setSail' });
  return state;
}

/** `value` as it comes back from storage: through JSON text. */
export function throughJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}
