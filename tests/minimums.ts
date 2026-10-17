/**
 * Measured minimums for property reach counts (#84).
 *
 * A fast-check property that draws fresh cases on every run (Shyden,
 * 2026-10-12: "don't repeat.") counts how often it reached the cases it
 * judges, so a generator that stops reaching them cannot pass. That count
 * moves from run to run, so it cannot be an exact floor (`tests/floors.ts`).
 * It is checked against a minimum measured over at least 200 fresh-seed runs
 * in CI instead: at or above passes, below is a real defect, and 0 always
 * fails. The method and the record live in `scripts/minimums-method.ts`.
 *
 * Shyden granted this exemption from exact floors for ten properties only
 * (2026-10-12: "Fresh cases, safe minimums"; 2026-10-16: "Yes, all 10"); the
 * measured-minimums guard pins where these checks may be called. Anywhere
 * else, ask him first.
 *
 * Runner-neutral, like `floorBreach`: the breach comes back as text for the
 * caller's own `expect`, after the property's verdict.
 */
import { appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MINIMUMS_DIR,
  MINIMUMS_RECORD_ENV,
  minimumsFileOf,
  readMinimumsDir,
  type Measured,
  type MinimumObservation,
} from '../scripts/minimums-method';
import { guardOf } from '../scripts/record-floors';
import { callSite } from './floors';
import { currentSeed, SEED_ENV } from './properties-seed';

export { MINIMUMS_RECORD_ENV, type MinimumObservation };

export type Minimums = Readonly<Record<string, Measured>>;

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const THIS_FILE = relative(ROOT, fileURLToPath(import.meta.url));

export const readMinimums = (
  dir: string = join(ROOT, MINIMUMS_DIR),
): Minimums => readMinimumsDir(dir);

export interface MinimumOptions {
  /** The recorded minimums; read from `MINIMUMS_DIR` when judging, if absent. */
  readonly minimums?: Minimums;
  /** Where to record, `null` to judge; absent means the environment decides. */
  readonly record?: string | null;
  /** The seed to name; absent means the one this file runs at. */
  readonly seed?: number | undefined;
  /** The call site, `path:line`; absent means the caller's own. */
  readonly site?: string;
}

const TO_RECORD =
  'label the pull request record-minimums, then run npm run minimums:fetch <run-id>';

const isCount = (n: number): boolean => Number.isInteger(n) && n >= 0;

const recordTarget = (options: MinimumOptions): string | null =>
  options.record === undefined
    ? (process.env[MINIMUMS_RECORD_ENV] ?? null)
    : options.record;

const seedOf = (options: MinimumOptions): number | undefined =>
  'seed' in options ? options.seed : currentSeed();

const siteOf = (options: MinimumOptions): string =>
  options.site ?? callSite(new Error().stack ?? '', THIS_FILE);

/** The suite a call site runs in: the logs suite's own (spec §5.12), or properties. */
const scriptOf = (site: string): string =>
  /^packages\/[^/]+\/logs\//.test(site) ? 'test:logs' : 'test:properties';

const replay = (seed: number | undefined, site: string): string =>
  seed === undefined
    ? 'no seed was set for this file'
    : `replay it with ${SEED_ENV}=${String(seed)} npm run ${scriptOf(site)}`;

const append = (file: string, observation: MinimumObservation): void => {
  appendFileSync(file, JSON.stringify(observation) + '\n');
};

/** The breach of one count against `minimums`, or nothing. */
function judged(
  id: string,
  actual: number,
  minimums: Minimums,
  seed: number | undefined,
  site: string,
): string | undefined {
  if (actual === 0)
    return (
      `${id}: reached nothing. The property no longer draws what it counts: ` +
      `a real defect, never a re-run (#84): ${replay(seed, site)}`
    );
  const measured = minimums[id];
  if (measured === undefined)
    return `${id} is not recorded in ${minimumsFileOf(id)}: ${TO_RECORD}`;
  if (actual < measured.minimum)
    return (
      `${id}: read ${String(actual)}, under its measured minimum ` +
      `${String(measured.minimum)} (lowest ${String(measured.lowest)} over ` +
      `${String(measured.runs)} runs, mean ${measured.mean.toFixed(1)}). A ` +
      `real defect, never a re-run (#84): ${replay(seed, site)}`
    );
  return undefined;
}

/**
 * Nothing when `actual` is at or above the minimum measured for `id`;
 * otherwise the breach, naming the id, both numbers and the seed that
 * replays it. A count of 0 always fails. In record mode it appends what it
 * saw and judges nothing. Something that is not a count is refused in both.
 */
export function minimumBreach(
  id: string,
  actual: number,
  options: MinimumOptions = {},
): string | undefined {
  if (!isCount(actual)) return `${id}: ${String(actual)} is not a count`;
  const seed = seedOf(options);
  const record = recordTarget(options);
  if (record !== null) {
    append(record, {
      id,
      actual,
      site: siteOf(options),
      seed: seed ?? null,
    });
    return undefined;
  }
  return judged(
    id,
    actual,
    options.minimums ?? readMinimums(),
    seed,
    siteOf(options),
  );
}

/**
 * For counts named only at runtime (log's refusal kinds): every id recorded
 * under `family` is judged, a member absent from `counts` as 0, and a member
 * of `counts` the record does not hold is refused. Both sides are derived,
 * the record from measurement and `counts` from the run, so no hand list
 * stands in for either. Breaches come one a line, sorted by id.
 */
export function minimumsBreach(
  family: string,
  counts: Readonly<Record<string, number>>,
  options: MinimumOptions = {},
): string | undefined {
  if (guardOf(`${family}x`) === undefined)
    return `${family} is not a minimum family: write group/prefix`;
  const members = Object.keys(counts).sort();
  for (const member of members) {
    const actual = counts[member] as number;
    if (!isCount(actual))
      return `${family}${member}: ${String(actual)} is not a count`;
  }
  const seed = seedOf(options);
  const record = recordTarget(options);
  if (record !== null) {
    const site = siteOf(options);
    for (const member of members)
      append(record, {
        id: `${family}${member}`,
        actual: counts[member] as number,
        site,
        seed: seed ?? null,
        family,
      });
    return undefined;
  }
  const minimums = options.minimums ?? readMinimums();
  const recorded = Object.keys(minimums).filter((id) => id.startsWith(family));
  if (recorded.length === 0)
    return `${family} has no measured minimums: ${TO_RECORD}`;
  const ids = [
    ...new Set([...recorded, ...members.map((m) => `${family}${m}`)]),
  ].sort();
  const site = siteOf(options);
  const breaches = ids.flatMap((id) => {
    if (!recorded.includes(id))
      return [
        `${id} is a new member of ${family} with no measured minimum: ${TO_RECORD}`,
      ];
    const breach = judged(
      id,
      counts[id.slice(family.length)] ?? 0,
      minimums,
      seed,
      site,
    );
    return breach === undefined ? [] : [breach];
  });
  return breaches.length === 0 ? undefined : breaches.join('\n');
}
