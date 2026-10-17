import { describe, expect, it } from 'vitest';
import { floorBreach } from '../../../tests/floors';
import { searched } from '../../../tests/searched';
import {
  initialState,
  Num,
  view,
  wallMs,
  type Course,
  type GameEvent,
  type GameState,
  type View,
} from '@yawelo-idle/core';
import {
  BOT_EPOCH_WALL_MS,
  syntheticCourse,
} from '@yawelo-idle/core/fixtures/synthetic-course';
import type { QuickReturn, Watcher } from '../src/player';
import { persona } from '../src/personas';
import {
  insaneValues,
  judgedValues,
  reachedAt,
  runPersona,
  SailLog,
  type RunPlayer,
} from '../src/run';
import { DAY_MS, dayOpens, QUICK_RETURN_MS, WAKE_MS } from '../src/schedule';
import { Streams } from '../src/streams';

/** A run, measured (#35 AC4 (h), AC6). */

let built: Course | undefined;
function course(): Course {
  built ??= syntheticCourse(1);
  return built;
}

/** A Num holding raw parts the Num API would refuse: what a bug could leave. */
function forged(mantissa: number, exponent: number): Num {
  return Object.assign(
    Object.create(Object.getPrototypeOf(Num.from(1)) as object),
    {
      mantissa,
      exponent,
    },
  ) as Num;
}

function cleanView(): View {
  const s = initialState(wallMs(BOT_EPOCH_WALL_MS), 35);
  return view(course(), s, s.wall);
}

describe('insaneValues', () => {
  it('finds nothing in a new game’s view', () => {
    const v = cleanView();
    const judged = judgedValues(v);
    expect(
      searched(insaneValues(v), {
        of: judged,
        what: 'values in a new game’s view',
      }),
    ).toEqual([]);
    expect(floorBreach('run/new game values', judged.length)).toBeUndefined();
    expect(v.shop.encounters).toHaveLength(6);
  });

  it('names a NaN Understanding', () => {
    expect(
      insaneValues({ ...cleanView(), understanding: forged(NaN, 0) }),
    ).toEqual(['understanding']);
  });

  it('names a negative rate', () => {
    expect(insaneValues({ ...cleanView(), rate: Num.from(-1) })).toEqual([
      'rate',
    ]);
  });

  it('names an Insight with an infinite exponent', () => {
    expect(
      insaneValues({ ...cleanView(), insight: forged(1, Infinity) }),
    ).toEqual(['insight']);
  });

  it('names an Encounter’s negative price', () => {
    const v = cleanView();
    const [first, ...rest] = v.shop.encounters;
    if (first === undefined) throw new Error('no Encounter offered');
    const bad = {
      ...v,
      shop: {
        ...v.shop,
        encounters: [{ ...first, price: Num.from(-5) }, ...rest],
      },
    };
    expect(insaneValues(bad)).toEqual([`price.${first.id}`]);
  });

  it('names a retrievability that is not a number', () => {
    const v = {
      ...cleanView(),
      queue: [{ itemId: 'w', rank: 'heard' as const, retrievability: NaN }],
    };
    expect(insaneValues(v)).toEqual(['R.w']);
  });
});

describe('runPersona, played by a stand-in', () => {
  // The run's bookkeeping, with a scripted stand-in for the Player: the real
  // Capped buyer's first day costs about 50 ms of CPU warm, past the unit
  // limit on a busy laptop, so it is played in the pacing suite
  // (packages/bots/pacing/run.test.ts, #544).

  /** One open of the stand-in. */
  interface Scripted {
    /** Applies a Set Sail a minute in, reaching the finale if `finale`. */
    readonly sails?: boolean;
    readonly finale?: boolean;
    /** Whether the open offered a decision. */
    readonly decided?: boolean;
    /** What a quick return after the open finds. */
    readonly returns?: QuickReturn;
    /** The view it decides from, in place of the game's. */
    readonly sees?: View;
  }

  /**
   * A player that plays `script`, one entry an open: it sees a view and
   * applies a Listen at each open's start, and a Set Sail where scripted.
   */
  function scripted(script: readonly Scripted[]) {
    return (initial: GameState, watcher: Watcher): RunPlayer => {
      let state = initial;
      let now: number = initial.wall;
      let opened = -1;
      let seq = 0;
      const applied = (event: GameEvent) => {
        watcher.applied?.(event, state);
      };
      return {
        get state() {
          return state;
        },
        get now() {
          return now;
        },
        open(startMs, lengthMs) {
          opened += 1;
          const step = script[opened] ?? {};
          now = startMs;
          watcher.saw?.(step.sees ?? view(course(), state, wallMs(now)));
          applied({ type: 'listen', seq: (seq += 1), wallMs: wallMs(now) });
          if (step.sails === true) {
            now += 60_000;
            state = {
              ...state,
              destination: state.destination + 1,
              finale: step.finale === true,
            };
            applied({ type: 'setSail', seq: (seq += 1), wallMs: wallMs(now) });
          }
          now = startMs + lengthMs;
          return step.decided ?? true;
        },
        returnAfter() {
          return script[opened]?.returns ?? 'decision';
        },
      };
    };
  }

  const capped = () => persona('capped');
  const firstOpenMs = BOT_EPOCH_WALL_MS + WAKE_MS;
  /** The Capped buyer's first day of opens, as the schedule draws them. */
  const firstDay = () =>
    dayOpens(capped(), BOT_EPOCH_WALL_MS, 0, new Streams(capped().seed));
  const play = (script: readonly Scripted[], stopAfterSails?: number) =>
    runPersona(course(), capped(), BOT_EPOCH_WALL_MS, 1, {
      player: scripted(script),
      ...(stopAfterSails === undefined ? {} : { stopAfterSails }),
    });

  it('records the day each open starts, from the first open', () => {
    const opens = firstDay();
    const run = play([{}, {}, {}]);
    expect(run.persona).toBe('capped');
    expect(run.openDays).toEqual(
      opens.map((o) => (o.startMs - firstOpenMs) / DAY_MS),
    );
    expect(run.openDays).toHaveLength(3);
    expect(run.openDays[0]).toBe(0);
  });

  it('counts every event applied and every view seen', () => {
    const run = play([{}, { sails: true }, {}]);
    expect(run.events).toBe(4);
    expect(run.views).toBe(3);
    expect(run.cpuMs).toBeGreaterThanOrEqual(0);
  });

  it('times each sail by the day it was applied, numbering the destinations', () => {
    const run = play([{}, { sails: true }, {}]);
    const [sail] = run.sails;
    if (sail === undefined) throw new Error('the run never sailed');
    expect(run.sails).toHaveLength(1);
    // A new game stands at destination 0: the first sail is to route 1.
    expect(sail.destination).toBe(1);
    expect(sail.day).toBeCloseTo((run.openDays[1] ?? NaN) + 60_000 / DAY_MS);
    expect(sail.reachedDay).toBeLessThanOrEqual(sail.day);
  });

  it('ends after the open in which the asked-for sails landed', () => {
    const script = [{}, { sails: true }, {}];
    const full = play(script);
    const stopped = play(script, 1);
    expect(full.openDays).toHaveLength(3);
    expect(stopped.openDays).toEqual(full.openDays.slice(0, 2));
    expect(stopped.sails).toEqual(full.sails);
  });

  it('judges a return after each open, recording one that found nothing or only Practice', () => {
    const run = play([
      { returns: 'nothing' },
      { returns: 'practice' },
      { returns: 'decision' },
    ]);
    const opens = firstDay();
    // A return is judged a quick return after the open ends.
    const returnDay = (i: number) => {
      const open = opens[i];
      if (open === undefined) throw new RangeError(`no open ${String(i)}`);
      return (
        (open.startMs + open.lengthMs + QUICK_RETURN_MS - firstOpenMs) / DAY_MS
      );
    };
    expect(run.returnsJudged).toBe(3);
    expect(run.returnsUndecided).toHaveLength(1);
    expect(run.returnsUndecided[0]).toBeCloseTo(returnDay(0));
    expect(run.returnsPracticeOnly).toHaveLength(1);
    expect(run.returnsPracticeOnly[0]).toBeCloseTo(returnDay(1));
  });

  it('records an open that offered no decision', () => {
    const run = play([{}, { decided: false }, {}]);
    expect(run.undecided).toEqual([run.openDays[1]]);
  });

  it('stops at the finale, judging no return after it', () => {
    const run = play([{}, { sails: true, finale: true }, {}]);
    expect(run.openDays).toHaveLength(2);
    expect(run.finaleDay).toBe(run.sails[0]?.day);
    expect(run.returnsJudged).toBe(1);
  });

  it('records no finale when the run ends first', () => {
    expect(play([{}, { sails: true }, {}]).finaleDay).toBeUndefined();
  });

  it('keeps what it saw that was not a sane value', () => {
    const run = play([
      {},
      { sees: { ...cleanView(), understanding: forged(NaN, 0) } },
      {},
    ]);
    expect(run.insane).toEqual(['understanding']);
  });

  it('waits 15 minutes for a quick return (operator, 2026-10-04)', () => {
    expect(QUICK_RETURN_MS).toBe(900_000);
  });
});

describe('reachedAt', () => {
  /** A stand-in state: Understanding earned `u` at `wall`, growing 1 a second. */
  interface Toy {
    readonly u: number;
    readonly wall: number;
  }
  const GOAL = 50;
  const meets = (s: Toy, atMs: number) => s.u + (atMs - s.wall) / 1_000 >= GOAL;
  const seen = (u: number, wall: number) => ({
    state: { u, wall },
    wallMs: wall,
  });

  it('finds the second production meets the goal between two actions', () => {
    const at = reachedAt([seen(0, 0), seen(10, 100_000)], 500_000, meets);
    expect(at).toBeGreaterThanOrEqual(140_000);
    expect(at).toBeLessThan(141_000);
  });

  it('gives an action’s moment when the action itself meets the goal', () => {
    expect(reachedAt([seen(0, 0), seen(60, 5_000)], 9_000, meets)).toBe(5_000);
  });

  it('gives the leg’s first moment when its first state already meets the goal', () => {
    expect(reachedAt([seen(70, 2_000), seen(80, 3_000)], 9_000, meets)).toBe(
      2_000,
    );
  });

  it('looks between the last action and the sail when no action meets the goal', () => {
    const at = reachedAt([seen(0, 0)], 80_000, meets);
    expect(at).toBeGreaterThanOrEqual(50_000);
    expect(at).toBeLessThan(51_000);
  });

  it('asks about few states: a 1,024-state leg in under 40 questions', () => {
    let asked = 0;
    // An action every second, each recording what production had earned.
    const leg = Array.from({ length: 1_024 }, (_, k) => seen(k, k * 1_000));
    const at = reachedAt(leg, 2_000_000, (s: Toy, t: number) => {
      asked += 1;
      return meets(s, t);
    });
    expect(at).toBe(50_000);
    expect(asked).toBeGreaterThan(0);
    expect(asked).toBeLessThan(40);
  });
});

describe('SailLog', () => {
  /** A stand-in state: `u` earned at `wall`, growing 1 a second, toward its own sail's `goal`. */
  interface Toy {
    readonly u: number;
    readonly wall: number;
    readonly goal: number;
  }
  const meets = (s: Toy, atMs: number) =>
    s.u + (atMs - s.wall) / 1_000 >= s.goal;
  const toy = (u: number, wall: number, goal: number): Toy => ({
    u,
    wall,
    goal,
  });
  /** Days in seconds, so the times read as the wall times fed. */
  const seconds = (ms: number) => ms / 1_000;

  it('restarts each goal’s clock at the sail before: the states the last run left are not searched', () => {
    const log = new SailLog(
      { state: toy(0, 0, 50), wallMs: 0 },
      meets,
      seconds,
    );
    // The first run meets its goal of 50 by 10 s and sails at 20 s.
    log.reached(toy(60, 10_000, 50), 10_000);
    log.reached(toy(70, 15_000, 50), 15_000);
    log.reached(toy(0, 20_000, 90), 20_000, 2);
    // The second earns from nothing toward 90: met at 90 s, sailed at 100 s,
    // found to the second by bisection (90.156 s). Searched with the first
    // run's states, whose own goal they met, it would answer 10 s.
    log.reached(toy(30, 30_000, 90), 30_000);
    log.reached(toy(0, 100_000, 140), 100_000, 3);
    expect(log.sails).toEqual([
      { destination: 2, day: 20, reachedDay: 10 },
      { destination: 3, day: 100, reachedDay: 90.156 },
    ]);
  });
});
