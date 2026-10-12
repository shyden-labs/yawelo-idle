import {
  initialState,
  Num,
  pickUpWord,
  view,
  wallMs,
  type Course,
  type GameEvent,
  type GameState,
} from '@yawelo-idle/core';
import {
  BOT_EPOCH_WALL_MS,
  syntheticCourse,
} from '@yawelo-idle/core/fixtures/synthetic-course';
import { Player, STEP_MS } from '../src/player';
import { persona } from '../src/personas';
import { Streams } from '../src/streams';

/**
 * One open played on a chosen state, for the player's tests: the unit
 * suite's (`player.test.ts`) and the pacing suite's runs of the same
 * policy at a fortune too costly for unit (`pacing/player.test.ts`, #544).
 */

export const HOUR_MS = 3_600_000;
export const FIRST_OPEN = BOT_EPOCH_WALL_MS + 8 * HOUR_MS;
/** An open long enough for its opening actions and exactly one check. */
export const ONE_CHECK = 25_000;

let built: Course | undefined;
export function course(): Course {
  built ??= syntheticCourse(1);
  return built;
}

export function fresh(): GameState {
  return initialState(wallMs(FIRST_OPEN), 35);
}

/** `state` holding exactly `understanding`, anchored at its simulated time. */
export function holding(state: GameState, understanding: number): GameState {
  return {
    ...state,
    anchor: {
      sim: state.sim,
      understanding: Num.toTuple(Num.from(understanding)),
    },
    runSpent: Num.toTuple(Num.from(0)),
  };
}

/** `state` with `n` words of the pool picked up, due at once. */
export function withWords(state: GameState, n: number): GameState {
  let s = holding(state, 1e30);
  // one scenario: picking up n words is one player's run of pick-ups.
  for (let k = 0; k < n; k += 1) {
    const r = pickUpWord(course(), s);
    if (!r.ok) throw new Error(JSON.stringify(r.rejection));
    s = r.state;
  }
  return s;
}

/** Play one open of `lengthMs` on `state` as `name`; every accepted event, in order. */
export function play(
  name: string,
  state: GameState,
  lengthMs: number,
  nextOpenMs: number = state.wall + 8 * HOUR_MS,
): { events: GameEvent[]; player: Player; decision: boolean } {
  const events: GameEvent[] = [];
  const p = persona(name);
  const player = new Player(course(), p, state, new Streams(p.seed), {
    applied: (event) => events.push(event),
  });
  const decision = player.open(state.wall, lengthMs, nextOpenMs);
  return { events, player, decision };
}

/** What the shop offered just after the open's last action, before the clock moved on. */
export function shopAfter(player: Player, events: readonly GameEvent[]) {
  const last = events.at(-1);
  if (last === undefined) throw new Error('the open sent nothing');
  return view(course(), player.state, wallMs(last.wallMs + STEP_MS)).shop;
}

export const buys = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === 'buyEncounter' || e.type === 'pickUpWord');
