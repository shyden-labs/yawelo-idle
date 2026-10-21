import { describe, expect, it } from 'vitest';
import type { CoverageMapData, FileCoverageData } from 'istanbul-lib-coverage';
import {
  buildTable,
  formatTable,
  joinMaps,
  rises,
  untested,
} from '../../scripts/coverage-table.ts';
import type { Entry } from '../../scripts/coverage-table.ts';

const ROOT = '/repo';

/** One file's istanbul data: statements hit `s` times, branches hit `b`. */
const file = (
  path: string,
  s: readonly number[],
  b: readonly (readonly number[])[] = [],
): FileCoverageData => ({
  path: `${ROOT}/${path}`,
  statementMap: Object.fromEntries(
    s.map((_, i) => [
      String(i),
      { start: { line: i + 1, column: 0 }, end: { line: i + 1, column: 1 } },
    ]),
  ),
  fnMap: {},
  branchMap: Object.fromEntries(
    b.map((arms, i) => [
      String(i),
      {
        loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
        type: 'if',
        locations: arms.map(() => ({
          start: { line: 1, column: 0 },
          end: { line: 1, column: 1 },
        })),
        line: 1,
      },
    ]),
  ),
  s: Object.fromEntries(s.map((hits, i) => [String(i), hits])),
  f: {},
  b: Object.fromEntries(b.map((arms, i) => [String(i), [...arms]])),
});

const map = (...files: FileCoverageData[]): CoverageMapData =>
  Object.fromEntries(files.map((data) => [data.path, data]));

describe("a file's untested code (#728)", () => {
  it('counts statements no test ran, of all its statements', () => {
    expect(untested(file('a.ts', [0, 2, 0, 1])).statements).toEqual({
      untested: 2,
      total: 4,
    });
  });

  it('counts branch arms no test ran, arm by arm, of all its arms', () => {
    expect(
      untested(
        file(
          'a.ts',
          [1],
          [
            [0, 3],
            [0, 0, 1],
          ],
        ),
      ).branches,
    ).toEqual({
      untested: 3,
      total: 5,
    });
  });

  it('a file with no statements has nothing untested, beside one that has', () => {
    expect([untested(file('a.d.ts', [])), untested(file('a.ts', [0]))]).toEqual(
      [
        {
          statements: { untested: 0, total: 0 },
          branches: { untested: 0, total: 0 },
        },
        {
          statements: { untested: 1, total: 1 },
          branches: { untested: 0, total: 0 },
        },
      ],
    );
  });
});

describe('suites are joined into one map (#728)', () => {
  it('a statement one suite ran counts as run in the join', () => {
    const joined = joinMaps([
      map(file('a.ts', [0, 1])),
      map(file('a.ts', [2, 0])),
    ]);
    expect(untested(joined[`${ROOT}/a.ts`] as FileCoverageData)).toEqual({
      statements: { untested: 0, total: 2 },
      branches: { untested: 0, total: 0 },
    });
  });

  it('a branch arm one suite took counts as taken in the join', () => {
    const joined = joinMaps([
      map(file('a.ts', [1], [[0, 1]])),
      map(file('a.ts', [1], [[1, 0]])),
    ]);
    expect(
      untested(joined[`${ROOT}/a.ts`] as FileCoverageData).branches,
    ).toEqual({ untested: 0, total: 2 });
  });

  it('keeps every file any suite reported', () => {
    const joined = joinMaps([map(file('a.ts', [1])), map(file('b.ts', [0]))]);
    expect(Object.keys(joined).sort()).toEqual([
      `${ROOT}/a.ts`,
      `${ROOT}/b.ts`,
    ]);
  });
});

const tracked = (path: string, firstLine = '') => ({ path, firstLine });
const texts: Record<string, string> = {
  '.github/workflows/ci.yml': 'on: push\n# why\njobs: {}\n',
};
/** Every path buildTable asked to read, in order. */
const asked: string[] = [];
const read = (path: string): string => {
  asked.push(path);
  // An unexpected path returns undefined, and the counter fails loudly on it.
  return texts[path] as string;
};

describe('the table holds every tracked code file (#728)', () => {
  it('a V8 file enters with its untested counts, measured by v8', () => {
    const { table, problems } = buildTable(
      map(file('a.ts', [0, 1], [[0, 1]])),
      [tracked('a.ts')],
      read,
      ROOT,
    );
    expect([problems, table['a.ts']]).toEqual([
      [],
      {
        measure: 'v8',
        statements: { untested: 1, total: 2 },
        branches: { untested: 1, total: 2 },
      },
    ]);
  });

  it('a file counted by lines enters at full size, measured by lines', () => {
    const { table } = buildTable(
      map(),
      [tracked('.github/workflows/ci.yml')],
      read,
      ROOT,
    );
    expect(table['.github/workflows/ci.yml']).toEqual({
      measure: 'lines',
      statements: { untested: 2, total: 2 },
      branches: { untested: 0, total: 0 },
    });
  });

  it('a file that is not code is left out', () => {
    const { table, problems } = buildTable(
      map(),
      [tracked('README.md')],
      read,
      ROOT,
    );
    expect([table, problems]).toEqual([{}, []]);
  });

  it('a tracked V8 file missing from the report is a problem, never zero', () => {
    const { table, problems } = buildTable(
      map(),
      [tracked('a.ts')],
      read,
      ROOT,
    );
    expect([problems, table]).toEqual([
      ['a.ts is tracked code but no suite reported it'],
      {},
    ]);
  });

  it('a tracked file of a kind the table does not list is a problem', () => {
    const { problems } = buildTable(map(), [tracked('x.py')], read, ROOT);
    expect(problems).toEqual([
      'x.py is of no listed kind (scripts/coverage-kinds.ts)',
    ]);
  });

  it('reads only the files it counts by lines, never a file V8 measured', () => {
    asked.length = 0;
    buildTable(
      map(file('a.ts', [1])),
      [
        tracked('a.ts'),
        tracked('README.md'),
        tracked('.github/workflows/ci.yml'),
      ],
      read,
      ROOT,
    );
    expect(asked).toEqual(['.github/workflows/ci.yml']);
  });

  it('a reported file nobody tracks is left out (generated types)', () => {
    const { table, problems } = buildTable(
      map(file('a.ts', [1]), file('worker-configuration.d.ts', [])),
      [tracked('a.ts')],
      read,
      ROOT,
    );
    expect([Object.keys(table), problems]).toEqual([['a.ts'], []]);
  });
});

describe('the table is written the same way every time (#728)', () => {
  it('sorts files by path and ends with a newline, whatever order they came in', () => {
    const entry = {
      measure: 'v8' as const,
      statements: { untested: 0, total: 1 },
      branches: { untested: 0, total: 0 },
    };
    const text = formatTable({ 'b.ts': entry, 'a.ts': entry });
    expect(text.indexOf('"a.ts"')).toBeLessThan(text.indexOf('"b.ts"'));
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toEqual({
      files: { 'a.ts': entry, 'b.ts': entry },
      totals: {
        statements: { untested: 0, total: 2 },
        branches: { untested: 0, total: 0 },
      },
    });
  });
});

const entry = (statements: number, branches = 0): Entry => ({
  measure: 'v8',
  statements: { untested: statements, total: 10 },
  branches: { untested: branches, total: 10 },
});

/**
 * The ratchet: no file's untested count may rise against the record at the
 * base, and a file new to the record enters at zero (Shyden, 2026-10-22,
 * "Untested count"). A renamed file is judged against its old path.
 */
describe('no file grows its untested code (#728)', () => {
  it('a file whose untested statements stay or fall is not named, beside one that rose', () => {
    expect(
      rises(
        { 'a.ts': entry(3), 'b.ts': entry(2), 'c.ts': entry(0) },
        { 'a.ts': entry(3), 'b.ts': entry(1), 'c.ts': entry(1) },
        new Map(),
      ),
    ).toEqual(['c.ts: untested statements rose from 0 to 1']);
  });

  it('a rise in untested statements names the file and both counts', () => {
    expect(
      rises({ 'a.ts': entry(3) }, { 'a.ts': entry(4) }, new Map()),
    ).toEqual(['a.ts: untested statements rose from 3 to 4']);
  });

  it('a rise in untested branch arms is judged on its own', () => {
    expect(
      rises({ 'a.ts': entry(3, 1) }, { 'a.ts': entry(2, 2) }, new Map()),
    ).toEqual(['a.ts: untested branch arms rose from 1 to 2']);
  });

  it('a file new to the record with untested code is refused', () => {
    expect(rises({}, { 'n.ts': entry(1) }, new Map())).toEqual([
      'n.ts enters the record with 1 untested statements; a file new to the record enters at zero',
    ]);
  });

  it('a file new to the record with nothing untested passes, beside one that has some', () => {
    expect(
      rises({}, { 'n.ts': entry(0), 'm.ts': entry(1) }, new Map()),
    ).toEqual([
      'm.ts enters the record with 1 untested statements; a file new to the record enters at zero',
    ]);
  });

  it('a renamed file is judged against its old path, not as new', () => {
    expect([
      rises(
        { 'old.ts': entry(3) },
        { 'new.ts': entry(3) },
        new Map([['new.ts', 'old.ts']]),
      ),
      rises({ 'old.ts': entry(3) }, { 'new.ts': entry(3) }, new Map()),
    ]).toEqual([
      [],
      [
        'new.ts enters the record with 3 untested statements; a file new to the record enters at zero',
      ],
    ]);
  });

  it('a renamed file that grew is named with its old path', () => {
    expect(
      rises(
        { 'old.ts': entry(3) },
        { 'new.ts': entry(4) },
        new Map([['new.ts', 'old.ts']]),
      ),
    ).toEqual(['new.ts (was old.ts): untested statements rose from 3 to 4']);
  });

  it('a deleted file is no rise, beside a kept file that rose', () => {
    expect(
      rises(
        { 'gone.ts': entry(5), 'kept.ts': entry(0) },
        { 'kept.ts': entry(1) },
        new Map(),
      ),
    ).toEqual(['kept.ts: untested statements rose from 0 to 1']);
  });

  it('every rise is named, not only the first', () => {
    expect(
      rises(
        { 'a.ts': entry(0), 'b.ts': entry(0) },
        { 'a.ts': entry(1), 'b.ts': entry(1) },
        new Map(),
      ),
    ).toHaveLength(2);
  });
});
