/**
 * Chosen states for the save tests: a new game, and one that has played an
 * event of every type (core's log scenario), so every field of the state
 * holds something other than its starting value.
 */
import { initialState, replay, type GameState } from '@yawelo-idle/core';
import { course, rich, scenario, START } from '../../core/test/log-laws.ts';

export const CONTENT_VERSION = 'synthetic-1';

export function newGame(): GameState {
  return initialState(START, 7);
}

export function played(): GameState {
  const c = course();
  const { state, refused } = replay(c, rich(c), scenario(c));
  if (refused.length > 0) {
    throw new Error(`the scenario refused ${String(refused.length)} events`);
  }
  return state;
}

/** `value` as it comes back from storage: through JSON text. */
export function throughJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}
