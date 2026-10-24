/**
 * `node scripts/pre-push.ts`, run by `.githooks/pre-push` (#752): the static
 * gates (format check, lint, typecheck; #123, #547) on each commit the push
 * sends, oldest first, never on the working tree. A committed error therefore
 * cannot pass because an uncommitted fix sits beside it, nor because it lives
 * in an earlier commit of a push of several, which CI (it checks a pull
 * request's head) would never see.
 *
 * Each commit is checked out in its own temporary detached worktree, and
 * each commit's own scripts and configs run there (as repo-template#65 ruled,
 * 2026-10-23). Installed packages are borrowed from this checkout: every
 * outside package is linked to the checkout's copy, but our own workspace
 * packages are linked inside the worktree, because npm links them relatively
 * (`../../packages/core`) and a link to the checkout's whole `node_modules`
 * would resolve them to the working tree, the very thing not to check. A
 * commit that changes the dependencies is checked against the checkout's
 * installed ones. `postinstall` runs first, since it writes the Workers' types
 * the typecheck reads. The worktree is removed in every outcome.
 *
 * The functions take git, npm and the filesystem as `Effects`, so the unit
 * suite runs them on stand-ins; the hook itself is run against a scratch
 * repository by `tests/integration/pre-push.test.ts`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';

/** The checks each commit must pass, in the order they run. */
export const GATES = ['format:check', 'lint', 'typecheck'] as const;

/** The npm scope our workspace packages are linked under. */
const WORKSPACE_SCOPE = '@yawelo-idle';

/** One line git writes to a pre-push hook's input. */
export interface Update {
  readonly localRef: string;
  readonly localSha: string;
  readonly remoteRef: string;
  readonly remoteSha: string;
}

/** The check a commit failed, and the commit's short name. */
export interface Refusal {
  readonly check: string;
  readonly commit: string;
}

/** What the checks do outside this module, stood in by the unit suite. */
export interface Effects {
  /** Runs git in `cwd` and returns what it printed; throws when git fails. */
  readonly git: (args: readonly string[], cwd: string) => string;
  /** Runs an npm script in `cwd`, its output shown, and returns its exit status. */
  readonly npm: (script: string, cwd: string, ifPresent: boolean) => number;
  readonly makeTempDir: () => string;
  readonly removeDir: (path: string) => void;
  /** A directory's entries, or `undefined` when it does not exist. */
  readonly list: (path: string) => readonly string[] | undefined;
  readonly readLink: (path: string) => string;
  readonly exists: (path: string) => boolean;
  readonly makeDir: (path: string) => void;
  readonly link: (target: string, path: string) => void;
  readonly say: (line: string) => void;
}

/** A commit name: SHA-1's 40 hex digits or SHA-256's 64. */
const OBJECT_NAME = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
/** Git's name for "no commit": a deletion's local side, a new ref's remote side. */
const NO_COMMIT = /^0+$/;

/** Reads git's pre-push input, refusing any line it cannot read. */
export function readUpdates(stdin: string): Update[] {
  return stdin
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const fields = line.split(' ');
      const [localRef, localSha, remoteRef, remoteSha] = fields;
      if (
        fields.length !== 4 ||
        localRef === undefined ||
        remoteRef === undefined ||
        localSha === undefined ||
        remoteSha === undefined ||
        !OBJECT_NAME.test(localSha) ||
        !OBJECT_NAME.test(remoteSha)
      )
        throw new Error(
          `git sent the pre-push hook a line it cannot read: ${line}`,
        );
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

/**
 * The commits the push sends that no remote branch has, oldest first, each
 * once. A deletion sends none; a new ref's commits are those past every
 * remote branch.
 */
export function commitsToCheck(
  updates: readonly Update[],
  revList: (args: readonly string[]) => readonly string[],
): string[] {
  const commits: string[] = [];
  for (const update of updates) {
    if (NO_COMMIT.test(update.localSha)) continue;
    const known = NO_COMMIT.test(update.remoteSha) ? [] : [update.remoteSha];
    const listed = revList([
      '--reverse',
      '--topo-order',
      update.localSha,
      '--not',
      '--remotes',
      ...known,
    ]);
    for (const commit of listed)
      if (!commits.includes(commit)) commits.push(commit);
  }
  return commits;
}

/**
 * Gives `worktree` this checkout's installed packages: each outside package
 * linked to the checkout's copy, our own workspace links rebuilt inside the
 * worktree, and each workspace the commit has given its installed packages.
 */
export function mirrorNodeModules(
  root: string,
  worktree: string,
  effects: Effects,
): void {
  const source = join(root, 'node_modules');
  const entries = effects.list(source);
  if (entries === undefined)
    throw new Error(`${source} is missing: run npm install first`);
  const target = join(worktree, 'node_modules');
  effects.makeDir(target);
  const workspaces: string[] = [];
  for (const name of [...entries].sort()) {
    if (name !== WORKSPACE_SCOPE) {
      effects.link(join(source, name), join(target, name));
      continue;
    }
    effects.makeDir(join(target, name));
    for (const pkg of [...(effects.list(join(source, name)) ?? [])].sort()) {
      const relative = effects.readLink(join(source, name, pkg));
      effects.link(relative, join(target, name, pkg));
      workspaces.push(normalize(join('node_modules', name, relative)));
    }
  }
  for (const workspace of workspaces) {
    const installed = join(root, workspace, 'node_modules');
    if (effects.exists(installed) && effects.exists(join(worktree, workspace)))
      effects.link(installed, join(worktree, workspace, 'node_modules'));
  }
}

/** Runs `postinstall` and the gates in `dir`, returning the first that fails. */
function failedStep(dir: string, effects: Effects): string | undefined {
  if (effects.npm('postinstall', dir, true) !== 0) return 'postinstall';
  return GATES.find((gate) => effects.npm(gate, dir, false) !== 0);
}

/**
 * Checks each commit in its own temporary worktree, in order, and returns the
 * first failure, or `undefined` when every commit passes.
 */
export function checkCommits(
  commits: readonly string[],
  root: string,
  effects: Effects,
): Refusal | undefined {
  for (const [index, commit] of commits.entries()) {
    const short = commit.slice(0, 7);
    effects.say(
      `pre-push: checking ${short} (${String(index + 1)} of ${String(commits.length)}) in a temporary worktree`,
    );
    const dir = effects.makeTempDir();
    let added = false;
    try {
      effects.git(
        ['worktree', 'add', '--quiet', '--detach', dir, commit],
        root,
      );
      added = true;
      mirrorNodeModules(root, dir, effects);
      const failed = failedStep(dir, effects);
      if (failed !== undefined) return { check: failed, commit: short };
    } finally {
      if (added) effects.git(['worktree', 'remove', '--force', dir], root);
      effects.removeDir(dir);
    }
  }
  return undefined;
}

/** What the hook prints when it refuses a push. */
export function refusalMessage(refusal: Refusal): string {
  return `✗ pre-push: ${refusal.check} failed on commit ${refusal.commit}, so nothing was pushed. Fix that commit (an uncommitted fix does not count), then push again.`;
}

/** The real effects: git and npm as processes, the real filesystem. */
function realEffects(childEnv: NodeJS.ProcessEnv): Effects {
  return {
    git: (args, cwd) =>
      execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      }),
    npm: (script, cwd, ifPresent) => {
      const run = spawnSync(
        'npm',
        ['run', '--silent', ...(ifPresent ? ['--if-present'] : []), script],
        { cwd, env: childEnv, stdio: ['ignore', 'inherit', 'inherit'] },
      );
      if (run.error !== undefined) throw run.error;
      return run.status ?? 1;
    },
    makeTempDir: () => mkdtempSync(join(tmpdir(), 'pre-push-')),
    removeDir: (path) => {
      rmSync(path, { recursive: true, force: true });
    },
    list: (path) => (existsSync(path) ? readdirSync(path) : undefined),
    readLink: (path) => readlinkSync(path),
    exists: (path) => existsSync(path),
    makeDir: (path) => {
      mkdirSync(path);
    },
    link: (target, path) => {
      symlinkSync(target, path);
    },
    say: (line) => {
      console.log(line);
    },
  };
}

if (import.meta.main) {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).trim();
    // Git sets these for its hooks; a check run in the temporary worktree
    // must find that worktree's repository, not this one's.
    const local = execFileSync('git', ['rev-parse', '--local-env-vars'], {
      encoding: 'utf8',
    }).split('\n');
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !local.includes(key)),
    );
    const effects = realEffects(childEnv);
    const commits = commitsToCheck(
      readUpdates(readFileSync(0, 'utf8')),
      (args) =>
        effects
          .git(['rev-list', ...args], root)
          .split('\n')
          .filter((line) => line !== ''),
    );
    if (commits.length === 0) effects.say('pre-push: no new commits to check');
    const refusal = checkCommits(commits, root, effects);
    if (refusal !== undefined) {
      console.error(refusalMessage(refusal));
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `✗ pre-push: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
