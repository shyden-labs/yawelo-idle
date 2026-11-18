/**
 * Player content reports (#52; design docs/superpowers/specs/
 * 2026-10-02-content-reports-design.md §B): a player reports a mistake in a
 * word, card, grammar note, story line, motif or line of screen text,
 * optionally with a correction. The body is strict (unknown keys refused by
 * name, validate.ts), and stores no personal data.
 */
import { z } from 'zod';

/** The longest suggestion or note, counted in Unicode code points (§B.1). */
export const MAX_TEXT = 1_000;

export const COURSES = ['en-id', 'id-en'] as const;
export const KINDS = [
  'lexicon',
  'culture',
  'grammar',
  'story',
  'motif',
  'ui',
] as const;
export const PROBLEMS = [
  'wrong-translation',
  'wrong-example',
  'spelling',
  'pronunciation',
  'offensive',
  'other',
] as const;

/** Text of at most MAX_TEXT code points: a UTF-16 count would halve emoji. */
const codePoints = (value: string): number =>
  (value.match(/./gsu) ?? []).length;

const text = z.string().refine((value) => codePoints(value) <= MAX_TEXT, {
  message: `at most ${String(MAX_TEXT)} characters`,
});

/** A short identifier the client sends: a version, an id. */
const token = z.string().min(1).max(128);

/** A report's body (§B.1). `website` is the honeypot the route answers. */
export const reportBody = z.strictObject({
  course: z.enum(COURSES),
  kind: z.enum(KINDS),
  itemId: token,
  problem: z.enum(PROBLEMS),
  suggestion: text.optional(),
  note: text.optional(),
  appVersion: token,
  contentVersion: token,
  installId: token,
  website: z.string().max(256),
});

export type ReportBody = z.infer<typeof reportBody>;

/** The largest report body read, in bytes. */
export const REPORT_MAX_BYTES = 0;

/** A report as stored: the body without its honeypot, plus id and times. */
export interface NewReport {
  readonly id: string;
  readonly createdAt: number;
  readonly utcDay: string;
  readonly course: (typeof COURSES)[number];
  readonly kind: (typeof KINDS)[number];
  readonly itemId: string;
  readonly problem: (typeof PROBLEMS)[number];
  readonly suggestion: string | null;
  readonly note: string | null;
  readonly appVersion: string;
  readonly contentVersion: string;
  readonly installId: string;
}

export type ReportOutcome = 'stored' | 'over_quota' | 'duplicate';

export type StoreReport = (report: NewReport) => Promise<ReportOutcome>;

export interface ReportDeps {
  readonly uuid: () => string;
  readonly now: () => number;
}

export function submitReport(
  _request: Request,
  _store: StoreReport,
  _deps: ReportDeps,
): Promise<Response> {
  throw new Error('not yet written');
}
