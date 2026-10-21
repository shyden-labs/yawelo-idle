import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * The coverage CLI as CI runs it (#728): `node scripts/coverage.ts`, a
 * process, so its refusals are tested here; a unit test starts none. The
 * pure half is in tests/unit/coverage-cli.test.ts. Each case runs in its
 * own temporary repository, so `record` judges a real HEAD.
 */
const CLI = resolve('scripts/coverage.ts');

/** The run's environment without CI, the record switch or git's own. */
const bare = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined &&
        entry[0] !== 'CI' &&
        entry[0] !== 'FLOORS_RECORD_JOB' &&
        !entry[0].startsWith('GIT_'),
    ),
  );

const GIT = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A repository with one commit; returns its directory and HEAD. */
function repository(): { dir: string; head: string } {
  const dir = mkdtempSync(join(tmpdir(), 'coverage-cli-'));
  made.push(dir);
  const git = (...args: string[]): string =>
    execFileSync('git', args, {
      cwd: dir,
      env: { ...bare(), ...GIT },
      encoding: 'utf8',
    }).trim();
  git('init', '--quiet');
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  git('add', 'a.txt');
  git('commit', '--quiet', '-m', 'c');
  return { dir, head: git('rev-parse', 'HEAD') };
}

const cli = (
  dir: string,
  args: readonly string[],
  env: Record<string, string> = {},
) =>
  spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    env: { ...bare(), ...GIT, ...env },
    encoding: 'utf8',
  });

const INSIDE = { CI: 'true', FLOORS_RECORD_JOB: 'record-floors' };

/**
 * A repository whose `origin/develop` is its first commit, so the check
 * reads a real merge base, rename and added record from git.
 */
function history() {
  const { dir } = repository();
  const git = (...args: string[]): string =>
    execFileSync('git', args, {
      cwd: dir,
      env: { ...bare(), ...GIT },
      encoding: 'utf8',
    }).trim();
  git('update-ref', 'refs/remotes/origin/develop', 'HEAD');
  const commit = (files: Record<string, string>): string => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    git('add', '--all');
    git('commit', '--quiet', '-m', 'c');
    return git('rev-parse', 'HEAD');
  };
  return { dir, git, commit };
}

const RECORD = 'tests/coverage/record.json';
const recordOf = (untested: number): string =>
  `${JSON.stringify({
    files: {
      'a.ts': {
        measure: 'v8',
        statements: { untested, total: 9 },
        branches: { untested: 0, total: 0 },
      },
    },
  })}\n`;

/** The measured table and its report of HEAD, as measure writes them. */
const measured = (dir: string, head: string, untested: number): void => {
  mkdirSync(join(dir, 'coverage'), { recursive: true });
  writeFileSync(join(dir, 'coverage', 'table.json'), recordOf(untested));
  writeFileSync(
    join(dir, 'coverage', 'meta.json'),
    JSON.stringify({ commit: head }),
  );
};

describe('the coverage CLI (#728)', () => {
  it('names its commands when given none', () => {
    const { dir } = repository();
    const run = cli(dir, []);
    expect([run.status, run.stderr.trim()]).toEqual([
      1,
      'coverage: name a command: measure, record, check or docs-only',
    ]);
  });

  it('refuses to record outside the record-floors workflow', () => {
    const { dir } = repository();
    const run = cli(dir, ['record']);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      'coverage: coverage is recorded in CI only, by the record-floors workflow',
    );
  });

  it('refuses to record when no report was measured', () => {
    const { dir } = repository();
    const run = cli(dir, ['record'], INSIDE);
    expect([run.status, run.stderr.trim()]).toEqual([
      1,
      'coverage: no coverage report (coverage/meta.json): run npm run test:coverage first',
    ]);
  });

  it('refuses to record a report measured on another commit', () => {
    const { dir, head } = repository();
    mkdirSync(join(dir, 'coverage'));
    const other = 'b'.repeat(40);
    writeFileSync(
      join(dir, 'coverage', 'meta.json'),
      JSON.stringify({ commit: other }),
    );
    const run = cli(dir, ['record'], INSIDE);
    expect([run.status, run.stderr.trim()]).toEqual([
      1,
      `coverage: the coverage report measured ${other}, not ${head}: run npm run test:coverage again`,
    ]);
  });

  it('records the measured table, byte for byte, when the report is of HEAD', () => {
    const { dir, head } = repository();
    mkdirSync(join(dir, 'coverage'));
    const table = '{\n  "files": {},\n  "totals": {}\n}\n';
    writeFileSync(join(dir, 'coverage', 'table.json'), table);
    writeFileSync(
      join(dir, 'coverage', 'meta.json'),
      JSON.stringify({ commit: head }),
    );
    const run = cli(dir, ['record'], INSIDE);
    expect(run.status).toBe(0);
    const record = join(dir, 'tests', 'coverage', 'record.json');
    expect(existsSync(record)).toBe(true);
    expect(readFileSync(record, 'utf8')).toBe(table);
  });
});

describe('the coverage check as the job runs it (#728)', () => {
  it('passes the pull request that adds the record, its table equal to it', () => {
    const { dir, commit } = history();
    const head = commit({ [RECORD]: recordOf(2) });
    measured(dir, head, 2);
    const run = cli(dir, ['check']);
    expect([run.status, run.stdout.trim()]).toEqual([
      0,
      expect.stringContaining('coverage: all 1 files match the record'),
    ]);
  });

  it('refuses a table that differs from the record, naming the file', () => {
    const { dir, commit } = history();
    const head = commit({ [RECORD]: recordOf(2) });
    measured(dir, head, 1);
    const run = cli(dir, ['check']);
    expect([run.status, run.stderr]).toEqual([
      1,
      expect.stringContaining(
        'a.ts: measured 1/9 statements and 0/0 branch arms untested, recorded 2/9 and 0/0',
      ),
    ]);
  });

  it('refuses a record that grew against the one at the merge base', () => {
    const { dir, git, commit } = history();
    commit({ [RECORD]: recordOf(1) });
    git('update-ref', 'refs/remotes/origin/develop', 'HEAD');
    const head = commit({ [RECORD]: recordOf(2) });
    measured(dir, head, 2);
    const run = cli(dir, ['check']);
    expect([run.status, run.stderr]).toEqual([
      1,
      expect.stringContaining('a.ts: untested statements rose from 1 to 2'),
    ]);
  });

  it('refuses a record renamed in from elsewhere: not added, and none at the base', () => {
    const { dir, git, commit } = history();
    commit({ 'tests/coverage/other.json': recordOf(2) });
    git('update-ref', 'refs/remotes/origin/develop', 'HEAD');
    mkdirSync(join(dir, 'tests', 'coverage'), { recursive: true });
    git('mv', 'tests/coverage/other.json', RECORD);
    git('commit', '--quiet', '-m', 'renamed');
    const head = git('rev-parse', 'HEAD');
    measured(dir, head, 2);
    const run = cli(dir, ['check']);
    expect([run.status, run.stderr]).toEqual([
      1,
      expect.stringContaining(
        'no coverage record at the merge base, and this pull request does not add one',
      ),
    ]);
  });

  it('refuses when no record is committed', () => {
    const { dir, head } = repository();
    execFileSync('git', ['update-ref', 'refs/remotes/origin/develop', 'HEAD'], {
      cwd: dir,
      env: { ...bare(), ...GIT },
    });
    measured(dir, head, 2);
    const run = cli(dir, ['check']);
    expect([run.status, run.stderr.trim()]).toEqual([
      1,
      `coverage: no ${RECORD}: dispatch record-floors on this commit and run npm run floors:fetch`,
    ]);
  });
});

describe('the documents-only proof as the job runs it (#728)', () => {
  it('passes a commit that changed only documents the record does not hold', () => {
    const { dir, commit } = history();
    commit({ [RECORD]: recordOf(0) });
    commit({ 'docs/x.md': 'x\n', 'HANDOVER.md': 'h\n' });
    const run = cli(dir, ['docs-only']);
    expect([run.status, run.stdout.trim()]).toEqual([
      0,
      'coverage: 2 changed file(s), all documents, none in the record: nothing measured changed',
    ]);
  });

  it('refuses a commit that changed code too', () => {
    const { dir, commit } = history();
    commit({ [RECORD]: recordOf(0) });
    commit({ 'docs/x.md': 'x\n', 'a.ts': 'export {};\n' });
    const run = cli(dir, ['docs-only']);
    expect([run.status, run.stderr]).toEqual([
      1,
      expect.stringContaining(
        'a.ts is not a document: the full coverage run judges it',
      ),
    ]);
  });
});
