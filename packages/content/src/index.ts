/**
 * A course pack, loaded and validated (#101; spec §5.1, §5.2). The build
 * refuses a malformed pack here, so the engine never meets bad data.
 *
 * The pack is the spec's flat shape. Lexicon items carry exactly #101 AC2's
 * fields; every other kind is a strict `{ id }` until the story that reads
 * more adds it (#102, #110, #462). Every object is strict (AC4), so a typo
 * such as `translation` is refused rather than ignored.
 */
import { z } from 'zod';
import { CEFR_LEVELS } from '@yawelo-idle/core';

const LANGUAGES = ['en', 'id'] as const;
const REVIEW_STATUSES = [
  'draft',
  'claude-checked',
  'native-reviewed',
  'rejected',
] as const;

/** Holds at least one character that is not whitespace. */
const VISIBLE = /\S/;

/** A string holding at least one character that is not whitespace. */
const visible = z.string().regex(VISIBLE, { message: 'is empty' });

/**
 * Who changed an item (#51 AC3): Claude, the operator, or the player report
 * a correction came from, by that report's id.
 */
const historyBy = z.union(
  [z.enum(['claude', 'operator']), z.string().regex(/^player-report:\S+$/)],
  { error: 'must be claude, operator or player-report:<id>' },
);

/** One change to an item: when (UTC), by whom, and what changed. */
const historyEntry = z.strictObject({
  at: z.iso.datetime(),
  by: historyBy,
  change: visible,
});

/**
 * Spec §5.2's review block. Every key is required, so a draft writes `null`
 * or `[]` rather than leaving a key out, and an omission or a typo is an
 * error. A `claude-checked` block's evidence (#51 AC2) is checked on the
 * item, which knows the text a label audit depends on.
 */
const review = z.strictObject({
  status: z.enum(REVIEW_STATUSES),
  reviewer: z.string().min(1).nullable(),
  reviewedAt: z.iso.datetime({ offset: true }).nullable(),
  notes: z.string().nullable(),
  sources: z.array(visible),
  backTranslation: z.string().nullable(),
  labelAudit: z.string().nullable(),
  history: z.array(historyEntry),
});

/** The review block, shared with the UI catalogue (#104 AC6). */
export const reviewSchema = review;
export type Review = z.output<typeof review>;

/** Text this short needs a label audit: a bare label gives no context. */
const LABEL_AUDIT_MAX_WORDS = 3;

const wordCount = (text: string): number =>
  text.split(/\s+/).filter((word) => word !== '').length;

const isVisible = (text: string | null): boolean =>
  text !== null && VISIBLE.test(text);

/**
 * The evidence a `claude-checked` block is missing (#51 AC2, spec D18): two
 * distinct sources, a back-translation, and a label audit when the text is
 * three words or fewer. Each entry is the field and why.
 */
export function missingEvidence(
  block: Review,
  text: string,
): readonly (readonly [field: string, message: string])[] {
  if (block.status !== 'claude-checked') return [];
  const missing: (readonly [string, string])[] = [];
  if (new Set(block.sources).size < 2)
    missing.push(['sources', 'needs at least two distinct source ids']);
  if (!isVisible(block.backTranslation))
    missing.push(['backTranslation', 'is required on a claude-checked item']);
  if (wordCount(text) <= LABEL_AUDIT_MAX_WORDS && !isVisible(block.labelAudit))
    missing.push([
      'labelAudit',
      `is required on a claude-checked item of ${String(LABEL_AUDIT_MAX_WORDS)} words or fewer`,
    ]);
  return missing;
}

const lexiconItem = z.strictObject({
  id: z.string(),
  target: z.string(),
  translations: z.array(z.string()).min(1),
  pos: z.string(),
  tags: z
    .array(z.string())
    .min(1)
    .refine((tags) => new Set(tags).size === tags.length, {
      message: 'a tag appears twice',
    }),
  example: z.strictObject({ target: z.string(), translation: z.string() }),
  cefr: z.enum(CEFR_LEVELS),
  // Required for an `en` target; checked on the course, which knows it.
  pronunciation: z
    .string()
    .regex(VISIBLE, { message: 'is whitespace only' })
    .optional(),
  // Spoken audio is a later update (spec D5); the slot exists and is unused.
  audio: z.string().optional(),
  source: z.string(),
  licence: z.string(),
  review,
});

/** A kind no story reads yet: an id and nothing else. */
const idOnly = z.strictObject({ id: z.string() });

export const courseSchema = z
  .strictObject({
    id: z.string(),
    sourceLang: z.enum(LANGUAGES),
    targetLang: z.enum(LANGUAGES),
    regions: z.array(idOnly),
    destinations: z.array(idOnly),
    encounters: z.array(idOnly),
    lexicon: z.array(lexiconItem),
    grammarNodes: z.array(idOnly),
    cultureCards: z.array(idOnly),
    motifs: z.array(idOnly),
    story: z.array(idOnly),
  })
  .superRefine((course, context) => {
    if (course.sourceLang === course.targetLang)
      context.addIssue({
        code: 'custom',
        path: ['targetLang'],
        message: `is the same as sourceLang (${course.sourceLang})`,
      });
    course.lexicon.forEach((item, index) => {
      for (const [field, message] of missingEvidence(item.review, item.target))
        context.addIssue({
          code: 'custom',
          path: ['lexicon', index, 'review', field],
          message,
        });
    });
    if (course.targetLang !== 'en') return;
    course.lexicon.forEach((item, index) => {
      if (item.pronunciation === undefined)
        context.addIssue({
          code: 'custom',
          path: ['lexicon', index, 'pronunciation'],
          message: 'is required when the target language is en',
        });
    });
  });

export type CoursePack = z.output<typeof courseSchema>;
export type LexiconEntry = CoursePack['lexicon'][number];

/** The statuses every build ships (spec D18, §5.5); the rest are refused. */
const SHIPPED: ReadonlySet<Review['status']> = new Set([
  'claude-checked',
  'native-reviewed',
]);

/**
 * Why a loaded course may not ship (#51 AC4): every `draft` or `rejected`
 * item, named. Empty means every item ships. The review tool loads drafts,
 * so this is a separate gate from `loadCourse`.
 */
export function shipErrors(course: CoursePack): readonly LoadError[] {
  return course.lexicon.flatMap((item) =>
    SHIPPED.has(item.review.status)
      ? []
      : [
          {
            kind: 'lexicon',
            item: item.id,
            field: 'review.status',
            message: `lexicon ${item.id}: review.status is ${item.review.status}, which never ships`,
          },
        ],
  );
}

/**
 * Whether the course must carry the disclosure line (#51 AC5): true while
 * any item that ships is below `native-reviewed`. Derived from the content
 * and never stored, so the line goes by itself once a course is reviewed.
 */
export function needsDisclosure(course: CoursePack): boolean {
  return course.lexicon.some(
    (item) =>
      SHIPPED.has(item.review.status) &&
      item.review.status !== 'native-reviewed',
  );
}

/** One reason a pack was refused, naming the item and the field. */
export interface LoadError {
  /** The pack's array the item sits in (`lexicon`), or `course`. */
  readonly kind: string;
  /** The item's `id`, `#<index>` when it has none, or `course`. */
  readonly item: string;
  /** The dotted path inside the item (`example.target`), or the course field. */
  readonly field: string;
  readonly message: string;
}

export type LoadResult =
  | { readonly ok: true; readonly course: CoursePack }
  | { readonly ok: false; readonly errors: readonly LoadError[] };

export function loadCourse(json: unknown): LoadResult {
  const parsed = courseSchema.safeParse(json);
  if (parsed.success) return { ok: true, course: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.flatMap((issue) => errorsOf(json, issue)),
  };
}

/** The item at `kind[index]` names itself by its `id`, read from the input. */
function itemName(json: unknown, kind: string, index: number): string {
  const items = isRecord(json) ? json[kind] : undefined;
  const item: unknown = Array.isArray(items) ? items[index] : undefined;
  return isRecord(item) && typeof item.id === 'string' && VISIBLE.test(item.id)
    ? item.id
    : `#${String(index)}`;
}

/** Which item of the pack a path sits in, and the path inside that item. */
function located(
  json: unknown,
  path: readonly PropertyKey[],
): { kind: string; item: string; within: readonly PropertyKey[] } {
  const [head, index, ...rest] = path;
  if (typeof head === 'string' && typeof index === 'number')
    return { kind: head, item: itemName(json, head, index), within: rest };
  return { kind: 'course', item: 'course', within: path };
}

function errorsOf(json: unknown, issue: z.core.$ZodIssue): LoadError[] {
  const { kind, item, within: path } = located(json, issue.path);
  const within = path.map(String);
  // An unknown key is reported at the object holding it, naming the keys.
  const fields =
    issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => [...within, key].join('.'))
      : [within.join('.')];
  return fields.map((field) => ({
    kind,
    item,
    field,
    message: `${kind} ${item}: ${field || '(the pack)'} ${issue.message}`,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One structural check's verdict: what it judged, and what it refused. */
export interface StructureCheck {
  readonly name: string;
  readonly judged: number;
  readonly errors: readonly LoadError[];
  readonly message: string;
}

const verdict = (
  name: string,
  judged: number,
  errors: readonly LoadError[],
): StructureCheck => ({
  name,
  judged,
  errors,
  message: `${name}: ${String(judged)} judged, ${String(errors.length)} refused`,
});

/** Every lexicon `id` is unique within a course (#103 AC1). */
function uniqueIds(course: CoursePack): StructureCheck {
  const byId = new Map<string, string[]>();
  course.lexicon.forEach((item, index) => {
    const named = `#${String(index)} (${item.target})`;
    byId.set(item.id, [...(byId.get(item.id) ?? []), named]);
  });
  const errors = [...byId]
    .filter(([, items]) => items.length > 1)
    .map(([id, items]) => ({
      kind: 'lexicon',
      item: id,
      field: 'id',
      message: `lexicon ${id}: id is shared by ${items.join(' and ')}`,
    }));
  return verdict('unique lexicon ids', course.lexicon.length, errors);
}

/** Every string leaf under `value`, with the path that reaches it. */
function stringLeaves(
  value: unknown,
  path: readonly (string | number)[] = [],
): readonly (readonly [readonly (string | number)[], string])[] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value))
    return value.flatMap((each, index) => stringLeaves(each, [...path, index]));
  if (isRecord(value))
    return Object.entries(value).flatMap(([key, each]) =>
      stringLeaves(each, [...path, key]),
    );
  return [];
}

/** No empty or whitespace-only string anywhere in a pack (#103 AC2). */
function noEmptyStrings(course: CoursePack): StructureCheck {
  const leaves = stringLeaves(course);
  const errors = leaves
    .filter(([, text]) => !VISIBLE.test(text))
    .map(([path]) => {
      const { kind, item, within } = located(course, path);
      const field = within.map(String).join('.');
      return {
        kind,
        item,
        field,
        message: `${kind} ${item}: ${field} is empty or whitespace only`,
      };
    });
  return verdict('no empty strings', leaves.length, errors);
}

/**
 * The structural mistakes that must never ship (#103; spec §5.5). Each check
 * says how many units it judged, so one that read nothing cannot pass for a
 * clean result. Separate from `loadCourse`, which the review tool uses on
 * drafts, and for the build to run alongside `shipErrors` (#106).
 */
export function structureChecks(course: CoursePack): readonly StructureCheck[] {
  return [uniqueIds(course), noEmptyStrings(course)];
}
