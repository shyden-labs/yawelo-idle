import { describe, expect, it } from 'vitest';
import {
  compare,
  parseEquivalents,
  report as verdictLines,
  undetected,
  run,
  type Undetected,
} from '../../scripts/mutation-survivors';

/**
 * The mutation score may not drop (Shyden, 2026-10-16: "fail on any drop",
 * #36). Every mutant the tests do not detect (Survived or NoCoverage) must be
 * on the committed list of equivalent mutants, stryker.equivalents.json, each
 * with its reason, and every listed entry must still be undetected, so the
 * list stays exact. The score can then only fall by gaining an unlisted
 * survivor, which fails the job. A mutant is keyed by its file, mutator,
 * original text and replacement, not its line, so an edit elsewhere in the
 * file does not move it.
 */

const FILES = ['packages/core/src/a.ts', 'packages/core/src/b.ts'] as const;

interface FakeMutant {
  id?: string;
  mutatorName?: string;
  replacement?: string;
  status?: string;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

const at = (
  line: number,
  column: number,
  endLine: number,
  endColumn: number,
) => ({
  start: { line, column },
  end: { line: endLine, column: endColumn },
});

const mutant = (status: string, extra: FakeMutant = {}): FakeMutant => ({
  id: '1',
  mutatorName: 'EqualityOperator',
  replacement: 'a <= b',
  status,
  location: at(1, 8, 1, 13),
  ...extra,
});

/** A report holding a.ts and b.ts; a.ts's source is `return a < b;`. */
function fakeReport(
  aMutants: FakeMutant[],
  bMutants: FakeMutant[] = [mutant('Killed')],
): unknown {
  return {
    schemaVersion: '2',
    thresholds: { high: 95, low: 90 },
    files: {
      'packages/core/src/a.ts': {
        language: 'typescript',
        source: 'return a < b;\n',
        mutants: aMutants,
      },
      'packages/core/src/b.ts': {
        language: 'typescript',
        source: 'return a < b;\n',
        mutants: bMutants,
      },
    },
  };
}

const lt: Undetected = {
  file: 'packages/core/src/a.ts',
  mutator: 'EqualityOperator',
  original: 'a < b',
  replacement: 'a <= b',
};

describe('the undetected mutants of a report (#36)', () => {
  it.each(['Survived', 'NoCoverage'])(
    'reads a %s mutant as undetected, with its original text from the source',
    (status) => {
      expect(
        undetected(fakeReport([mutant(status)]), FILES).undetected,
      ).toEqual([lt]);
    },
  );

  it.each(['Killed', 'Timeout', 'CompileError', 'RuntimeError', 'Ignored'])(
    'does not read a %s mutant as undetected',
    (status) => {
      expect(
        undetected(fakeReport([mutant(status)]), FILES).undetected,
      ).toEqual([]);
    },
  );

  it('counts every mutant it judged, in every file', () => {
    const result = undetected(
      fakeReport([mutant('Killed'), mutant('Survived')], [mutant('Killed')]),
      FILES,
    );
    expect([result.judged, result.files]).toEqual([3, 2]);
  });

  it('reads a location across lines, end exclusive', () => {
    const report = {
      files: {
        'packages/core/src/a.ts': {
          source: 'if (x) {\n  y();\n}\n',
          mutants: [
            mutant('Survived', {
              mutatorName: 'BlockStatement',
              replacement: '{}',
              location: at(1, 8, 3, 2),
            }),
          ],
        },
        'packages/core/src/b.ts': {
          source: 'return a < b;\n',
          mutants: [mutant('Killed')],
        },
      },
    };
    expect(undetected(report, FILES).undetected).toEqual([
      {
        file: 'packages/core/src/a.ts',
        mutator: 'BlockStatement',
        original: '{\n  y();\n}',
        replacement: '{}',
      },
    ]);
  });

  // Stryker's locations count lines as Babel does: CRLF is one break, and
  // U+2028 and U+2029 are breaks too. Built from char codes, not typed.
  it.each([
    ['CRLF', '\r\n'],
    ['a lone CR', '\r'],
    ['U+2028', String.fromCharCode(0x2028)],
    ['U+2029', String.fromCharCode(0x2029)],
  ])('reads a location on the line after a %s break', (_why, br) => {
    const report = {
      files: {
        'packages/core/src/a.ts': {
          source: `x;${br}return a < b;${br}`,
          mutants: [mutant('Survived', { location: at(2, 8, 2, 13) })],
        },
        'packages/core/src/b.ts': {
          source: 'return a < b;\n',
          mutants: [mutant('Killed')],
        },
      },
    };
    expect(undetected(report, FILES).undetected).toEqual([lt]);
  });

  it('refuses a report holding a file it did not mutate, naming it', () => {
    const report = fakeReport([mutant('Killed')]) as {
      files: Record<string, unknown>;
    };
    report.files['packages/core/src/c.ts'] = {
      source: 'x\n',
      mutants: [mutant('Killed')],
    };
    expect(() => undetected(report, FILES)).toThrow(
      'packages/core/src/c.ts is in the report but not in stryker.config.json mutate',
    );
  });

  it('refuses a report missing a mutated file, naming it', () => {
    const report = fakeReport([mutant('Killed')]) as {
      files: Record<string, unknown>;
    };
    delete report.files['packages/core/src/b.ts'];
    expect(() => undetected(report, FILES)).toThrow(
      'packages/core/src/b.ts is mutated but missing from the report',
    );
  });

  it('refuses a mutated file with no mutants, which would judge nothing', () => {
    expect(() => undetected(fakeReport([mutant('Killed')], []), FILES)).toThrow(
      'packages/core/src/b.ts has no mutants',
    );
  });

  it.each(['Pending', 'Unknown', ''])(
    'refuses a mutant whose status is %j, naming its id',
    (status) => {
      expect(() =>
        undetected(fakeReport([mutant(status, { id: '42' })]), FILES),
      ).toThrow(/mutant 42 .*status/);
    },
  );

  it.each([
    ['a report that is not an object', null],
    ['a report with no files', { schemaVersion: '2' }],
    ['a file with no source', { files: { [FILES[0]]: { mutants: [] } } }],
    ['a file with no mutant list', { files: { [FILES[0]]: { source: '' } } }],
  ])('refuses %s, by name', (_why, report) => {
    expect(() => undetected(report, FILES)).toThrow(/mutation report/);
  });

  it.each([
    ['no mutator', { mutatorName: undefined }],
    ['no location', { location: undefined }],
    ['a location outside the source', { location: at(9, 1, 9, 4) }],
    ['a column past the end of its line', { location: at(1, 8, 1, 30) }],
    ['an end before its start', { location: at(1, 13, 1, 8) }],
  ])('refuses a mutant with %s, naming its id', (_why, extra) => {
    expect(() =>
      undetected(
        fakeReport([mutant('Survived', { id: '7', ...extra })]),
        FILES,
      ),
    ).toThrow(/mutant 7/);
  });

  it('reads a mutant with no replacement as an empty one', () => {
    expect(
      undetected(
        fakeReport([mutant('Survived', { replacement: undefined })]),
        FILES,
      ).undetected,
    ).toEqual([{ ...lt, replacement: '' }]);
  });
});

describe('the committed list of equivalent mutants (#36)', () => {
  const entry = { ...lt, reason: 'a and b are never equal here' };

  it('reads each entry with its reason', () => {
    expect(parseEquivalents([entry])).toEqual([entry]);
  });

  it('reads an empty list', () => {
    expect(parseEquivalents([])).toEqual([]);
  });

  it.each([
    ['a list that is not an array', {}],
    ['an entry with no reason', [{ ...lt }]],
    ['an entry with an empty reason', [{ ...lt, reason: ' ' }]],
    ['an entry with no original text', [{ ...entry, original: undefined }]],
    ['an entry with a key it does not know', [{ ...entry, line: 3 }]],
  ])('refuses %s, by name', (_why, list) => {
    expect(() => parseEquivalents(list)).toThrow(/stryker\.equivalents\.json/);
  });
});

describe('undetected mutants against the list (#36)', () => {
  const entry = { ...lt, reason: 'a and b are never equal here' };

  it('passes an undetected mutant on the list', () => {
    expect(compare([lt], [entry])).toEqual({ unlisted: [], stale: [] });
  });

  it('fails an undetected mutant not on the list', () => {
    expect(compare([lt], [])).toEqual({ unlisted: [lt], stale: [] });
  });

  it('matches by file, mutator, original and replacement, each of them', () => {
    expect(
      compare(
        [lt],
        [
          { ...entry, file: 'packages/core/src/b.ts' },
          { ...entry, mutator: 'ConditionalExpression' },
          { ...entry, original: 'a > b' },
          { ...entry, replacement: 'a >= b' },
        ],
      ).unlisted,
    ).toEqual([lt]);
  });

  it('needs one entry for each of two identical undetected mutants', () => {
    expect(compare([lt, lt], [entry])).toEqual({ unlisted: [lt], stale: [] });
  });

  it('fails a listed entry that is no longer undetected, so the list stays exact', () => {
    expect(compare([], [entry])).toEqual({ unlisted: [], stale: [entry] });
  });
});

describe('a run of the check (#36)', () => {
  const CONFIG = JSON.stringify({ mutate: [...FILES] });
  const files = (
    report: unknown,
    list: unknown,
    config = CONFIG,
  ): Record<string, string> => ({
    'stryker.config.json': config,
    'reports/mutation/mutation.json': JSON.stringify(report),
    'stryker.equivalents.json': JSON.stringify(list),
  });
  const reader = (f: Record<string, string>) => (path: string) => {
    const text = f[path];
    if (text === undefined) throw new Error(`ENOENT: ${path}`);
    return text;
  };
  const entry = { ...lt, reason: 'a and b are never equal here' };

  it('passes, printing the verdict, when every undetected mutant is listed', () => {
    expect(
      run(reader(files(fakeReport([mutant('Survived')]), [entry]))),
    ).toEqual({
      out: [
        'judged 2 mutants in 2 files: 1 undetected, every one on stryker.equivalents.json',
      ],
      err: [],
      code: 0,
    });
  });

  it('fails on an unlisted undetected mutant', () => {
    const result = run(reader(files(fakeReport([mutant('Survived')]), [])));
    expect([result.code, result.out.length]).toEqual([1, 2]);
  });

  it('fails on a stale entry', () => {
    const result = run(reader(files(fakeReport([mutant('Killed')]), [entry])));
    expect([result.code, result.out.length]).toEqual([1, 2]);
  });

  it('fails by name when the report is missing', () => {
    const f = files(fakeReport([mutant('Killed')]), []);
    delete f['reports/mutation/mutation.json'];
    expect(run(reader(f))).toEqual({
      out: [],
      err: ['✗ ENOENT: reports/mutation/mutation.json'],
      code: 1,
    });
  });

  it('fails by name when stryker.config.json has no mutate list', () => {
    expect(
      run(reader(files(fakeReport([mutant('Killed')]), [], '{}'))).err,
    ).toEqual(['✗ stryker.config.json has no mutate list of files']);
  });

  it('judges the files stryker.config.json mutates', () => {
    const config = JSON.stringify({ mutate: [FILES[0]] });
    expect(
      run(reader(files(fakeReport([mutant('Killed')]), [], config))).err,
    ).toEqual([
      '✗ packages/core/src/b.ts is in the report but not in stryker.config.json mutate',
    ]);
  });
});

describe('the printed verdict (#36)', () => {
  it('states what it judged and that every undetected mutant is listed', () => {
    expect(
      verdictLines(
        { judged: 120, files: 9, undetected: [lt] },
        { unlisted: [], stale: [] },
      ),
    ).toEqual([
      'judged 120 mutants in 9 files: 1 undetected, every one on stryker.equivalents.json',
    ]);
  });

  it('names each unlisted mutant and each stale entry', () => {
    const entry = { ...lt, reason: 'r' };
    expect(
      verdictLines(
        { judged: 120, files: 9, undetected: [lt] },
        { unlisted: [lt], stale: [entry] },
      ),
    ).toEqual([
      'judged 120 mutants in 9 files: 1 undetected',
      '✗ not on stryker.equivalents.json (kill it with a test, or list it with its reason): packages/core/src/a.ts EqualityOperator "a < b" -> "a <= b"',
      '✗ listed but no longer undetected (remove it from stryker.equivalents.json): packages/core/src/a.ts EqualityOperator "a < b" -> "a <= b"',
    ]);
  });
});
