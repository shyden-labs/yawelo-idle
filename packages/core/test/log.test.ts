import { describe, expect, it } from 'vitest';
import { floorBreach } from '../../../tests/floors';
import { searched } from '../../../tests/searched';
import { HOUR_MS, wallMs } from '../src/clock';
import type { Course } from '../src/course';
import type { GameEvent } from '../src/events';
import { apply, replay } from '../src/log';
import { Num } from '../src/num';
import { sailPreview } from '../src/sail';
import { advance, listen } from '../src/sim';
import { initialState, type GameState } from '../src/state';
import { offlineCapMs } from '../src/upgrades';
import {
  START,
  MINUTE_MS,
  course,
  rich,
  firstWord,
  scenario,
  direct,
  before,
  TYPE_INDEXES,
  TYPES,
  checkApply,
  checkCommute,
} from './log-laws';

/**
 * `apply` and `replay` (#34 AC2, AC3, AC6; design §4, §7): the event log is
 * the only way the live state changes. Each event type is checked against
 * the action it names, called directly on the state advanced to the
 * event's wall time.
 */

describe('apply dispatches each event to its action (design §4)', () => {
  it('the scenario has one event of each type, in this order', () => {
    expect(scenario(course()).map((e) => e.type)).toEqual(TYPES);
  });

  it.each(TYPE_INDEXES)(
    '$type: accepted, the action’s state with the event’s seq',
    ({ index }) => {
      const c = course();
      const state = before(c, index);
      const event = scenario(c)[index];
      if (event === undefined) throw new Error(`no event ${String(index)}`);
      const expected = direct(c, state, event);
      expect(expected.ok).toBe(true);
      if (!expected.ok) return;
      expect(apply(c, state, event)).toEqual({
        ok: true,
        state: { ...expected.state, seq: event.seq },
      });
    },
  );

  it('Set Sail is available where the scenario sails', () => {
    const c = course();
    const state = before(c, TYPES.length - 1);
    expect(sailPreview(c, advance(c, state, state.wall).state).available).toBe(
      true,
    );
  });

  it('a refusal is the action’s own refusal', () => {
    const c = course();
    const event: GameEvent = {
      type: 'buyUpgrade',
      seq: 1,
      wallMs: wallMs(START + MINUTE_MS),
      id: 'noSuchUpgrade',
    };
    expect(apply(c, rich(c), event)).toEqual({
      ok: false,
      rejection: { kind: 'unknownUpgrade', id: 'noSuchUpgrade' },
    });
  });
});

describe('seq (AC2)', () => {
  it('a new game has seq 0', () => {
    expect(initialState(START, 1).seq).toBe(0);
  });

  it.each([
    ['equal to the last', 4, 4],
    ['below the last', 3, 4],
    ['zero on a new game', 0, 0],
  ])('refuses a seq %s as staleSeq', (_name, seq, last) => {
    const c = course();
    const state = { ...rich(c), seq: last };
    expect(apply(c, state, { type: 'listen', seq, wallMs: START })).toEqual({
      ok: false,
      rejection: { kind: 'staleSeq', seq, last },
    });
  });

  it('checks seq before anything else', () => {
    const c = course();
    const state = { ...rich(c), seq: 9 };
    const event: GameEvent = {
      type: 'buyUpgrade',
      seq: 9,
      wallMs: START,
      id: 'none',
    };
    expect(apply(c, state, event)).toEqual({
      ok: false,
      rejection: { kind: 'staleSeq', seq: 9, last: 9 },
    });
  });

  it('allows a gap: a refused event keeps its number', () => {
    const c = course();
    const result = apply(
      c,
      { ...rich(c), seq: 1 },
      { type: 'listen', seq: 7, wallMs: START },
    );
    expect(result.ok && result.state.seq).toBe(7);
  });

  it('accepts the next seq after the last', () => {
    const c = course();
    const result = apply(
      c,
      { ...rich(c), seq: 1 },
      { type: 'listen', seq: 2, wallMs: START },
    );
    expect(result.ok && result.state.seq).toBe(2);
  });
});

describe('the wall clock (AC3, DN21)', () => {
  it('an earlier wallMs is clamped, not refused: nothing is credited', () => {
    const c = course();
    const lived = before(c, 3);
    // Five Understanding held at the anchor, so the tap's +0.25 shows: on the
    // scenario's 1e40 it would be lost to rounding.
    const state: GameState = {
      ...lived,
      anchor: { sim: lived.sim, understanding: Num.toTuple(Num.from(5)) },
    };
    const result = apply(c, state, {
      type: 'listen',
      seq: 4,
      wallMs: wallMs(state.wall - HOUR_MS),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wall).toBe(state.wall);
    expect(result.state.sim).toBe(state.sim);
    expect(result.state).toEqual({ ...listen(c, state), seq: 4 });
    expect(result.state.anchor.understanding).toEqual(
      Num.toTuple(Num.from(5.25)),
    );
  });

  it('a later wallMs is credited as advance credits it', () => {
    const c = course();
    const state = before(c, 3);
    const event: GameEvent = {
      type: 'resume',
      seq: 4,
      wallMs: wallMs(state.wall + 3 * HOUR_MS),
    };
    const result = apply(c, state, event);
    expect(result).toEqual({
      ok: true,
      state: { ...advance(c, state, event.wallMs).state, seq: 4 },
    });
    expect(result.ok && result.state.sim - state.sim).toBe(3 * HOUR_MS);
  });
});

describe('resume (operator, 2026-10-03)', () => {
  /** A Listen 40 h after `state`, with or without a resume at 30 h. */
  function after40h(withResume: boolean): GameState {
    const c = course();
    const state = before(c, 3);
    const events: GameEvent[] = [
      ...(withResume
        ? [
            {
              type: 'resume',
              seq: 10,
              wallMs: wallMs(state.wall + 30 * HOUR_MS),
            } as const,
          ]
        : []),
      { type: 'listen', seq: 11, wallMs: wallMs(state.wall + 40 * HOUR_MS) },
    ];
    return replay(c, state, events).state;
  }

  it('a visit with no other action banks its capped time', () => {
    const c = course();
    const start = before(c, 3);
    const cap = offlineCapMs(start);
    expect(cap).toBeLessThan(30 * HOUR_MS);
    expect(after40h(true).sim - start.sim).toBe(cap + 10 * HOUR_MS);
  });

  it('without it, the whole gap is capped once', () => {
    const c = course();
    const start = before(c, 3);
    expect(after40h(false).sim - start.sim).toBe(offlineCapMs(start));
  });
});

describe('a refused event leaves state unchanged (AC2)', () => {
  // Stand-ins of the random events (properties/log.test.ts, #543): for each
  // type, a valid event at the point of the scenario where that type comes,
  // and a mangled one (an unknown id, a slot or count out of range, a clock
  // pushed back) at the start. What `apply` answered is pinned, measured
  // 2026-10-12: 'undefined' where it accepted, else the refusal's kind.
  // Every valid event is accepted; a clock pushed back is clamped, so the
  // mangled resume, listen and pick-up are accepted too.
  type Fields = Readonly<Record<string, unknown>>;
  const STAND_INS = (
    c: Course,
  ): Record<(typeof TYPES)[number], [Fields, Fields]> => {
    const encounter = c.regions[1]?.encounters[0]?.id ?? '';
    const node = c.regions[1]?.grammarNodes[0]?.id ?? '';
    const word = firstWord(c);
    return {
      resume: [{ wallMs: 0 }, { wallMs: -HOUR_MS }],
      listen: [{ wallMs: MINUTE_MS }, { wallMs: 3 * HOUR_MS }],
      buyEncounter: [
        { id: encounter, count: 1 },
        { id: 'none', count: Number.MAX_SAFE_INTEGER },
      ],
      pickUpWord: [{ wallMs: 0 }, { wallMs: -HOUR_MS }],
      answerReview: [
        { itemId: word, correct: true, latencyMs: 2500, promptType: 'choice' },
        { itemId: 'none', correct: false, latencyMs: 0, promptType: 'tiles' },
      ],
      answerPractice: [{ itemId: word }, { itemId: 'none' }],
      buyUpgrade: [{ id: 'offlineCap' }, { id: 'none' }],
      startJourney: [
        { slot: 0, durationId: '2h' },
        { slot: 4, durationId: 'none' },
      ],
      collectJourney: [{ slot: 0, wallMs: 3 * HOUR_MS }, { slot: 4 }],
      buyGrammarNode: [{ id: node }, { id: 'none' }],
      setAutomation: [
        { enabled: true, intervalMs: 10_000 },
        { enabled: true, intervalMs: 7 },
      ],
      setSail: [{}, { to: 'none' }],
    };
  };
  const ANSWERED: Record<string, string> = {
    'resume valid': 'undefined',
    'resume mangled': 'undefined',
    'listen valid': 'undefined',
    'listen mangled': 'undefined',
    'buyEncounter valid': 'undefined',
    'buyEncounter mangled': 'unknownEncounter',
    'pickUpWord valid': 'undefined',
    'pickUpWord mangled': 'undefined',
    'answerReview valid': 'undefined',
    'answerReview mangled': 'unknownWord',
    'answerPractice valid': 'undefined',
    'answerPractice mangled': 'unknownWord',
    'buyUpgrade valid': 'undefined',
    'buyUpgrade mangled': 'unknownUpgrade',
    'startJourney valid': 'undefined',
    'startJourney mangled': 'unknownSlot',
    'collectJourney valid': 'undefined',
    'collectJourney mangled': 'unknownSlot',
    'buyGrammarNode valid': 'undefined',
    'buyGrammarNode mangled': 'unknownGrammarNode',
    'setAutomation valid': 'undefined',
    'setAutomation mangled': 'intervalNotOwned',
    'setSail valid': 'undefined',
    'setSail mangled': 'sailTargetInvalid',
  };

  for (const type of TYPES)
    for (const which of ['valid', 'mangled'] as const)
      it(`for a ${which} ${type} event, apply never throws and never writes to its input`, () => {
        const c = course();
        const [valid, mangled] = STAND_INS(c)[type];
        const at = which === 'valid' ? TYPES.indexOf(type) : 0;
        const partial = {
          type,
          seq: 0,
          wallMs: 0,
          ...(which === 'valid' ? valid : mangled),
        } as GameEvent;
        expect(String(checkApply(c, at, partial))).toBe(
          ANSWERED[`${type} ${which}`],
        );
      });

  it('a log with a refused event inserted replays to the state without it', () => {
    const c = course();
    const events = scenario(c);
    const inserted: GameEvent = {
      type: 'buyUpgrade',
      seq: 6,
      wallMs: events[4]?.wallMs ?? START,
      id: 'noSuchUpgrade',
    };
    const renumbered = events.map((e) => ({ ...e, seq: e.seq * 2 }));
    const withRefusal = [
      ...renumbered.slice(0, 5),
      { ...inserted, seq: 11 },
      ...renumbered.slice(5),
    ];
    const plain = replay(c, rich(c), renumbered);
    const noisy = replay(c, rich(c), withRefusal);
    // Before the exact checks, so a replay that loses or doubles its
    // refusals is named by this search and its floor (#375).
    expect(
      searched(plain.refused, {
        of: noisy.refused,
        what: 'refusals with one inserted',
      }),
    ).toEqual([]);
    expect(
      floorBreach('log/refusals with one inserted', noisy.refused.length),
    ).toBeUndefined();
    expect(noisy.state).toEqual(plain.state);
    expect(noisy.refused).toEqual([
      { seq: 11, rejection: { kind: 'unknownUpgrade', id: 'noSuchUpgrade' } },
    ]);
  });
});

describe('replay (AC6)', () => {
  it('equals applying each event in turn', () => {
    const c = course();
    expect(replay(c, rich(c), scenario(c))).toEqual({
      state: before(c, TYPES.length),
      refused: [],
    });
  });

  it('of an empty log is the state it was given', () => {
    const c = course();
    const state = rich(c);
    expect(replay(c, state, [])).toEqual({ state, refused: [] });
  });

  it('lists each refusal with its seq, in log order', () => {
    const c = course();
    const result = replay(c, rich(c), [
      { type: 'listen', seq: 2, wallMs: START },
      { type: 'listen', seq: 2, wallMs: START },
      { type: 'collectJourney', seq: 3, wallMs: START, slot: 0 },
    ]);
    expect(result.refused).toEqual([
      { seq: 2, rejection: { kind: 'staleSeq', seq: 2, last: 2 } },
      { seq: 3, rejection: { kind: 'slotEmpty', slot: 0 } },
    ]);
    expect(result.state.seq).toBe(2);
  });

  it('round-trips through JSON: the log and the state are plain data', () => {
    const c = course();
    const log: unknown = JSON.parse(JSON.stringify(scenario(c)));
    const live = replay(c, rich(c), scenario(c)).state;
    const again = replay(c, rich(c), log as GameEvent[]).state;
    expect(again).toEqual(live);
    expect(JSON.parse(JSON.stringify(live))).toEqual(live);
  });
});

describe('apply and advance commute within the offline cap (design §7)', () => {
  // Stand-ins of the random times (properties/log.test.ts, #543): no time,
  // the most drawn, and between, from the start and from the last event.
  it.each([
    [0, 0, 0],
    [TYPES.length, 4 * HOUR_MS, 2 * HOUR_MS],
    [5, 90 * MINUTE_MS, 1],
  ])(
    'advance then apply equals apply then advance, the event being later: before event %i, %i ms then %i ms',
    (index, first, second) => {
      checkCommute(course(), index, first, second);
    },
  );

  it('but not when the cap clips: advancing first banks the cap at the earlier time', () => {
    const c = course();
    const state = before(c, 3);
    const t = wallMs(state.wall + 30 * HOUR_MS);
    const event: GameEvent = {
      type: 'listen',
      seq: state.seq + 1,
      wallMs: wallMs(t + HOUR_MS),
    };
    const viaAdvance = apply(c, advance(c, state, t).state, event);
    const applied = apply(c, state, event);
    expect(viaAdvance.ok && applied.ok).toBe(true);
    if (!viaAdvance.ok || !applied.ok) return;
    expect(viaAdvance.state.sim - applied.state.sim).toBe(HOUR_MS);
  });
});
