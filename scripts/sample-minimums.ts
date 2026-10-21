/**
 * Sample the properties suite's reach counts in CI (#84, spec §5.5):
 * `npm run minimums:sample -- --runs <n> --out <dir>`.
 *
 * Each run is a fresh `vitest run` of the whole properties suite, so every
 * file draws a fresh seed (tests/properties-setup.ts), with the minimum
 * checker's record switch set to the run's own file: every reach count is
 * written down and none is judged, zeros included. The record-minimums
 * workflow runs this on 4 shards and uploads each folder for
 * `npm run minimums:fetch` to read back. A red run stops the sample, naming
 * it: a red property is a real defect, never a re-run (AC9). Every check of
 * what was recorded happens once, in the fetch, which sees every shard.
 * Refused outside that workflow, as `floors:record` is outside its own.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { posix } from 'node:path';
import { MINIMUMS_RECORD_ENV } from './minimums-method.ts';

/** The switch the record-minimums workflow sets, naming itself. */
export const SAMPLE_JOB_ENV = 'MINIMUMS_RECORD_JOB';

const WORKFLOW = 'record-minimums';

/** Why this environment must not sample, or nothing. */
export const sampleRefusal = (
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined =>
  environment['CI'] !== undefined &&
  environment['CI'] !== '' &&
  environment[SAMPLE_JOB_ENV] === WORKFLOW
    ? undefined
    : `minimums are sampled in CI only, by the ${WORKFLOW} workflow: push the commit to refs/minimums/<branch> and dispatch ${WORKFLOW} on develop (#84, #718)`;

const USAGE =
  'usage: npm run minimums:sample -- --runs <whole number of 1 or more> --out <folder>';

/** The runs and the folder, or the usage for anything else. */
export function sampleArgs(
  argv: readonly string[],
): { runs: number; out: string } | string {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] as string;
    const value = argv[i + 1];
    if ((flag !== '--runs' && flag !== '--out') || value === undefined)
      return USAGE;
    values.set(flag, value);
  }
  const runs = values.get('--runs');
  const out = values.get('--out');
  if (runs === undefined || out === undefined || !/^[1-9]\d*$/.test(runs))
    return USAGE;
  return { runs: Number(runs), out };
}

/** Run `n`'s record file, padded so a folder's files sort in run order. */
export const runFile = (out: string, n: number): string =>
  posix.join(out, `run-${String(n).padStart(3, '0')}.jsonl`);

/** The process run `n` starts. */
export function sampleRun(
  out: string,
  n: number,
): { command: string; args: string[]; env: Record<string, string> } {
  return {
    command: 'npx',
    args: ['vitest', 'run', '-c', 'vitest.properties.config.ts'],
    env: { [MINIMUMS_RECORD_ENV]: runFile(out, n) },
  };
}

const die = (message: string): never => {
  console.error(`minimums:sample: ${message}`);
  process.exit(1);
};

function main(): void {
  const refusal = sampleRefusal(process.env);
  if (refusal !== undefined) die(refusal);
  const args = sampleArgs(process.argv.slice(2));
  if (typeof args === 'string') die(args);
  const { runs, out } = args as { runs: number; out: string };
  mkdirSync(out, { recursive: true });
  const started = Date.now();
  for (let n = 1; n <= runs; n += 1) {
    const { command, args: argv, env } = sampleRun(out, n);
    const run = spawnSync(command, argv, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    if (run.error !== undefined)
      die(`${command} did not start: ${run.error.message}`);
    if (run.status !== 0)
      die(
        `run ${String(n)} of ${String(runs)} went red: a real defect, never a re-run (#84, AC9). File it and replay it from the seed it names.`,
      );
    const file = runFile(out, n);
    if (!existsSync(file) || statSync(file).size === 0)
      die(
        `run ${String(n)} recorded nothing: the record switch reached no check`,
      );
    console.log(
      `minimums:sample: run ${String(n)} of ${String(runs)} recorded, ${String(Math.round((Date.now() - started) / 1000))} s in`,
    );
  }
}

if (import.meta.main) main();
