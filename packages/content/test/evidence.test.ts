import { describe, expect, it } from 'vitest';
import enId from './fixtures/en-id.min.json' with { type: 'json' };
import {
  evidenceGaps,
  loadCourse,
  promote,
  recordBackTranslation,
  recordLabelAudit,
  recordSource,
  statusReport,
  type CoursePack,
  type Edit,
  type Review,
} from '../src/index.ts';

/**
 * The Claude-check evidence recorder (#109; spec §5.2, D18). Each edit is a
 * pure function from one course to the next; each case asserts the whole
 * review block, the whole refusal, or the whole report.
 */

const NOW = '2026-11-15T03:00:00Z';

/** The en-id fixture, loaded, its one item's review overridden by `review`. */
const pack = (review: Partial<Review> = {}, target?: string): CoursePack => {
  const loaded = loadCourse(JSON.parse(JSON.stringify(enId)));
  if (!loaded.ok) throw new Error('the en-id fixture no longer loads');
  const item = loaded.course.lexicon[0];
  if (item === undefined) throw new Error('the en-id fixture has no item');
  item.review = { ...item.review, ...review };
  if (target !== undefined) item.target = target;
  return loaded.course;
};

const edited = (edit: Edit): CoursePack => {
  if (!edit.ok) throw new Error(`expected an edit, got: ${edit.message}`);
  return edit.course;
};

const review = (course: CoursePack): Review => {
  const item = course.lexicon[0];
  if (item === undefined) throw new Error('no item');
  return item.review;
};

/** A draft with every piece of evidence in place. */
const ready = (): CoursePack =>
  pack({
    sources: ['wiktionary:rumah', 'kbbi:rumah'],
    backTranslation: 'house',
    labelAudit: 'a dwelling, not a household',
  });

const SOURCES = 'review.sources needs at least two distinct source ids';
const BACK = 'review.backTranslation is required on a claude-checked item';
const AUDIT =
  'review.labelAudit is required on a claude-checked item of 3 words or fewer';

describe('evidenceGaps: each item below claude-checked and what it lacks (AC1)', () => {
  it('names the three gaps of an empty one-word draft', () => {
    expect(evidenceGaps(pack())).toEqual([
      { item: 'rumah', status: 'draft', missing: [SOURCES, BACK, AUDIT] },
    ]);
  });

  it('asks no label audit of a four-word text', () => {
    expect(evidenceGaps(pack({}, 'rumah saya sangat besar'))).toEqual([
      { item: 'rumah', status: 'draft', missing: [SOURCES, BACK] },
    ]);
  });

  it('lists a draft with all its evidence, with nothing missing', () => {
    expect(evidenceGaps(ready())).toEqual([
      { item: 'rumah', status: 'draft', missing: [] },
    ]);
  });

  it('leaves out a claude-checked item', () => {
    expect(evidenceGaps(edited(promote(ready(), 'rumah', NOW)))).toEqual([]);
  });

  it('leaves out a rejected item', () => {
    expect(evidenceGaps(pack({ status: 'rejected' }))).toEqual([]);
  });
});

describe('recordSource (AC2)', () => {
  it('adds the first source and a history line by claude', () => {
    const after = review(
      edited(recordSource(pack(), 'rumah', 'wiktionary:rumah', NOW)),
    );
    expect(after.sources).toEqual(['wiktionary:rumah']);
    expect(after.history).toEqual([
      { at: NOW, by: 'claude', change: 'Source recorded: wiktionary:rumah.' },
    ]);
  });

  it('adds a second source distinct from the first and the drafting source', () => {
    const course = pack({ sources: ['wiktionary:rumah'] });
    expect(
      review(edited(recordSource(course, 'rumah', 'kbbi:rumah', NOW))).sources,
    ).toEqual(['wiktionary:rumah', 'kbbi:rumah']);
  });

  it('refuses a source id already recorded', () => {
    const course = pack({ sources: ['kbbi:rumah'] });
    expect(recordSource(course, 'rumah', 'kbbi:rumah', NOW)).toEqual({
      ok: false,
      message: 'rumah: source kbbi:rumah is already recorded',
    });
  });

  it('refuses the drafting source as a second source', () => {
    const course = pack({ sources: ['kbbi:rumah'] });
    expect(recordSource(course, 'rumah', 'wiktionary:rumah', NOW)).toEqual({
      ok: false,
      message:
        'rumah: wiktionary:rumah is the drafting source, so it is not a second independent source',
    });
  });

  it('refuses a blank source id', () => {
    expect(recordSource(pack(), 'rumah', ' ', NOW)).toEqual({
      ok: false,
      message: 'rumah: the source id is empty',
    });
  });

  it('refuses an id no lexicon item has', () => {
    expect(recordSource(pack(), 'kucing', 'kbbi:kucing', NOW)).toEqual({
      ok: false,
      message: 'kucing: no lexicon item has this id',
    });
  });

  it('never changes the course it is given', () => {
    const course = pack();
    recordSource(course, 'rumah', 'kbbi:rumah', NOW);
    expect(review(course)).toEqual(review(pack()));
  });
});

describe('recordBackTranslation (AC3)', () => {
  it('stores the text, notes the method in the history, and flags nothing', () => {
    const edit = recordBackTranslation(
      pack(),
      'rumah',
      'house',
      'Google Cloud Translation',
      NOW,
    );
    expect(edit.ok && edit.flags).toEqual([]);
    const after = review(edited(edit));
    expect(after.backTranslation).toBe('house');
    expect(after.history).toEqual([
      {
        at: NOW,
        by: 'claude',
        change:
          'Back-translation recorded (method: Google Cloud Translation): house',
      },
    ]);
  });

  it('records one identical to the source string, and flags it for human attention', () => {
    const edit = recordBackTranslation(
      pack(),
      'rumah',
      'rumah',
      'Google Cloud Translation',
      NOW,
    );
    expect(edit.ok && edit.flags).toEqual([
      'rumah: the back-translation is identical to the source string, so it needs human attention',
    ]);
    expect(review(edited(edit)).backTranslation).toBe('rumah');
  });

  it('counts a back-translation differing only in case and spacing as identical', () => {
    const edit = recordBackTranslation(
      pack(),
      'rumah',
      ' RUMAH  ',
      'Google Cloud Translation',
      NOW,
    );
    expect(edit.ok && edit.flags.length).toBe(1);
  });

  it('refuses a blank back-translation', () => {
    expect(
      recordBackTranslation(
        pack(),
        'rumah',
        '',
        'Google Cloud Translation',
        NOW,
      ),
    ).toEqual({ ok: false, message: 'rumah: the back-translation is empty' });
  });

  it('refuses a blank method', () => {
    expect(recordBackTranslation(pack(), 'rumah', 'house', ' ', NOW)).toEqual({
      ok: false,
      message: 'rumah: the back-translation method is empty',
    });
  });

  it('refuses an id no lexicon item has', () => {
    expect(
      recordBackTranslation(
        pack(),
        'kucing',
        'cat',
        'Google Cloud Translation',
        NOW,
      ),
    ).toEqual({ ok: false, message: 'kucing: no lexicon item has this id' });
  });
});

describe('recordLabelAudit', () => {
  it('stores the note and a history line by claude', () => {
    const after = review(
      edited(recordLabelAudit(pack(), 'rumah', 'a dwelling', NOW)),
    );
    expect(after.labelAudit).toBe('a dwelling');
    expect(after.history).toEqual([
      { at: NOW, by: 'claude', change: 'Label audit recorded: a dwelling' },
    ]);
  });

  it('refuses a blank note', () => {
    expect(recordLabelAudit(pack(), 'rumah', '\t', NOW)).toEqual({
      ok: false,
      message: 'rumah: the label-audit note is empty',
    });
  });

  it('refuses an id no lexicon item has', () => {
    expect(recordLabelAudit(pack(), 'kucing', 'a cat', NOW)).toEqual({
      ok: false,
      message: 'kucing: no lexicon item has this id',
    });
  });
});

describe('promote (AC4)', () => {
  it('promotes a draft with its evidence, naming claude and the change', () => {
    expect(review(edited(promote(ready(), 'rumah', NOW)))).toEqual({
      status: 'claude-checked',
      reviewer: 'claude',
      reviewedAt: NOW,
      notes: null,
      sources: ['wiktionary:rumah', 'kbbi:rumah'],
      backTranslation: 'house',
      labelAudit: 'a dwelling, not a household',
      history: [
        {
          at: NOW,
          by: 'claude',
          change: 'Promoted from draft to claude-checked.',
        },
      ],
    });
  });

  it('gives a course the schema loads', () => {
    const course = edited(promote(ready(), 'rumah', NOW));
    expect(loadCourse(JSON.parse(JSON.stringify(course))).ok).toBe(true);
  });

  it('refuses an item that is not a draft', () => {
    expect(promote(pack({ status: 'native-reviewed' }), 'rumah', NOW)).toEqual({
      ok: false,
      message:
        'rumah: is native-reviewed, and only a draft is promoted to claude-checked',
    });
  });

  it('refuses an id no lexicon item has', () => {
    expect(promote(ready(), 'kucing', NOW)).toEqual({
      ok: false,
      message: 'kucing: no lexicon item has this id',
    });
  });
});

describe('promote refuses each missing piece with its own message (AC6)', () => {
  it('one source', () => {
    const course = pack({
      sources: ['kbbi:rumah'],
      backTranslation: 'house',
      labelAudit: 'a dwelling',
    });
    expect(promote(course, 'rumah', NOW)).toEqual({
      ok: false,
      message: `rumah: not promoted: ${SOURCES}`,
    });
  });

  it('an empty back-translation', () => {
    const course = pack({
      sources: ['wiktionary:rumah', 'kbbi:rumah'],
      backTranslation: '',
      labelAudit: 'a dwelling',
    });
    expect(promote(course, 'rumah', NOW)).toEqual({
      ok: false,
      message: `rumah: not promoted: ${BACK}`,
    });
  });

  it('a 3-word label without an audit note', () => {
    const course = pack(
      {
        sources: ['wiktionary:rumah', 'kbbi:rumah'],
        backTranslation: 'my big house',
      },
      'rumah besar saya',
    );
    expect(promote(course, 'rumah', NOW)).toEqual({
      ok: false,
      message: `rumah: not promoted: ${AUDIT}`,
    });
  });

  it('all three at once, joined', () => {
    expect(promote(pack(), 'rumah', NOW)).toEqual({
      ok: false,
      message: `rumah: not promoted: ${SOURCES}; ${BACK}; ${AUDIT}`,
    });
  });
});

describe('statusReport (AC5)', () => {
  const zero = {
    draft: 0,
    'claude-checked': 0,
    'native-reviewed': 0,
    rejected: 0,
  };

  it('counts a draft, with nothing shipped', () => {
    const counts = { ...zero, draft: 1 };
    expect(statusReport(pack())).toEqual({
      course: 'en-id',
      byStatus: counts,
      byKind: { lexicon: counts },
      shipped: 0,
      shippedBelowNativeReviewed: 0,
      shareBelowNativeReviewed: 0,
    });
  });

  it('counts a claude-checked item as shipped and below native-reviewed', () => {
    const counts = { ...zero, 'claude-checked': 1 };
    expect(statusReport(edited(promote(ready(), 'rumah', NOW)))).toEqual({
      course: 'en-id',
      byStatus: counts,
      byKind: { lexicon: counts },
      shipped: 1,
      shippedBelowNativeReviewed: 1,
      shareBelowNativeReviewed: 1,
    });
  });

  it('counts a native-reviewed item as shipped and not below', () => {
    const counts = { ...zero, 'native-reviewed': 1 };
    expect(statusReport(pack({ status: 'native-reviewed' }))).toEqual({
      course: 'en-id',
      byStatus: counts,
      byKind: { lexicon: counts },
      shipped: 1,
      shippedBelowNativeReviewed: 0,
      shareBelowNativeReviewed: 0,
    });
  });

  it('does not count a rejected item as shipped', () => {
    expect(statusReport(pack({ status: 'rejected' })).shipped).toBe(0);
  });
});
