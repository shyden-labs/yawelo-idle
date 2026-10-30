import { describe, expect, it } from 'vitest';
import { simMs, wallMs } from '../src/clock';
import {
  automationOpensAt,
  automationUnlocked,
  bestPayback,
} from '../src/automation';
import { newWordMemory, review } from '../src/memory';
import { Num } from '../src/num';
import { rateBreakdown, rateGain, understandingNow } from '../src/production';
import { setSail } from '../src/sail';
import { advance, integrate, setAutomation } from '../src/sim';
import { initialState, type GameState } from '../src/state';
import { encounterPrice } from '../src/upgrades';
import {
  START,
  course,
  oneRegion,
  hollow,
  tuple,
  at,
  ok,
  refused,
  EARLY,
  ALL_TIERS,
  pemandu,
  unitsOwned,
  checkTickByTick,
  shop,
  SHOP_ENCOUNTERS,
  twins,
  TEA,
  type PemanduGame,
} from './automation-laws';

/**
 * Pemandu automation (#33): the unlock and the setting (AC1), the choice
 * and the purchases `integrate` makes (AC2).
 *
 * The course is declared here, so it is checked against the `Course`
 * contract rather than sharing it. Its route numbers destinations 0 to 3 in
 * region 1, 4 to 7 in region 2 and 8 to 11 in region 3, so Pemandu opens at
 * destination 4, or 3 with the stamp upgrade. The opening region and the
 * intervals are written out as literals, so a change to `BALANCE.automation`
 * fails here as well as in its own pin.
 */

describe('the automation setting in state (AC1)', () => {
  it('a new game has Pemandu off at the starting 10 s interval', () => {
    expect(initialState(START, 1).automation).toEqual({
      enabled: false,
      intervalMs: 10_000,
    });
  });

  it('a sail keeps the setting', () => {
    // Destination 4's goal: 4.81e17 Understanding (#35's table) and 8 + 2 x 4 words.
    const words = Object.fromEntries(
      Array.from({ length: 16 }, (_, k) => [
        `r1-d0-w${String(k)}`,
        newWordMemory(START),
      ]),
    );
    const on = ok(
      setAutomation(course, at(4, { held: 4.81e17, words }), true, 10_000),
    );
    const sailed = ok(setSail(course, on));
    expect(sailed.destination).toBe(5);
    expect(sailed.automation).toEqual({ enabled: true, intervalMs: 10_000 });
  });
});

describe('where Pemandu opens (AC1)', () => {
  it.each([
    ['region 2, without the stamp upgrade', course, {}, 4],
    ['one destination earlier, with it', course, EARLY, 3],
    ['region 3 when region 2 has no destinations', hollow, {}, 4],
    ['never on a course with one region', oneRegion, {}, undefined],
    [
      'never on a course with one region, even early',
      oneRegion,
      EARLY,
      undefined,
    ],
  ] as const)('%s', (_label, c, upgrades, want) => {
    expect(automationOpensAt(c, at(0, { upgrades }))).toBe(want);
  });

  it.each([
    ['locked at destination 3', 3, {}, false],
    ['open at destination 4, region 2', 4, {}, true],
    ['open at destination 11, region 3', 11, {}, true],
    ['open at destination 3 with the stamp upgrade', 3, EARLY, true],
    ['locked at destination 2 even with it', 2, EARLY, false],
  ] as const)('%s', (_label, reached, upgrades, want) => {
    expect(automationUnlocked(course, at(reached, { upgrades }))).toBe(want);
  });

  it('stays open after a replay of an earlier destination', () => {
    const replaying = { ...at(6), destination: 1 };
    expect(automationUnlocked(course, replaying)).toBe(true);
  });

  it.each([
    ['without the stamp upgrade', {}],
    ['with it', EARLY],
  ] as const)(
    'is locked on a course with one region, %s',
    (_label, upgrades) => {
      expect(automationUnlocked(oneRegion, at(3, { upgrades }))).toBe(false);
    },
  );
});

describe('setAutomation (AC1)', () => {
  it.each([
    ['turning it on', true],
    ['turning it off', false],
  ] as const)('refuses %s before Pemandu opens', (_label, enabled) => {
    expect(refused(setAutomation(course, at(3), enabled, 10_000))).toEqual({
      kind: 'automationLocked',
      reached: 3,
    });
  });

  it('refuses a locked Pemandu before judging the interval', () => {
    expect(refused(setAutomation(course, at(3), true, 3_000)).kind).toBe(
      'automationLocked',
    );
  });

  it('turns Pemandu on at the starting interval once open', () => {
    const s = ok(setAutomation(course, at(4), true, 10_000));
    expect(s.automation).toEqual({ enabled: true, intervalMs: 10_000 });
  });

  it('opens one destination early with the stamp upgrade', () => {
    const s = ok(
      setAutomation(course, at(3, { upgrades: EARLY }), true, 10_000),
    );
    expect(s.automation.enabled).toBe(true);
  });

  it('turns Pemandu off and keeps the interval chosen', () => {
    const on = ok(
      setAutomation(course, at(4, { upgrades: ALL_TIERS }), true, 2_000),
    );
    expect(ok(setAutomation(course, on, false, 2_000)).automation).toEqual({
      enabled: false,
      intervalMs: 2_000,
    });
  });

  it.each([
    ['5 s with its tier', { pemanduFaster1: 1 }, 5_000],
    ['2 s with its tier', { pemanduFaster1: 1, pemanduFaster2: 1 }, 2_000],
    ['1 s with every tier', ALL_TIERS, 1_000],
    ['10 s with every tier', ALL_TIERS, 10_000],
  ] as const)('accepts %s', (_label, upgrades, intervalMs) => {
    const s = ok(setAutomation(course, at(4, { upgrades }), true, intervalMs));
    expect(s.automation.intervalMs).toBe(intervalMs);
  });

  it.each([
    ['5 s without its tier', {}, 5_000, [10_000]],
    [
      '1 s with only the first tier',
      { pemanduFaster1: 1 },
      1_000,
      [10_000, 5_000],
    ],
    [
      '3 s, which no tier gives',
      ALL_TIERS,
      3_000,
      [10_000, 5_000, 2_000, 1_000],
    ],
    ['0 ms', ALL_TIERS, 0, [10_000, 5_000, 2_000, 1_000]],
    ['-10 s', ALL_TIERS, -10_000, [10_000, 5_000, 2_000, 1_000]],
    ['NaN', ALL_TIERS, Number.NaN, [10_000, 5_000, 2_000, 1_000]],
  ] as const)('refuses %s', (_label, upgrades, intervalMs, owned) => {
    expect(
      refused(setAutomation(course, at(4, { upgrades }), true, intervalMs)),
    ).toEqual({ kind: 'intervalNotOwned', intervalMs, owned });
  });

  it('refuses an interval not owned when turning Pemandu off too', () => {
    expect(refused(setAutomation(course, at(4), false, 5_000)).kind).toBe(
      'intervalNotOwned',
    );
  });

  it('banks production first, so ticks start after the setting', () => {
    const s = at(4, { owned: { tea0: 3 }, held: 7, simMs: 90_000 });
    const before = understandingNow(course, s);
    const on = ok(setAutomation(course, s, true, 10_000));
    expect(on.anchor.sim).toBe(90_000);
    expect(on.anchor.understanding).toEqual(Num.toTuple(before));
    expect(Num.toNumber(before)).toBe(7 + 3 * 90);
  });

  it('changes nothing else', () => {
    const s = at(4, { owned: { tea0: 3 }, held: 7, simMs: 90_000 });
    const on = ok(setAutomation(course, s, true, 10_000));
    expect({ ...on, anchor: s.anchor, automation: s.automation }).toEqual(s);
  });
});

describe('rateGain (AC2)', () => {
  /**
   * Words reviewed two days before the game, so each word's bonus depends on
   * the hour bucket the gain is taken in. Built per test, so a throwing setup
   * fails each test by name, never the file (#97).
   */
  function gainState(): GameState {
    const reviewedAt = wallMs(START - 2 * 86_400_000);
    return at(4, {
      owned: { tea: 9, inn: 3, ferry1: 1 },
      upgrades: { 'phrasebook:food': 1 },
      words: Object.fromEntries(
        ['r0-d0-w0', 'r0-d0-w1'].map((id) => [
          id,
          review(newWordMemory(reviewedAt), reviewedAt, true),
        ]),
      ),
      simMs: 5 * 3_600_000 + 17,
    });
  }
  it.each(SHOP_ENCOUNTERS)(
    '%s: its rate with one more, less its rate now, bit for bit',
    (_id, encounter) => {
      const s = gainState();
      const gain = rateGain(shop, s, s.sim)(encounter);
      const plus = {
        ...s,
        owned: { ...s.owned, [encounter.id]: (s.owned[encounter.id] ?? 0) + 1 },
      };
      const rateOf = (state: GameState) =>
        rateBreakdown(shop, state, s.sim).find((e) => e.id === encounter.id)
          ?.rate ?? Num.from(0);
      expect(gain).toEqual(Num.sub(rateOf(plus), rateOf(s)));
    },
  );

  it('the 10th tea doubles every tea, so it gains 11 of them', () => {
    const plain = at(0, { owned: { tea: 9 } });
    expect(rateGain(shop, plain, simMs(0))(TEA)).toEqual(Num.from(11));
  });
});

describe('bestPayback (AC2)', () => {
  it.each([
    ['nothing, when no unit is affordable', 0, 9, {}, {}, undefined],
    ['tea, the only one affordable', 0, 10, {}, {}, 'tea'],
    ['inn at 5 over tea at 10, not the cheapest', 0, 50, {}, {}, 'inn'],
    ['inn at 5 over palace, which gains the most', 0, 1e5, {}, {}, 'inn'],
    ['inn, since ferry is in region 2', 3, 1e5, {}, {}, 'inn'],
    ['ferry at 0.1 once region 2 is reached', 4, 1e5, {}, {}, 'ferry1'],
    ['tea at 3.2 when its 10th unit doubles it', 0, 1e5, { tea: 9 }, {}, 'tea'],
    ['inn over tea at 30.6 one unit earlier', 0, 1e5, { tea: 8 }, {}, 'inn'],
    [
      'market at 3.33 once a Phrasebook doubles food',
      0,
      1e5,
      {},
      { 'phrasebook:food': 1 },
      'market',
    ],
    [
      'tea at 9.5 with one level of stamp discount',
      0,
      9.6,
      {},
      { encounterDiscount: 1 },
      'tea',
    ],
    ['nothing at 9.6 without it', 0, 9.6, {}, {}, undefined],
  ] as const)('chooses %s', (_label, reached, held, owned, upgrades, want) => {
    expect(bestPayback(shop, at(reached, { held, owned, upgrades }))).toBe(
      want,
    );
  });

  it('buys a unit whose price is exactly the Understanding held', () => {
    const s = at(0);
    const price = encounterPrice(s, TEA, 1);
    const held = {
      ...s,
      anchor: { sim: s.sim, understanding: Num.toTuple(price) },
    };
    expect(bestPayback(shop, held)).toBe('tea');
  });

  it('breaks a tie by id in code-unit order', () => {
    expect(bestPayback(twins, at(0, { held: 100 }))).toBe('Zed');
  });
});

/** Pemandu on at `intervalMs` from the state's own time, by the real action. */
describe('integrate with Pemandu (AC2)', () => {
  const RICH = { held: 1e9, owned: { tea0: 1 } };

  it('buys nothing while Pemandu is off, however much is held', () => {
    const s = at(4, RICH);
    const later = integrate(course, s, 60_000);
    expect(later.owned).toEqual(s.owned);
    expect(later.anchor).toEqual(s.anchor);
  });

  it('buys one unit at each tick, the last one at the new time', () => {
    const later = integrate(course, pemandu(at(4, RICH)), 60_000);
    expect(unitsOwned(later) - 1).toBe(6);
    expect(later.anchor.sim).toBe(60_000);
  });

  it('buys at the multiples of 5 s, not 5 s after Pemandu was set', () => {
    const s = pemandu(
      at(4, { ...RICH, simMs: 2_345, upgrades: ALL_TIERS }),
      5_000,
    );
    const later = integrate(course, s, 9_999);
    expect(unitsOwned(later) - 1).toBe(2);
    expect(later.anchor.sim).toBe(10_000);
  });

  it('buys nothing at the tick Pemandu was set on', () => {
    const s = pemandu(at(4, { ...RICH, simMs: 20_000 }));
    expect(integrate(course, s, 9_999).owned).toEqual(s.owned);
  });

  it('buys nothing when nothing is owned and nothing is affordable', () => {
    const s = pemandu(at(4, { held: 9 }));
    expect(Object.keys(integrate(course, s, 3_600_000).owned)).toEqual([]);
  });

  it('pays what a purchase by hand pays, with the stamp discount', () => {
    const s = pemandu(at(4, { held: 9.6, upgrades: { encounterDiscount: 1 } }));
    const later = integrate(course, s, 10_000);
    expect(later.owned).toEqual({ tea0: 1 });
    expect(Num.toNumber(Num.fromTuple(later.runSpent))).toBeCloseTo(9.5, 12);
  });

  // Stand-ins of the seeded random games (properties/automation.test.ts,
  // #543): rich with nothing owned, broke, every field at its largest drawn,
  // and one between. The units each buys are pinned, so the idle game and
  // the buying ones stay what they stand in for.
  const GAMES: [string, PemanduGame, number][] = [
    [
      'a rich game owning nothing',
      {
        interval: 10_000,
        reached: 4,
        tea0: 0,
        market0: 0,
        tea1: 0,
        held: 5_000,
        sim: 0,
        ticks: 150,
        discount: 0,
        phrasebook: false,
        reviewed: 0,
      },
      150,
    ],
    [
      'a broke game owning nothing',
      {
        interval: 1_000,
        reached: 3,
        tea0: 0,
        market0: 0,
        tea1: 0,
        held: 0,
        sim: 0,
        ticks: 150,
        discount: 0,
        phrasebook: false,
        reviewed: 0,
      },
      0,
    ],
    [
      'every field at its largest',
      {
        interval: 2_000,
        reached: 8,
        tea0: 40,
        market0: 20,
        tea1: 10,
        held: 5_000,
        sim: 30 * 3_600_000,
        ticks: 150,
        discount: 2,
        phrasebook: true,
        reviewed: 5,
      },
      150,
    ],
    [
      'a game between',
      {
        interval: 5_000,
        reached: 4,
        tea0: 7,
        market0: 3,
        tea1: 0,
        held: 1_234,
        sim: 1_234_567,
        ticks: 60,
        discount: 1,
        phrasebook: false,
        reviewed: 2,
      },
      60,
    ],
  ];

  it.each(GAMES)(
    'equals buying tick by tick with bestPayback and buyEncounter, in %s',
    (_label, game, units) => {
      expect(checkTickByTick(game)).toBe(units);
    },
  );
});

describe('advance with Pemandu (AC2)', () => {
  it('reports what was produced, not what is left after Pemandu spent', () => {
    const s = pemandu({
      ...at(4, { held: 1e9, owned: { tea0: 1 } }),
      runSpent: tuple(500),
    });
    const { state: later, summary } = advance(
      course,
      s,
      wallMs(s.wall + 60_000),
    );
    const spent = Num.sub(
      Num.fromTuple(later.runSpent),
      Num.fromTuple(s.runSpent),
    );
    expect(Num.toNumber(spent)).toBeGreaterThan(0);
    expect(summary.understandingEarned).toEqual(
      Num.toTuple(
        Num.add(
          Num.sub(understandingNow(course, later), understandingNow(course, s)),
          spent,
        ),
      ),
    );
  });
});
