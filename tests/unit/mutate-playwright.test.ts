import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPlaywrightReport, type Report } from '../../scripts/mutate.ts';
import { floorBreach } from '../floors.ts';
import { searched } from '../searched.ts';

/**
 * The runner reads a Playwright run (#649, spec §5) into the same report it
 * reads from its vitest reporter. The reports here were recorded in CI by
 * Playwright 1.63.0 (run 39053867584), from the repository at
 * `/__w/yawelo-idle/yawelo-idle`, before the reader was written: each suite
 * clean and with a failed expectation, and the engines suite with every
 * test given 1 ms and with a spec that does not parse.
 */

const CWD = '/__w/yawelo-idle/yawelo-idle';
const ENGINES = 'playwright.engines.config.ts';
const WEB = 'playwright.web.config.ts';
const ESC = String.fromCharCode(27);
const PROJECTS = ['chromium', 'firefox', 'webkit'];

const recorded = (name: string): unknown =>
  JSON.parse(
    readFileSync(`tests/unit/fixtures/mutate/playwright-${name}.json`, 'utf8'),
  ) as unknown;

const read = (name: string, config: string): Report =>
  readPlaywrightReport(recorded(name), CWD, config);

const CSP =
  'the shell runs under its Content Security Policy with no violation';

describe('readPlaywrightReport, on recorded runs', () => {
  it('reads a clean engines run: every test once per project, no failure', () => {
    expect(read('engines-clean', ENGINES)).toEqual<Report>({
      total: 27,
      files: [
        'tests/engines/golden-log.spec.ts',
        'tests/engines/golden-vectors.spec.ts',
      ],
      failing: [],
      timedOut: [],
    });
  });

  it('reads a clean web smoke run', () => {
    expect(read('web-clean', WEB)).toEqual<Report>({
      total: 12,
      files: ['tests/web/shell.spec.ts'],
      failing: [],
      timedOut: [],
    });
  });

  it('names a failed test once per project, with its file and project', () => {
    expect(read('web-failed', WEB).failing.map((f) => f.name)).toEqual(
      PROJECTS.map((p) => `tests/web/shell.spec.ts › ${p} > ${CSP}`),
    );
  });

  it('keeps the total of a run with failures', () => {
    expect(read('web-failed', WEB).total).toBe(12);
  });

  it('keeps a failure’s expectation and its source line', () => {
    const [first] = read('web-failed', WEB).failing;
    expect(first?.text).toContain('not.toContain');
    expect(first?.text).toContain('content-security-policy');
  });

  it('removes the colour codes Playwright writes even with FORCE_COLOR=0', () => {
    const { failing } = read('web-failed', WEB);
    expect(
      searched(
        failing.filter((f) => f.text.includes(ESC)),
        { of: failing, what: 'web smoke failures' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('mutate-playwright/web-failures', failing.length),
    ).toBeUndefined();
    expect(
      JSON.stringify(recorded('web-failed')).includes('\\u001b['),
      'the recorded run holds colour codes',
    ).toBe(true);
  });

  it('removes forced colour codes from every failure', () => {
    const { failing } = read('engines-failed-colour', ENGINES);
    expect(failing).toHaveLength(24);
    expect(
      searched(
        failing.filter((f) => f.text.includes(ESC)),
        { of: failing, what: 'engines failures, colour forced' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('mutate-playwright/forced-colour-failures', failing.length),
    ).toBeUndefined();
  });

  it('names a test that timed out, and counts it failing', () => {
    const report = read('engines-timed-out', ENGINES);
    const timedOut = [
      'tests/engines/golden-log.spec.ts › %s > the golden log replays to its recorded hash',
      'tests/engines/golden-vectors.spec.ts › %s > pow gives the same bits as Node on 100,000 vectors',
    ].flatMap((name) => PROJECTS.map((p) => name.replace('%s', p)));
    expect([...report.timedOut].sort()).toEqual([...timedOut].sort());
    expect(report.failing.map((f) => f.name).sort()).toEqual(
      [...timedOut].sort(),
    );
  });

  it('counts skipped tests in the total, never as failing', () => {
    expect(read('engines-timed-out', ENGINES).total).toBe(27);
  });

  it('names a spec that does not parse as its file, failing', () => {
    const report = read('engines-load-error', ENGINES);
    expect(report.failing.map((f) => f.name)).toEqual([
      'tests/engines/golden-log.spec.ts › (the file)',
    ]);
    expect(report.failing[0]?.text).toContain('SyntaxError');
    expect(report.total).toBe(0);
  });
});

/** The smallest report Playwright writes for one test, in `cwd`'s `tests`. */
function oneTest(test: Record<string, unknown>, titles: string[] = []) {
  const spec = { title: 'reads', file: 'a.spec.ts', tests: [test] };
  // Each describe title wraps the next level; the spec sits in the last.
  const nest = (rest: string[]): Record<string, unknown> =>
    rest.length === 0
      ? { specs: [spec], suites: [] }
      : { specs: [], suites: [{ title: rest[0], ...nest(rest.slice(1)) }] };
  return {
    config: { rootDir: '/repo/tests' },
    suites: [{ title: 'a.spec.ts', file: 'a.spec.ts', ...nest(titles) }],
    errors: [],
  };
}

const FAILED = {
  projectName: 'webkit',
  status: 'unexpected',
  results: [{ status: 'failed', errors: [{ message: 'expected 1 to be 2' }] }],
};

describe('readPlaywrightReport, on the shapes it reads', () => {
  it('names every describe between the project and the title', () => {
    expect(
      readPlaywrightReport(oneTest(FAILED, ['outer', 'inner']), '/repo', WEB)
        .failing,
    ).toEqual([
      {
        name: 'tests/a.spec.ts › webkit > outer > inner > reads',
        text: 'expected 1 to be 2',
      },
    ]);
  });

  it('counts a flaky test failing: the runner allows no retry', () => {
    expect(
      readPlaywrightReport(
        oneTest({ ...FAILED, status: 'flaky' }),
        '/repo',
        WEB,
      ).failing.map((f) => f.name),
    ).toEqual(['tests/a.spec.ts › webkit > reads']);
  });

  it('names an error outside any file as the run', () => {
    expect(
      readPlaywrightReport(
        {
          ...oneTest({ ...FAILED, status: 'expected', results: [] }),
          errors: [
            { message: 'Timed out waiting 60000ms from config.webServer.' },
          ],
        },
        '/repo',
        WEB,
      ).failing,
    ).toEqual([
      {
        name: `${WEB} › (the run)`,
        text: 'Timed out waiting 60000ms from config.webServer.',
      },
    ]);
  });

  it('refuses a report that is not an object', () => {
    expect(() => readPlaywrightReport([], '/repo', WEB)).toThrow(
      'the Playwright report is not an object',
    );
  });

  it('refuses a test whose status it does not know', () => {
    expect(() =>
      readPlaywrightReport(
        oneTest({ ...FAILED, status: 'unknown' }),
        '/repo',
        WEB,
      ),
    ).toThrow(
      'the Playwright report gives tests/a.spec.ts › webkit > reads the status unknown',
    );
  });

  it('refuses a test with no project', () => {
    expect(() =>
      readPlaywrightReport(
        oneTest({ status: 'expected', results: [] }),
        '/repo',
        WEB,
      ),
    ).toThrow(
      'the Playwright report has a test with no project in tests/a.spec.ts',
    );
  });
});
