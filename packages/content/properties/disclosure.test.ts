import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import enId from '../test/fixtures/en-id.min.json' with { type: 'json' };
import {
  loadCourse,
  needsDisclosure,
  shipErrors,
  type CoursePack,
  type LexiconEntry,
} from '../src/index';

/**
 * The disclosure line and the ship gate over generated courses (#51 AC5).
 * The unit suite holds the named cases (test/ship.test.ts).
 */

type Status = LexiconEntry['review']['status'];

const STATUSES: readonly Status[] = [
  'draft',
  'claude-checked',
  'native-reviewed',
  'rejected',
];

const loaded = loadCourse(JSON.parse(JSON.stringify(enId)));
if (!loaded.ok) throw new Error('the en-id fixture no longer loads');
const base = loaded.course;
const [item] = base.lexicon;
if (item === undefined) throw new Error('the en-id fixture has no item');

const courseOf = (statuses: readonly Status[]): CoursePack => ({
  ...base,
  lexicon: statuses.map((status, index) => ({
    ...item,
    id: `item-${String(index)}`,
    review: { ...item.review, status },
  })),
});

const shipped = (status: Status): boolean =>
  status === 'claude-checked' || status === 'native-reviewed';

const statuses = fc.array(fc.constantFrom(...STATUSES), { maxLength: 40 });

describe('needsDisclosure over generated courses (#51 AC5)', () => {
  it('is true exactly when a shipped item is below native-reviewed', () => {
    fc.assert(
      fc.property(statuses, (list) => {
        const expected = list.some(
          (status) => shipped(status) && status !== 'native-reviewed',
        );
        expect(needsDisclosure(courseOf(list))).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });

  it('is false whenever every shipped item is native-reviewed', () => {
    const fullyReviewed = fc.array(
      fc.constantFrom<Status>('native-reviewed', 'draft', 'rejected'),
      { maxLength: 40 },
    );
    fc.assert(
      fc.property(fullyReviewed, (list) => {
        expect(needsDisclosure(courseOf(list))).toBe(false);
      }),
      { numRuns: 500 },
    );
  });
});

describe('shipErrors over generated courses (#51 AC4)', () => {
  it('names exactly the draft and rejected items, in order', () => {
    fc.assert(
      fc.property(statuses, (list) => {
        const refused = list.flatMap((status, index) =>
          shipped(status) ? [] : [`item-${String(index)}`],
        );
        expect(shipErrors(courseOf(list)).map((error) => error.item)).toEqual(
          refused,
        );
      }),
      { numRuns: 500 },
    );
  });
});
