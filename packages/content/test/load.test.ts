import { describe, expect, it } from 'vitest';
import enId from './fixtures/en-id.min.json' with { type: 'json' };
import idEn from './fixtures/id-en.min.json' with { type: 'json' };
import { loadCourse, type LoadError } from '../src/index';

/**
 * Loading a course pack (#101). Every refusal names the item and the field
 * (AC1, AC3), so each case asserts the whole error list, not just `ok`.
 */

type Json = Record<string, unknown>;

/** A deep copy, so a case edits its own pack and never the fixture. */
const copy = (pack: object): Json => JSON.parse(JSON.stringify(pack)) as Json;

/** The pack's first lexicon item, for a case to edit in place. */
const firstItem = (pack: Json): Json => {
  const lexicon = pack.lexicon;
  if (!Array.isArray(lexicon) || lexicon.length === 0)
    throw new Error('fixture has no lexicon item');
  return lexicon[0] as Json;
};

const refusal = (json: unknown): readonly LoadError[] => {
  const result = loadCourse(json);
  if (result.ok) throw new Error('expected a refusal, and the pack loaded');
  return result.errors;
};

/** One lexicon error on `item`/`field`, its message naming both. */
const lexiconError = (item: string, field: string) => ({
  kind: 'lexicon',
  item,
  field,
  message: expect.stringMatching(
    new RegExp(`${item}[^]*${field.replace('.', '\\.')}`),
  ) as unknown,
});

/**
 * A `claude-checked` review block holding all of #51's evidence: two
 * distinct sources, a back-translation, a label audit and one history line.
 */
const checkedReview = (): Json => ({
  status: 'claude-checked',
  reviewer: 'claude',
  reviewedAt: '2026-11-08T03:00:00Z',
  notes: null,
  sources: ['kbbi:rumah', 'wiktionary:rumah'],
  backTranslation: 'house',
  labelAudit: 'the building a family lives in, not a household',
  history: [{ at: '2026-11-08T03:00:00Z', by: 'claude', change: 'checked' }],
});

/** The pack with its first item's review block set to `review`. */
const withReview = (review: Json): Json => {
  const pack = copy(enId);
  firstItem(pack).review = review;
  return pack;
};

describe('loadCourse: both minimal fixtures load (AC6)', () => {
  it('loads the minimal en-id pack, unchanged', () => {
    expect(loadCourse(copy(enId))).toEqual({ ok: true, course: enId });
  });

  it('loads the minimal id-en pack, unchanged', () => {
    expect(loadCourse(copy(idEn))).toEqual({ ok: true, course: idEn });
  });

  it('refuses a pack whose source and target language are the same', () => {
    const pack = copy(enId);
    pack.sourceLang = 'id';
    expect(refusal(pack)).toEqual([
      {
        kind: 'course',
        item: 'course',
        field: 'targetLang',
        message: expect.stringContaining('targetLang') as unknown,
      },
    ]);
  });
});

describe('loadCourse: AC3’s boundary cases, each named by item and field', () => {
  it('refuses an empty translations list', () => {
    const pack = copy(enId);
    firstItem(pack).translations = [];
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'translations')]);
  });

  it('refuses cefr B2', () => {
    const pack = copy(enId);
    firstItem(pack).cefr = 'B2';
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'cefr')]);
  });

  it('refuses an empty tags list', () => {
    const pack = copy(enId);
    firstItem(pack).tags = [];
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'tags')]);
  });

  it('refuses a tag duplicated inside one item', () => {
    const pack = copy(enId);
    firstItem(pack).tags = ['home', 'home'];
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'tags')]);
  });

  it('refuses a whitespace-only pronunciation on an id-en item', () => {
    const pack = copy(idEn);
    firstItem(pack).pronunciation = ' \t ';
    expect(refusal(pack)).toEqual([lexiconError('house', 'pronunciation')]);
  });
});

describe('loadCourse: strict, so a typo fails (AC4)', () => {
  it('refuses translation, a typo for translations, naming the key', () => {
    const pack = copy(enId);
    firstItem(pack).translation = ['house'];
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'translation')]);
  });

  it('refuses an unknown key on the course itself', () => {
    const pack = copy(enId);
    pack.lexicons = [];
    expect(refusal(pack)).toEqual([
      {
        kind: 'course',
        item: 'course',
        field: 'lexicons',
        message: expect.stringContaining('lexicons') as unknown,
      },
    ]);
  });

  it('refuses an unknown key on a kind that carries only an id', () => {
    const pack = copy(enId);
    (pack.regions as Json[])[0] = { id: 'jawa', name: 'Jawa' };
    expect(refusal(pack)).toEqual([
      {
        kind: 'regions',
        item: 'jawa',
        field: 'name',
        message: expect.stringContaining('name') as unknown,
      },
    ]);
  });
});

describe('loadCourse: AC2’s required lexicon fields', () => {
  it.each([
    'target',
    'translations',
    'pos',
    'tags',
    'example',
    'cefr',
    'source',
    'licence',
    'review',
  ])('refuses an item missing %s', (field) => {
    const pack = copy(enId);
    pack.lexicon = [
      Object.fromEntries(
        Object.entries(firstItem(pack)).filter(([key]) => key !== field),
      ),
    ];
    expect(refusal(pack)).toEqual([lexiconError('rumah', field)]);
  });

  it('refuses an item missing id, naming it by its index', () => {
    const pack = copy(enId);
    delete firstItem(pack).id;
    expect(refusal(pack)).toEqual([lexiconError('#0', 'id')]);
  });

  it('refuses an example missing its translation', () => {
    const pack = copy(enId);
    delete (firstItem(pack).example as Json).translation;
    expect(refusal(pack)).toEqual([
      lexiconError('rumah', 'example.translation'),
    ]);
  });
});

describe('loadCourse: pronunciation and audio (AC2)', () => {
  it('refuses an id-en item with no pronunciation, as an en target needs one', () => {
    const pack = copy(idEn);
    delete firstItem(pack).pronunciation;
    expect(refusal(pack)).toEqual([lexiconError('house', 'pronunciation')]);
  });

  it('loads an en-id item that gives a pronunciation, which is optional there', () => {
    const pack = copy(enId);
    firstItem(pack).pronunciation = 'ROO-mah';
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });

  it('loads an item that carries audio, which is optional and unused', () => {
    const pack = copy(enId);
    firstItem(pack).audio = 'rumah.ogg';
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });
});

describe('loadCourse: the review block (spec §5.2)', () => {
  it('refuses a review missing its reviewer key, even on a draft', () => {
    const pack = copy(enId);
    delete (firstItem(pack).review as Json).reviewer;
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.reviewer')]);
  });

  it('refuses a reviewedAt that is a date without a time', () => {
    const pack = copy(enId);
    firstItem(pack).review = { ...checkedReview(), reviewedAt: '2026-10-07' };
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.reviewedAt')]);
  });

  it('loads a reviewedAt with an offset', () => {
    const pack = copy(enId);
    firstItem(pack).review = {
      ...checkedReview(),
      reviewedAt: '2026-10-07T12:40:00+07:00',
    };
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });

  it('refuses a status outside the four', () => {
    const pack = copy(enId);
    (firstItem(pack).review as Json).status = 'approved';
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.status')]);
  });
});

describe('loadCourse: input that is not a pack', () => {
  it('refuses null as a course, naming no item', () => {
    expect(refusal(null)).toEqual([
      {
        kind: 'course',
        item: 'course',
        field: '',
        message: expect.any(String) as unknown,
      },
    ]);
  });
});

describe('loadCourse: a claude-checked block holds its evidence (#51 AC2)', () => {
  it('loads a claude-checked block with all of its evidence', () => {
    const pack = withReview(checkedReview());
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });

  it('refuses a claude-checked block with no sources', () => {
    const pack = withReview({ ...checkedReview(), sources: [] });
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.sources')]);
  });

  it('refuses a claude-checked block with one source', () => {
    const pack = withReview({ ...checkedReview(), sources: ['kbbi:rumah'] });
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.sources')]);
  });

  it('refuses a claude-checked block whose two sources are the same id', () => {
    const pack = withReview({
      ...checkedReview(),
      sources: ['kbbi:rumah', 'kbbi:rumah'],
    });
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.sources')]);
  });

  it('refuses a source id that is whitespace only', () => {
    const pack = withReview({
      ...checkedReview(),
      sources: ['kbbi:rumah', ' '],
    });
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.sources.1')]);
  });

  it('refuses a claude-checked block with a null back-translation', () => {
    const pack = withReview({ ...checkedReview(), backTranslation: null });
    expect(refusal(pack)).toEqual([
      lexiconError('rumah', 'review.backTranslation'),
    ]);
  });

  it('refuses a claude-checked block with a whitespace-only back-translation', () => {
    const pack = withReview({ ...checkedReview(), backTranslation: '  ' });
    expect(refusal(pack)).toEqual([
      lexiconError('rumah', 'review.backTranslation'),
    ]);
  });

  it('refuses a claude-checked one-word item with no label audit', () => {
    const pack = withReview({ ...checkedReview(), labelAudit: null });
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.labelAudit')]);
  });

  it('refuses a claude-checked one-word item with an empty label audit', () => {
    const pack = withReview({ ...checkedReview(), labelAudit: '' });
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.labelAudit')]);
  });

  it('refuses a claude-checked three-word item with no label audit', () => {
    const pack = withReview({ ...checkedReview(), labelAudit: null });
    firstItem(pack).target = 'rumah  saya besar';
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.labelAudit')]);
  });

  it('loads a claude-checked four-word item with no label audit', () => {
    const pack = withReview({ ...checkedReview(), labelAudit: null });
    firstItem(pack).target = 'rumah saya besar sekali';
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });

  it('names every missing piece of evidence at once', () => {
    const pack = withReview({
      ...checkedReview(),
      sources: [],
      backTranslation: null,
      labelAudit: null,
    });
    expect(refusal(pack)).toEqual([
      lexiconError('rumah', 'review.sources'),
      lexiconError('rumah', 'review.backTranslation'),
      lexiconError('rumah', 'review.labelAudit'),
    ]);
  });

  it('loads a draft with no evidence, as the fixtures do', () => {
    const pack = copy(enId);
    expect((firstItem(pack).review as Json).status).toBe('draft');
    expect(loadCourse(pack).ok).toBe(true);
  });

  it('loads a native-reviewed block with no evidence', () => {
    const pack = withReview({
      ...checkedReview(),
      status: 'native-reviewed',
      sources: [],
      backTranslation: null,
      labelAudit: null,
    });
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });

  it('refuses a review block missing its sources key, even on a draft', () => {
    const pack = copy(enId);
    delete (firstItem(pack).review as Json).sources;
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.sources')]);
  });
});

describe('loadCourse: every review block keeps its history (#51 AC3)', () => {
  const withHistoryBy = (by: string): Json =>
    withReview({
      ...checkedReview(),
      history: [{ at: '2026-11-08T03:00:00Z', by, change: 'edited' }],
    });

  it('loads a history line by claude', () => {
    const pack = withHistoryBy('claude');
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });

  it('loads a history line by operator', () => {
    const pack = withHistoryBy('operator');
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });

  it('loads a history line by player-report:<id>', () => {
    const pack = withHistoryBy('player-report:01JC8Q2R4M');
    expect(loadCourse(pack)).toEqual({ ok: true, course: pack });
  });

  it('refuses a history line by anyone else', () => {
    expect(refusal(withHistoryBy('shyden'))).toEqual([
      lexiconError('rumah', 'review.history.0.by'),
    ]);
  });

  it('refuses player-report: with no id', () => {
    expect(refusal(withHistoryBy('player-report:'))).toEqual([
      lexiconError('rumah', 'review.history.0.by'),
    ]);
  });

  it('refuses a player-report id holding whitespace', () => {
    expect(refusal(withHistoryBy('player-report:a b'))).toEqual([
      lexiconError('rumah', 'review.history.0.by'),
    ]);
  });

  it('refuses a by that only starts with claude', () => {
    expect(refusal(withHistoryBy('claude-2'))).toEqual([
      lexiconError('rumah', 'review.history.0.by'),
    ]);
  });

  it('refuses a history time with an offset, as it must be UTC', () => {
    const pack = withReview({
      ...checkedReview(),
      history: [
        { at: '2026-11-08T10:00:00+07:00', by: 'claude', change: 'checked' },
      ],
    });
    expect(refusal(pack)).toEqual([
      lexiconError('rumah', 'review.history.0.at'),
    ]);
  });

  it('refuses a history line with an empty change', () => {
    const pack = withReview({
      ...checkedReview(),
      history: [{ at: '2026-11-08T03:00:00Z', by: 'claude', change: ' ' }],
    });
    expect(refusal(pack)).toEqual([
      lexiconError('rumah', 'review.history.0.change'),
    ]);
  });

  it('refuses an unknown key on a history line', () => {
    const pack = withReview({
      ...checkedReview(),
      history: [
        { at: '2026-11-08T03:00:00Z', by: 'claude', change: 'x', why: 'y' },
      ],
    });
    expect(refusal(pack)).toEqual([
      lexiconError('rumah', 'review.history.0.why'),
    ]);
  });

  it('refuses a review block missing its history key, even on a draft', () => {
    const pack = copy(enId);
    delete (firstItem(pack).review as Json).history;
    expect(refusal(pack)).toEqual([lexiconError('rumah', 'review.history')]);
  });
});

describe('loadCourse: review notes with nothing to say are null (#103)', () => {
  it('loads a null note', () => {
    const pack = copy(enId);
    (firstItem(pack).review as Json).notes = null;
    expect(loadCourse(pack).ok).toBe(true);
  });
});
