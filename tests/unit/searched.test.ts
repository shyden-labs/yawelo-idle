import { describe, expect, it } from 'vitest';
import { floorBreach } from '../floors';
import { againstControl, againstTwin, searched } from '../searched';

/**
 * `searched` puts the population a finding list was drawn from inside the
 * assertion itself (#361): `expect(findings).toEqual([])` is green both when
 * a guard read everything and found nothing and when it read nothing at all.
 * Each search here checks its population's floor like any other.
 */

describe('searched', () => {
  it('returns the findings it was given, untouched', () => {
    const findings = ['a finding'];
    const units = ['a unit'];
    expect(searched(findings, { of: units, what: 'units' })).toBe(findings);
    expect(floorBreach('searched/untouched', units.length)).toBeUndefined();
  });

  it('passes an empty finding list over a live population', () => {
    const units = ['a unit', 'another'];
    expect(searched([], { of: units, what: 'units' })).toEqual([]);
    expect(floorBreach('searched/live', units.length)).toBeUndefined();
  });

  it('passes a count of at least one', () => {
    const count = 3;
    expect(searched([], { of: count, what: 'units' })).toEqual([]);
    expect(floorBreach('searched/count', count)).toBeUndefined();
  });

  // Members that are values a guard could be hunting, so they count.
  it.each([
    ['zero', 0],
    ['false', false],
    ['a non-blank string', 'x'],
    ['a list holding something', [0]],
    ['an object holding a key', { k: undefined }],
    ['a set holding something', new Set([0])],
    ['a map holding something', new Map([[0, 0]])],
  ])('counts %s as a live member', (_what, member) => {
    const members = [member];
    expect(searched([], { of: members, what: 'units' })).toEqual([]);
    expect(floorBreach('searched/member', members.length)).toBeUndefined();
  });

  it('refuses an empty population, naming it', () => {
    expect(() => searched([], { of: [], what: 'built pages' })).toThrow(
      /searched no built pages/,
    );
  });

  // Six blank headers are six entries and no content (#112 in shyden.co.uk):
  // a population of empties is as dead as an empty one.
  it.each([
    ['a blank string', '  '],
    ['an empty string', ''],
    ['an empty list', []],
    ['an empty object', {}],
    ['an empty set', new Set()],
    ['an empty map', new Map()],
    ['null', null],
    ['undefined', undefined],
  ])('refuses a population whose only member is %s', (_what, member) => {
    expect(() => searched([], { of: [member], what: 'rows' })).toThrow(
      /searched no rows/,
    );
  });

  it.each([
    ['zero', 0],
    ['a negative count', -1],
    ['a fraction', 1.5],
    ['NaN', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
  ])('refuses %s as a count', (_what, count) => {
    expect(() => searched([], { of: count, what: 'rows' })).toThrow(
      /searched no rows/,
    );
  });
});

/** Splits on commas: nothing in, nothing out, and one word per field. */
const fields = (line: string): string[] =>
  line.split(',').filter((field) => field !== '');

describe('againstControl', () => {
  it('returns what the run finds in the empty input', () => {
    expect(againstControl(fields, { input: '', control: 'a,b' })).toEqual([]);
  });

  it('runs the control first, then the input, and returns the input’s result', () => {
    const seen: string[] = [];
    const run = (given: string): string[] => {
      seen.push(given);
      return fields(given);
    };
    expect(againstControl(run, { input: '', control: 'x' })).toEqual([]);
    expect(seen).toEqual(['x', '']);
  });

  it('refuses an input with content: a population checks a floor instead', () => {
    expect(() =>
      againstControl(fields, { input: 'a', control: 'a,b' }),
    ).toThrow(/againstControl is for an empty input/);
  });

  it('refuses a control that finds nothing: a dead run passes otherwise', () => {
    expect(() => againstControl(fields, { input: '', control: ',' })).toThrow(
      /the control found nothing/,
    );
  });

  it('leaves a run that ignores its input to fail the absence assertion', () => {
    // Its control finds something, so its input finds the same thing, and
    // the `toEqual([])` a real use writes would fail.
    const ignoring = (): string[] => ['always'];
    expect(againstControl(ignoring, { input: '', control: 'a' })).toEqual([
      'always',
    ]);
  });
});

/** Every `bad` word in a sample: a clean sample finds nothing. */
const bad = (sample: string): string[] =>
  sample.split(' ').filter((word) => word === 'bad');

describe('againstTwin', () => {
  it('returns what the run finds in the clean sample', async () => {
    expect(
      await againstTwin(bad, { input: 'good text', twin: 'good bad text' }),
    ).toEqual([]);
  });

  it('runs the twin first, then the sample, and returns the sample’s result', async () => {
    const seen: string[] = [];
    const run = (given: string): string[] => {
      seen.push(given);
      return bad(given);
    };
    expect(await againstTwin(run, { input: 'good', twin: 'bad' })).toEqual([]);
    expect(seen).toEqual(['bad', 'good']);
  });

  it('awaits a run that answers later, as a linter does', async () => {
    const later = (sample: string): Promise<string[]> =>
      Promise.resolve(bad(sample));
    expect(await againstTwin(later, { input: 'good', twin: 'bad' })).toEqual(
      [],
    );
  });

  it('refuses an empty sample: that is againstControl’s', () => {
    expect(() => againstTwin(bad, { input: ' ', twin: 'bad' })).toThrow(
      /an empty input takes againstControl/,
    );
  });

  it('refuses a sample that is not text: a list is a population', () => {
    expect(() =>
      againstTwin(bad, { input: ['good'] as unknown as string, twin: 'bad' }),
    ).toThrow(/one sample written as text/);
  });

  it('refuses a twin that is not text', () => {
    expect(() =>
      againstTwin(bad, { input: 'good', twin: ['bad'] as unknown as string }),
    ).toThrow(/one sample written as text/);
  });

  it('refuses a twin the same as the sample: it proves nothing', () => {
    expect(() => againstTwin(bad, { input: 'good', twin: 'good' })).toThrow(
      /the twin must differ from the sample/,
    );
  });

  it('refuses a twin that finds nothing: a dead run passes otherwise', async () => {
    await expect(
      againstTwin(bad, { input: 'good', twin: 'also good' }),
    ).rejects.toThrow(/the twin found nothing/);
  });

  it('leaves a run that ignores its sample to fail the absence assertion', async () => {
    // Its twin finds something, so its sample finds the same thing, and the
    // `toEqual([])` a real use writes would fail.
    const ignoring = (): string[] => ['always'];
    expect(await againstTwin(ignoring, { input: 'good', twin: 'bad' })).toEqual(
      ['always'],
    );
  });
});
