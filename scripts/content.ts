/**
 * The content tool (#109; spec §5.2, D18). It lists what each item below
 * `claude-checked` lacks, records the evidence for it, promotes it once the
 * evidence is complete, and reports a course's counts.
 *
 *   npm run content:check <course.json>
 *   npm run content -- report <course.json>
 *   npm run content -- source <course.json> <item> <source-id>
 *   npm run content -- back-translation <course.json> <item> <method> <text>
 *   npm run content -- label-audit <course.json> <item> <note>
 *   npm run content -- promote <course.json> <item>
 *
 * A recording command rewrites the file only when its edit is made and the
 * edited course still loads; otherwise the file is left exactly as it was.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
  type LoadError,
  type StatusCounts,
} from '@yawelo-idle/content';

/** Everything the tool touches outside itself, so tests can stand it in. */
export interface ContentIo {
  readonly read: (path: string) => string;
  readonly write: (path: string, text: string) => void;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  /** The time now, as an ISO-8601 UTC timestamp. */
  readonly now: () => string;
}

/** Each command and the arguments it takes after the course file. */
const COMMANDS: Readonly<Record<string, readonly string[]>> = {
  check: [],
  report: [],
  source: ['<item>', '<source-id>'],
  'back-translation': ['<item>', '<method>', '<text>'],
  'label-audit': ['<item>', '<note>'],
  promote: ['<item>'],
};

const usage = (io: ContentIo): number => {
  io.err('usage: content <command> <course.json> [arguments]');
  for (const [name, args] of Object.entries(COMMANDS))
    io.err(`  ${[name, '<course.json>', ...args].join(' ')}`);
  return 2;
};

const printErrors = (
  heading: string,
  errors: readonly LoadError[],
  io: ContentIo,
): number => {
  io.err(heading);
  for (const { message } of errors) io.err(`  ${message}`);
  return 1;
};

const line = (counts: StatusCounts): string =>
  `draft ${String(counts.draft)}, claude-checked ${String(counts['claude-checked'])}, native-reviewed ${String(counts['native-reviewed'])}, rejected ${String(counts.rejected)}`;

const check = (course: CoursePack, io: ContentIo): number => {
  const gaps = evidenceGaps(course);
  for (const { item, status, missing } of gaps)
    if (missing.length === 0)
      io.out(`${item} (${status}) has its evidence: ready to promote.`);
    else {
      io.out(`${item} (${status}) lacks:`);
      for (const gap of missing) io.out(`  ${gap}`);
    }
  const items = gaps.length === 1 ? 'item' : 'items';
  io.out(
    `${String(gaps.length)} ${items} below claude-checked in ${course.id}.`,
  );
  return 0;
};

const report = (course: CoursePack, io: ContentIo): number => {
  const counts = statusReport(course);
  io.out(counts.course);
  io.out(`  ${line(counts.byStatus)}`);
  io.out(`  lexicon: ${line(counts.byKind.lexicon)}`);
  const percent = Math.round(counts.shareBelowNativeReviewed * 100);
  io.out(
    `  below native-reviewed: ${String(counts.shippedBelowNativeReviewed)} of ${String(counts.shipped)} shipped items (${String(percent)}%)`,
  );
  return 0;
};

const write = (
  path: string,
  edit: Edit,
  io: ContentIo,
  done?: string,
): number => {
  if (!edit.ok) {
    io.err(edit.message);
    return 1;
  }
  const reloaded = loadCourse(JSON.parse(JSON.stringify(edit.course)));
  if (!reloaded.ok)
    return printErrors(
      `the edited course does not load, so ${path} was not written:`,
      reloaded.errors,
      io,
    );
  io.write(path, `${JSON.stringify(edit.course, null, 2)}\n`);
  for (const flag of edit.flags) io.out(`flag: ${flag}`);
  if (done !== undefined) io.out(done);
  return 0;
};

export function main(argv: readonly string[], io: ContentIo): number {
  const [command, path, ...args] = argv;
  const expected = command === undefined ? undefined : COMMANDS[command];
  if (path === undefined || expected?.length !== args.length) return usage(io);
  const loaded = loadCourse(JSON.parse(io.read(path)));
  if (!loaded.ok)
    return printErrors(`${path} does not load:`, loaded.errors, io);
  const { course } = loaded;
  const [item = '', second = '', third = ''] = args;
  const at = io.now();
  if (command === 'check') return check(course, io);
  if (command === 'report') return report(course, io);
  if (command === 'source')
    return write(path, recordSource(course, item, second, at), io);
  if (command === 'back-translation')
    return write(
      path,
      recordBackTranslation(course, item, third, second, at),
      io,
    );
  if (command === 'label-audit')
    return write(path, recordLabelAudit(course, item, second, at), io);
  return write(
    path,
    promote(course, item, at),
    io,
    `${item}: promoted to claude-checked.`,
  );
}

if (import.meta.main)
  process.exitCode = main(process.argv.slice(2), {
    read: (path) => readFileSync(path, 'utf8'),
    write: (path, text) => {
      writeFileSync(path, text);
    },
    out: (text) => {
      console.log(text);
    },
    err: (text) => {
      console.error(text);
    },
    now: () => new Date().toISOString(),
  });
