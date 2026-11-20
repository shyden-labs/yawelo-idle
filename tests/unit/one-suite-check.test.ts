import { describe, expect, it } from 'vitest';
import { checkSuite } from '../../scripts/one-suite-check';

/**
 * The shared one-suite check on one suite's run (#1003 AC2, AC4): what
 * Playwright listed for each desktop browser, what each ran, and each test's
 * assertion count, all read from one-suite/<suite>/.
 */

interface Spec {
  title: string;
  tags?: string[];
  annotations?: { type: string; description?: string }[];
  statuses: Record<string, 'expected' | 'skipped' | 'unexpected'>;
}

/** A Playwright JSON report of one spec file. */
function report(specs: Spec[]): string {
  return JSON.stringify({
    config: {},
    errors: [],
    stats: {},
    suites: [
      {
        title: 'a.spec.ts',
        file: 'a.spec.ts',
        specs: specs.map((s) => ({
          title: s.title,
          tags: s.tags ?? [],
          tests: Object.entries(s.statuses).map(([projectName, status]) => ({
            projectName,
            annotations: s.annotations ?? [],
            status,
            results: [],
          })),
        })),
      },
    ],
  });
}

const ALL = ['chromium', 'firefox', 'webkit', 'msedge'] as const;

function everywhere(
  status: 'expected' | 'skipped' | 'unexpected',
): Spec['statuses'] {
  return Object.fromEntries(ALL.map((b) => [b, status]));
}

function counts(n: number): string {
  return JSON.stringify(Object.fromEntries(ALL.map((b) => [b, { 'a.spec.ts › loads': n }])));
}

function files(list: Spec[], ran: Spec[], assertions = counts(2)) {
  const byName: Record<string, string> = {
    'one-suite/web/list.json': report(list),
    'one-suite/web/report.json': report(ran),
    'one-suite/web/assertions.json': assertions,
  };
  return (file: string): string => {
    const body = byName[file];
    if (body === undefined) throw new Error(`ENOENT: ${file}`);
    return body;
  };
}

const LOADS: Spec = { title: 'loads', statuses: everywhere('expected') };

describe('checkSuite (#1003)', () => {
  it('passes a suite every browser ran in full, printing each total', () => {
    const out = checkSuite('one-suite/web', files([LOADS], [LOADS]));
    expect(out.problems).toEqual([]);
    expect(out.totals).toHaveLength(4);
    expect(out.totals.join('\n')).toMatch(/msedge/);
  });

  it('refuses a test one browser skipped (#1003 AC4)', () => {
    const ran = { title: 'loads', statuses: { ...everywhere('expected'), msedge: 'skipped' as const } };
    const out = checkSuite('one-suite/web', files([LOADS], [ran]));
    expect(out.problems.join('\n')).toMatch(/msedge skipped/);
  });

  it('refuses a test listed for some browsers only, untagged (#1003 AC5)', () => {
    const some: Spec = { title: 'loads', statuses: { chromium: 'expected' } };
    const out = checkSuite('one-suite/web', files([some], [some]));
    expect(out.problems).not.toEqual([]);
  });

  it('refuses unequal assertion counts between browsers', () => {
    const uneven = JSON.stringify({
      ...JSON.parse(counts(2)),
      webkit: { 'a.spec.ts › loads': 1 },
    });
    const out = checkSuite('one-suite/web', files([LOADS], [LOADS], uneven));
    expect(out.problems).not.toEqual([]);
  });

  it('names a file the run did not write', () => {
    const read = (file: string): string => {
      throw new Error(`ENOENT: ${file}`);
    };
    expect(() => checkSuite('one-suite/web', read)).toThrow(
      /one-suite\/web\/list\.json/,
    );
  });
});
