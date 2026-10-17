import { describe, expect, it } from 'vitest';
import type { Mutation, MutationFile } from '../../scripts/mutation-file';
import {
  runFile,
  type Io,
  type MutableSuite,
  type RunOutcome,
  type RunRequest,
} from '../../scripts/mutate';
import type { Observation } from '../../scripts/record-floors';

/**
 * `runFile` (#527, spec §4): one mutation file from load to verdict, driven
 * here through a stand-in `Io` that holds files in memory and answers each
 * suite run from a script. No process starts and no tree is read; the
 * integration suite runs the real thing.
 */

const UNIT: MutableSuite = { name: 'unit suite', config: undefined };
const GUARDS: MutableSuite = {
  name: 'guards suite',
  config: 'vitest.guards.config.ts',
};
const SUITES = [UNIT, GUARDS];

const SRC = 'src/reader.ts';
const TARGET = 'tests/unit/reader.test.ts';
const GUARD = 'tests/guards/reader.test.ts';
const RED = `${TARGET} › reader > reads every item`;
const ORIGINAL = 'export const readAll = (xs) => xs;\n';

const MUTATION: Mutation = {
  name: 'reader-blind',
  file: SRC,
  anchor: '=> xs;',
  replacement: '=> xs.slice(1);',
  red: { [RED]: 'reader/items' },
};

const FILE: MutationFile = { targets: [TARGET], mutations: [MUTATION] };

interface Answer {
  readonly failing?: readonly [string, string][];
  readonly total?: number;
  readonly files?: readonly string[];
  readonly log?: string;
  readonly ceilingHit?: boolean;
  readonly noReport?: boolean;
  readonly observations?: readonly Observation[];
}

/** A vitest JSON report holding `failing` as failed tests in their files. */
function vitestJson(answer: Answer): unknown {
  const byFile = new Map<string, { title: string; message: string }[]>();
  for (const file of answer.files ?? []) byFile.set(file, []);
  for (const [name, message] of answer.failing ?? []) {
    const [file = '', title = ''] = name.split(' › ');
    byFile.set(file, [...(byFile.get(file) ?? []), { title, message }]);
  }
  return {
    numTotalTests: answer.total ?? 9,
    testResults: [...byFile].map(([file, tests]) => ({
      name: `/repo/${file}`,
      status: tests.length > 0 ? 'failed' : 'passed',
      message: '',
      assertionResults: tests.map(({ title, message }) => {
        const path = title.split(' > ');
        return {
          ancestorTitles: path.slice(0, -1),
          title: path.at(-1),
          status: 'failed',
          failureMessages: [message],
        };
      }),
    })),
  };
}

interface Stand {
  readonly io: Io;
  readonly runs: RunRequest[];
  readonly printed: string[];
  readonly files: Map<string, string>;
  /** The text of the mutated file each run saw. */
  readonly seen: string[];
  readonly guarded: string[];
}

function stand(
  answers: readonly Answer[],
  options: {
    ci?: boolean;
    listings?: ReadonlyMap<string, readonly string[]>;
    untracked?: readonly string[];
    dirty?: readonly string[];
    floors?: Readonly<Record<string, number>>;
    restoreFails?: boolean;
    /** Report the mutated file changed against HEAD once every run is done. */
    dirtyAtEnd?: boolean;
  } = {},
): Stand {
  const files = new Map([[SRC, ORIGINAL]]);
  const runs: RunRequest[] = [];
  const printed: string[] = [];
  const seen: string[] = [];
  const guarded: string[] = [];
  const observed = new Map<string, readonly Observation[]>();
  const listings =
    options.listings ??
    new Map([
      ['unit suite', [TARGET]],
      ['guards suite', [GUARD]],
    ]);
  let next = 0;
  let writes = 0;
  const io: Io = {
    ci: options.ci ?? false,
    root: '/repo',
    read: (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`no file ${path}`);
      return new TextEncoder().encode(text);
    },
    write: (path, bytes) => {
      writes += 1;
      if (options.restoreFails === true && writes === 2) return;
      files.set(path, new TextDecoder().decode(bytes));
    },
    tracked: (path) => !(options.untracked ?? []).includes(path),
    clean: (path) =>
      !(options.dirty ?? []).includes(path) &&
      !(options.dirtyAtEnd === true && next === answers.length) &&
      (path !== SRC || files.get(SRC) === ORIGINAL),
    list: (suite) => listings.get(suite.name) ?? [],
    run: (request) => {
      runs.push(request);
      seen.push(files.get(SRC) ?? '');
      const answer = answers[next];
      next += 1;
      if (answer === undefined)
        throw new Error(`no answer scripted for run ${String(next)}`);
      if (request.recordTo !== undefined)
        observed.set(request.recordTo, answer.observations ?? []);
      const outcome: RunOutcome = {
        json: answer.noReport === true ? undefined : vitestJson(answer),
        log: answer.log ?? '',
        ceilingHit: answer.ceilingHit ?? false,
      };
      return Promise.resolve(outcome);
    },
    observations: (path) => observed.get(path) ?? [],
    floors: () => options.floors ?? {},
    guard: (path) => guarded.push(`guard ${path}`),
    release: (path) => guarded.push(`release ${path}`),
    print: (line) => printed.push(line),
  };
  return { io, runs, printed, files, seen, guarded };
}

const GREEN: Answer = { files: [TARGET] };
const BLIND: Answer = {
  files: [TARGET],
  failing: [[RED, 'reader/items: read 3, recorded 4']],
};

describe('runFile', () => {
  it('runs the baseline, then the mutation planted, and matches its prediction', async () => {
    const s = stand([GREEN, BLIND]);
    expect(await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES)).toEqual({
      matched: 1,
      rows: 1,
    });
    expect(s.seen).toEqual([
      ORIGINAL,
      'export const readAll = (xs) => xs.slice(1);\n',
    ]);
    expect(s.files.get(SRC)).toBe(ORIGINAL);
    expect(s.printed.at(-2)).toBe('ok   reader-blind');
    expect(s.printed.at(-1)).toBe('tests/mutations/x.ts: 1 of 1 matched');
  });

  it('writes each run’s report and log under .mutations/<file stem>/', async () => {
    const s = stand([GREEN, BLIND]);
    await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES);
    expect(s.runs.map((r) => [r.suite.name, r.json, r.log])).toEqual([
      ['unit suite', '.mutations/x/baseline.json', '.mutations/x/baseline.log'],
      [
        'unit suite',
        '.mutations/x/reader-blind.json',
        '.mutations/x/reader-blind.log',
      ],
    ]);
  });

  it('guards the planted file while it differs from HEAD, and releases it', async () => {
    const s = stand([GREEN, BLIND]);
    await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES);
    expect(s.guarded).toEqual([`guard ${SRC}`, `release ${SRC}`]);
  });

  it('prints each way a row missed, and counts it unmatched', async () => {
    const s = stand([GREEN, GREEN]);
    expect(await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES)).toEqual({
      matched: 0,
      rows: 1,
    });
    expect(s.printed.slice(-3)).toEqual([
      'MISS reader-blind',
      `  predicted red, stayed green: ${RED}`,
      'tests/mutations/x.ts: 0 of 1 matched',
    ]);
  });

  it('misses a row whose anchor does not occur once, and runs nothing for it', async () => {
    const s = stand([GREEN]);
    const file: MutationFile = {
      ...FILE,
      mutations: [{ ...MUTATION, anchor: 'nowhere' }],
    };
    expect(await runFile(s.io, 'tests/mutations/x.ts', file, SUITES)).toEqual({
      matched: 0,
      rows: 1,
    });
    expect(s.runs).toHaveLength(1);
    expect(s.printed).toContain(`ANCHOR reader-blind: 0 matches in ${SRC}`);
  });

  it('misses a run stopped at the ceiling, naming the suite', async () => {
    const s = stand([GREEN, { ...BLIND, ceilingHit: true }]);
    await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES);
    expect(s.printed).toContain(
      '  unit suite ran past the 600 s ceiling and was stopped',
    );
    expect(s.files.get(SRC)).toBe(ORIGINAL);
  });

  it('puts the file back when the run throws', async () => {
    const s = stand([GREEN]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow('no answer scripted for run 2');
    expect(s.files.get(SRC)).toBe(ORIGINAL);
    expect(s.guarded).toEqual([`guard ${SRC}`, `release ${SRC}`]);
  });

  it('stops when the file does not read back as it was', async () => {
    const s = stand([GREEN, BLIND], { restoreFails: true });
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(`${SRC} did not read back as it was before reader-blind`);
  });

  it('refuses at the end a mutated file that differs from HEAD', async () => {
    const s = stand([GREEN, BLIND], { dirtyAtEnd: true });
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      `tests/mutations/x.ts: ${SRC} differs from HEAD after every mutation was put back`,
    );
  });

  it.each<[string, Parameters<typeof stand>[1], string]>([
    [
      'an untracked target',
      { untracked: [TARGET] },
      `${TARGET} is not tracked`,
    ],
    [
      'a mutated file with changes against HEAD',
      { dirty: [SRC] },
      `${SRC} differs from HEAD: commit or restore it first`,
    ],
    [
      'targets in no suite it can run',
      { listings: new Map() },
      `${TARGET} is in no suite the runner can run (the harness and Playwright suites wait on #649)`,
    ],
  ])('refuses %s before running anything', async (_case, options, refusal) => {
    const s = stand([], options);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(`tests/mutations/x.ts: ${refusal}`);
    expect(s.runs).toEqual([]);
  });

  it('refuses a malformed file before running anything', async () => {
    const s = stand([]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', { ...FILE, targets: [] }, SUITES),
    ).rejects.toThrow('tests/mutations/x.ts: names no targets');
    expect(s.runs).toEqual([]);
  });

  it('refuses a non-unit suite on the laptop before running anything', async () => {
    const s = stand([], {
      listings: new Map([['guards suite', [TARGET]]]),
    });
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      'tests/mutations/x.ts: guards suite: the laptop runs the unit suite only',
    );
    expect(s.runs).toEqual([]);
  });

  it('refuses a red baseline, naming each failure, and plants nothing', async () => {
    const s = stand([{ files: [TARGET], failing: [[RED, 'boom']] }]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      `tests/mutations/x.ts: the unit suite is red before any mutation:\n  ${RED}: boom`,
    );
    expect(s.runs).toHaveLength(1);
  });

  it('refuses a baseline with a timed-out test', async () => {
    const s = stand([{ ...GREEN, log: 'Test timed out in 1000ms.' }]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      'the unit suite is red before any mutation:\n  1 test timed out',
    );
  });

  it('refuses a baseline that wrote no report', async () => {
    const s = stand([{ noReport: true }]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      'the unit suite is red before any mutation:\n  no JSON report: the run ended before vitest wrote one',
    );
  });
});

describe('runFile in the guards suite (CI)', () => {
  const COUNT = 'tests/guards/count.test.ts';
  const OTHER = 'tests/guards/helper.test.ts';
  const GUARD_RED = `${GUARD} › reader > reads every item`;
  // The helper guard imports the mutated file, so its moved floor is the
  // author's to predict: no corpus prediction accounts for it.
  const PREDICTED = {
    [GUARD_RED]: 'reader/items',
    [`${OTHER} › helps`]: 'helper/items',
  };
  const GUARD_FILE: MutationFile = {
    targets: [GUARD],
    mutations: [
      { ...MUTATION, red: PREDICTED },
      { ...MUTATION, name: 'reader-blind-again', red: PREDICTED },
    ],
  };
  const observations: Observation[] = [
    { id: 'count/reads', actual: 6, site: `${COUNT}:12` },
    { id: 'reader/items', actual: 3, site: `${GUARD}:20` },
    { id: 'helper/items', actual: 1, site: `${OTHER}:8` },
  ];
  const floors = { 'count/reads': 5, 'reader/items': 4, 'helper/items': 2 };
  const judged: Answer = {
    files: [GUARD],
    failing: [
      [GUARD_RED, 'reader/items: read 3, recorded 4'],
      [`${COUNT} › counts every read`, 'count/reads: read 6, recorded 5'],
      [`${OTHER} › helps`, 'helper/items: read 1, recorded 2'],
    ],
  };
  const related: Answer = { files: [GUARD, OTHER] };

  it('lists the importers once, records, and predicts only floors outside targets and importers', async () => {
    const s = stand(
      [GREEN, related, { observations }, judged, { observations }, judged],
      { ci: true, floors, listings: new Map([['guards suite', [GUARD]]]) },
    );
    expect(
      await runFile(s.io, 'tests/mutations/g.ts', GUARD_FILE, SUITES),
    ).toEqual({
      matched: 2,
      rows: 2,
    });
    expect(
      s.runs.map((r) => [r.json, r.related ?? null, r.recordTo ?? null]),
    ).toEqual([
      ['.mutations/g/baseline.json', null, null],
      ['.mutations/g/importers-1.json', SRC, null],
      [
        '.mutations/g/reader-blind.record.json',
        null,
        '.mutations/g/reader-blind.observations.jsonl',
      ],
      ['.mutations/g/reader-blind.json', null, null],
      [
        '.mutations/g/reader-blind-again.record.json',
        null,
        '.mutations/g/reader-blind-again.observations.jsonl',
      ],
      ['.mutations/g/reader-blind-again.json', null, null],
    ]);
    expect(
      s.printed.filter((line) => line.includes('whole-repo floor')),
    ).toEqual([
      '  whole-repo floor: count/reads 5 → 6, tests/guards/count.test.ts',
      '  whole-repo floor: count/reads 5 → 6, tests/guards/count.test.ts',
    ]);
  });

  it('lists importers on the unmutated tree and records on the mutated one', async () => {
    const s = stand(
      [GREEN, related, { observations }, judged, { observations }, judged],
      { ci: true, floors, listings: new Map([['guards suite', [GUARD]]]) },
    );
    await runFile(s.io, 'tests/mutations/g.ts', GUARD_FILE, SUITES);
    expect(s.seen.slice(1, 4)).toEqual([
      ORIGINAL,
      'export const readAll = (xs) => xs.slice(1);\n',
      'export const readAll = (xs) => xs.slice(1);\n',
    ]);
  });
});
