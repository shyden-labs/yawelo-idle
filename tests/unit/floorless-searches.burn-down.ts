/**
 * Every scope holding an absence search that proves nothing about its
 * population, by `file › test title as written` (or the named function), with
 * how many (#361). Measured when the meta-guard landed. A search is proved by
 * a recorded floor on the population its `of:` names, checked in the same
 * scope, or, for an input left empty on purpose, by againstControl.
 *
 * Checked for equality both ways by `floorless-searches.test.ts`: a new
 * unproved search fails, and so does a converted one until its entry is
 * lowered. It only shrinks.
 */
export const UNPROVED: Readonly<Record<string, number>> = {
  'packages/core/test/automation.test.ts › buys nothing when nothing is owned and nothing is affordable': 1,
  'packages/core/test/cards.test.ts › is not shown while no card is held': 1,
  'packages/core/test/grammar.test.ts › is empty with no node owned': 1,
  'packages/core/test/hash.test.ts › changes when any numeric field moves by one ulp': 1,
  'packages/core/test/ladder.test.ts › carries no tier into the course core plays': 1,
  'packages/core/test/log.test.ts › a log with a refused event inserted replays to the state without it': 1,
  'packages/core/test/review.test.ts › is empty when nothing is due': 2,
  "packages/core/test/sail.test.ts › a sail from destination ${String(i)} goes to ${IDS[i + 1] ?? ''}": 1,
  'packages/core/test/sail.test.ts › never needs a review: unreviewed words and no Insight still sail (D1)': 1,
  'packages/core/test/sail.test.ts › owns no Encounters and holds only the starting grant, with nothing spent': 1,
  'packages/core/test/sail.test.ts › resets exactly the Encounters owned and the Understanding held': 1,
  'packages/core/test/shop.test.ts › is not affordable before grammar opens, however much Insight is held': 1,
  'packages/core/test/shop.test.ts › offers nothing while every open slot is busy': 1,
  'packages/core/test/shop.test.ts › stays on offer with nothing else affordable, as Practice costs nothing': 1,
  'packages/core/test/words.test.ts › is refused when the pool is empty, never reaching a later destination': 1,
  'packages/lockdown/test/lockdown.test.ts › challenges %s on a non-prod host and never serves': 2,
  'packages/lockdown/test/lockdown.test.ts › challenges every request when the password is not configured': 1,
  'packages/lockdown/test/lockdown.test.ts › serves blocking robots.txt on a non-prod host': 1,
  'packages/lockdown/test/lockdown.test.ts › serves blocking robots.txt on a non-prod host without credentials': 1,
};
