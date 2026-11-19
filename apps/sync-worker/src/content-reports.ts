/**
 * Player content reports (#52; design docs/superpowers/specs/
 * 2026-10-02-content-reports-design.md §B): a player reports a mistake in a
 * word, card, grammar note, story line, motif or line of screen text,
 * optionally with a correction. The body is strict (unknown keys refused by
 * name, validate.ts), and stores no personal data.
 */
import { z } from 'zod';
import { readBody } from './validate';

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

/**
 * The largest report body read, in bytes: two texts of 1,000 code points sent
 * as escaped surrogate pairs (12 bytes each) are 24,000, and the rest is short.
 */
export const REPORT_MAX_BYTES = 32_768;

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

const answer = (body: Record<string, string>, status: number): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** The UTC calendar day of a Unix-millisecond time, as YYYY-MM-DD. */
const utcDayOf = (time: number): string =>
  new Date(time).toISOString().slice(0, 10);

/**
 * POST /v1/content-reports (§B.1), checked in the design's order: the body
 * (413, 400, 422), the honeypot (201 like a stored report, nothing written,
 * so a bot learns nothing), then the store, whose one D1 batch holds the
 * daily quota (429) and the one open report per item (409).
 */
export async function submitReport(
  request: Request,
  store: StoreReport,
  deps: ReportDeps,
): Promise<Response> {
  const body = await readBody(request, reportBody, REPORT_MAX_BYTES);
  if (!body.ok) return body.response;
  const id = deps.uuid();
  const { website, suggestion, note, ...fields } = body.data;
  if (website !== '') return answer({ id }, 201);
  const createdAt = deps.now();
  const outcome = await store({
    ...fields,
    id,
    createdAt,
    utcDay: utcDayOf(createdAt),
    suggestion: suggestion ?? null,
    note: note ?? null,
  });
  if (outcome === 'over_quota') return answer({ error: 'daily_limit' }, 429);
  if (outcome === 'duplicate')
    return answer({ error: 'already_reported' }, 409);
  return answer({ id }, 201);
}
