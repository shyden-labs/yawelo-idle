import { describe, expect, it } from 'vitest';
import enId from './fixtures/en-id.min.json' with { type: 'json' };
import idEn from './fixtures/id-en.min.json' with { type: 'json' };
import {
  attributionOf,
  buildCourse,
  loadCourse,
  SOURCES,
  type CoursePack,
} from '../src/index';

/**
 * The attribution manifest (#122): every source the course cites, with its
 * licence, its address and how many items come from it, and the items under
 * each licence in force. The figures are the fixtures', measured 2026-11-21:
 * 5 items each, 1 from Wiktionary (CC BY-SA 4.0) and 4 original (CC BY-NC-SA
 * 4.0).
 */

const load = (json: unknown): CoursePack => {
  const loaded = loadCourse(JSON.parse(JSON.stringify(json)));
  if (!loaded.ok) throw new Error('a fixture no longer loads');
  return loaded.course;
};

const MEASURED = {
  items: 5,
  sources: [
    {
      id: 'original',
      licence: 'CC-BY-NC-SA-4.0',
      url: SOURCES['original']?.url,
      items: 4,
    },
    {
      id: 'wiktionary',
      licence: 'CC-BY-SA-4.0',
      url: SOURCES['wiktionary']?.url,
      items: 1,
    },
  ],
  licences: [
    { licence: 'CC-BY-SA-4.0', items: 1 },
    { licence: 'CC-BY-NC-SA-4.0', items: 4 },
  ],
  unused: [],
};

describe('attributionOf (#122 AC1, AC2)', () => {
  it('lists the en-id course’s sources and licences, item by item', () => {
    expect(attributionOf(load(enId))).toEqual({ course: 'en-id', ...MEASURED });
  });

  it('lists the id-en course’s sources and licences, item by item', () => {
    expect(attributionOf(load(idEn))).toEqual({ course: 'id-en', ...MEASURED });
  });

  it('counts every licensed item once: the licences add up to the items', () => {
    const { items, licences, sources } = attributionOf(load(enId));
    expect(licences.reduce((sum, l) => sum + l.items, 0)).toBe(items);
    expect(sources.reduce((sum, s) => sum + s.items, 0)).toBe(items);
  });
});

describe('a registered source no item cites (#122 AC3)', () => {
  it('is reported as unused, and left out of the credits', () => {
    const course = load(enId);
    const lexicon = course.lexicon.map((item) => ({
      ...item,
      source: 'original:rumah',
      licence: 'CC-BY-NC-SA-4.0',
    }));
    const attribution = attributionOf({ ...course, lexicon });
    expect(attribution.unused).toEqual(['wiktionary']);
    expect(attribution.sources.map((s) => s.id)).toEqual(['original']);
  });
});

/** The en-id course with its items marked native-reviewed, so it may ship. */
const shippable = (): CoursePack => {
  const course = load(enId);
  return {
    ...course,
    lexicon: course.lexicon.map((item) => ({
      ...item,
      review: { ...item.review, status: 'native-reviewed' as const },
    })),
  };
};

describe('the build (#122 AC1, AC3)', () => {
  it('returns the manifest with the bundle', () => {
    const course = shippable();
    const built = buildCourse(course);
    expect(built.ok && built.attribution).toEqual(attributionOf(course));
  });

  it('refuses a course citing a source missing from the registry, so no manifest is made', () => {
    const course = shippable();
    const lexicon = course.lexicon.map((item) => ({
      ...item,
      source: 'kbbi:rumah',
    }));
    const built = buildCourse({ ...course, lexicon });
    expect(built.ok).toBe(false);
    expect(built.ok ? [] : built.refusals.map((r) => r.error.field)).toContain(
      'source',
    );
  });
});

describe('the manifest’s text (#122 AC4, Refs #51)', () => {
  it('claims no native review and stores no disclosure flag', () => {
    const text = JSON.stringify(attributionOf(load(enId)));
    expect(text).not.toMatch(/native|review|disclos/i);
  });
});
