/**
 * The scratch-ref gate (#718), moved out of record-floors.yml's shell into a
 * tested script (#771). A record measures a commit not yet pushed to its
 * branch: the session pushes it to `refs/floors/<branch>` and dispatches the
 * workflow on develop with the branch and the SHA. The SHA alone could name
 * any commit, so before any job checks it out this gate refuses develop and
 * main, a malformed branch or SHA, and a SHA that is not the scratch ref's
 * tip as the public repository reads it (a failed read is refused too).
 *
 * The workflow runs it from develop's own checkout, before the measured
 * commit is checked out: the commit it judges never runs its own gate. It
 * imports node built-ins only, since that job runs no `npm ci`.
 *
 * record-floors.yml starts it with one inline line (`node --input-type=module
 * -e …`), not a start file (Shyden, 2026-10-28: "Start line in the workflow").
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** A finished process as the gate reads it. */
export interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** What the gate reaches outside itself, stood in by the unit tests. */
export interface GateIo {
  env: Readonly<Record<string, string | undefined>>;
  readFile(path: string): string;
  /** `env` is added to the runner's environment for this command alone. */
  run(
    command: string,
    args: readonly string[],
    env?: Readonly<Record<string, string>>,
  ): Run;
  error(message: string): void;
}

/** Floors come from the ticket branches merged into these (#547). */
export const REFUSED_BRANCHES: readonly string[] = ['develop', 'main'];

const BRANCH = /^[A-Za-z0-9._/-]+$/;
const SHA = /^[0-9a-f]{40}$/;

/** Why the given branch and SHA may not be recorded, or nothing. */
export function inputRefusal(branch: string, sha: string): string | undefined {
  if (REFUSED_BRANCHES.includes(branch))
    return `record-floors records ticket branches, not ${branch} (#547).`;
  if (!BRANCH.test(branch)) return 'branch must be a branch name (#718).';
  if (!SHA.test(sha)) return 'sha must be 40 lowercase hex characters (#718).';
  return undefined;
}

/**
 * Why `git ls-remote <repository> refs/floors/<branch>` does not show `sha`
 * at exactly that ref, or nothing. ls-remote matches its pattern by the
 * ref's tail, so a longer ref ending in the same name answers too: only one
 * line, naming exactly the ref, passes.
 */
export function tipRefusal(
  branch: string,
  sha: string,
  lsRemote: Run,
): string | undefined {
  const ref = `refs/floors/${branch}`;
  if (lsRemote.status !== 0)
    return `git ls-remote could not read ${ref}: ${lsRemote.stderr.trim()} (#718).`;
  const lines = lsRemote.stdout.split('\n').filter((line) => line !== '');
  const unread = lines.find((line) => line.split('\t').length !== 2);
  if (unread !== undefined)
    return `git ls-remote printed a line the gate cannot read: ${unread} (#718).`;
  const listed = lines.map((line) => line.split('\t') as [string, string]);
  if (listed.length === 0) return `${ref} is at '', not ${sha} (#718).`;
  // Not empty, so the first entry is there.
  const [[tip, name]] = listed as [[string, string], ...[string, string][]];
  if (listed.length !== 1 || name !== ref)
    return `git ls-remote listed ${listed.map(([, listedRef]) => listedRef).join(', ')} for ${ref}, not exactly it (#718).`;
  return tip === sha ? undefined : `${ref} is at '${tip}', not ${sha} (#718).`;
}

/** The dispatch's branch and SHA, or why the event payload holds none. */
export function eventInputs(
  text: string,
): { branch: string; sha: string } | string {
  let event: unknown;
  try {
    event = JSON.parse(text);
  } catch {
    return 'the event payload is not JSON (#771).';
  }
  const inputs = (event as { inputs?: unknown }).inputs;
  if (typeof inputs !== 'object' || inputs === null)
    return 'the event payload holds no inputs (#771).';
  const { branch, sha } = inputs as { branch?: unknown; sha?: unknown };
  if (typeof branch !== 'string')
    return 'inputs.branch is not a string (#771).';
  if (typeof sha !== 'string') return 'inputs.sha is not a string (#771).';
  return { branch, sha };
}

const VARIABLES = [
  'GITHUB_EVENT_PATH',
  'GITHUB_SERVER_URL',
  'GITHUB_REPOSITORY',
] as const;

/** Why this run may not record, read through `io`, or nothing. */
function refusal(io: GateIo): string | undefined {
  const missing = VARIABLES.find((name) => io.env[name] === undefined);
  if (missing !== undefined) return `${missing} is not set (#771).`;
  const {
    GITHUB_EVENT_PATH: path,
    GITHUB_SERVER_URL: server,
    GITHUB_REPOSITORY: repository,
  } = io.env as Record<(typeof VARIABLES)[number], string>;
  let text: string;
  try {
    text = io.readFile(path);
  } catch (error) {
    return `could not read the event payload at ${path}: ${(error as Error).message} (#771).`;
  }
  const inputs = eventInputs(text);
  if (typeof inputs === 'string') return inputs;
  const { branch, sha } = inputs;
  return (
    inputRefusal(branch, sha) ??
    tipRefusal(
      branch,
      sha,
      io.run('git', [
        'ls-remote',
        `${server}/${repository}`,
        `refs/floors/${branch}`,
      ]),
    )
  );
}

/** The step's exit code: 0 to record, 1 after naming the refusal. */
export function gate(io: GateIo): number {
  const refused = refusal(io);
  if (refused === undefined) return 0;
  io.error(`::error::${refused}`);
  return 1;
}

/** A spawnSync result as the gate reads it: a process that never started says why. */
export const toRun = (
  result: Pick<
    SpawnSyncReturns<string>,
    'status' | 'stdout' | 'stderr' | 'error'
  >,
): Run => ({
  status: result.status,
  stdout: result.stdout,
  stderr: result.error?.message ?? result.stderr,
});

/** The real io: the runner's environment, files, git and stderr. */
export const nodeIo: GateIo = {
  env: process.env,
  readFile: (path) => readFileSync(path, 'utf8'),
  run: (command, args, env) =>
    toRun(
      spawnSync(command, args, {
        encoding: 'utf8',
        env: { ...process.env, ...env },
      }),
    ),
  error: (message) => {
    console.error(message);
  },
};
