import { describe, it } from 'vitest';
import fc from 'fast-check';
import { HOUR_MS } from '../src/clock.ts';
import { checkJourneySplit, inFlight } from '../test/journeys-laws.ts';

/**
 * The return on random splits of time (#30 AC2), at the full count (#543).
 * The unit suite checks chosen splits through the same check
 * (test/journeys.test.ts).
 */

describe('the return (AC2)', () => {
  it('falls at the same time however integrate is split, with Journeys in flight', () => {
    const out = inFlight();
    const gap = fc.integer({ min: 0, max: 30 * HOUR_MS });
    fc.assert(
      fc.property(gap, gap, (a, b) => {
        checkJourneySplit(out, a, b);
      }),
      { numRuns: 300 },
    );
  });
});
