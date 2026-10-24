import { describe, expect, it } from 'vitest';
import {
  GATES,
  checkCommits,
  commitsToCheck,
  mirrorNodeModules,
  readUpdates,
  refusalMessage,
  type Effects,
  type Update,
} from '../../scripts/pre-push';
import { againstControl } from '../searched';

/**
 * The pre-push hook checks each commit the push sends, not the working tree
 * (#752): a committed error under an uncommitted fix, or in the first of two
 * commits, must not reach GitHub. The pure half is tested here with git, npm
 * and the filesystem stood in; the hook itself is run against a scratch
 * repository in tests/integration/pre-push.test.ts.
 */

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const ZERO = '0'.repeat(40);

const line = (localSha: string, remoteSha: string, ref = 'refs/heads/x') =>
  `${ref} ${localSha} ${ref} ${remoteSha}`;

const update = (localSha: string, remoteSha: string): Update => ({
  localRef: 'refs/heads/x',
  localSha,
  remoteRef: 'refs/heads/x',
  remoteSha,
});

describe('readUpdates reads the lines git writes to the hook (#752 AC1, AC3)', () => {
  it('reads one update', () => {
    expect(readUpdates(`${line(A, B)}\n`)).toEqual([update(A, B)]);
  });

  it('reads two updates, in the order git wrote them', () => {
    expect(readUpdates(`${line(A, B)}\n${line(C, ZERO)}\n`)).toEqual([
      update(A, B),
      update(C, ZERO),
    ]);
  });

  it('reads a SHA-256 repository’s 64-digit names', () => {
    const long = 'd'.repeat(64);
    expect(readUpdates(line(long, '0'.repeat(64)))).toEqual([
      update(long, '0'.repeat(64)),
    ]);
  });

  it('reads an empty input as no updates', () => {
    expect(
      againstControl(readUpdates, { input: '', control: line(A, B) }),
    ).toEqual([]);
  });

  it('refuses a line with three fields, naming it', () => {
    expect(() => readUpdates(`refs/heads/x ${A} refs/heads/x\n`)).toThrow(
      `git sent the pre-push hook a line it cannot read: refs/heads/x ${A} refs/heads/x`,
    );
  });

  it('refuses a line whose local name is not a commit name, naming it', () => {
    expect(() => readUpdates(line('a1b2', B))).toThrow(
      `git sent the pre-push hook a line it cannot read: ${line('a1b2', B)}`,
    );
  });

  it('refuses a line whose remote name is not a commit name, naming it', () => {
    expect(() => readUpdates(line(A, 'HEAD'))).toThrow(
      `git sent the pre-push hook a line it cannot read: ${line(A, 'HEAD')}`,
    );
  });
});

/** A rev-list stand-in that records every call and answers from a table. */
function revLists(answers: Record<string, readonly string[]>) {
  const calls: string[] = [];
  const revList = (args: readonly string[]) => {
    const key = args.join(' ');
    calls.push(key);
    const answer = answers[key];
    if (answer === undefined) throw new Error(`no answer for: ${key}`);
    return answer;
  };
  return { calls, revList };
}

describe('commitsToCheck lists the commits no remote has, oldest first (#752 AC1, AC3)', () => {
  it('lists an existing branch’s new commits past what the remote had', () => {
    const git = revLists({
      [`--reverse --topo-order ${A} --not --remotes ${B}`]: [C, A],
    });
    expect(commitsToCheck([update(A, B)], git.revList)).toEqual([C, A]);
    expect(git.calls).toEqual([
      `--reverse --topo-order ${A} --not --remotes ${B}`,
    ]);
  });

  it('lists a new branch’s commits past every remote branch', () => {
    const git = revLists({
      [`--reverse --topo-order ${A} --not --remotes`]: [B, A],
    });
    expect(commitsToCheck([update(A, ZERO)], git.revList)).toEqual([B, A]);
    expect(git.calls).toEqual([`--reverse --topo-order ${A} --not --remotes`]);
  });

  it('checks nothing for a deletion, asking git nothing, beside an update it does check', () => {
    const git = revLists({
      [`--reverse --topo-order ${A} --not --remotes ${C}`]: [A],
    });
    expect(
      commitsToCheck([update(ZERO, B), update(A, C)], git.revList),
    ).toEqual([A]);
    expect(git.calls).toEqual([
      `--reverse --topo-order ${A} --not --remotes ${C}`,
    ]);
  });

  it('checks nothing when the remote already has every commit, beside an update it does check', () => {
    const git = revLists({
      [`--reverse --topo-order ${A} --not --remotes ${A}`]: [],
      [`--reverse --topo-order ${C} --not --remotes`]: [B, C],
    });
    expect(
      commitsToCheck([update(A, A), update(C, ZERO)], git.revList),
    ).toEqual([B, C]);
    expect(git.calls).toEqual([
      `--reverse --topo-order ${A} --not --remotes ${A}`,
      `--reverse --topo-order ${C} --not --remotes`,
    ]);
  });

  it('lists a commit two updates share once, where it first appears', () => {
    const git = revLists({
      [`--reverse --topo-order ${A} --not --remotes`]: [B, A],
      [`--reverse --topo-order ${C} --not --remotes`]: [B, C],
    });
    expect(
      commitsToCheck([update(A, ZERO), update(C, ZERO)], git.revList),
    ).toEqual([B, A, C]);
  });

  it('passes on git’s refusal, never reading it as no commits', () => {
    const git = revLists({});
    expect(() => commitsToCheck([update(A, B)], git.revList)).toThrow(
      'no answer for:',
    );
  });
});

/**
 * Effects stood in: an in-memory tree of directories and links, and a log of
 * every git, npm and filesystem call in order.
 */
function fakeEffects(
  options: {
    readonly dirs?: Record<string, readonly string[]>;
    readonly links?: Record<string, string>;
    readonly failing?: Record<string, number>;
    readonly throwing?: string;
  } = {},
) {
  const log: string[] = [];
  const dirs = new Map(Object.entries(options.dirs ?? {}));
  const links = new Map(Object.entries(options.links ?? {}));
  const made: string[] = [];
  let temps = 0;
  const effects: Effects = {
    git: (args, cwd) => {
      log.push(`git ${args.join(' ')} @${cwd}`);
      return '';
    },
    npm: (script, cwd, ifPresent) => {
      log.push(`npm ${script}${ifPresent ? ' if-present' : ''} @${cwd}`);
      if (script === options.throwing)
        throw new Error(`${script} could not start`);
      return options.failing?.[`${script} @${cwd}`] ?? 0;
    },
    makeTempDir: () => {
      temps += 1;
      const path = `/tmp/check-${String(temps)}`;
      log.push(`mkdtemp ${path}`);
      return path;
    },
    removeDir: (path) => log.push(`rm ${path}`),
    list: (path) => dirs.get(path),
    readLink: (path) => {
      const target = links.get(path);
      if (target === undefined) throw new Error(`not a link: ${path}`);
      return target;
    },
    exists: (path) => dirs.has(path),
    makeDir: (path) => made.push(`dir ${path}`),
    link: (target, path) => made.push(`link ${path} -> ${target}`),
    say: (text) => log.push(`say ${text}`),
  };
  return { effects, log, made };
}

const CHECKOUT = {
  dirs: {
    '/repo/node_modules': ['.bin', '@yawelo-idle', 'vitest'],
    '/repo/node_modules/@yawelo-idle': ['core', 'web'],
    '/repo/apps/web/node_modules': ['vite'],
    '/w/apps/web': ['package.json'],
  },
  links: {
    '/repo/node_modules/@yawelo-idle/core': '../../packages/core',
    '/repo/node_modules/@yawelo-idle/web': '../../apps/web',
  },
};

describe('mirrorNodeModules lends the checkout’s packages but keeps ours the commit’s (#752 AC2)', () => {
  it('links every outside package to the checkout’s copy and rebuilds our links inside the worktree', () => {
    const fake = fakeEffects(CHECKOUT);
    mirrorNodeModules('/repo', '/w', fake.effects);
    expect(fake.made).toEqual([
      'dir /w/node_modules',
      'link /w/node_modules/.bin -> /repo/node_modules/.bin',
      'dir /w/node_modules/@yawelo-idle',
      'link /w/node_modules/@yawelo-idle/core -> ../../packages/core',
      'link /w/node_modules/@yawelo-idle/web -> ../../apps/web',
      'link /w/node_modules/vitest -> /repo/node_modules/vitest',
      'link /w/apps/web/node_modules -> /repo/apps/web/node_modules',
    ]);
  });

  it('lends no workspace packages to a workspace the commit does not have', () => {
    const dirs = Object.fromEntries(
      Object.entries(CHECKOUT.dirs).filter(([path]) => path !== '/w/apps/web'),
    );
    const fake = fakeEffects({ ...CHECKOUT, dirs });
    mirrorNodeModules('/repo', '/w', fake.effects);
    expect(fake.made).toEqual([
      'dir /w/node_modules',
      'link /w/node_modules/.bin -> /repo/node_modules/.bin',
      'dir /w/node_modules/@yawelo-idle',
      'link /w/node_modules/@yawelo-idle/core -> ../../packages/core',
      'link /w/node_modules/@yawelo-idle/web -> ../../apps/web',
      'link /w/node_modules/vitest -> /repo/node_modules/vitest',
    ]);
  });

  it('refuses a checkout with no node_modules, naming the fix', () => {
    const fake = fakeEffects();
    expect(() => {
      mirrorNodeModules('/repo', '/w', fake.effects);
    }).toThrow('/repo/node_modules is missing: run npm install first');
  });
});

const ROOT_ONLY = {
  dirs: { '/repo/node_modules': ['vitest'] },
};

const stepsFor = (dir: string) => [
  `npm postinstall if-present @${dir}`,
  ...GATES.map((gate) => `npm ${gate} @${dir}`),
];

describe('checkCommits checks each commit in its own temporary worktree (#752 AC2)', () => {
  it('passes a clean pair, each checked in turn and its worktree removed', () => {
    const fake = fakeEffects(ROOT_ONLY);
    expect(checkCommits([A, B], '/repo', fake.effects)).toBeUndefined();
    expect(fake.log).toEqual([
      'say pre-push: checking aaaaaaa (1 of 2) in a temporary worktree',
      'mkdtemp /tmp/check-1',
      `git worktree add --quiet --detach /tmp/check-1 ${A} @/repo`,
      ...stepsFor('/tmp/check-1'),
      'git worktree remove --force /tmp/check-1 @/repo',
      'rm /tmp/check-1',
      'say pre-push: checking bbbbbbb (2 of 2) in a temporary worktree',
      'mkdtemp /tmp/check-2',
      `git worktree add --quiet --detach /tmp/check-2 ${B} @/repo`,
      ...stepsFor('/tmp/check-2'),
      'git worktree remove --force /tmp/check-2 @/repo',
      'rm /tmp/check-2',
    ]);
  });

  it('refuses at the first failing check, naming it and the commit, and checks nothing after', () => {
    const fake = fakeEffects({
      ...ROOT_ONLY,
      failing: { 'lint @/tmp/check-1': 1 },
    });
    expect(checkCommits([A, B], '/repo', fake.effects)).toEqual({
      check: 'lint',
      commit: 'aaaaaaa',
    });
    expect(fake.log).toEqual([
      'say pre-push: checking aaaaaaa (1 of 2) in a temporary worktree',
      'mkdtemp /tmp/check-1',
      `git worktree add --quiet --detach /tmp/check-1 ${A} @/repo`,
      'npm postinstall if-present @/tmp/check-1',
      'npm format:check @/tmp/check-1',
      'npm lint @/tmp/check-1',
      'git worktree remove --force /tmp/check-1 @/repo',
      'rm /tmp/check-1',
    ]);
  });

  it('refuses a commit whose generated types fail, naming postinstall', () => {
    const fake = fakeEffects({
      ...ROOT_ONLY,
      failing: { 'postinstall @/tmp/check-2': 2 },
    });
    expect(checkCommits([A, B], '/repo', fake.effects)).toEqual({
      check: 'postinstall',
      commit: 'bbbbbbb',
    });
  });

  it('removes the worktree when a check cannot start, and passes the error on', () => {
    const fake = fakeEffects({ ...ROOT_ONLY, throwing: 'typecheck' });
    expect(() => checkCommits([A], '/repo', fake.effects)).toThrow(
      'typecheck could not start',
    );
    expect(fake.log.slice(-2)).toEqual([
      'git worktree remove --force /tmp/check-1 @/repo',
      'rm /tmp/check-1',
    ]);
  });

  it('removes the temporary directory, and asks git to remove no worktree, when the worktree cannot be made', () => {
    const fake = fakeEffects(ROOT_ONLY);
    const effects: Effects = {
      ...fake.effects,
      git: (args, cwd) => {
        fake.log.push(`git ${args.join(' ')} @${cwd}`);
        throw new Error('worktree add failed');
      },
    };
    expect(() => checkCommits([A], '/repo', effects)).toThrow(
      'worktree add failed',
    );
    expect(fake.log.slice(-2)).toEqual([
      `git worktree add --quiet --detach /tmp/check-1 ${A} @/repo`,
      'rm /tmp/check-1',
    ]);
  });

  it('checks nothing, and makes nothing, for no commits', () => {
    const logOf = (commits: readonly string[]) => {
      const fake = fakeEffects(ROOT_ONLY);
      expect(checkCommits(commits, '/repo', fake.effects)).toBeUndefined();
      return fake.log;
    };
    expect(againstControl(logOf, { input: [], control: [A] })).toEqual([]);
  });
});

describe('refusalMessage names the check and the commit (#752 AC2)', () => {
  it('says which check failed on which commit, and that nothing was pushed', () => {
    expect(refusalMessage({ check: 'lint', commit: 'aaaaaaa' })).toBe(
      '✗ pre-push: lint failed on commit aaaaaaa, so nothing was pushed. Fix that commit (an uncommitted fix does not count), then push again.',
    );
  });
});
