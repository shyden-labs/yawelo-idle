import { describe, expect, it } from 'vitest';
import {
  artifactPrefix,
  describeMinimumMoves,
  fetchedMinimums,
  parseRun,
  reportTable,
  sampled,
  type RecordedRun,
} from '../../scripts/fetch-minimums.ts';
import type { Measured } from '../../scripts/minimums-method.ts';
import type { MinimumObservation } from '../minimums.ts';

/**
 * `npm run minimums:fetch <run>` (#84, spec §5.7): every shard's runs read
 * back, checked, turned into one sample per count, and the measured minimums
 * written for the counts the method can bound. Every expected figure below is
 * worked by hand.
 */

const SIM = 'packages/core/properties/sim.test.ts:9';
const LOG = 'packages/core/logs/log.test.ts:40';

const line = (
  id: string,
  actual: number,
  seed: number | null,
  site: string = SIM,
  family?: string,
): MinimumObservation =>
  family === undefined
    ? { id, actual, site, seed }
    : { id, actual, site, seed, family };

const run = (name: string, lines: MinimumObservation[]): RecordedRun => ({
  name,
  lines,
});

/** `n` runs alternating `low` and `high`, one count each, a fresh seed a run. */
const alternating = (id: string, n: number, low: number, high: number) =>
  Array.from({ length: n }, (_, i) =>
    run(`r${String(i)}`, [line(id, i % 2 === 0 ? low : high, i)]),
  );

describe('artifactPrefix', () => {
  it('names a commit’s shards minimums-<sha>-', () => {
    expect(artifactPrefix('a'.repeat(40))).toBe(`minimums-${'a'.repeat(40)}-`);
  });
});

describe('parseRun', () => {
  it('reads one observation a line, skipping the final newline', () => {
    expect(
      parseRun(
        's1/run-1.jsonl',
        '{"id":"g/a","actual":3,"site":"x.ts:1","seed":5}\n',
      ),
    ).toEqual(run('s1/run-1.jsonl', [line('g/a', 3, 5, 'x.ts:1')]));
  });

  it('refuses a line that is not an observation, naming the run and line', () => {
    expect(() =>
      parseRun('s1/run-1.jsonl', '{"id":"g/a","actual":3}\nnot json\n'),
    ).toThrow(
      's1/run-1.jsonl line 1 is not an observation\ns1/run-1.jsonl line 2 is not an observation',
    );
  });

  it('refuses an empty run: its record switch reached no check', () => {
    expect(() => parseRun('s1/run-1.jsonl', '')).toThrow(
      's1/run-1.jsonl recorded nothing',
    );
  });
});

describe('sampled', () => {
  it('gives each count its values in run order', () => {
    expect(
      sampled([
        run('a', [line('g/x', 3, 1), line('g/y', 5, 1)]),
        run('b', [line('g/x', 4, 2), line('g/y', 6, 2)]),
      ]),
    ).toEqual({ samples: { 'g/x': [3, 4], 'g/y': [5, 6] }, refusals: [] });
  });

  it('counts a family member a run did not reach as 0 in that run', () => {
    expect(
      sampled([
        run('a', [line('g/k-stale', 2, 1, LOG, 'g/k-')]),
        run('b', [line('g/k-poor', 1, 2, LOG, 'g/k-')]),
      ]),
    ).toEqual({
      samples: { 'g/k-poor': [0, 1], 'g/k-stale': [2, 0] },
      refusals: [],
    });
  });

  it('refuses no runs at all', () => {
    expect(sampled([]).refusals).toEqual(['no runs were recorded']);
  });

  it('refuses an id asserted twice in one run', () => {
    expect(
      sampled([run('a', [line('g/x', 3, 1), line('g/x', 4, 1)])]).refusals,
    ).toEqual(['g/x is asserted twice in a']);
  });

  it('refuses an id asserted from two places', () => {
    expect(
      sampled([
        run('a', [line('g/x', 3, 1)]),
        run('b', [line('g/x', 3, 2, 'other.test.ts:4')]),
      ]).refusals,
    ).toEqual([`g/x is asserted from two places: ${SIM}, other.test.ts:4`]);
  });

  it('refuses an id recorded in one family and outside it', () => {
    expect(
      sampled([
        run('a', [line('g/k-x', 3, 1, LOG, 'g/k-')]),
        run('b', [line('g/k-x', 3, 2, LOG)]),
      ]).refusals,
    ).toEqual(['g/k-x is recorded under families g/k-, (none)']);
  });

  it('refuses a run whose counts outside families differ from the first run’s', () => {
    expect(
      sampled([
        run('a', [line('g/x', 3, 1), line('g/y', 3, 1)]),
        run('b', [line('g/x', 3, 2), line('g/z', 3, 2)]),
      ]).refusals,
    ).toEqual(['b lacks g/y', 'b adds g/z']);
  });

  it('refuses a seed one file ran at in two runs: the cases repeated', () => {
    expect(
      sampled([run('a', [line('g/x', 3, 7)]), run('b', [line('g/x', 4, 7)])])
        .refusals,
    ).toEqual([
      'packages/core/properties/sim.test.ts ran at seed 7 in both a and b: the cases repeated',
    ]);
  });

  it('accepts one seed shared by two files in a run, and by one file’s ids, refusing only the run beside them that holds no seed', () => {
    expect(
      sampled([
        run('a', [line('g/x', 3, 7), line('g/y', 2, 7, LOG)]),
        run('b', [line('g/x', 4, 8), line('g/y', 2, 9, LOG)]),
        run('c', [line('g/x', 4, null), line('g/y', 2, 5, LOG)]),
      ]).refusals,
    ).toEqual([
      'g/x was recorded with no seed in c: record it in the properties suite',
    ]);
  });

  it('refuses two seeds for one file in one run', () => {
    expect(
      sampled([run('a', [line('g/x', 3, 1), line('g/y', 3, 2)])]).refusals,
    ).toEqual([
      'packages/core/properties/sim.test.ts ran at seeds 1 and 2 in a',
    ]);
  });

  it('refuses a count recorded with no seed', () => {
    expect(sampled([run('a', [line('g/x', 3, null)])]).refusals).toEqual([
      'g/x was recorded with no seed in a: record it in the properties suite',
    ]);
  });
});

describe('fetchedMinimums', () => {
  const SOUND: Measured = {
    minimum: 87,
    runs: 200,
    lowest: 98,
    mean: 100,
    sd: Math.sqrt(800 / 199),
  };

  it('writes the minimum the method gives for each count', () => {
    const { samples } = sampled(alternating('g/x', 200, 98, 102));
    const { next, findings, refusals } = fetchedMinimums({}, samples);
    expect({ next, findings, refusals }).toEqual({
      next: { 'g/x': SOUND },
      findings: [],
      refusals: [],
    });
  });

  it('writes no minimum for a count too small to check, and lists it with its factor', () => {
    // Mean 2, sd 2·√(200/199) ≈ 2.005: least k with 2k − 6√k·2.005 ≥ 1 is
    // 38 (76 − 74.16 = 1.84; k 37 gives 74 − 73.18 = 0.82), ×1.5 → 57.
    const { samples } = sampled(alternating('g/x', 200, 0, 4));
    expect(fetchedMinimums({}, samples)).toMatchObject({
      next: {},
      findings: [{ id: 'g/x', kind: 'too-small', factor: 57 }],
      refusals: [],
    });
  });

  it('refuses fewer than 200 runs', () => {
    const { samples } = sampled(alternating('g/x', 199, 98, 102));
    expect(fetchedMinimums({}, samples).refusals).toEqual([
      'only 199 runs were recorded: 200 are needed',
    ]);
  });

  it('refuses a minimum recorded here that the run does not hold', () => {
    const { samples } = sampled(alternating('g/x', 200, 98, 102));
    expect(fetchedMinimums({ 'g/gone': SOUND }, samples).refusals).toEqual([
      'g/gone is recorded here but not in the run',
    ]);
  });
});

describe('describeMinimumMoves', () => {
  const at = (minimum: number): Measured => ({
    minimum,
    runs: 200,
    lowest: minimum,
    mean: minimum + 10,
    sd: 1,
  });

  it('names each minimum that moved, appeared or went, and nothing else', () => {
    expect(
      describeMinimumMoves(
        { 'g/a': at(5), 'g/b': at(7), 'g/c': at(9) },
        { 'g/a': at(5), 'g/b': at(8), 'g/d': at(3) },
      ),
    ).toEqual(['g/b: 7 → 8', 'g/c: 9 → none', 'g/d: none → 3']);
  });
});

describe('reportTable', () => {
  it('prints every count’s figures and its minimum or finding, with the method', () => {
    const { samples } = sampled([...alternating('g/x', 200, 98, 102)]);
    const { rows } = fetchedMinimums({}, samples);
    expect(reportTable(rows)).toBe(
      [
        'Minimum = min(lowest, floor(mean − 6 sd)) over 200 or more fresh-seed runs (#84). A factor assumes the count is a sum over runs.',
        '',
        '| Count | Runs | Lowest | Mean | SD | Mean − 6 SD | Minimum or finding |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| `g/x` | 200 | 98 | 100.00 | 2.01 | 87.97 | 87 |',
        '',
      ].join('\n'),
    );
  });

  it('names each finding in words', () => {
    const rows = [
      ...fetchedMinimums({}, sampled(alternating('g/a', 200, 0, 4)).samples)
        .rows,
      ...fetchedMinimums({}, sampled(alternating('g/b', 200, 5, 5)).samples)
        .rows,
      ...fetchedMinimums({}, sampled(alternating('g/c', 200, 0, 0)).samples)
        .rows,
    ];
    expect(
      reportTable(rows)
        .split('\n')
        .filter((l) => l.startsWith('| `'))
        .map((l) => l.split(' | ').at(-1)),
    ).toEqual([
      'too small: raise its runs ×57 |',
      'no spread: fixed by construction, or barely sampled |',
      'never reached |',
    ]);
  });
});
