/**
 * The Claude-check evidence recorder (#109; spec §5.2, D18).
 *
 * Each piece of evidence (a source consulted, a back-translation, a label
 * audit) is recorded by its own edit, and an item reaches `claude-checked`
 * only through `promote`, which applies the schema's evidence rule
 * (`missingEvidence`): the bar cannot be claimed without the work.
 *
 * Edits are pure: each returns a new course, leaves its input untouched, and
 * appends one history line by `claude`. Only lexicon items carry a review
 * block so far; the other kinds gain one with the stories that add their
 * fields (#110, #462).
 */
import {
  missingEvidence,
  type CoursePack,
  type LexiconEntry,
  type Review,
} from './index.ts';

/** An edit's outcome: the new course and anything to show a human, or why not. */
export type Edit =
  | {
      readonly ok: true;
      readonly course: CoursePack;
      readonly flags: readonly string[];
    }
  | { readonly ok: false; readonly message: string };

/** An item below `claude-checked`, with the evidence it still lacks. */
export interface EvidenceGap {
  readonly item: string;
  readonly status: Review['status'];
  readonly missing: readonly string[];
}

export type StatusCounts = Readonly<Record<Review['status'], number>>;

/** A course's counts (AC5); the share feeds the disclosure line (#51 AC5). */
export interface StatusReport {
  readonly course: string;
  readonly byStatus: StatusCounts;
  readonly byKind: Readonly<Record<'lexicon', StatusCounts>>;
  /** Items that ship: `claude-checked` and `native-reviewed` (spec §5.5). */
  readonly shipped: number;
  readonly shippedBelowNativeReviewed: number;
  /** Of the shipped items, the share below `native-reviewed`; 0 when none ship. */
  readonly shareBelowNativeReviewed: number;
}

const blank = (text: string): boolean => text.trim() === '';

/** What `item` would lack were it `claude-checked`, as `review.<field> <why>`. */
const gapsOf = (item: LexiconEntry): readonly string[] =>
  missingEvidence(
    { ...item.review, status: 'claude-checked' },
    item.target,
  ).map(([field, why]) => `review.${field} ${why}`);

export function evidenceGaps(course: CoursePack): readonly EvidenceGap[] {
  return course.lexicon
    .filter(({ review }) => review.status === 'draft')
    .map((item) => ({
      item: item.id,
      status: item.review.status,
      missing: gapsOf(item),
    }));
}

/** A change to one item's review: refused with a reason, or made with its history line. */
type Change =
  | { readonly refuse: string }
  | {
      readonly review: Review;
      readonly change: string;
      readonly flags?: readonly string[];
    };

const applyTo = (
  course: CoursePack,
  id: string,
  at: string,
  decide: (item: LexiconEntry) => Change,
): Edit => {
  const item = course.lexicon.find((entry) => entry.id === id);
  if (item === undefined)
    return { ok: false, message: `${id}: no lexicon item has this id` };
  const decided = decide(item);
  if ('refuse' in decided)
    return { ok: false, message: `${id}: ${decided.refuse}` };
  const review: Review = {
    ...decided.review,
    history: [
      ...item.review.history,
      { at, by: 'claude', change: decided.change },
    ],
  };
  return {
    ok: true,
    course: {
      ...course,
      lexicon: course.lexicon.map((entry) =>
        entry === item ? { ...entry, review } : entry,
      ),
    },
    flags: decided.flags ?? [],
  };
};

/**
 * Records a source consulted (AC2). An id is recorded once; the drafting
 * source (`item.source`) may stand as the first source but never as the
 * second, which must be independent of the first and of the draft.
 */
export function recordSource(
  course: CoursePack,
  id: string,
  source: string,
  at: string,
): Edit {
  return applyTo(course, id, at, (item) => {
    const { sources } = item.review;
    if (blank(source)) return { refuse: 'the source id is empty' };
    if (sources.includes(source))
      return { refuse: `source ${source} is already recorded` };
    if (sources.length > 0 && source === item.source)
      return {
        refuse: `${source} is the drafting source, so it is not a second independent source`,
      };
    return {
      review: { ...item.review, sources: [...sources, source] },
      change: `Source recorded: ${source}.`,
    };
  });
}

/** Lower case with runs of whitespace folded, for comparing two short texts. */
const fold = (text: string): string =>
  text.trim().replaceAll(/\s+/g, ' ').toLowerCase();

/**
 * Records a back-translation as text, its method noted in the history line
 * (AC3). One identical to the source string, the item's own text, is kept
 * and flagged: the word may be the same in both languages, or it was never
 * translated, and only a human can say which.
 */
export function recordBackTranslation(
  course: CoursePack,
  id: string,
  text: string,
  method: string,
  at: string,
): Edit {
  return applyTo(course, id, at, (item) => {
    if (blank(text)) return { refuse: 'the back-translation is empty' };
    if (blank(method))
      return { refuse: 'the back-translation method is empty' };
    return {
      review: { ...item.review, backTranslation: text },
      change: `Back-translation recorded (method: ${method}): ${text}`,
      flags:
        fold(text) === fold(item.target)
          ? [
              `${id}: the back-translation is identical to the source string, so it needs human attention`,
            ]
          : [],
    };
  });
}

/** Records the note on which sense a short label was checked for. */
export function recordLabelAudit(
  course: CoursePack,
  id: string,
  note: string,
  at: string,
): Edit {
  return applyTo(course, id, at, (item) => {
    if (blank(note)) return { refuse: 'the label-audit note is empty' };
    return {
      review: { ...item.review, labelAudit: note },
      change: `Label audit recorded: ${note}`,
    };
  });
}

/**
 * Promotes a draft to `claude-checked` (AC4), only when the schema's
 * evidence rule passes; a refusal names every missing piece (AC6).
 */
export function promote(course: CoursePack, id: string, at: string): Edit {
  return applyTo(course, id, at, (item) => {
    const { status } = item.review;
    if (status !== 'draft')
      return {
        refuse: `is ${status}, and only a draft is promoted to claude-checked`,
      };
    const gaps = gapsOf(item);
    if (gaps.length > 0) return { refuse: `not promoted: ${gaps.join('; ')}` };
    return {
      review: {
        ...item.review,
        status: 'claude-checked',
        reviewer: 'claude',
        reviewedAt: at,
      },
      change: 'Promoted from draft to claude-checked.',
    };
  });
}

export function statusReport(course: CoursePack): StatusReport {
  const lexicon: Record<Review['status'], number> = {
    draft: 0,
    'claude-checked': 0,
    'native-reviewed': 0,
    rejected: 0,
  };
  for (const { review } of course.lexicon) lexicon[review.status] += 1;
  const below = lexicon['claude-checked'];
  const shipped = below + lexicon['native-reviewed'];
  return {
    course: course.id,
    byStatus: lexicon,
    byKind: { lexicon },
    shipped,
    shippedBelowNativeReviewed: below,
    shareBelowNativeReviewed: shipped > 0 ? below / shipped : 0,
  };
}
