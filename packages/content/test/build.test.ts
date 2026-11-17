import { describe, expect, it } from 'vitest';
import { canonicalHash } from '@yawelo-idle/core';
import enId from './fixtures/en-id.min.json' with { type: 'json' };
import {
  buildCourse,
  loadCourse,
  type CoursePack,
  type LexiconEntry,
} from '../src/index';

/**
 * The content build (#106): a course that may ship becomes one JSON bundle
 * and a `contentVersion` hashed from its canonical form; any ship, structure
 * or licence error refuses it, naming the gate and the item.
 */

type Status = LexiconEntry['review']['status'];

const fixture = (): CoursePack => {
  const loaded = loadCourse(JSON.parse(JSON.stringify(enId)));
  if (!loaded.ok) throw new Error('the en-id fixture no longer loads');
  return loaded.course;
};

/** The fixture's course, its one item with `status` and `changes` applied. */
const courseWith = (
  status: Status,
  changes: Partial<LexiconEntry> = {},
): CoursePack => {
  const course = fixture();
  const [item] = course.lexicon;
  if (item === undefined) throw new Error('the en-id fixture has no item');
  return {
    ...course,
    lexicon: [{ ...item, review: { ...item.review, status }, ...changes }],
  };
};

const gatesOf = (course: CoursePack): string[] => {
  const result = buildCourse(course);
  return result.ok ? [] : result.refusals.map(({ gate }) => gate);
};

describe('a course that may ship (#106 AC1)', () => {
  it('builds into its JSON bundle', () => {
    const course = courseWith('native-reviewed');
    const result = buildCourse(course);
    expect(result.ok && (JSON.parse(result.bundle) as unknown)).toEqual(course);
  });

  it('is versioned by the hash of its canonical form', () => {
    const course = courseWith('native-reviewed');
    const result = buildCourse(course);
    expect(result.ok && result.contentVersion).toBe(canonicalHash(course));
  });

  it('gets the same version from the same input, built twice', () => {
    const first = buildCourse(courseWith('claude-checked'));
    const second = buildCourse(courseWith('claude-checked'));
    expect(first.ok && first.contentVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(second.ok && second.contentVersion).toBe(
      first.ok && first.contentVersion,
    );
  });
});

describe('the build refuses what may not ship (#106 AC2)', () => {
  it('refuses a draft item at the ship gate, naming it', () => {
    const result = buildCourse(courseWith('draft'));
    expect(!result.ok && result.refusals[0]).toEqual({
      gate: 'ship',
      error: expect.objectContaining({
        item: 'rumah',
        field: 'review.status',
      }) as unknown,
    });
  });

  it('refuses a rejected item at the ship gate', () => {
    expect(gatesOf(courseWith('rejected'))).toEqual(['ship']);
  });

  it('refuses a repeated id at the structure gate', () => {
    const course = courseWith('native-reviewed');
    const [item] = course.lexicon;
    if (item === undefined) throw new Error('no item');
    expect(gatesOf({ ...course, lexicon: [item, item] })).toEqual([
      'structure',
    ]);
  });

  it('refuses an unregistered source at the licence gate', () => {
    expect(
      gatesOf(courseWith('native-reviewed', { source: 'nowhere:rumah' })),
    ).toEqual(['licence']);
  });
});

/** The version of the fixture's course with `change` made to its one item. */
const versionAfter = (
  change: (item: LexiconEntry) => LexiconEntry,
): string | false => {
  const course = courseWith('native-reviewed');
  const [item] = course.lexicon;
  if (item === undefined) throw new Error('no item');
  const result = buildCourse({ ...course, lexicon: [change(item)] });
  return result.ok && result.contentVersion;
};

/** `text` with its first character replaced by a different one. */
const oneCharOff = (text: string): string =>
  `${text.startsWith('x') ? 'y' : 'x'}${text.slice(1)}`;

describe('one character changes the version (#106 AC3)', () => {
  const unchanged = (): string | false => versionAfter((item) => item);

  it('in the item target', () => {
    expect(
      versionAfter((item) => ({ ...item, target: oneCharOff(item.target) })),
    ).not.toBe(unchanged());
  });

  it('in a translation', () => {
    expect(
      versionAfter((item) => ({
        ...item,
        translations: item.translations.map((t, i) =>
          i === 0 ? oneCharOff(t) : t,
        ),
      })),
    ).not.toBe(unchanged());
  });

  it('in the example sentence', () => {
    expect(
      versionAfter((item) => ({
        ...item,
        example: { ...item.example, target: oneCharOff(item.example.target) },
      })),
    ).not.toBe(unchanged());
  });

  it('in the example translation', () => {
    expect(
      versionAfter((item) => ({
        ...item,
        example: {
          ...item.example,
          translation: oneCharOff(item.example.translation),
        },
      })),
    ).not.toBe(unchanged());
  });

  it('in a tag', () => {
    expect(
      versionAfter((item) => ({
        ...item,
        tags: item.tags.map((t, i) => (i === 0 ? oneCharOff(t) : t)),
      })),
    ).not.toBe(unchanged());
  });
});
