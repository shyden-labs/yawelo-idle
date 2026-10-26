import { describe, expect, it } from 'vitest';
import {
  judgeShopAlong,
  SHOP_KINDS,
  SHOP_READ_BEFORE,
  shopCounts,
  type ShopCount,
  type ShopKind,
  type ShopTally,
} from '../../packages/core/fixtures/shop-agreement.ts';
import { floorBreach } from '../floors.ts';
import {
  eventsOf,
  golden,
  REGENERATE,
  sliceOf,
  SHOP_FREE_ROWS,
  SHOP_ROWS,
  startOf,
  type SliceRow,
} from '../golden.ts';
import { searched } from '../searched.ts';

/**
 * The shop can never disagree with `apply` (#35 AC3), judged along the golden
 * log one slice at a time (#479 by day; #542 by open): each slice from its
 * recorded start (#473), so no test walks the whole log. Each slice's tests
 * prove the counts `npm run golden-log` recorded for it, and the whole log's
 * counts are those added up. The heavy slices, whose resume alone is over
 * the unit suite's line, are judged in the pacing suite, with the whole log
 * (`packages/bots/pacing/golden-log.test.ts`).
 */

/**
 * Judgements measured on #35's tuned golden log (2026-10-04), each floor the
 * measured figure less one, which the count must exceed. Regenerating the
 * golden log moves them, deliberately.
 */
const FLOORS: Readonly<Record<ShopKind, ShopCount>> = {
  encounters: { accepted: 13337, refused: 4481 },
  pickUp: { accepted: 976, refused: 1562 },
  upgrades: { accepted: 325, refused: 50473 },
  grammar: { accepted: 217, refused: 30261 },
  journeys: { accepted: 1545, refused: 11153 },
  pemandu: { accepted: 1447, refused: 8711 },
  practice: { accepted: 2524, refused: 14 },
};

/** The kinds `judgeShopAlong` judges, listed here so collection calls nothing (#97). */
const KINDS = [
  'encounters',
  'pickUp',
  'upgrades',
  'grammar',
  'journeys',
  'pemandu',
  'practice',
] as const satisfies readonly ShopKind[];

/**
 * The slices this suite judges: the heavy ones are the pacing suite's, and
 * the shop-free ones are proven so below (#553).
 */
const UNIT: readonly SliceRow[] = [...SHOP_ROWS];
/** The slices that read no shop, known before the run: one test each. */
const SHOP_FREE: readonly SliceRow[] = [...SHOP_FREE_ROWS];
/** Every unit slice with every kind: one test each. */
const SLICE_KINDS = UNIT.flatMap(([n, day, open, part]) =>
  KINDS.map((kind) => [n, day, open, part, kind] as const),
);

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

/** A kind's recorded counts over every slice: each slice's own test proves its figure. */
function total(kind: ShopKind): ShopCount {
  let accepted = 0;
  let refused = 0;
  for (const slice of golden().slices) {
    accepted += slice.shop[kind].accepted;
    refused += slice.shop[kind].refused;
  }
  return { accepted, refused };
}

describe('the shop agrees with apply along the golden log, slice by slice (AC3, #479, #542)', () => {
  it.each(SLICE_KINDS)(
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

  it.each(SHOP_FREE)(
    'slice %i (day %i, open %i, part %i) reads no shop: none of its events is one the shop is read before (#553)',
    (n) => {
      const { events } = eventsOf(n);
      expect(
        searched(
          events.filter((event) => SHOP_READ_BEFORE.has(event.type)),
          { of: events, what: `slice ${String(n)}'s events` },
        ),
      ).toEqual([]);
      expect(
        floorBreach(
          `shop-agreement/shop-free slice ${String(n)}`,
          events.length,
        ),
      ).toBeUndefined();
      expect(sliceOf(n).shop, REGENERATE).toEqual(
        Object.fromEntries(
          KINDS.map((kind) => [kind, { accepted: 0, refused: 0 }]),
        ),
      );
    },
  );

  it('judges the kinds the shop is judged by', () => {
    expect(KINDS).toEqual(SHOP_KINDS);
  });

  it.each(KINDS)(
    'the slices judge, between them, the %s offers the whole log did',
    (kind) => {
      const { accepted, refused } = total(kind);
      expect(
        floorBreach(`shop-agreement/judged/${kind}`, accepted + refused),
      ).toBeUndefined();
    },
  );

  it.each(KINDS)(
    'judged %s offers apply accepted, at least the floor',
    (kind) => {
      expect(total(kind).accepted).toBeGreaterThan(FLOORS[kind].accepted);
    },
  );

  it.each(KINDS)(
    'judged %s offers apply refused, at least the floor',
    (kind) => {
      expect(total(kind).refused).toBeGreaterThan(FLOORS[kind].refused);
    },
  );
});
