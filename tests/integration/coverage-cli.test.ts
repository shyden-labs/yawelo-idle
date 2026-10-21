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

describe('the coverage CLI (#728)', () => {
  it('names its commands when given none', () => {
    const { dir } = repository();
    const run = cli(dir, []);
    expect([run.status, run.stderr.trim()]).toEqual([
      1,
      'coverage: name a command: measure or record',
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
