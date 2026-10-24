import { describe, expect, it } from 'vitest';
import { floorBreach } from '../../../tests/floors.ts';
import { searched } from '../../../tests/searched.ts';
import {
  buys,
  fresh,
  holding,
  ONE_CHECK,
  play,
  shopAfter,
  withWords,
} from '../test/open.ts';

/**
 * The player's buying, at a fortune of 1e7 Understanding: about 220
 * purchases in one check, 25 to 40 ms of CPU, past a unit test's 0.1 s on a
 * busy laptop (#544). The unit suite's `player.test.ts` plays the same
 * policy at 3,000; these are its runs at the original fortune, deep into
 * the catalogue. Each count is a recorded floor, read for equality.
 */

const FORTUNE = 1e7;

function rich() {
  return holding(withWords(fresh(), 3), FORTUNE);
}

describe('an open at a fortune of 1e7', () => {
  it('buys until nothing is affordable', () => {
    const { player, events } = play('casual', rich(), ONE_CHECK);
    const shop = shopAfter(player, events);
    expect(
      searched(
        shop.encounters.filter((o) => o.affordable).map((o) => o.id),
        { of: shop.encounters, what: 'Encounters on offer' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('player-rich/casual offers', shop.encounters.length),
    ).toBeUndefined();
    expect(shop.pickUp?.affordable ?? false).toBe(false);
    expect(
      floorBreach('player-rich/casual buys', buys(events).length),
    ).toBeUndefined();
  });

  it('the Capped Buyer makes 5 purchases in a check where the Casual Learner makes more', () => {
    const capped = buys(play('capped', rich(), ONE_CHECK).events);
    const casual = buys(play('casual', rich(), ONE_CHECK).events);
    expect(capped).toHaveLength(5);
    expect(casual.length).toBeGreaterThan(capped.length);
  });

  it('the Random Buyer buys until nothing is affordable, in its own order', () => {
    const random = play('random', rich(), ONE_CHECK);
    const greedy = play('casual', rich(), ONE_CHECK);
    const shop = shopAfter(random.player, random.events);
    expect(
      searched(
        shop.encounters.filter((o) => o.affordable).map((o) => o.id),
        { of: shop.encounters, what: 'Encounters on offer' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('player-rich/random offers', shop.encounters.length),
    ).toBeUndefined();
    expect(
      floorBreach('player-rich/random buys', buys(random.events).length),
    ).toBeUndefined();
    expect(buys(random.events)).not.toEqual(buys(greedy.events));
  });
});
