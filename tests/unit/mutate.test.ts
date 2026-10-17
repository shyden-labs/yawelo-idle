import { describe, expect, it } from 'vitest';
import type { Mutation } from '../../scripts/mutation-file';
import {
  corpusPredictions,
  judge,
  laptopRefusal,
  plant,
  readReport,
  suiteOf,
  type CorpusPrediction,
  type Report,
} from '../../scripts/mutate';

/**
 * The mutation runner's pure parts (#527, spec §4–§6): what its reporter's
 * file says, where an anchor lands, which suite a set runs in, which
 * whole-repo floors a planted mutation moves, and whether a run matched its
 * prediction. `main` wires them to real processes; the integration suite
 * runs it.
 */

const T = 'tests/guards/reader.test.ts';
const RED = `${T} › reader > reads every item`;

describe('readReport', () => {
  it('reads the total, the files, each failure’s text and the timed-out tests', () => {
    expect(
      readReport({
        total: 2,
        files: [T],
        failing: { [RED]: 'reader/items: read 3, recorded 4' },
        timedOut: [RED],
      }),
    ).toEqual<Report>({
      total: 2,
      files: [T],
      failing: new Map([[RED, 'reader/items: read 3, recorded 4']]),
      timedOut: [RED],
    });
  });

  it.each<[string, unknown, string]>([
    ['a report that is not an object', null, 'is not an object'],
    ['a list', [], 'is not an object'],
    [
      'a total that is not a count',
      { total: -1, files: [], failing: {}, timedOut: [] },
      'total is not a count',
    ],
    [
      'files that are not text',
      { total: 0, files: [1], failing: {}, timedOut: [] },
      'files is not a list of paths',
    ],
    [
      'a failure whose text is not text',
      { total: 1, files: [T], failing: { [RED]: 3 }, timedOut: [] },
      'failing is not a map of tests to text',
    ],
    [
      'timed-out tests that are not text',
      { total: 1, files: [T], failing: {}, timedOut: {} },
      'timedOut is not a list of tests',
    ],
  ])('refuses %s', (_case, json, refusal) => {
    expect(() => readReport(json)).toThrow(
      `the runner's report is not readable: ${refusal}`,
    );
  });
});

describe('plant', () => {
  it('replaces an anchor that occurs exactly once', () => {
    expect(plant('a\nb\nc\n', 'b\n', 'B\n')).toEqual({ text: 'a\nB\nc\n' });
  });

  it.each<[string, string, number]>([
    ['an anchor that is missing', 'a\nc\n', 0],
    ['an anchor that occurs twice', 'b\nb\n', 2],
  ])('refuses %s, with its count', (_case, text, matches) => {
    expect(plant(text, 'b\n', 'B\n')).toEqual({ matches });
  });

  it('keeps a replacement holding $ patterns as written', () => {
    expect(plant('x = 1;', '1', "'$&$1'")).toEqual({ text: "x = '$&$1';" });
  });
});

describe('suiteOf', () => {
  const listings = new Map<string, readonly string[]>([
    ['unit suite', ['tests/unit/a.test.ts']],
    ['guards suite', [T, 'tests/guards/b.test.ts']],
  ]);

  it('finds the one suite that lists every target', () => {
    expect(suiteOf([T, 'tests/guards/b.test.ts'], listings)).toEqual({
      suite: 'guards suite',
    });
  });

  it('refuses a target no suite lists', () => {
    expect(suiteOf(['apps/web/test/game.test.ts'], listings)).toEqual({
      refusal:
        'apps/web/test/game.test.ts is in no suite the runner can run (the harness and Playwright suites wait on #649)',
    });
  });

  it('refuses a target two suites list', () => {
    const both = new Map([...listings, ['pacing suite', [T]]]);
    expect(suiteOf([T], both)).toEqual({
      refusal: `${T} is listed by guards suite and pacing suite`,
    });
  });

  it('refuses targets in different suites', () => {
    expect(suiteOf([T, 'tests/unit/a.test.ts'], listings)).toEqual({
      refusal: `the targets are in more than one suite: ${T} in guards suite, tests/unit/a.test.ts in unit suite`,
    });
  });
});

describe('laptopRefusal', () => {
  it('lets the unit suite run on the laptop', () => {
    expect(laptopRefusal('unit suite', false)).toBeUndefined();
  });

  it('refuses any other suite on the laptop', () => {
    expect(laptopRefusal('pacing suite', false)).toBe(
      'pacing suite: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it',
    );
  });

  it('lets any suite run in CI', () => {
    expect(laptopRefusal('pacing suite', true)).toBeUndefined();
  });
});

describe('corpusPredictions', () => {
  const floors = { 'line-of/accesses': 100, 'reader/items': 4 };
  const NONE = new Set<string>();

  it('predicts a whole-repo floor that grew, with both figures', () => {
    expect(
      corpusPredictions(
        [
          {
            id: 'line-of/accesses',
            actual: 102,
            site: 'tests/guards/line-of.test.ts:39',
          },
        ],
        floors,
        NONE,
      ),
    ).toEqual<CorpusPrediction[]>([
      {
        file: 'tests/guards/line-of.test.ts',
        id: 'line-of/accesses',
        actual: 102,
        recorded: 100,
        text: 'line-of/accesses: read 102, recorded 100',
      },
    ]);
  });

  it('predicts a whole-repo floor that fell', () => {
    expect(
      corpusPredictions(
        [
          {
            id: 'line-of/accesses',
            actual: 97,
            site: 'tests/guards/line-of.test.ts:39',
          },
        ],
        floors,
        NONE,
      ).map((p) => p.text),
    ).toEqual(['line-of/accesses: read 97, recorded 100']);
  });

  it('predicts nothing for a floor at its recorded figure', () => {
    expect(
      corpusPredictions(
        [
          {
            id: 'line-of/accesses',
            actual: 100,
            site: 'tests/guards/line-of.test.ts:39',
          },
        ],
        floors,
        NONE,
      ),
    ).toEqual([]);
  });

  it('predicts an id no floor file records', () => {
    expect(
      corpusPredictions(
        [{ id: 'new/thing', actual: 3, site: 'tests/guards/new.test.ts:9' }],
        floors,
        NONE,
      ).map((p) => p.text),
    ).toEqual(['new/thing is not recorded']);
  });

  it('leaves out a floor checked in an excluded file (a target or an importer)', () => {
    expect(
      corpusPredictions(
        [{ id: 'reader/items', actual: 3, site: `${T}:12` }],
        floors,
        new Set([T]),
      ),
    ).toEqual([]);
  });

  it('predicts one moved floor once, however often it was checked', () => {
    const seen = {
      id: 'line-of/accesses',
      actual: 102,
      site: 'tests/guards/line-of.test.ts:39',
    };
    expect(corpusPredictions([seen, seen], floors, NONE)).toHaveLength(1);
  });

  it('refuses a site it cannot read a file from', () => {
    expect(() =>
      corpusPredictions(
        [{ id: 'line-of/accesses', actual: 1, site: 'nowhere' }],
        floors,
        NONE,
      ),
    ).toThrow(
      'cannot read a file:line from the site "nowhere" of line-of/accesses',
    );
  });
});

describe('judge', () => {
  const MUTATION: Mutation = {
    name: 'reader-blind',
    file: 'src/reader.ts',
    anchor: 'xs',
    replacement: 'xs.slice(1)',
    red: { [RED]: 'reader/items' },
  };
  const CORPUS: CorpusPrediction = {
    file: 'tests/guards/count.test.ts',
    id: 'count/reads',
    actual: 6,
    recorded: 5,
    text: 'count/reads: read 6, recorded 5',
  };
  const COUNTED = 'tests/guards/count.test.ts › counts every read';
  const run = (
    failing: [string, string][],
    total = 9,
    timedOut: string[] = [],
  ): Report => ({
    total,
    files: [T],
    failing: new Map(failing),
    timedOut,
  });

  it('matches a run that failed exactly as predicted', () => {
    expect(
      judge(MUTATION, [], run([[RED, 'reader/items: read 3, recorded 4']]), 9),
    ).toEqual([]);
  });

  it('matches a whole-repo floor the corpus prediction accounts for', () => {
    expect(
      judge(
        MUTATION,
        [CORPUS],
        run([
          [RED, 'reader/items: read 3, recorded 4'],
          [
            COUNTED,
            'count/reads: read 6, recorded 5. The population grew by 1',
          ],
        ]),
        9,
      ),
    ).toEqual([]);
  });

  it('misses that same run without the corpus prediction', () => {
    expect(
      judge(
        MUTATION,
        [],
        run([
          [RED, 'reader/items: read 3, recorded 4'],
          [
            COUNTED,
            'count/reads: read 6, recorded 5. The population grew by 1',
          ],
        ]),
        9,
      ),
    ).toEqual([
      `unpredicted red: ${COUNTED}: count/reads: read 6, recorded 5. The population grew by 1`,
    ]);
  });

  it('misses a corpus prediction no failing test shows', () => {
    expect(
      judge(
        MUTATION,
        [CORPUS],
        run([[RED, 'reader/items: read 3, recorded 4']]),
        9,
      ),
    ).toEqual([
      'whole-repo floor stayed green: count/reads 5 → 6 in tests/guards/count.test.ts',
    ]);
  });

  it('does not let a corpus prediction account for a failure in another file', () => {
    const other = 'tests/guards/other.test.ts › also';
    expect(
      judge(
        MUTATION,
        [CORPUS],
        run([
          [RED, 'reader/items: read 3, recorded 4'],
          [COUNTED, 'count/reads: read 6, recorded 5'],
          [other, 'count/reads: read 6, recorded 5'],
        ]),
        9,
      ),
    ).toEqual([`unpredicted red: ${other}: count/reads: read 6, recorded 5`]);
  });

  it('misses a predicted test that stayed green', () => {
    expect(judge(MUTATION, [], run([]), 9)).toEqual([
      `predicted red, stayed green: ${RED}`,
    ]);
  });

  it('misses a predicted test red for another reason, with its first line', () => {
    expect(
      judge(
        MUTATION,
        [],
        run([[RED, '\nTypeError: x is undefined\n  at y']]),
        9,
      ),
    ).toEqual([
      `red for another reason: ${RED} (wanted "reader/items"): TypeError: x is undefined`,
    ]);
  });

  it('prints the first line of a failure without its terminal colours', () => {
    const coloured = `${String.fromCharCode(27)}[31m[PARSE_ERROR] ${String.fromCharCode(27)}[0mUnexpected token`;
    expect(
      judge({ ...MUTATION, red: {} }, [], run([[RED, coloured]]), 9),
    ).toEqual([`unpredicted red: ${RED}: [PARSE_ERROR] Unexpected token`]);
  });

  it('matches a mutation predicted green that stayed green', () => {
    expect(judge({ ...MUTATION, red: {} }, [], run([]), 9)).toEqual([]);
  });

  it('misses a moved total', () => {
    expect(
      judge(
        MUTATION,
        [],
        run([[RED, 'reader/items: read 3, recorded 4']], 8),
        9,
      ),
    ).toEqual(['the total moved: 8 tests, not 9']);
  });

  it('misses a timed-out test', () => {
    expect(
      judge(
        MUTATION,
        [],
        run([[RED, 'reader/items: read 3, recorded 4']], 9, [RED]),
        9,
      ),
    ).toEqual([`1 test timed out: ${RED}`]);
  });

  it('misses a run that wrote no report', () => {
    expect(judge(MUTATION, [], undefined, 9)).toEqual([
      'no report: the run ended before the reporter wrote one',
    ]);
  });
});
