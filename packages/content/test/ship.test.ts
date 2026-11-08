import { describe, expect, it } from 'vitest';
import enId from './fixtures/en-id.min.json' with { type: 'json' };
import {
  loadCourse,
  needsDisclosure,
  shipErrors,
  type CoursePack,
  type LexiconEntry,
} from '../src/index';

/**
 * What may ship (#51 AC4) and the disclosure line (#51 AC5): every build
 * ships `claude-checked` and `native-reviewed` items and refuses `draft` and
 * `rejected` ones (spec D18, §5.5).
 */

type Status = LexiconEntry['review']['status'];

const fixture = (): CoursePack => {
  const loaded = loadCourse(JSON.parse(JSON.stringify(enId)));
  if (!loaded.ok) throw new Error('the en-id fixture no longer loads');
  return loaded.course;
};

/** The fixture's course, its lexicon one copy of its item per status. */
const courseOf = (...statuses: readonly Status[]): CoursePack => {
  const course = fixture();
  const [item] = course.lexicon;
  if (item === undefined) throw new Error('the en-id fixture has no item');
  return {
    ...course,
    lexicon: statuses.map((status, index) => ({
      ...item,
      id: `item-${String(index)}`,
      review: { ...item.review, status },
    })),
  };
};

const statusError = (item: string) => ({
  kind: 'lexicon',
  item,
  field: 'review.status',
  message: expect.stringMatching(
    new RegExp(`${item}[^]*review\\.status`),
  ) as unknown,
});

describe('shipErrors: only checked content ships (#51 AC4)', () => {
  it('ships a claude-checked item', () => {
    expect(shipErrors(courseOf('claude-checked'))).toEqual([]);
  });

  it('ships a native-reviewed item', () => {
    expect(shipErrors(courseOf('native-reviewed'))).toEqual([]);
  });

  it('refuses a draft item, naming it', () => {
    expect(shipErrors(courseOf('draft'))).toEqual([statusError('item-0')]);
  });

  it('refuses a rejected item, naming it', () => {
    expect(shipErrors(courseOf('rejected'))).toEqual([statusError('item-0')]);
  });

  it('names every item it refuses, and only those', () => {
    expect(
      shipErrors(
        courseOf('claude-checked', 'draft', 'native-reviewed', 'rejected'),
      ),
    ).toEqual([statusError('item-1'), statusError('item-3')]);
  });

  it('says why in the message', () => {
    const [error] = shipErrors(courseOf('rejected'));
    expect(error?.message).toContain('rejected');
  });

  it('ships a course with no lexicon items', () => {
    expect(shipErrors(courseOf())).toEqual([]);
  });
});

describe('needsDisclosure: derived from the content (#51 AC5)', () => {
  it('is true for a course holding a claude-checked item', () => {
    expect(needsDisclosure(courseOf('claude-checked'))).toBe(true);
  });

  it('is true while one item of many is only claude-checked', () => {
    expect(
      needsDisclosure(
        courseOf('native-reviewed', 'claude-checked', 'native-reviewed'),
      ),
    ).toBe(true);
  });

  it('is false when every item is native-reviewed', () => {
    expect(
      needsDisclosure(courseOf('native-reviewed', 'native-reviewed')),
    ).toBe(false);
  });

  it('ignores items that never ship', () => {
    expect(
      needsDisclosure(courseOf('native-reviewed', 'draft', 'rejected')),
    ).toBe(false);
  });

  it('is false for a course with nothing to ship', () => {
    expect(needsDisclosure(courseOf())).toBe(false);
  });
});
