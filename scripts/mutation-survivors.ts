/**
 * The mutation score may not drop (Shyden, 2026-10-16: "fail on any drop",
 * #36).
 *
 *   node scripts/mutation-survivors.ts
 *
 * Run by the mutation workflow after Stryker, whether Stryker passed or
 * failed. It reads Stryker's JSON report (reports/mutation/mutation.json)
 * and fails on any mutant the tests did not detect (Survived or NoCoverage)
 * that is not on the committed list of equivalent mutants,
 * stryker.equivalents.json, each listed with the reason no input tells it
 * apart. It fails too on a listed entry that is no longer undetected, so the
 * list stays exact and cannot hide a later survivor. The score can then only
 * fall by gaining an unlisted survivor. Stryker's own `break` at 90 (spec
 * §7) stays as the floor under it.
 *
 * A mutant is keyed by its file, mutator, original text and replacement,
 * never its line or Stryker's id, so an edit elsewhere in a file does not
 * move it. Two identical mutants need two entries.
 *
 * It proves it saw what it judges: every file stryker.config.json mutates
 * must be in the report with at least one mutant, no other file may be, and
 * every mutant must have finished with a status it knows. Anything else
 * fails by name. Imports are Node's own.
 */
import { readFileSync } from 'node:fs';

/** A mutant the tests did not detect. */
export interface Undetected {
  file: string;
  mutator: string;
  original: string;
  replacement: string;
}

/** A listed equivalent mutant: no input tells it apart from the original. */
export interface Equivalent extends Undetected {
  reason: string;
}

export interface Found {
  /** Every mutant judged, in every file. */
  judged: number;
  files: number;
  undetected: Undetected[];
}

export interface Comparison {
  unlisted: Undetected[];
  stale: Equivalent[];
}

const UNDETECTED = new Set(['Survived', 'NoCoverage']);
const DETECTED_OR_INVALID = new Set([
  'Killed',
  'Timeout',
  'CompileError',
  'RuntimeError',
  'Ignored',
]);

/** Babel's line terminators, which Stryker's locations count by. */
const LINE_BREAK = /\r\n|[\n\r\u2028\u2029]/g;

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** The offset at which each line starts (line 1 at index 0). */
function lineStarts(source: string): number[] {
  const starts = [0];
  for (const m of source.matchAll(LINE_BREAK))
    starts.push(m.index + m[0].length);
  return starts;
}

/** The source offset of a 1-based line and column, or null when outside it. */
function offsetOf(
  source: string,
  starts: readonly number[],
  position: unknown,
): number | null {
  if (!isRecord(position)) return null;
  const { line, column } = position;
  if (
    typeof line !== 'number' ||
    typeof column !== 'number' ||
    !Number.isInteger(line) ||
    !Number.isInteger(column) ||
    line < 1 ||
    column < 1
  )
    return null;
  const start = starts[line - 1];
  if (start === undefined) return null;
  const offset = start + column - 1;
  const next = starts[line] ?? source.length + 1;
  return offset < next ? offset : null;
}

/** Every undetected mutant of a report over the files `mutated` names. */
export function undetected(report: unknown, mutated: readonly string[]): Found {
  if (!isRecord(report) || !isRecord(report['files']))
    throw new Error('the mutation report has no files object');
  const files = report['files'];
  for (const name of Object.keys(files))
    if (!mutated.includes(name))
      throw new Error(
        `${name} is in the report but not in stryker.config.json mutate`,
      );
  const found: Undetected[] = [];
  let judged = 0;
  for (const name of mutated) {
    const file = files[name];
    if (file === undefined)
      throw new Error(`${name} is mutated but missing from the report`);
    if (
      !isRecord(file) ||
      typeof file['source'] !== 'string' ||
      !Array.isArray(file['mutants'])
    )
      throw new Error(
        `the mutation report's entry for ${name} has no source or mutant list`,
      );
    const source = file['source'];
    const mutants: unknown[] = file['mutants'];
    if (mutants.length === 0) throw new Error(`${name} has no mutants`);
    const starts = lineStarts(source);
    for (const m of mutants) {
      judged += 1;
      const id = isRecord(m) ? String(m['id']) : '?';
      if (!isRecord(m))
        throw new Error(`mutant ${id} in ${name} is not an object`);
      const status = m['status'];
      if (
        typeof status !== 'string' ||
        !(UNDETECTED.has(status) || DETECTED_OR_INVALID.has(status))
      )
        throw new Error(
          `mutant ${id} in ${name} has status ${JSON.stringify(status)}, which is not a finished one`,
        );
      if (typeof m['mutatorName'] !== 'string')
        throw new Error(`mutant ${id} in ${name} has no mutator`);
      const location = m['location'];
      const from = isRecord(location)
        ? offsetOf(source, starts, location['start'])
        : null;
      const to = isRecord(location)
        ? offsetOf(source, starts, location['end'])
        : null;
      if (from === null || to === null || to < from)
        throw new Error(
          `mutant ${id} in ${name} has a location outside the source: ${JSON.stringify(location)}`,
        );
      const replacement = m['replacement'];
      if (replacement !== undefined && typeof replacement !== 'string')
        throw new Error(
          `mutant ${id} in ${name} has a replacement that is not text`,
        );
      if (UNDETECTED.has(status))
        found.push({
          file: name,
          mutator: m['mutatorName'],
          original: source.slice(from, to),
          replacement: replacement ?? '',
        });
    }
  }
  return { judged, files: mutated.length, undetected: found };
}

const ENTRY_KEYS = ['file', 'mutator', 'original', 'replacement', 'reason'];

/** stryker.equivalents.json, refusing anything but a list of whole entries. */
export function parseEquivalents(list: unknown): Equivalent[] {
  if (!Array.isArray(list))
    throw new Error('stryker.equivalents.json is not a list');
  return list.map((e: unknown, i) => {
    const where = `stryker.equivalents.json entry ${String(i)}`;
    if (!isRecord(e)) throw new Error(`${where} is not an object`);
    const extra = Object.keys(e).filter((k) => !ENTRY_KEYS.includes(k));
    if (extra.length > 0)
      throw new Error(
        `${where} has keys it does not know: ${extra.join(', ')}`,
      );
    for (const key of ENTRY_KEYS)
      if (typeof e[key] !== 'string') throw new Error(`${where} has no ${key}`);
    const entry = e as unknown as Equivalent;
    if (entry.reason.trim() === '')
      throw new Error(`${where} has an empty reason`);
    return entry;
  });
}

const keyOf = (m: Undetected): string =>
  JSON.stringify([m.file, m.mutator, m.original, m.replacement]);

/** Undetected mutants against the list, as multisets. */
export function compare(
  found: readonly Undetected[],
  listed: readonly Equivalent[],
): Comparison {
  const remaining = [...listed];
  const unlisted: Undetected[] = [];
  for (const m of found) {
    const i = remaining.findIndex((e) => keyOf(e) === keyOf(m));
    if (i === -1) unlisted.push(m);
    else remaining.splice(i, 1);
  }
  return { unlisted, stale: remaining };
}

const describe = (m: Undetected): string =>
  `${m.file} ${m.mutator} ${JSON.stringify(m.original)} -> ${JSON.stringify(m.replacement)}`;

/** The lines the step prints: what it judged, then each failure. */
export function report(found: Found, result: Comparison): string[] {
  const head = `judged ${String(found.judged)} mutants in ${String(found.files)} files: ${String(found.undetected.length)} undetected`;
  if (result.unlisted.length === 0 && result.stale.length === 0)
    return [`${head}, every one on stryker.equivalents.json`];
  return [
    head,
    ...result.unlisted.map(
      (m) =>
        `✗ not on stryker.equivalents.json (kill it with a test, or list it with its reason): ${describe(m)}`,
    ),
    ...result.stale.map(
      (m) =>
        `✗ listed but no longer undetected (remove it from stryker.equivalents.json): ${describe(m)}`,
    ),
  ];
}

/** What a run prints and its exit code, reading each file through `read`. */
export function run(read: (path: string) => string): {
  out: string[];
  err: string[];
  code: number;
} {
  try {
    const config = JSON.parse(read('stryker.config.json')) as {
      mutate?: unknown;
    };
    const mutate = config.mutate;
    if (!Array.isArray(mutate) || !mutate.every((f) => typeof f === 'string'))
      throw new Error('stryker.config.json has no mutate list of files');
    const found = undetected(
      JSON.parse(read('reports/mutation/mutation.json')),
      mutate,
    );
    const result = compare(
      found.undetected,
      parseEquivalents(JSON.parse(read('stryker.equivalents.json'))),
    );
    const failed = result.unlisted.length > 0 || result.stale.length > 0;
    return { out: report(found, result), err: [], code: failed ? 1 : 0 };
  } catch (error) {
    return {
      out: [],
      err: [`✗ ${error instanceof Error ? error.message : String(error)}`],
      code: 1,
    };
  }
}

if (import.meta.main) {
  const { out, err, code } = run((path) => readFileSync(path, 'utf8'));
  for (const line of out) console.log(line);
  for (const line of err) console.error(line);
  process.exit(code);
}
