import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MINIMUMS_RECORD_ENV,
  minimumBreach,
  minimumsBreach,
  readMinimums,
  type MinimumObservation,
} from '../minimums';
import type { Measured } from '../../scripts/minimums-method';

/**
 * `minimumBreach` judges a reach count against its measured minimum: at or
 * above passes, below fails, and 0 always fails (#84 AC8). In record mode it
 * writes what it saw and judges nothing, zeros included.
 */
const entry = (minimum: number): Measured => ({
  minimum,
  runs: 200,
  lowest: minimum + 3,
  mean: minimum + 20,
  sd: 3,
});
const MINIMUMS = {
  'group/units': entry(5),
  'group/refused-stale': entry(4),
  'group/refused-poor': entry(2),
};

const judge = (actual: number, seed?: number) =>
  minimumBreach('group/units', actual, {
    minimums: MINIMUMS,
    record: null,
    seed,
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('minimumBreach', () => {
  it('says nothing for a count at its minimum', () => {
    expect(judge(5)).toBeUndefined();
  });

  it('says nothing for a count above its minimum: growth is no breach', () => {
    expect(judge(500)).toBeUndefined();
  });

  it('names a count under its minimum, with the figures and the seed that replays it', () => {
    expect(judge(4, 77)).toBe(
      'group/units: read 4, under its measured minimum 5 (lowest 8 over 200 ' +
        'runs, mean 25.0). A real defect, never a re-run (#84): replay it ' +
        'with PROPERTIES_SEED=77 npm run test:properties',
    );
  });

  it('names the logs suite’s command for a count judged under packages/*/logs/ (spec §5.12)', () => {
    expect(
      minimumBreach('group/units', 4, {
        minimums: MINIMUMS,
        record: null,
        seed: 77,
        site: 'packages/core/logs/log.test.ts:47',
      }),
    ).toMatch(/: replay it with PROPERTIES_SEED=77 npm run test:logs$/);
  });

  it('names the properties suite’s command for a count judged under packages/*/properties/', () => {
    expect(
      minimumBreach('group/units', 4, {
        minimums: MINIMUMS,
        record: null,
        seed: 77,
        site: 'packages/core/properties/sim.test.ts:98',
      }),
    ).toMatch(/: replay it with PROPERTIES_SEED=77 npm run test:properties$/);
  });

  it('says so when no seed was set for the file', () => {
    expect(judge(4)).toMatch(
      /never a re-run \(#84\): no seed was set for this file$/,
    );
  });

  it('fails a count of 0, whatever is recorded', () => {
    expect(
      minimumBreach('group/units', 0, {
        minimums: { 'group/units': entry(0) },
        record: null,
        seed: 3,
      }),
    ).toBe(
      'group/units: reached nothing. The property no longer draws what it ' +
        'counts: a real defect, never a re-run (#84): replay it with ' +
        'PROPERTIES_SEED=3 npm run test:properties',
    );
  });

  it('fails a count of 0 for an id that is not recorded', () => {
    expect(
      minimumBreach('group/other', 0, { minimums: MINIMUMS, record: null }),
    ).toMatch(/^group\/other: reached nothing\./);
  });

  it('names an id that is not recorded, and how to record it', () => {
    expect(
      minimumBreach('group/other', 9, { minimums: MINIMUMS, record: null }),
    ).toBe(
      'group/other is not recorded in tests/minimums/group.json: push the ' +
        'commit to refs/minimums/<branch>, dispatch record-minimums on ' +
        'develop, then run npm run minimums:fetch <run-id>',
    );
  });

  it.each([-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s, which is not a count',
    (actual) => {
      expect(judge(actual)).toBe(
        `group/units: ${String(actual)} is not a count`,
      );
    },
  );

  it('reads the recorded minimums from the directory it is given', () => {
    const dir = mkdtempSync(join(tmpdir(), 'minimums-test-'));
    writeFileSync(
      join(dir, 'group.json'),
      JSON.stringify({ 'group/units': entry(5) }),
    );
    expect(readMinimums(dir)).toEqual({ 'group/units': entry(5) });
  });
});

describe('minimumsBreach, for counts named only at runtime', () => {
  const family = (
    counts: Readonly<Record<string, number>>,
    minimums: Readonly<Record<string, Measured>> = MINIMUMS,
  ) =>
    minimumsBreach('group/refused-', counts, {
      minimums,
      record: null,
      seed: 1,
    });

  it('says nothing when every recorded member is at or above its minimum', () => {
    expect(family({ stale: 4, poor: 9 })).toBeUndefined();
  });

  it('counts a recorded member the run never reached as 0, which fails', () => {
    expect(family({ stale: 4 })).toMatch(
      /^group\/refused-poor: reached nothing\./,
    );
  });

  it('names a member under its minimum', () => {
    expect(family({ stale: 3, poor: 2 })).toMatch(
      /^group\/refused-stale: read 3, under its measured minimum 4 /,
    );
  });

  it('names the logs suite’s command for a member judged under packages/*/logs/', () => {
    expect(
      minimumsBreach(
        'group/refused-',
        { stale: 3, poor: 2 },
        {
          minimums: MINIMUMS,
          record: null,
          seed: 5,
          site: 'packages/core/logs/log.test.ts:47',
        },
      ),
    ).toMatch(/: replay it with PROPERTIES_SEED=5 npm run test:logs$/);
  });

  it('refuses a member the record does not hold: a new kind to record', () => {
    expect(family({ stale: 4, poor: 2, odd: 6 })).toBe(
      'group/refused-odd is a new member of group/refused- with no measured ' +
        'minimum: push the commit to refs/minimums/<branch>, dispatch ' +
        'record-minimums on develop, then run npm run minimums:fetch <run-id>',
    );
  });

  it('names every breach, one a line, sorted by id', () => {
    expect(family({ stale: 1, odd: 6 })?.split('\n')).toEqual([
      expect.stringMatching(/^group\/refused-odd is a new member /),
      expect.stringMatching(/^group\/refused-poor: reached nothing\. /),
      expect.stringMatching(/^group\/refused-stale: read 1, /),
    ]);
  });

  it('refuses a family the record holds no member of', () => {
    expect(family({ stale: 4 }, { 'group/units': entry(5) })).toBe(
      'group/refused- has no measured minimums: push the commit to ' +
        'refs/minimums/<branch>, dispatch record-minimums on develop, then ' +
        'run npm run minimums:fetch <run-id>',
    );
  });

  it('refuses a family that is not group/prefix', () => {
    expect(
      minimumsBreach(
        'refused-',
        { stale: 4 },
        {
          minimums: MINIMUMS,
          record: null,
        },
      ),
    ).toBe('refused- is not a minimum family: write group/prefix');
  });

  it('refuses a member count that is not one', () => {
    expect(family({ stale: 4, poor: -1 })).toBe(
      'group/refused-poor: -1 is not a count',
    );
  });
});

describe('record mode', () => {
  const recordFile = () =>
    join(mkdtempSync(join(tmpdir(), 'minimums-test-')), 'seen.jsonl');
  const lines = (file: string) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as MinimumObservation);

  it('writes the id, the count, the calling file and line and the seed, and says nothing', () => {
    const file = recordFile();
    expect(
      minimumBreach('group/units', 7, { record: file, seed: 12 }),
    ).toBeUndefined();
    const seen = lines(file);
    expect(seen.map(({ id, actual, seed }) => ({ id, actual, seed }))).toEqual([
      { id: 'group/units', actual: 7, seed: 12 },
    ]);
    expect(seen[0]?.site).toMatch(/^tests\/unit\/minimums\.test\.ts:\d+$/);
  });

  it('records a count of 0 and judges nothing: a first round must see zeros', () => {
    const file = recordFile();
    expect(minimumBreach('group/units', 0, { record: file })).toBeUndefined();
    expect(lines(file)).toEqual([
      expect.objectContaining({ id: 'group/units', actual: 0, seed: null }),
    ]);
  });

  it('records each member of a family with the family it belongs to', () => {
    const file = recordFile();
    expect(
      minimumsBreach(
        'group/refused-',
        { stale: 2, poor: 0 },
        {
          record: file,
          seed: 4,
        },
      ),
    ).toBeUndefined();
    expect(
      lines(file).map(({ id, actual, family }) => ({ id, actual, family })),
    ).toEqual([
      { id: 'group/refused-poor', actual: 0, family: 'group/refused-' },
      { id: 'group/refused-stale', actual: 2, family: 'group/refused-' },
    ]);
  });

  it('records when the environment names a file and no option overrides it', () => {
    const file = recordFile();
    vi.stubEnv(MINIMUMS_RECORD_ENV, file);
    expect(minimumBreach('group/units', 2)).toBeUndefined();
    expect(lines(file)).toEqual([expect.objectContaining({ actual: 2 })]);
  });

  it('judges when an option says so, whatever the environment says', () => {
    vi.stubEnv(MINIMUMS_RECORD_ENV, recordFile());
    expect(judge(4)).toMatch(/read 4, under its measured minimum 5/);
  });

  it('refuses a count that is not one in record mode too, writing nothing', () => {
    const file = recordFile();
    expect(minimumBreach('group/units', -2, { record: file })).toBe(
      'group/units: -2 is not a count',
    );
    expect(() => readFileSync(file)).toThrow(/ENOENT/);
  });
});
