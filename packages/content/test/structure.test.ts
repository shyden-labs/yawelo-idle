import { describe, expect, it } from 'vitest';
import enId from './fixtures/en-id.min.json' with { type: 'json' };
import idEn from './fixtures/id-en.min.json' with { type: 'json' };
import {
  loadCourse,
  structureChecks,
  type CoursePack,
  type LexiconEntry,
  type StructureCheck,
} from '../src/index';

/**
 * The structural mistakes that must never ship (#103; spec §5.5): a repeated
 * lexicon id, and an empty or whitespace-only string anywhere in a pack. Each
 * check reports how many units it judged, so one that read nothing cannot
 * pass for a clean result.
 */

const load = (json: unknown): CoursePack => {
  const loaded = loadCourse(JSON.parse(JSON.stringify(json)));
  if (!loaded.ok) throw new Error('the fixture no longer loads');
  return loaded.course;
};

const firstItem = (course: CoursePack): LexiconEntry => {
  const [item] = course.lexicon;
  if (item === undefined) throw new Error('the fixture has no lexicon item');
  return item;
};

/** The fixture with its item followed by `extras`, each changed as given. */
const withExtras = (
  ...extras: readonly Partial<LexiconEntry>[]
): CoursePack => {
  const course = load(enId);
  const item = firstItem(course);
  return {
    ...course,
    lexicon: [item, ...extras.map((extra) => ({ ...item, ...extra }))],
  };
};

const check = (course: CoursePack, name: string): StructureCheck => {
  const found = structureChecks(course).find((each) => each.name === name);
  if (found === undefined) throw new Error(`no check named ${name}`);
  return found;
};

const IDS = 'unique lexicon ids';
const STRINGS = 'no empty strings';

/** The fixture's string leaves, counted by `jq '[..|strings]|length'`. */
const FIXTURE_LEAVES = 22;

describe('structureChecks: the fixtures pass, and say what they judged', () => {
  it('en-id judges its one id', () => {
    expect(check(load(enId), IDS)).toEqual({
      name: IDS,
      judged: 1,
      errors: [],
      message: 'unique lexicon ids: 1 judged, 0 refused',
    });
  });

  it('en-id judges every string leaf', () => {
    expect(check(load(enId), STRINGS)).toEqual({
      name: STRINGS,
      judged: FIXTURE_LEAVES,
      errors: [],
      message: `no empty strings: ${String(FIXTURE_LEAVES)} judged, 0 refused`,
    });
  });

  it('id-en judges its one id', () => {
    expect(check(load(idEn), IDS).judged).toBe(1);
  });

  it('id-en judges every string leaf', () => {
    expect(check(load(idEn), STRINGS).judged).toBe(FIXTURE_LEAVES);
  });

  it('a clean id-en refuses nothing', () => {
    expect(structureChecks(load(idEn)).flatMap((c) => c.errors)).toEqual([]);
  });
});

describe('structureChecks: every lexicon id is unique (AC1)', () => {
  it('names both items of a duplicate, by position and target', () => {
    const course = withExtras({ target: 'omah' });
    expect(check(course, IDS)).toEqual({
      name: IDS,
      judged: 2,
      errors: [
        {
          kind: 'lexicon',
          item: 'rumah',
          field: 'id',
          message: 'lexicon rumah: id is shared by #0 (rumah) and #1 (omah)',
        },
      ],
      message: 'unique lexicon ids: 2 judged, 1 refused',
    });
  });

  it('names all three items of a triple, as one error', () => {
    const course = withExtras({ target: 'omah' }, { target: 'griya' });
    expect(check(course, IDS).errors.map((e) => e.message)).toEqual([
      'lexicon rumah: id is shared by #0 (rumah) and #1 (omah) and #2 (griya)',
    ]);
  });

  it('passes distinct ids that differ only in case', () => {
    expect(check(withExtras({ id: 'Rumah' }), IDS).errors).toEqual([]);
  });

  it('passes two different ids', () => {
    expect(check(withExtras({ id: 'besar' }), IDS)).toMatchObject({
      judged: 2,
      errors: [],
    });
  });

  it('reports each repeated id once, for two separate duplicates', () => {
    const course = withExtras(
      {},
      { id: 'besar' },
      { id: 'besar', target: 'gede' },
    );
    expect(check(course, IDS).errors.map((e) => e.item)).toEqual([
      'rumah',
      'besar',
    ]);
  });
});

describe('structureChecks: no empty string anywhere in a pack (AC2)', () => {
  it('refuses an empty string in a lexicon field', () => {
    const course = withExtras({ id: 'kosong', target: '' });
    expect(check(course, STRINGS).errors).toEqual([
      {
        kind: 'lexicon',
        item: 'kosong',
        field: 'target',
        message: 'lexicon kosong: target is empty or whitespace only',
      },
    ]);
  });

  it('refuses a spaces-only string', () => {
    const course = withExtras({ id: 'kosong', pos: '   ' });
    expect(check(course, STRINGS).errors.map((e) => e.field)).toEqual(['pos']);
  });

  it('refuses a no-break-space-only string', () => {
    const course = withExtras({ id: 'kosong', pos: ' ' });
    expect(check(course, STRINGS).errors.map((e) => e.field)).toEqual(['pos']);
  });

  it('refuses a tabs-and-newlines-only string', () => {
    const course = withExtras({ id: 'kosong', pos: '\t\n' });
    expect(check(course, STRINGS).errors.map((e) => e.field)).toEqual(['pos']);
  });

  it('passes a string with one visible character among spaces', () => {
    const course = withExtras({ id: 'isi', pos: ' n ' });
    expect(check(course, STRINGS).errors).toEqual([]);
  });

  it('refuses an empty string inside an array, naming its position', () => {
    const course = withExtras({ id: 'kosong', translations: ['house', ''] });
    expect(check(course, STRINGS).errors.map((e) => e.field)).toEqual([
      'translations.1',
    ]);
  });

  it('refuses an empty string in a nested object', () => {
    const course = withExtras({
      id: 'kosong',
      example: { target: 'Rumah.', translation: ' ' },
    });
    expect(check(course, STRINGS).errors.map((e) => e.field)).toEqual([
      'example.translation',
    ]);
  });

  it('refuses an empty string in a review block', () => {
    const item = firstItem(load(enId));
    const course = withExtras({
      id: 'kosong',
      review: { ...item.review, notes: '' },
    });
    expect(check(course, STRINGS).errors.map((e) => e.field)).toEqual([
      'review.notes',
    ]);
  });

  it('reads a null as no string, neither judged nor refused', () => {
    const item = firstItem(load(enId));
    const course = load(enId);
    const noted = {
      ...course,
      lexicon: [{ ...item, review: { ...item.review, notes: 'Read.' } }],
    };
    expect(check(noted, STRINGS)).toMatchObject({
      judged: FIXTURE_LEAVES + 1,
      errors: [],
    });
  });

  it('refuses an empty id on a kind other than lexicon', () => {
    const course = { ...load(enId), regions: [{ id: ' ' }] };
    expect(check(course, STRINGS).errors).toEqual([
      {
        kind: 'regions',
        item: '#0',
        field: 'id',
        message: 'regions #0: id is empty or whitespace only',
      },
    ]);
  });

  it('refuses an empty course id, naming the course', () => {
    const course = { ...load(enId), id: '' };
    expect(check(course, STRINGS).errors).toEqual([
      {
        kind: 'course',
        item: 'course',
        field: 'id',
        message: 'course course: id is empty or whitespace only',
      },
    ]);
  });

  it('counts a refused leaf as judged, and states the refusals', () => {
    const course = { ...load(enId), id: '' };
    expect(check(course, STRINGS).message).toBe(
      `no empty strings: ${String(FIXTURE_LEAVES)} judged, 1 refused`,
    );
  });
});

describe('structureChecks: an empty pack is judged, not assumed', () => {
  it('reports zero ids judged for a pack with no lexicon', () => {
    const course = { ...load(enId), lexicon: [] };
    expect(check(course, IDS).message).toBe(
      'unique lexicon ids: 0 judged, 0 refused',
    );
  });
});
