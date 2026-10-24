import { describe, expect, it } from 'vitest';
import {
  boughtIn,
  GOLDEN,
  playGolden,
  playGoldenSlice,
  writeGolden,
} from '../../core/fixtures/golden-log.ts';
import {
  judgeShopAlong,
  shopCounts,
  type ShopKind,
  type ShopTally,
} from '../../core/fixtures/shop-agreement.ts';
import { stateHash } from '../../core/src/hash.ts';
import { apply, replay } from '../../core/src/log.ts';
import type { GameState } from '../../core/src/state.ts';
import { floorBreach } from '../../../tests/floors.ts';
import {
  allEvents,
  eventsOf,
  golden,
  HEAVY_ROWS,
  REGENERATE,
  sliceOf,
  startOf,
  total,
  totals,
  type SliceRow,
} from '../../../tests/golden.ts';
import { searched } from '../../../tests/searched.ts';

/**
 * The golden log's runs that do not fit the unit suite (#542): each heavy
 * slice, whose resume alone is over the unit suite's line because Pemandu
 * buys thousands of Encounters across the gap, checked as the unit suite
 * checks every other slice (`tests/unit/golden-log.test.ts`,
 * `tests/unit/shop-agreement.test.ts`); and the whole log, played, replayed
 * and judged from the first state, so no real run is dropped when the unit
 * suite replays slices (AC4). This suite has one measured limit, at its CI
 * step, and none per test (#476).
 */

/** The kinds the shop is judged by, listed here so collection calls nothing (#97). */
const KINDS = [
  'encounters',
  'pickUp',
  'upgrades',
  'grammar',
  'journeys',
  'pemandu',
  'practice',
] as const satisfies readonly ShopKind[];

/** The heavy slices: one test each. */
const HEAVY: readonly SliceRow[] = [...HEAVY_ROWS];
/** Every heavy slice with every kind: one test each. */
const HEAVY_KINDS = HEAVY.flatMap(([n, day, open, part]) =>
  KINDS.map((kind) => [n, day, open, part, kind] as const),
);

/** Walk events from a state with `apply`, keeping what is accepted. */
function walk(state: GameState, n: number): GameState {
  let current = state;
  for (const event of eventsOf(n).events) {
    const result = apply(golden().course, current, event);
    if (result.ok) current = result.state;
  }
  return current;
}

const judged = new Map<number, Record<ShopKind, ShopTally>>();

/** Slice `n` judged from its recorded start, once for all its kinds' tests. */
function judgedSlice(n: number): Record<ShopKind, ShopTally> {
  let tallies = judged.get(n);
  if (tallies === undefined) {
    tallies = judgeShopAlong(
      golden().course,
      startOf(n).state,
      eventsOf(n).events,
    );
    judged.set(n, tallies);
  }
  return tallies;
}

let wholeJudged: Record<ShopKind, ShopTally> | undefined;

/** The whole log judged from the first state, once for all the kinds' tests. */
function judgedWhole(): Record<ShopKind, ShopTally> {
  const { course, initial } = golden();
  wholeJudged ??= judgeShopAlong(course, initial, allEvents());
  return wholeJudged;
}

describe('each heavy slice, from its start (#542)', () => {
  it.each(HEAVY)(
    'slice %i (day %i, open %i, part %i): is heavy, its resume buying the Encounters recorded',
    (n) => {
      const slice = sliceOf(n);
      const [first] = eventsOf(n).events;
      if (first === undefined) throw new Error(`slice ${String(n)} is empty`);
      expect(boughtIn(golden().course, startOf(n).state, first)).toBe(
        slice.purchases,
      );
      expect(slice.purchases).toBeGreaterThan(GOLDEN.heavyPurchases);
    },
  );

  it.each(HEAVY)(
    'slice %i (day %i, open %i, part %i): the policy, resumed at its start, writes exactly its events and ends where the next slice starts',
    (n) => {
      const slice = sliceOf(n);
      const { events, lines } = eventsOf(n);
      const played = playGoldenSlice(golden().course, slice, startOf(n));
      expect(played.events, REGENERATE).toEqual(events);
      expect(
        played.events.map((e) => JSON.stringify(e)),
        REGENERATE,
      ).toEqual(lines);
      expect(played.opens, REGENERATE).toEqual(slice.opens);
      expect(played.end, REGENERATE).toEqual(startOf(n + 1));
      expect({ accepted: played.accepted, refused: played.refused }).toEqual({
        accepted: slice.accepted,
        refused: slice.refused,
      });
    },
  );

  it.each(HEAVY)(
    'slice %i (day %i, open %i, part %i): replay of its events from its start reaches where the next slice starts',
    (n) => {
      const replayed = replay(
        golden().course,
        startOf(n).state,
        eventsOf(n).events,
      );
      expect(replayed.state, REGENERATE).toEqual(startOf(n + 1).state);
      expect(replayed.refused).toHaveLength(total(sliceOf(n).refused));
    },
  );

  it.each(HEAVY)(
    'slice %i (day %i, open %i, part %i): a walk of its events with apply reaches where the next slice starts',
    (n) => {
      expect(walk(startOf(n).state, n), REGENERATE).toEqual(
        startOf(n + 1).state,
      );
    },
  );

  it.each(HEAVY_KINDS)(
    'slice %i (day %i, open %i, part %i): every %s offer’s affordable is apply’s answer',
    (n, _day, _open, _part, kind) => {
      const tally = judgedSlice(n)[kind];
      const offers = tally.accepted + tally.refused;
      expect(
        searched(tally.disagreements, {
          of: offers,
          what: `slice ${String(n)}'s judged ${kind} offers`,
        }),
      ).toEqual([]);
      expect(shopCounts(judgedSlice(n))[kind], REGENERATE).toEqual(
        sliceOf(n).shop[kind],
      );
      expect(
        floorBreach(`shop-agreement/slice ${String(n)}/${kind}`, offers),
      ).toBeUndefined();
    },
  );
});

describe('the whole golden log, from the first state (#542 AC4)', () => {
  it('the golden policy, played whole, writes exactly the log', () => {
    const run = playGolden(golden().course);
    expect(writeGolden(run) === golden().text, REGENERATE).toBe(true);
  });

  it('replay of the whole log reaches the live hash, refusing what the slices recorded', () => {
    const { course, initial, header } = golden();
    const replayed = replay(course, initial, allEvents());
    expect(stateHash(replayed.state), REGENERATE).toBe(header.liveHash);
    expect(replayed.refused).toHaveLength(total(totals('refused')));
  });

  it.each(KINDS)(
    'judged whole, every %s offer’s affordable is apply’s answer, as many as the slices judged',
    (kind) => {
      const tally = judgedWhole()[kind];
      const offers = tally.accepted + tally.refused;
      expect(
        searched(tally.disagreements, {
          of: offers,
          what: `the whole log's judged ${kind} offers`,
        }),
      ).toEqual([]);
      let accepted = 0;
      let refused = 0;
      for (const slice of golden().slices) {
        accepted += slice.shop[kind].accepted;
        refused += slice.shop[kind].refused;
      }
      expect(shopCounts(judgedWhole())[kind], REGENERATE).toEqual({
        accepted,
        refused,
      });
      expect(
        floorBreach(`shop-agreement/whole log/${kind}`, offers),
      ).toBeUndefined();
    },
  );
});
