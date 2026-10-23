/**
 * `node scripts/mutations-verdict.ts` (#619 AC5, #754 AC2): the `mutations`
 * job, which is develop's required check. It runs whatever happened in the
 * jobs above it (`!cancelled()`), reads their results from the environment
 * (`CHANGED`, `COUNT`, `FILES`, `RUN`) and each file job's result from the
 * artifacts downloaded under `results/`, and passes only when the judge
 * passed and either listed no file and the run jobs were skipped, or every
 * listed file's own job ran it clean. A failed judge skips the run jobs, so a
 * check reading the run jobs alone would pass it; and a file job cancelled,
 * skipped or timed out uploads no result, so that file fails by name.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/** The file each run job writes its file's result to, in `.mutations/`. */
export const OUTCOME_FILE = 'run-outcome.json';

export interface Results {
  /** The `changed` job's result: the judge. */
  readonly changed: string;
  /** How many mutation files the judge listed, as it wrote it. */
  readonly count: string;
  /** The files the judge listed, as the JSON list it wrote. */
  readonly files: string;
  /** The `run` jobs' result, all of them together. */
  readonly run: string;
  /** Each result a run job uploaded, as written: `{file, outcome}`. */
  readonly outcomes: readonly string[];
}

const files = (n: number): string =>
  `${String(n)} mutation file${n === 1 ? '' : 's'}`;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** The outcomes a step can end with (`steps.<id>.outcome`). */
const OUTCOMES = new Set(['success', 'failure', 'cancelled', 'skipped']);

/** Each uploaded result's file to its outcome, or the line refusing them. */
function endings(outcomes: readonly string[]): Map<string, string> | string {
  const ended = new Map<string, string>();
  for (const text of outcomes) {
    const record = parsed(text);
    if (
      typeof record !== 'object' ||
      record === null ||
      !('file' in record) ||
      !('outcome' in record) ||
      typeof record.file !== 'string' ||
      typeof record.outcome !== 'string' ||
      !OUTCOMES.has(record.outcome)
    )
      return `a run result is not {file, outcome}: ${JSON.stringify(text)}`;
    if (ended.has(record.file)) return `two results name ${record.file}`;
    ended.set(record.file, record.outcome);
  }
  return ended;
}

/** Whether the check passes, and the line saying why. */
export function verdict(results: Results): {
  readonly ok: boolean;
  readonly line: string;
} {
  const { changed, count, run } = results;
  if (changed !== 'success')
    return {
      ok: false,
      line: `✗ the judge ended ${changed}: read its log for each finding`,
    };
  if (!/^(0|[1-9][0-9]*)$/.test(count))
    return {
      ok: false,
      line: `✗ the judge passed but wrote no count it can read: ${JSON.stringify(count)}`,
    };
  const n = Number(count);
  const listed = parsed(results.files);
  if (!isStrings(listed) || listed.length !== n)
    return {
      ok: false,
      line: `✗ the judge counted ${count} but listed ${JSON.stringify(results.files)}`,
    };
  if (n === 0)
    return run === 'skipped'
      ? { ok: true, line: '✓ the judge passed and listed no mutation file' }
      : {
          ok: false,
          line: `✗ the run job ran ${run} with no mutation file listed`,
        };
  const ended = endings(results.outcomes);
  if (typeof ended === 'string') return { ok: false, line: `✗ ${ended}` };
  const unclean = [
    ...listed.flatMap((file) => {
      const outcome = ended.get(file);
      if (outcome === 'success') return [];
      return [
        outcome === undefined
          ? `${file} uploaded no result (its job was cancelled, skipped or timed out)`
          : `${file} ended ${outcome}`,
      ];
    }),
    ...[...ended.keys()]
      .filter((file) => !listed.includes(file))
      .map((file) => `${file} has a result but was not listed`),
  ];
  if (unclean.length > 0)
    return {
      ok: false,
      line: `✗ the run of ${files(n)} was not clean: ${unclean.join('; ')}`,
    };
  return run === 'success'
    ? { ok: true, line: `✓ the judge passed and ${files(n)} ran clean` }
    : { ok: false, line: `✗ the run of ${files(n)} ended ${run}` };
}

/**
 * The results among a recursive listing of the download folder, at any
 * depth: download-artifact (v8.0.2, `src/download-artifact.ts`) puts a lone
 * artifact straight into the folder and each of several in its own.
 */
export function outcomePaths(listing: readonly string[]): string[] {
  return listing.filter((path) => basename(path) === OUTCOME_FILE).sort();
}

const uploaded = (dir: string): string[] =>
  existsSync(dir)
    ? outcomePaths(readdirSync(dir, { recursive: true, encoding: 'utf8' })).map(
        (path) => readFileSync(join(dir, path), 'utf8'),
      )
    : [];

if (import.meta.main) {
  const result = verdict({
    changed: process.env.CHANGED ?? '',
    count: process.env.COUNT ?? '',
    files: process.env.FILES ?? '',
    run: process.env.RUN ?? '',
    outcomes: uploaded('results'),
  });
  console.log(result.line);
  process.exitCode = result.ok ? 0 : 1;
}
