/**
 * The measured-minimum method and its record (#84, spec §4 and §5.2).
 *
 * Ten fast-check properties draw fresh cases on every run (Shyden,
 * 2026-10-12: "don't repeat."), so the counts that prove they reached the
 * cases they judge move from run to run, and an exact floor would fail at
 * random. Each such count is sampled over at least 200 fresh-seed runs in CI
 * and checked against
 *
 *     minimum = min(lowest, floor(mean - 6 sd))
 *
 * which is at or below every count seen and six standard deviations under
 * the mean, so a false failure is vanishingly rare (Shyden, 2026-10-12:
 * "Fresh cases, safe minimums"; 2026-10-16: "Yes, all 10"). A count that
 * cannot be checked so is a finding, never a guessed figure: too few runs,
 * no spread, never reached, or too small, for which its property's runs are
 * raised (2026-10-16: "Raise their runs").
 *
 * Each id's minimum lives in `tests/minimums/<group>.json` with the figures
 * it came from, so the evidence sits beside the number.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, posix } from 'node:path';
import { GUARD, guardOf } from './record-floors.ts';

/** The recorded minimums, one file per group, relative to the repository root. */
export const MINIMUMS_DIR = 'tests/minimums';

/** Set to a file for each check to append what it saw to, judging nothing. */
export const MINIMUMS_RECORD_ENV = 'MINIMUMS_RECORD';

/** One line of a record run. */
export interface MinimumObservation {
  readonly id: string;
  readonly actual: number;
  /** The repository-relative `file:line` that asked. */
  readonly site: string;
  /** The seed the file ran at, or null outside the properties suite. */
  readonly seed: number | null;
  /** The family a runtime-named count belongs to. */
  readonly family?: string;
}

/** Runs a count is sampled over before it takes a minimum (AC6). */
export const MIN_RUNS = 200;

/** Standard deviations a minimum sits under the mean. */
export const SIGMAS = 6;

/** What the runs measured of one count. */
export interface Summary {
  readonly runs: number;
  readonly lowest: number;
  readonly mean: number;
  /** The sample standard deviation (n - 1). */
  readonly sd: number;
}

/** A recorded minimum and the figures it came from. */
export interface Measured extends Summary {
  readonly minimum: number;
}

export type Assessment =
  | { readonly kind: 'minimum'; readonly minimum: number }
  | { readonly kind: 'too-small'; readonly factor: number }
  | { readonly kind: 'no-spread' }
  | { readonly kind: 'never-reached' }
  | { readonly kind: 'too-few' };

const FIELDS = ['minimum', 'runs', 'lowest', 'mean', 'sd'] as const;

/** The runs, lowest, mean and sample spread of a count's values. */
export function summarise(values: readonly number[]): Summary {
  if (values.length < 2)
    throw new Error(
      `a spread needs two runs or more, not ${String(values.length)}`,
    );
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squares = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return {
    runs: values.length,
    lowest: Math.min(...values),
    mean,
    sd: Math.sqrt(squares / (values.length - 1)),
  };
}

const clears = (k: number, mean: number, sd: number): boolean =>
  k * mean - SIGMAS * Math.sqrt(k) * sd >= 1;

/**
 * The factor a count's runs must rise by for it to hold a minimum of 1 or
 * more. A count is a sum over independent runs, so k times the runs gives k
 * times the mean and sqrt(k) times the spread: the least k with
 * k·mean − 6·√k·sd ≥ 1, then ×1.5 rounded up, for the error in the sampled
 * mean and spread. The recording round after the raise checks it.
 */
export function raiseFactor(mean: number, sd: number): number {
  if (!(mean > 0))
    throw new Error('a count that never reached anything has no factor');
  // sqrt(k) solves mean·x² − 6·sd·x − 1 = 0; the float root is then walked
  // to the exact least whole k.
  const root =
    (SIGMAS * sd + Math.sqrt((SIGMAS * sd) ** 2 + 4 * mean)) / (2 * mean);
  let k = Math.max(1, Math.ceil(root * root));
  while (k > 1 && clears(k - 1, mean, sd)) k -= 1;
  while (!clears(k, mean, sd)) k += 1;
  return Math.ceil(k * 1.5);
}

/** The minimum a count's runs support, or the finding that stops one. */
export function assess(summary: Summary): Assessment {
  const { runs, lowest, mean, sd } = summary;
  if (runs < MIN_RUNS) return { kind: 'too-few' };
  if (mean === 0) return { kind: 'never-reached' };
  if (sd === 0) return { kind: 'no-spread' };
  const minimum = Math.min(lowest, Math.floor(mean - SIGMAS * sd));
  if (minimum < 1) return { kind: 'too-small', factor: raiseFactor(mean, sd) };
  return { kind: 'minimum', minimum };
}

/** The repository-relative file that records `id`; throws for an id that names no group. */
export const minimumsFileOf = (id: string): string => {
  const group = guardOf(id);
  if (group === undefined)
    throw new Error(
      `${id} is not a minimum id: write group/name, the group in lower-case ` +
        'words joined by hyphens',
    );
  return posix.join(MINIMUMS_DIR, `${group}.json`);
};

const isCount = (v: unknown): boolean =>
  Number.isInteger(v) && (v as number) >= 0;
const isFigure = (v: unknown): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Why `entry` is no measured minimum, by field, or nothing. */
function entryRefusals(name: string, id: string, entry: unknown): string[] {
  if (
    typeof entry !== 'object' ||
    entry === null ||
    Array.isArray(entry) ||
    Object.keys(entry).sort().join() !== [...FIELDS].sort().join()
  )
    return [`${name}: ${id} does not hold exactly ${FIELDS.join(', ')}`];
  const fields = entry as Record<string, unknown>;
  const refusals: string[] = [];
  for (const field of ['minimum', 'runs', 'lowest'] as const)
    if (!isCount(fields[field]))
      refusals.push(
        `${name}: ${id} ${field} is ${String(fields[field])}, not a count`,
      );
  for (const field of ['mean', 'sd'] as const)
    if (!isFigure(fields[field]))
      refusals.push(
        `${name}: ${id} ${field} is ${String(fields[field])}, not a finite figure of 0 or more`,
      );
  return refusals;
}

/**
 * Every minimum recorded in `dir`, the union of its group files. Throws,
 * naming each, for a file that is not `<group>.json`, is not JSON, holds no
 * object, or holds an id of another group or an entry of another shape:
 * read silently, any of them would hide a minimum.
 */
export const readMinimumsDir = (dir: string): Record<string, Measured> => {
  const minimums: Record<string, Measured> = {};
  const refusals: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) {
      refusals.push(`${name} is not a .json minimums file`);
      continue;
    }
    const group = name.slice(0, -'.json'.length);
    if (!GUARD.test(group)) {
      refusals.push(`${name} is not named for a group`);
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    } catch {
      refusals.push(`${name} is not valid JSON`);
      continue;
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      refusals.push(`${name} does not hold an object of minimums`);
      continue;
    }
    for (const [id, entry] of Object.entries(parsed)) {
      const owner = guardOf(id);
      if (owner !== group) {
        refusals.push(
          owner === undefined
            ? `${name}: ${id} is not a minimum id`
            : `${name}: ${id} belongs in ${owner}.json`,
        );
        continue;
      }
      const wrong = entryRefusals(name, id, entry);
      if (wrong.length > 0) refusals.push(...wrong);
      else minimums[id] = entry as Measured;
    }
  }
  if (refusals.length > 0)
    throw new Error(`${dir} cannot be read:\n  ${refusals.join('\n  ')}`);
  return minimums;
};

/** A group's file text: ids sorted, each entry's fields in one order. */
const minimumsText = (entries: Readonly<Record<string, Measured>>): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.keys(entries)
        .sort()
        .map((id) => {
          const entry = entries[id] as Measured;
          return [id, Object.fromEntries(FIELDS.map((f) => [f, entry[f]]))];
        }),
    ),
    null,
    2,
  ) + '\n';

/**
 * Write each group's file whose text would change, and remove each group
 * file `next` holds no id of: a record run re-measures every minimum, so the
 * directory holds exactly `next`. Returns the files written or removed, by
 * name.
 */
export const writeMinimums = (
  dir: string,
  next: Readonly<Record<string, Measured>>,
): string[] => {
  const byGroup = new Map<string, Record<string, Measured>>();
  for (const [id, entry] of Object.entries(next)) {
    const name = posix.basename(minimumsFileOf(id));
    byGroup.set(name, { ...byGroup.get(name), [id]: entry });
  }
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const [name, entries] of [...byGroup].sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    const file = join(dir, name);
    const text = minimumsText(entries);
    if (existsSync(file) && readFileSync(file, 'utf8') === text) continue;
    writeFileSync(file, text);
    written.push(name);
  }
  for (const name of readdirSync(dir).sort())
    if (name.endsWith('.json') && !byGroup.has(name)) {
      rmSync(join(dir, name));
      written.push(`${name} (removed)`);
    }
  return written;
};
