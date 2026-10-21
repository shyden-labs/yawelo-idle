/**
 * Write the measured minimums the record-minimums workflow sampled in CI
 * (#84, spec §5.7): `npm run minimums:fetch <run-id>`.
 *
 * The session pushes its unpushed commit to `refs/minimums/<branch>` and
 * dispatches record-minimums on develop (#718), which runs the properties
 * suite 200 times at that SHA with fresh seeds, over 4 shards, each
 * recording every reach count (`tests/minimums.ts` in record mode). This
 * script refuses a run that measured any commit but the unpushed HEAD,
 * reads every shard back,
 * refuses a record that cannot be trusted (too few runs, a repeated seed, an
 * id asserted twice or from two places, runs that disagree on what they
 * count, a minimum here the run lacks), and writes the minimum the method
 * gives (`scripts/minimums-method.ts`) for each count it can bound. Each
 * count it cannot is a finding, printed with the table to post on #84, and
 * gets no minimum, so the checker refuses it until it is dealt with. As for
 * floors, CI records and the laptop folds the figures into its unpushed
 * commit (operator, 2026-10-12; global rule 2026-10-21).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deleteScratchRef,
  fetchRefusal,
  pushedHead,
  type RecordRun,
} from './fetch-floors.ts';
import {
  assess,
  MIN_RUNS,
  MINIMUMS_DIR,
  readMinimumsDir,
  SIGMAS,
  summarise,
  writeMinimums,
  type Assessment,
  type Measured,
  type MinimumObservation,
  type Summary,
} from './minimums-method.ts';

const WORKFLOW = 'record-minimums';

/** The shards the workflow runs (record-minimums.yml's matrix). */
export const SHARDS = 4;

/** What a commit's shards are named before their number. */
export const artifactPrefix = (sha: string): string => `minimums-${sha}-`;

/** One `vitest run` of the properties suite: what it recorded. */
export interface RecordedRun {
  /** `<artifact>/<file>`, which names the run in every refusal. */
  readonly name: string;
  readonly lines: readonly MinimumObservation[];
}

const isObservation = (v: unknown): v is MinimumObservation => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' &&
    typeof o['actual'] === 'number' &&
    typeof o['site'] === 'string' &&
    (o['seed'] === null || typeof o['seed'] === 'number') &&
    (o['family'] === undefined || typeof o['family'] === 'string')
  );
};

/** A run's record file, one observation a line; throws naming every bad line. */
export function parseRun(name: string, text: string): RecordedRun {
  const raw = text.split('\n').filter((l) => l !== '');
  if (raw.length === 0) throw new Error(`${name} recorded nothing`);
  const bad: string[] = [];
  const lines = raw.flatMap((l, i) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(l);
    } catch {
      parsed = undefined;
    }
    if (isObservation(parsed)) return [parsed];
    bad.push(`${name} line ${String(i + 1)} is not an observation`);
    return [];
  });
  if (bad.length > 0) throw new Error(bad.join('\n'));
  return { name, lines };
}

/** The test file a `file:line` site names. */
const fileOf = (site: string): string => site.replace(/:\d+$/, '');

/**
 * One sample per count, a value per run in run order (a family member a run
 * did not reach counts 0 there), or the refusals that make the record
 * untrustworthy.
 */
export function sampled(runs: readonly RecordedRun[]): {
  samples: Record<string, number[]>;
  refusals: string[];
} {
  if (runs.length === 0)
    return { samples: {}, refusals: ['no runs were recorded'] };
  const refusals: string[] = [];
  const sites = new Map<string, Set<string>>();
  const families = new Map<string, Set<string>>();
  const seedRuns = new Map<string, string>();
  for (const { name, lines } of runs) {
    const seen = new Set<string>();
    const fileSeeds = new Map<string, Set<number>>();
    for (const o of lines) {
      if (seen.has(o.id)) refusals.push(`${o.id} is asserted twice in ${name}`);
      seen.add(o.id);
      sites.set(o.id, (sites.get(o.id) ?? new Set()).add(o.site));
      families.set(
        o.id,
        (families.get(o.id) ?? new Set()).add(o.family ?? '(none)'),
      );
      if (o.seed === null) {
        refusals.push(
          `${o.id} was recorded with no seed in ${name}: record it in the properties suite`,
        );
        continue;
      }
      const file = fileOf(o.site);
      fileSeeds.set(file, (fileSeeds.get(file) ?? new Set()).add(o.seed));
    }
    for (const [file, seeds] of [...fileSeeds].sort(([a], [b]) =>
      a < b ? -1 : 1,
    )) {
      if (seeds.size > 1) {
        refusals.push(
          `${file} ran at seeds ${[...seeds].join(' and ')} in ${name}`,
        );
        continue;
      }
      const key = `${file}@${String([...seeds][0])}`;
      const earlier = seedRuns.get(key);
      if (earlier !== undefined)
        refusals.push(
          `${file} ran at seed ${String([...seeds][0])} in both ${earlier} and ${name}: the cases repeated`,
        );
      else seedRuns.set(key, name);
    }
  }
  for (const [id, where] of [...sites].sort(([a], [b]) => (a < b ? -1 : 1)))
    if (where.size > 1)
      refusals.push(
        `${id} is asserted from two places: ${[...where].join(', ')}`,
      );
  const member = new Set<string>();
  for (const [id, fams] of [...families].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (fams.size > 1)
      refusals.push(`${id} is recorded under families ${[...fams].join(', ')}`);
    if ([...fams].some((f) => f !== '(none)')) member.add(id);
  }
  const plain = (r: RecordedRun) =>
    new Set(r.lines.map((o) => o.id).filter((id) => !member.has(id)));
  const first = plain(runs[0] as RecordedRun);
  for (const r of runs.slice(1)) {
    const these = plain(r);
    const lacks = [...first].filter((id) => !these.has(id)).sort();
    const adds = [...these].filter((id) => !first.has(id)).sort();
    if (lacks.length > 0) refusals.push(`${r.name} lacks ${lacks.join(', ')}`);
    if (adds.length > 0) refusals.push(`${r.name} adds ${adds.join(', ')}`);
  }
  const ids = [...sites.keys()].sort();
  const samples: Record<string, number[]> = {};
  for (const id of ids)
    samples[id] = runs.map(
      (r) => r.lines.find((o) => o.id === id)?.actual ?? 0,
    );
  return { samples, refusals };
}

/** A count that took no minimum, and why. */
export type Finding = { readonly id: string } & Exclude<
  Assessment,
  { kind: 'minimum' }
>;

/** One line of the report: a count's figures and what the method made of them. */
export interface Row extends Summary {
  readonly id: string;
  readonly assessment: Assessment;
}

/**
 * The minimums to write, one per count the method can bound, the findings
 * for the rest, the report's rows, and the refusals that stop any write.
 */
export function fetchedMinimums(
  local: Readonly<Record<string, Measured>>,
  samples: Readonly<Record<string, readonly number[]>>,
): {
  next: Record<string, Measured>;
  findings: Finding[];
  rows: Row[];
  refusals: string[];
} {
  const refusals: string[] = [];
  const ids = Object.keys(samples).sort();
  const runs = samples[ids[0] ?? '']?.length ?? 0;
  if (runs < MIN_RUNS)
    refusals.push(
      `only ${String(runs)} runs were recorded: ${String(MIN_RUNS)} are needed`,
    );
  for (const id of Object.keys(local).sort())
    if (samples[id] === undefined)
      refusals.push(`${id} is recorded here but not in the run`);
  const next: Record<string, Measured> = {};
  const findings: Finding[] = [];
  const rows: Row[] = [];
  for (const id of ids) {
    const summary = summarise(samples[id] as readonly number[]);
    const assessment = assess(summary);
    rows.push({ id, ...summary, assessment });
    if (assessment.kind === 'minimum')
      next[id] = { minimum: assessment.minimum, ...summary };
    else findings.push({ id, ...assessment });
  }
  return { next, findings, rows, refusals };
}

/** Each minimum that moved, appeared or went: `id: before → after`. */
export function describeMinimumMoves(
  local: Readonly<Record<string, Measured>>,
  next: Readonly<Record<string, Measured>>,
): string[] {
  const figure = (m: Measured | undefined) =>
    m === undefined ? 'none' : String(m.minimum);
  return [...new Set([...Object.keys(local), ...Object.keys(next)])]
    .sort()
    .filter((id) => local[id]?.minimum !== next[id]?.minimum)
    .map((id) => `${id}: ${figure(local[id])} → ${figure(next[id])}`);
}

const verdict = (a: Assessment): string => {
  switch (a.kind) {
    case 'minimum':
      return String(a.minimum);
    case 'too-small':
      return `too small: raise its runs ×${String(a.factor)}`;
    case 'no-spread':
      return 'no spread: fixed by construction, or barely sampled';
    case 'never-reached':
      return 'never reached';
    case 'too-few':
      return `too few runs: ${String(MIN_RUNS)} are needed`;
  }
};

/** The report to post on #84: the method, then a row per count. */
export function reportTable(rows: readonly Row[]): string {
  return [
    `Minimum = min(lowest, floor(mean − ${String(SIGMAS)} sd)) over ${String(MIN_RUNS)} or more fresh-seed runs (#84). A factor assumes the count is a sum over runs.`,
    '',
    `| Count | Runs | Lowest | Mean | SD | Mean − ${String(SIGMAS)} SD | Minimum or finding |`,
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| \`${r.id}\` | ${String(r.runs)} | ${String(r.lowest)} | ` +
        `${r.mean.toFixed(2)} | ${r.sd.toFixed(2)} | ` +
        `${(r.mean - SIGMAS * r.sd).toFixed(2)} | ${verdict(r.assessment)} |`,
    ),
    '',
  ].join('\n');
}

const die = (message: string): never => {
  console.error(`minimums:fetch: ${message}`);
  process.exit(1);
};

/** A command's standard output; dies, naming it, when it fails. */
function output(command: string, args: readonly string[]): string {
  const run = spawnSync(command, args, { encoding: 'utf8' });
  if (run.error !== undefined)
    die(`${command} did not start: ${run.error.message}`);
  if (run.status !== 0)
    die(`${command} ${args.join(' ')} failed: ${run.stderr.trim()}`);
  return run.stdout.trim();
}

function main(): void {
  const id = process.argv[2];
  if (id === undefined || !/^\d+$/.test(id))
    die('name the record-minimums run: npm run minimums:fetch <run-id>');
  const runId = id as string;
  const run = JSON.parse(
    output('gh', [
      'run',
      'view',
      runId,
      '--json',
      'workflowName,status,conclusion,displayTitle',
    ]),
  ) as RecordRun;
  const head = output('git', ['rev-parse', 'HEAD']);
  const branch = output('git', ['branch', '--show-current']);
  const refusal = fetchRefusal(run, head, branch, pushedHead(output), WORKFLOW);
  if (refusal !== undefined) die(refusal);

  const dir = mkdtempSync(join(tmpdir(), 'minimums-fetch-'));
  try {
    output('gh', [
      'run',
      'download',
      runId,
      '--pattern',
      `${artifactPrefix(head)}*`,
      '--dir',
      dir,
    ]);
    // gh writes each artifact of a multi-artifact download to its own folder.
    const shards = readdirSync(dir).sort();
    if (shards.length !== SHARDS)
      die(
        `found ${String(shards.length)} shards (${shards.join(', ')}), not ${String(SHARDS)}`,
      );
    const runs = shards.flatMap((shard) =>
      readdirSync(join(dir, shard))
        .filter((f) => f.endsWith('.jsonl'))
        .sort()
        .map((f) =>
          parseRun(`${shard}/${f}`, readFileSync(join(dir, shard, f), 'utf8')),
        ),
    );
    const { samples, refusals: sampleRefusals } = sampled(runs);
    if (sampleRefusals.length > 0)
      die(`nothing written:\n  ${sampleRefusals.join('\n  ')}`);
    const local = readMinimumsDirIfAny();
    const { next, findings, rows, refusals } = fetchedMinimums(local, samples);
    if (refusals.length > 0)
      die(`nothing written:\n  ${refusals.join('\n  ')}`);
    const written = writeMinimums(MINIMUMS_DIR, next);
    const moves = describeMinimumMoves(local, next);
    console.log(reportTable(rows));
    console.log(
      `minimums:fetch: run ${runId} at ${head}, ${String(runs.length)} runs: ` +
        `${String(Object.keys(next).length)} minimums, ${String(findings.length)} findings`,
    );
    if (moves.length > 0)
      console.log(`minimums:fetch: moved:\n  ${moves.join('\n  ')}`);
    console.log(`minimums:fetch: wrote ${written.join(', ') || 'nothing'}`);
    console.log(
      `minimums:fetch: fold them into the unpushed commit (git commit --amend), push the branch once, then: ${deleteScratchRef(WORKFLOW, branch)}`,
    );
    if (findings.length > 0)
      die(
        `${String(findings.length)} counts took no minimum, and the checker ` +
          `refuses them until each is dealt with (spec §4, §6):\n  ` +
          findings.map((f) => `${f.id}: ${verdict(f)}`).join('\n  '),
      );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The minimums recorded here; none before the first record. */
function readMinimumsDirIfAny(): Record<string, Measured> {
  try {
    return readMinimumsDir(MINIMUMS_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

if (import.meta.main) main();
