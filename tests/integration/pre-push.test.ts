import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GATES } from '../../scripts/pre-push';

/**
 * The pre-push hook (#123 AC2, #752 AC4): it checks each commit the push
 * sends, in a temporary worktree, never the working tree. The hook is RUN by
 * a real `git push` from a scratch repository to a bare scratch remote. The
 * scratch repository carries this checkout's hook and script, and npm
 * scripts standing in for the gates: `lint` refuses a `LINT-ERROR` in
 * `src.txt`, and `typecheck` loads the workspace package
 * `@yawelo-idle/pkg` through `node_modules` and refuses it broken, so a
 * worktree whose packages resolved to the working tree would pass a broken
 * commit, and this test would see it.
 */

const HOOK = '.githooks/pre-push';
const SCRIPT = 'scripts/pre-push.ts';
const IDENTITY = ['-c', 'user.name=t', '-c', 'user.email=t@example.com'];

const PACKAGE = {
  name: 'scratch',
  private: true,
  scripts: {
    'format:check': 'node -e ""',
    lint: 'node lint.mjs',
    typecheck: 'node typecheck.cjs',
  },
};
const LINT = `import { readFileSync } from 'node:fs';
if (readFileSync('src.txt', 'utf8').includes('LINT-ERROR')) process.exit(3);
`;
const TYPECHECK = `if (require('@yawelo-idle/pkg') !== 'ok') process.exit(4);
`;

let dir = '';
let work = '';
let remote = '';
let temp = '';

function git(args: readonly string[]) {
  const run = spawnSync('git', [...IDENTITY, ...args], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: temp },
  });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

function must(args: readonly string[]): string {
  const run = git(args);
  if (run.status !== 0)
    throw new Error(`git ${args.join(' ')} failed: ${run.out}`);
  return run.out.trim();
}

function write(path: string, text: string): void {
  mkdirSync(dirname(join(work, path)), { recursive: true });
  writeFileSync(join(work, path), text);
}

function commit(message: string): string {
  must(['add', '-A']);
  must(['commit', '-q', '-m', message]);
  return must(['rev-parse', 'HEAD']);
}

const remoteHead = (branch: string) =>
  spawnSync('git', ['rev-parse', '--verify', '--quiet', branch], {
    cwd: remote,
    encoding: 'utf8',
  }).stdout.trim();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pre-push-it-'));
  work = join(dir, 'work');
  remote = join(dir, 'remote.git');
  temp = join(dir, 'tmp');
  mkdirSync(temp);
  mkdirSync(work);
  expect(spawnSync('git', ['init', '-q', '--bare', remote]).status).toBe(0);
  must(['init', '-q', '-b', 'main']);
  must(['config', 'core.hooksPath', '.githooks']);
  must(['remote', 'add', 'origin', remote]);
  write('package.json', `${JSON.stringify(PACKAGE, null, 2)}\n`);
  write('lint.mjs', LINT);
  write('typecheck.cjs', TYPECHECK);
  write('src.txt', 'clean\n');
  write('.gitignore', 'node_modules/\n');
  write(
    'packages/pkg/package.json',
    '{ "name": "@yawelo-idle/pkg", "main": "index.js" }\n',
  );
  write('packages/pkg/index.js', "module.exports = 'ok';\n");
  mkdirSync(join(work, '.githooks'));
  copyFileSync(HOOK, join(work, HOOK));
  chmodSync(join(work, HOOK), 0o755);
  mkdirSync(join(work, 'scripts'));
  copyFileSync(SCRIPT, join(work, SCRIPT));
  write('node_modules/left-pad/index.js', 'module.exports = 1;\n');
  mkdirSync(join(work, 'node_modules/@yawelo-idle'));
  symlinkSync(
    '../../packages/pkg',
    join(work, 'node_modules/@yawelo-idle/pkg'),
  );
  commit('base');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** What every push must leave: the checkout's packages, and one worktree (the unit suite proves the temporary directory's removal). */
function expectNothingLeft(): void {
  expect(
    readFileSync(join(work, 'node_modules/left-pad/index.js'), 'utf8'),
  ).toBe('module.exports = 1;\n');
  expect(existsSync(join(work, 'node_modules/@yawelo-idle/pkg/index.js'))).toBe(
    true,
  );
  expect(
    must(['worktree', 'list', '--porcelain']).match(/^worktree /gm),
  ).toHaveLength(1);
}

describe('the pre-push hook checks each pushed commit, not the working tree (#752 AC4)', () => {
  it('passes a clean first push of a new branch, and the remote has it', () => {
    const head = must(['rev-parse', 'HEAD']);
    const push = git(['push', '-q', 'origin', 'main']);
    expect(push.out).toContain('pre-push: checking');
    expect(push.status).toBe(0);
    expect(remoteHead('main')).toBe(head);
    expectNothingLeft();
  });

  it('refuses a committed error under an uncommitted fix, naming lint and the commit', () => {
    must(['push', '-q', 'origin', 'main']);
    const base = remoteHead('main');
    write('src.txt', 'LINT-ERROR\n');
    const broken = commit('broken');
    write('src.txt', 'fixed but not committed\n');
    const push = git(['push', '-q', 'origin', 'main']);
    expect(push.out).toContain(
      `✗ pre-push: lint failed on commit ${broken.slice(0, 7)}, so nothing was pushed.`,
    );
    expect(push.status).not.toBe(0);
    expect(remoteHead('main')).toBe(base);
    expectNothingLeft();
  });

  it('refuses an error in the first of two commits, the second fixing it, naming typecheck and the first', () => {
    must(['push', '-q', 'origin', 'main']);
    const base = remoteHead('main');
    write('packages/pkg/index.js', "module.exports = 'broken';\n");
    const broken = commit('break the package');
    write('packages/pkg/index.js', "module.exports = 'ok';\n");
    commit('fix the package');
    const push = git(['push', '-q', 'origin', 'main']);
    expect(push.out).toContain(
      `✗ pre-push: typecheck failed on commit ${broken.slice(0, 7)}, so nothing was pushed.`,
    );
    expect(push.status).not.toBe(0);
    expect(remoteHead('main')).toBe(base);
    expectNothingLeft();
  });

  it('passes a clean pair, checking both, and the remote has the second', () => {
    must(['push', '-q', 'origin', 'main']);
    write('src.txt', 'one\n');
    commit('one');
    write('src.txt', 'two\n');
    const second = commit('two');
    const push = git(['push', '-q', 'origin', 'main']);
    expect(push.out).toContain('(1 of 2)');
    expect(push.out).toContain('(2 of 2)');
    expect(push.status).toBe(0);
    expect(remoteHead('main')).toBe(second);
    expectNothingLeft();
  });

  it('passes a deletion-only push, checking nothing', () => {
    must(['push', '-q', 'origin', 'main']);
    must(['push', '-q', 'origin', 'main:gone']);
    const push = git(['push', '-q', 'origin', '--delete', 'gone']);
    expect(push.out).toContain('pre-push: no new commits to check');
    expect(push.status).toBe(0);
    expect(remoteHead('gone')).toBe('');
    expectNothingLeft();
  });
});

describe('the pre-push hook is installed (#123 AC2)', () => {
  it('is executable', () => {
    expect(statSync(HOOK).mode & 0o111).toBe(0o111);
  });

  it.each(GATES)('names a root script that exists: %s', (gate) => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts[gate]).toBeDefined();
  });

  it('is installed by npm install, through the root prepare script', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.prepare).toBe('git config core.hooksPath .githooks');
  });

  it('is installed in this checkout: git reads hooks from .githooks', () => {
    const read = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
      encoding: 'utf8',
    });
    expect(read.stdout.trim()).toBe('.githooks');
  });
});
