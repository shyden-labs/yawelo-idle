/**
 * Write the floors the record-floors workflow recorded in CI (#547):
 * `npm run floors:fetch <run-id>`.
 *
 * Floors are recorded in CI only (global rule 2026-10-09): labelling a pull
 * request `record-floors` runs every suite on its head and uploads
 * `tests/floors/` as `floors-<head SHA>`. The commit is made here, so the
 * push runs CI as any push does (operator, 2026-10-12: "CI records, laptop
 * commits"; the App's key never leaves the laptop). This script refuses
 * unless the run is record-floors', finished, succeeded, and recorded this
 * branch at its current HEAD; and it refuses figures that fall or a floor
 * the run does not hold, which the recorder itself would never write. It
 * prints each figure that moved, for the commit to name.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  describeMoves,
  FLOORS_DIR,
  readFloorsDir,
  writeFloors,
} from './record-floors.ts';

/** What `gh run view --json` says of a run, as far as a fetch reads it. */
export interface RecordRun {
  readonly workflowName: string;
  readonly status: string;
  readonly conclusion: string;
  readonly headSha: string;
  readonly headBranch: string;
}

const WORKFLOW = 'record-floors';

/** The artifact a record uploads: named by the commit it ran on. */
export const artifactName = (sha: string): string => `floors-${sha}`;

/** Why this run's floors must not be written here, or nothing. */
export function fetchRefusal(
  run: RecordRun,
  head: string,
  branch: string,
): string | undefined {
  if (run.workflowName !== WORKFLOW)
    return `run is ${run.workflowName}’s, not ${WORKFLOW}’`;
  if (run.status !== 'completed') return `run is ${run.status}, not finished`;
  if (run.conclusion !== 'success')
    return `run ended ${run.conclusion}: it recorded nothing`;
  if (run.headBranch !== branch)
    return `run recorded ${run.headBranch}, not ${branch}`;
  if (run.headSha !== head)
    return `run recorded ${run.headSha}, but HEAD is ${head}: label the pull request again after the last push`;
  return undefined;
}

/**
 * The figures to write: the run's. Refused, by id, where one would fall or
 * where a floor recorded here is missing from the run's, since the recorder
 * neither lowers nor drops a figure.
 */
export function fetchedFloors(
  local: Readonly<Record<string, number>>,
  fetched: Readonly<Record<string, number>>,
): { next: Record<string, number>; refusals: string[] } {
  const refusals: string[] = [];
  for (const [id, figure] of Object.entries(local)) {
    const recorded = fetched[id];
    if (recorded === undefined)
      refusals.push(`${id} is recorded here but not in the run’s floors`);
    else if (recorded < figure)
      refusals.push(
        `${id} would fall from ${String(figure)} to ${String(recorded)}: the recorder refuses a fall, so this run is not its record`,
      );
  }
  return { next: { ...fetched }, refusals };
}

const die = (message: string): never => {
  console.error(`floors:fetch: ${message}`);
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
    die('name the record-floors run: npm run floors:fetch <run-id>');
  const runId = id as string;
  const run = JSON.parse(
    output('gh', [
      'run',
      'view',
      runId,
      '--json',
      'workflowName,status,conclusion,headSha,headBranch',
    ]),
  ) as RecordRun;
  const head = output('git', ['rev-parse', 'HEAD']);
  const branch = output('git', ['branch', '--show-current']);
  const refusal = fetchRefusal(run, head, branch);
  if (refusal !== undefined) die(refusal);

  const dir = mkdtempSync(join(tmpdir(), 'floors-fetch-'));
  try {
    output('gh', [
      'run',
      'download',
      runId,
      '--name',
      artifactName(head),
      '--dir',
      dir,
    ]);
    const local = readFloorsDir(FLOORS_DIR);
    const { next, refusals } = fetchedFloors(local, readFloorsDir(dir));
    if (refusals.length > 0)
      die(`nothing written:\n  ${refusals.join('\n  ')}`);
    const written = writeFloors(FLOORS_DIR, next);
    const moves = describeMoves(local, next);
    console.log(
      moves.length === 0
        ? 'floors:fetch: no figure moved'
        : `floors:fetch: run ${runId} at ${head} moved ${String(moves.length)}:\n  ${moves.join('\n  ')}`,
    );
    console.log(`floors:fetch: wrote ${written.join(', ') || 'nothing'}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) main();
