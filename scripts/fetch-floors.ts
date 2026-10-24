/**
 * Write the floors the record-floors workflow recorded in CI (#547):
 * `npm run floors:fetch <run-id>`.
 *
 * Floors are recorded in CI only (global rule 2026-10-09), on a commit not
 * yet pushed to its branch (#718; global rule 2026-10-21): the session
 * pushes it to `refs/floors/<branch>` and dispatches record-floors on
 * develop, which uploads `tests/floors/` as `floors-<sha>`. The figures are
 * folded into that commit here, and the branch is pushed once, already
 * green. This script refuses unless the run is record-floors', finished,
 * succeeded, and measured this branch at its current HEAD, and HEAD is on no
 * remote branch; and it refuses figures that fall or a floor the run does
 * not hold, which the recorder itself would never write. It prints each
 * figure that moved, for the commit to name, and the scratch ref's delete.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import {
  describeMoves,
  floorsFileOf,
  FLOORS_DIR,
  readFloorsDir,
  writeFloors,
} from './record-floors.ts';
import { parseNameStatus } from './ci-scope.ts';
import {
  coveragePlan,
  fetchedRecordRefusals,
  RECORD_FILE,
  renamesFrom,
} from './coverage.ts';
import { isIgnored } from '../tests/unit/tracked-files.ts';

/**
 * What `gh run view --json` says of a run, as far as a fetch reads it. A
 * dispatched run's head is develop's, so the commit it measured is read
 * from its title, which the workflow's `run-name` sets (#718).
 */
export interface RecordRun {
  readonly workflowName: string;
  readonly status: string;
  readonly conclusion: string;
  readonly displayTitle: string;
}

const WORKFLOW = 'record-floors';

/** The artifact a record uploads: named by the commit it ran on. */
export const artifactName = (sha: string): string => `floors-${sha}`;

/** The coverage record's artifact (#728): its own, so the floors keep their layout. */
export const coverageArtifactName = (sha: string): string => `coverage-${sha}`;

/** The `owner/name` a run belongs to, from its URL. */
export function repoOfRunUrl(url: string): string {
  const match =
    /^https:\/\/github\.com\/([^/]+\/[^/]+)\/actions\/runs\/\d+$/.exec(url);
  if (match === null) throw new Error(`not a run URL: ${url}`);
  return match[1] as string;
}

/**
 * The ref a workflow measures a branch's unpushed commit on: not a branch,
 * so it lists nowhere and starts no run (#718 AC1).
 */
export const scratchRef = (workflow: string, branch: string): string =>
  `refs/${workflow.replace(/^record-/, '')}/${branch}`;

/** The command that deletes the scratch ref once the branch is pushed. */
export const deleteScratchRef = (workflow: string, branch: string): string =>
  `git push origin --delete ${scratchRef(workflow, branch)}`;

/**
 * Why this run's record must not be written here, or nothing. `pushed` is
 * whether HEAD is already on a remote branch: the figures fold into a
 * commit not yet pushed, never into a commit on top (#718).
 */
export function fetchRefusal(
  run: RecordRun,
  head: string,
  branch: string,
  pushed: boolean,
  workflow: string = WORKFLOW,
): string | undefined {
  if (run.workflowName !== workflow)
    return `run is ${run.workflowName}’s, not ${workflow}’`;
  if (run.status !== 'completed') return `run is ${run.status}, not finished`;
  if (run.conclusion !== 'success')
    return `run ended ${run.conclusion}: it recorded nothing`;
  const wanted = `${workflow} ${branch} at ${head}`;
  if (run.displayTitle !== wanted)
    return `run measured “${run.displayTitle}”, not “${wanted}”: push this commit to ${scratchRef(workflow, branch)} and dispatch ${workflow} on develop for it`;
  if (pushed)
    return `HEAD ${head} is already on origin: figures fold into a commit not yet pushed, so measure the commit before its first push (#718)`;
  return undefined;
}

/**
 * Whether HEAD is on any remote branch, read after a fetch that prunes, so
 * the ref of a branch deleted on GitHub never counts as pushed (#723).
 */
export function pushedHead(
  output: (command: string, args: readonly string[]) => string,
): boolean {
  output('git', ['fetch', '--quiet', '--prune', 'origin']);
  return output('git', ['branch', '--remotes', '--contains', 'HEAD']) !== '';
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

/** The coverage record a fetch writes, beside the floors. */
export interface FetchedRecord {
  readonly file: string;
  readonly text: string;
}

/** A file's text, or undefined where there is none. */
const textOf = (file: string): string | undefined =>
  existsSync(file) ? readFileSync(file, 'utf8') : undefined;

/**
 * Write the run's floors and its coverage record as one change (#747):
 * every file a fetch may touch is read first, the folders are made (the
 * first record's among them), and when any step fails each file is put back
 * as it was and each file and folder the fetch made is removed, so a failed
 * fetch changes nothing. Returns the files written: floors by name, the
 * record by path.
 */
export function writeFetched(
  floorsDir: string,
  next: Readonly<Record<string, number>>,
  record: FetchedRecord | undefined,
  write: (file: string, text: string) => void = writeFileSync,
): string[] {
  const before = new Map<string, string | undefined>();
  if (existsSync(floorsDir))
    for (const name of readdirSync(floorsDir))
      before.set(join(floorsDir, name), textOf(join(floorsDir, name)));
  if (record !== undefined) before.set(record.file, textOf(record.file));
  const made: string[] = [];
  try {
    for (const dir of [
      floorsDir,
      ...(record === undefined ? [] : [dirname(record.file)]),
    ]) {
      const first = mkdirSync(dir, { recursive: true });
      if (first !== undefined) made.push(first);
    }
    const written = writeFloors(floorsDir, next, write);
    if (record !== undefined) {
      write(record.file, record.text);
      written.push(record.file);
    }
    return written;
  } catch (error) {
    for (const name of existsSync(floorsDir) ? readdirSync(floorsDir) : [])
      if (!before.has(join(floorsDir, name))) rmSync(join(floorsDir, name));
    for (const [file, text] of before)
      if (text === undefined) {
        if (existsSync(file)) rmSync(file);
      } else if (textOf(file) !== text) writeFileSync(file, text);
    for (const dir of made.reverse())
      rmSync(dir, { recursive: true, force: true });
    throw new Error(
      `nothing written, every file is as it was: ${(error as Error).message}`,
      { cause: error },
    );
  }
}

/** Every file a fetch may write: each floors file once, then the record. */
export function fetchTargets(
  floorsDir: string,
  next: Readonly<Record<string, number>>,
  recordFile: string | undefined,
): string[] {
  const floors = new Set(
    Object.keys(next).map((id) =>
      join(floorsDir, posix.basename(floorsFileOf(id))),
    ),
  );
  return [
    ...[...floors].sort(),
    ...(recordFile === undefined ? [] : [recordFile]),
  ];
}

/**
 * Why the fetch must not write, or nothing: a target git ignores would be
 * written and reported, then left out by the amend (#748). `ignored` is
 * tracked-files' `isIgnored`, which answers as `git check-ignore` does.
 */
export const ignoredRefusal = (
  targets: readonly string[],
  ignored: (path: string) => boolean,
): string | undefined => {
  const left = targets.filter(ignored);
  return left.length === 0
    ? undefined
    : `nothing written, git would leave out of the commit what the fetch writes (a .gitignore pattern matches it): ${left.join(', ')}. Un-ignore it in .gitignore, then fetch again`;
};

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

/**
 * The run's coverage record (#728), checked before anything is written: no
 * file's untested code may grow against the record at the merge base with
 * origin/develop. Undefined when neither the run nor the tree holds one.
 */
function fetchedCoverage(
  runId: string,
  head: string,
  dir: string,
): string | undefined {
  const repo = repoOfRunUrl(
    output('gh', ['run', 'view', runId, '--json', 'url', '--jq', '.url']),
  );
  const uploaded = output('gh', [
    'api',
    `repos/${repo}/actions/runs/${runId}/artifacts`,
    '--jq',
    '.artifacts[].name',
  ]).split('\n');
  const plan = coveragePlan(
    uploaded.includes(coverageArtifactName(head)),
    existsSync(RECORD_FILE),
  );
  if (plan === 'skip') {
    console.log('floors:fetch: no coverage record in the run or the tree');
    return undefined;
  }
  if (plan !== 'fetch') die(plan);
  const into = join(dir, 'coverage');
  output('gh', [
    'run',
    'download',
    runId,
    '--name',
    coverageArtifactName(head),
    '--dir',
    into,
  ]);
  const fetched = readFileSync(join(into, 'record.json'), 'utf8');
  const base = output('git', ['merge-base', 'HEAD', 'origin/develop']);
  const shown = spawnSync('git', ['show', `${base}:${RECORD_FILE}`], {
    encoding: 'utf8',
  });
  // `output` trims whitespace only, so -z's closing NUL is kept.
  const renamed = renamesFrom(
    parseNameStatus(
      output('git', ['diff', '--name-status', '-z', '-M', base, 'HEAD']),
    ),
  );
  const refusals = fetchedRecordRefusals(
    shown.status === 0 ? shown.stdout : undefined,
    fetched,
    renamed,
  );
  if (refusals.length > 0)
    die(
      `nothing written, a file's untested code grew:\n  ${refusals.join('\n  ')}`,
    );
  return fetched;
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
      'workflowName,status,conclusion,displayTitle',
    ]),
  ) as RecordRun;
  const head = output('git', ['rev-parse', 'HEAD']);
  const branch = output('git', ['branch', '--show-current']);
  const refusal = fetchRefusal(run, head, branch, pushedHead(output));
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
    const coverage = fetchedCoverage(runId, head, dir);
    const ignoredWhy = ignoredRefusal(
      fetchTargets(
        FLOORS_DIR,
        next,
        coverage === undefined ? undefined : RECORD_FILE,
      ),
      (path) => isIgnored(path),
    );
    if (ignoredWhy !== undefined) die(ignoredWhy);
    let written: string[] = [];
    try {
      written = writeFetched(
        FLOORS_DIR,
        next,
        coverage === undefined
          ? undefined
          : { file: RECORD_FILE, text: coverage },
      );
    } catch (error) {
      die((error as Error).message);
    }
    const moves = describeMoves(local, next);
    console.log(
      moves.length === 0
        ? 'floors:fetch: no figure moved'
        : `floors:fetch: run ${runId} at ${head} moved ${String(moves.length)}:\n  ${moves.join('\n  ')}`,
    );
    console.log(`floors:fetch: wrote ${written.join(', ') || 'nothing'}`);
    console.log(
      `floors:fetch: fold them into the unpushed commit (git commit --amend), push the branch once, then: ${deleteScratchRef(WORKFLOW, branch)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) main();
