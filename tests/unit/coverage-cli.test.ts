import { describe, expect, it } from 'vitest';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import {
  percent,
  shortfalls,
  suiteFailure,
  THRESHOLDS,
  totalsOf,
  untestedScreens,
} from '../../scripts/coverage';

/** One file's map: two statements, one branch with two arms. */
const fileMap = (
  path: string,
  statementHits: [number, number],
  armHits: [number, number],
): CoverageMapData => {
  const at = (line: number) => ({
    start: { line, column: 0 },
    end: { line, column: 1 },
  });
  const loc = at(1);
  return {
    [path]: {
      path,
      statementMap: { 0: loc, 1: at(2) },
      fnMap: {},
      branchMap: { 0: { loc, type: 'if', locations: [loc, at(2)], line: 1 } },
      s: { 0: statementHits[0], 1: statementHits[1] },
      f: {},
      b: { 0: armHits },
    },
  };
};

describe('every suite is joined before the totals are taken (#795)', () => {
  it('counts a statement one suite ran as run, whichever suite ran it', () => {
    expect(
      totalsOf([
        fileMap('a.ts', [1, 0], [0, 0]),
        fileMap('a.ts', [0, 1], [0, 1]),
      ]),
    ).toEqual({
      statements: { untested: 0, total: 2 },
      branches: { untested: 1, total: 2 },
    });
  });

  it('adds the files of different suites together', () => {
    expect(
      totalsOf([
        fileMap('a.ts', [1, 1], [1, 1]),
        fileMap('b.ts', [0, 0], [0, 0]),
      ]),
    ).toEqual({
      statements: { untested: 2, total: 4 },
      branches: { untested: 2, total: 4 },
    });
  });
});

describe('every Svelte screen is tested in full (#802, #804)', () => {
  const at = (line: number) => ({
    start: { line, column: 0 },
    end: { line, column: 1 },
  });
  /**
   * A screen's entry: the component function on line 1, a handler on line 4,
   * statements on lines 2 and 5, and an if on line 6 with its two arms.
   */
  const screen = (
    path: string,
    hits: { s: [number, number]; f: [number, number]; b: [number, number] },
  ): CoverageMapData => ({
    [path]: {
      path,
      statementMap: { 0: at(2), 1: at(5) },
      fnMap: {
        0: { name: 'Screen', decl: at(1), loc: at(1), line: 1 },
        1: { name: 'buy', decl: at(4), loc: at(4), line: 4 },
      },
      branchMap: {
        0: { loc: at(6), type: 'if', locations: [at(6), at(7)], line: 6 },
      },
      s: { 0: hits.s[0], 1: hits.s[1] },
      f: { 0: hits.f[0], 1: hits.f[1] },
      b: { 0: hits.b },
    },
  });
  const ALL: { s: [number, number]; f: [number, number]; b: [number, number] } =
    { s: [1, 1], f: [1, 1], b: [1, 1] };

  it('passes a screen whose every statement, arm and function ran', () => {
    expect(untestedScreens([screen('/r/Shop.svelte', { ...ALL })])).toEqual([]);
  });

  it('names an unrun statement with its line', () => {
    expect(
      untestedScreens([screen('/r/Shop.svelte', { ...ALL, s: [1, 0] })]),
    ).toEqual(['/r/Shop.svelte:5: statement never run']);
  });

  it('names an unrun branch arm with its line', () => {
    expect(
      untestedScreens([screen('/r/Shop.svelte', { ...ALL, b: [3, 0] })]),
    ).toEqual(['/r/Shop.svelte:7: branch arm 2 of 2 never taken']);
  });

  it('names an unrun function, a handler no test called', () => {
    expect(
      untestedScreens([screen('/r/Shop.svelte', { ...ALL, f: [1, 0] })]),
    ).toEqual(['/r/Shop.svelte:4: function buy never called']);
  });

  it('names everything in a screen no test rendered, in line order', () => {
    expect(
      untestedScreens([
        screen('/r/Shop.svelte', { s: [0, 0], f: [0, 0], b: [0, 0] }),
      ]),
    ).toEqual([
      '/r/Shop.svelte:1: function Screen never called',
      '/r/Shop.svelte:2: statement never run',
      '/r/Shop.svelte:4: function buy never called',
      '/r/Shop.svelte:5: statement never run',
      '/r/Shop.svelte:6: branch arm 1 of 2 never taken',
      '/r/Shop.svelte:7: branch arm 2 of 2 never taken',
    ]);
  });

  it('passes a screen two suites ran between them', () => {
    expect(
      untestedScreens([
        screen('/r/Shop.svelte', { s: [1, 0], f: [1, 0], b: [1, 0] }),
        screen('/r/Shop.svelte', { s: [0, 1], f: [0, 1], b: [0, 1] }),
      ]),
    ).toEqual([]);
  });

  it('names a Svelte file whose entry holds no function, rather than passing it', () => {
    expect(
      untestedScreens([
        {
          '/r/Odd.svelte': {
            path: '/r/Odd.svelte',
            statementMap: {},
            fnMap: {},
            branchMap: {},
            s: {},
            f: {},
            b: {},
          },
        },
      ]),
    ).toEqual(['/r/Odd.svelte:1: no component function, so no render shows']);
  });

  /** A screen whose line 3 is `source`, with a logical branch on it. */
  const logical = (source: string, arms: [number, number]) => ({
    map: {
      '/r/Text.svelte': {
        path: '/r/Text.svelte',
        statementMap: {},
        fnMap: { 0: { name: 'Text', decl: at(1), loc: at(1), line: 1 } },
        branchMap: {
          0: {
            loc: {
              start: { line: 3, column: 13 },
              end: { line: 3, column: null },
            },
            type: 'binary-expr',
            locations: [
              {
                start: { line: 3, column: 13 },
                end: { line: 3, column: null },
              },
              {
                start: { line: 3, column: 18 },
                end: { line: 3, column: null },
              },
            ],
            line: 3,
          },
        },
        s: {},
        f: { 0: 1 },
        b: { 0: arms },
      },
    } as unknown as CoverageMapData,
    read: () => `<script>\n</script>\n${source}\n`,
  });

  it("passes the `?? ''` Svelte adds to a {value}, which no test can take", () => {
    const { map, read } = logical('  <p>Count: {count}</p>', [3, 0]);
    expect(untestedScreens([map], read)).toEqual([]);
  });

  it('names an untaken arm of a ?? written in the screen', () => {
    const { map, read } = logical("  <p>Count: {count ?? 'none'}</p>", [3, 0]);
    expect(untestedScreens([map], read)).toEqual([
      '/r/Text.svelte:3: branch arm 2 of 2 never taken',
    ]);
  });

  it('names an untaken arm of a || or && written in the screen', () => {
    const { map, read } = logical('  <p>Count: {a || b && c}</p>', [3, 0]);
    expect(untestedScreens([map], read)).toEqual([
      '/r/Text.svelte:3: branch arm 2 of 2 never taken',
    ]);
  });

  it('judges only Svelte files', () => {
    expect(untestedScreens([fileMap('a.ts', [0, 0], [0, 0])])).toEqual([]);
  });
});

describe('coverage fails below one overall threshold (#795)', () => {
  const at = (statements: number, branches: number) => ({
    statements: { untested: 100 - statements, total: 100 },
    branches: { untested: 100 - branches, total: 100 },
  });

  it('passes at both thresholds exactly', () => {
    expect(shortfalls(at(THRESHOLDS.statements, THRESHOLDS.branches))).toEqual(
      [],
    );
  });

  it('names statements below theirs', () => {
    expect(shortfalls(at(87, 90), { statements: 88, branches: 81 })).toEqual([
      'statements: 87.0% run (13 of 100 untested), below the 88% threshold',
    ]);
  });

  it('names branches below theirs', () => {
    expect(shortfalls(at(95, 80), { statements: 88, branches: 81 })).toEqual([
      'branches: 80.0% run (20 of 100 untested), below the 81% threshold',
    ]);
  });

  it('names both when both are below', () => {
    expect(shortfalls(at(0, 0), { statements: 88, branches: 81 })).toHaveLength(
      2,
    );
  });

  it('holds the figures CI measured with Svelte counted, rounded down', () => {
    expect(THRESHOLDS).toEqual({ statements: 85, branches: 76 });
  });
});

describe('a count reads as the share of code run (#728)', () => {
  it('names the share run and both counts', () => {
    expect(percent({ untested: 1, total: 4 })).toBe(
      '75.0% run (1 of 4 untested)',
    );
  });

  it('groups thousands, as the probe figures were written', () => {
    expect(percent({ untested: 5290, total: 25566 })).toBe(
      '79.3% run (5,290 of 25,566 untested)',
    );
  });

  it('rounds down, so a share just under a threshold never prints as it (#798)', () => {
    expect(percent({ untested: 1275, total: 5542 })).toBe(
      '76.9% run (1,275 of 5,542 untested)',
    );
  });

  it('reads a file with no code as all run', () => {
    expect(percent({ untested: 0, total: 0 })).toBe(
      '100.0% run (0 of 0 untested)',
    );
  });
});

describe('a suite that did not run measures nothing (#728, #771)', () => {
  it.each([
    [
      'one that never started',
      { error: new Error('spawn npx ENOENT'), status: null },
      'the unit suite did not start: spawn npx ENOENT',
    ],
    [
      'one that failed',
      { status: 3 },
      'the unit suite failed (exit 3): nothing measured',
    ],
    [
      'one stopped by a signal',
      { status: null },
      'the unit suite failed (exit null): nothing measured',
    ],
  ])('stops on %s', (_case, run, failure) => {
    expect(suiteFailure('unit', run)).toBe(failure);
  });

  it('goes on after one that passed', () => {
    expect(suiteFailure('unit', { status: 0 })).toBeUndefined();
  });
});
