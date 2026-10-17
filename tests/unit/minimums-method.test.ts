import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assess,
  minimumsFileOf,
  raiseFactor,
  readMinimumsDir,
  summarise,
  writeMinimums,
  type Measured,
} from '../../scripts/minimums-method';

/**
 * The measured-minimum method (#84 spec §4): a reach count sampled over at
 * least 200 fresh-seed runs takes min(lowest, floor(mean - 6 sd)), or a
 * finding when that cannot be checked safely. Every expected figure below is
 * worked by hand, never computed by the code under test.
 */

const scratch = (): string => mkdtempSync(join(tmpdir(), 'minimums-test-'));

const SOUND: Measured = {
  minimum: 88,
  runs: 200,
  lowest: 90,
  mean: 100,
  sd: 2,
};

describe('summarise', () => {
  it('gives the runs, the lowest, the mean and the sample standard deviation', () => {
    expect(summarise([3, 5, 7])).toEqual({
      runs: 3,
      lowest: 3,
      mean: 5,
      sd: 2,
    });
  });

  it('gives a spread of 0 to identical counts', () => {
    expect(summarise([4, 4])).toEqual({ runs: 2, lowest: 4, mean: 4, sd: 0 });
  });

  it('refuses fewer than two runs, which have no sample spread', () => {
    expect(() => summarise([4])).toThrow(
      'a spread needs two runs or more, not 1',
    );
  });
});

describe('assess', () => {
  it('takes six spreads under the mean when that is under the lowest count', () => {
    expect(assess({ runs: 200, lowest: 90, mean: 100, sd: 2 })).toEqual({
      kind: 'minimum',
      minimum: 88,
    });
  });

  it('takes the lowest count when that is under six spreads below the mean', () => {
    expect(assess({ runs: 200, lowest: 80, mean: 100, sd: 2 })).toEqual({
      kind: 'minimum',
      minimum: 80,
    });
  });

  it('rounds six spreads under the mean down to a whole count', () => {
    expect(assess({ runs: 200, lowest: 90, mean: 100.9, sd: 2 })).toEqual({
      kind: 'minimum',
      minimum: 88,
    });
  });

  it('accepts a minimum of exactly 1', () => {
    expect(assess({ runs: 200, lowest: 4, mean: 7, sd: 1 })).toEqual({
      kind: 'minimum',
      minimum: 1,
    });
  });

  it('finds a count too small to check, naming the factor its runs must rise by', () => {
    expect(assess({ runs: 200, lowest: 3, mean: 9, sd: 3 })).toEqual({
      kind: 'too-small',
      factor: 8,
    });
  });

  it('finds a count whose lowest run reached nothing too small, however high its mean', () => {
    expect(assess({ runs: 200, lowest: 0, mean: 100, sd: 2 })).toEqual({
      kind: 'too-small',
      factor: 2,
    });
  });

  it('finds a count that never spread over its runs', () => {
    expect(assess({ runs: 200, lowest: 60, mean: 60, sd: 0 })).toEqual({
      kind: 'no-spread',
    });
  });

  it('finds a count that reached nothing in any run', () => {
    expect(assess({ runs: 200, lowest: 0, mean: 0, sd: 0 })).toEqual({
      kind: 'never-reached',
    });
  });

  it('finds 199 runs too few, and accepts 200', () => {
    expect(assess({ runs: 199, lowest: 90, mean: 100, sd: 2 })).toEqual({
      kind: 'too-few',
    });
  });
});

describe('raiseFactor', () => {
  // Least k with k·mean − 6·√k·sd ≥ 1, then ×1.5 rounded up.
  it('gives 8 for mean 9 and spread 3 (least k 5: 4.75 clears 1, k 4 gives 0)', () => {
    expect(raiseFactor(9, 3)).toBe(8);
  });

  it('gives 33 for mean 2 and spread 1.5 (least k 22: 1.79 clears 1, k 21 gives 0.76)', () => {
    expect(raiseFactor(2, 1.5)).toBe(33);
  });

  it('gives 2 when the count already clears the line at its own runs', () => {
    expect(raiseFactor(100, 2)).toBe(2);
  });

  it('refuses a count with no mean, which no factor raises', () => {
    expect(() => raiseFactor(0, 0)).toThrow(
      'a count that never reached anything has no factor',
    );
  });
});

describe('minimumsFileOf', () => {
  it('records group/name in tests/minimums/<group>.json', () => {
    expect(minimumsFileOf('core-sim/split-on-edge')).toBe(
      'tests/minimums/core-sim.json',
    );
  });

  it('refuses an id that names no group', () => {
    expect(() => minimumsFileOf('split-on-edge')).toThrow(
      'split-on-edge is not a minimum id: write group/name',
    );
  });
});

describe('readMinimumsDir', () => {
  it('reads every entry of every group file', () => {
    const dir = scratch();
    writeFileSync(
      join(dir, 'core-sim.json'),
      JSON.stringify({ 'core-sim/on-edge': SOUND }),
    );
    expect(readMinimumsDir(dir)).toEqual({ 'core-sim/on-edge': SOUND });
  });

  it('refuses an entry missing a figure, one with another, and one of another group', () => {
    const dir = scratch();
    const noSpread = {
      minimum: SOUND.minimum,
      runs: SOUND.runs,
      lowest: SOUND.lowest,
      mean: SOUND.mean,
    };
    writeFileSync(
      join(dir, 'core-sim.json'),
      JSON.stringify({
        'core-sim/a': noSpread,
        'core-sim/b': { ...SOUND, extra: 1 },
        'core-log/c': SOUND,
      }),
    );
    expect(() => readMinimumsDir(dir)).toThrow(
      [
        `${dir} cannot be read:`,
        '  core-sim.json: core-sim/a does not hold exactly minimum, runs, lowest, mean, sd',
        '  core-sim.json: core-sim/b does not hold exactly minimum, runs, lowest, mean, sd',
        '  core-sim.json: core-log/c belongs in core-log.json',
      ].join('\n'),
    );
  });

  it('refuses figures that are not counts, and a mean or spread that is negative or not finite', () => {
    const dir = scratch();
    writeFileSync(
      join(dir, 'g.json'),
      JSON.stringify({
        'g/a': { ...SOUND, minimum: 1.5 },
        'g/b': { ...SOUND, runs: -1 },
        'g/c': { ...SOUND, mean: -1 },
        'g/d': { ...SOUND, sd: null },
      }),
    );
    expect(() => readMinimumsDir(dir)).toThrow(
      [
        `${dir} cannot be read:`,
        '  g.json: g/a minimum is 1.5, not a count',
        '  g.json: g/b runs is -1, not a count',
        '  g.json: g/c mean is -1, not a finite figure of 0 or more',
        '  g.json: g/d sd is null, not a finite figure of 0 or more',
      ].join('\n'),
    );
  });

  it('refuses a file that is not a group’s JSON object', () => {
    const dir = scratch();
    writeFileSync(join(dir, 'notes.txt'), '');
    writeFileSync(join(dir, 'Bad_Name.json'), '{}');
    writeFileSync(join(dir, 'broken.json'), '{');
    writeFileSync(join(dir, 'list.json'), '[]');
    expect(() => readMinimumsDir(dir)).toThrow(
      [
        `${dir} cannot be read:`,
        '  Bad_Name.json is not named for a group',
        '  broken.json is not valid JSON',
        '  list.json does not hold an object of minimums',
        '  notes.txt is not a .json minimums file',
      ].join('\n'),
    );
  });
});

describe('writeMinimums', () => {
  it('writes one sorted file per group and reads back what it wrote', () => {
    const dir = scratch();
    const next = {
      'core-sim/b': SOUND,
      'core-log/a': { ...SOUND, minimum: 5 },
      'core-sim/a': { ...SOUND, minimum: 7 },
    };
    expect(writeMinimums(dir, next)).toEqual([
      'core-log.json',
      'core-sim.json',
    ]);
    expect(readdirSync(dir).sort()).toEqual(['core-log.json', 'core-sim.json']);
    const written = JSON.parse(
      readFileSync(join(dir, 'core-sim.json'), 'utf8'),
    ) as Record<string, Measured>;
    expect(Object.keys(written)).toEqual(['core-sim/a', 'core-sim/b']);
    expect(readMinimumsDir(dir)).toEqual(next);
  });

  it('leaves a file whose text would not change, and writes the one beside it that would', () => {
    const dir = scratch();
    writeMinimums(dir, { 'g/a': SOUND });
    expect(writeMinimums(dir, { 'g/a': SOUND, 'h/a': SOUND })).toEqual([
      'h.json',
    ]);
  });

  it('removes a group file the next record holds no id of: minimums are re-measured whole', () => {
    const dir = scratch();
    writeMinimums(dir, { 'g/a': SOUND, 'h/a': SOUND });
    expect(writeMinimums(dir, { 'g/a': SOUND })).toEqual(['h.json (removed)']);
    expect(readdirSync(dir)).toEqual(['g.json']);
  });
});
