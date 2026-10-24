import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * The comparison CLI as the coverage-same-tests job runs it (#762 AC3):
 * `node scripts/coverage-same-tests.ts <scope>`, a process, so it is tested
 * here; the pure half is in tests/unit/coverage-same-tests.test.ts. Each case
 * plants both jobs' reports in a directory of its own and runs from there,
 * with the repository's real coverage configs.
 */
const CLI = resolve('scripts/coverage-same-tests.ts');
// The pacing coverage config's one left-out file (BUDGET_TESTS).
const PERF = 'packages/bots/pacing/pemandu-perf.test.ts';

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** A Vitest JSON report of `files`, each with its tests' titles, under `root`. */
const report = (
  root: string,
  files: Record<string, readonly string[]>,
): string =>
  JSON.stringify({
    testResults: Object.entries(files).map(([file, titles]) => ({
      name: join(root, file),
      status: 'passed',
      assertionResults: titles.map((title) => ({
        ancestorTitles: [],
        title,
        status: 'passed',
      })),
    })),
  });

/** Runs the CLI in a new directory holding the reports `plant` writes. */
function run(
  scope: string,
  plant: (root: string, write: (path: string, text: string) => void) => void,
) {
  // The real path: a report's names are read against the CLI's cwd.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'same-tests-')));
  dirs.push(root);
  plant(root, (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  });
  return spawnSync(process.execPath, [CLI, scope], {
    cwd: root,
    encoding: 'utf8',
  });
}

describe('the coverage-same-tests CLI (#762 AC3)', () => {
  it('refuses a scope it does not know, naming it', () => {
    const result = run('partial', () => undefined);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'name the change\'s scope, full or docs-only, not "partial"',
    );
  });

  it('passes docs-only reports that agree, printing what it compared', () => {
    const result = run('docs-only', (root, write) => {
      for (const suite of ['unit', 'guards']) {
        const text = report(root, { [`tests/${suite}/a.test.ts`]: ['a', 'b'] });
        write(`test-reports/${suite}.json`, text);
        write(`coverage/tests/${suite}.json`, text);
      }
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      'coverage-same-tests: the unit suite: 1 files, 2 tests, the same in its step and under coverage\n' +
        'coverage-same-tests: the guards suite: 1 files, 2 tests, the same in its step and under coverage\n',
    );
  });

  it('passes the pacing time-budget test the coverage config leaves out, and refuses a lost test elsewhere', () => {
    const result = run('full', (root, write) => {
      for (const suite of ['unit', 'guards', 'integration', 'properties']) {
        const text = report(root, { [`tests/${suite}/a.test.ts`]: ['a'] });
        write(`test-reports/${suite}.json`, text);
        write(
          `coverage/tests/${suite}.json`,
          suite === 'integration'
            ? report(root, { 'tests/integration/a.test.ts': [] })
            : text,
        );
      }
      write(
        'test-reports/pacing.json',
        report(root, {
          'packages/bots/pacing/a.test.ts': ['a'],
          [PERF]: ['p'],
        }),
      );
      write(
        'coverage/tests/pacing.json',
        report(root, { 'packages/bots/pacing/a.test.ts': ['a'] }),
      );
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(
      'coverage-same-tests: the integration suite:\n' +
        '  tests/integration/a.test.ts: 1 test in the integration step, 0 under coverage; only in the step: passed "a"\n',
    );
    expect(result.stdout).toContain(
      'coverage-same-tests: the pacing suite: 1 files, 1 tests, the same in its step and under coverage\n',
    );
  });

  it('refuses a report nothing wrote, naming its path', () => {
    const result = run('docs-only', (root, write) => {
      const text = report(root, { 'tests/unit/a.test.ts': ['a'] });
      write('test-reports/unit.json', text);
      write('coverage/tests/unit.json', text);
      write('coverage/tests/guards.json', text);
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(
      'coverage-same-tests: the guards suite:\n  test-reports/guards.json is missing\n',
    );
  });
});
