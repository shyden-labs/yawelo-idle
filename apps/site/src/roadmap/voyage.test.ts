import { describe, expect, it } from 'vitest';
import { fill, islandName } from './voyage';

describe('fill (#827)', () => {
  it('puts each value in its place', () => {
    expect(fill('{n} stories and {points} points', { n: 2, points: 8 })).toBe(
      '2 stories and 8 points',
    );
  });

  it('leaves an unknown name as it was written', () => {
    expect(fill('{n} and {missing}', { n: 1 })).toBe('1 and {missing}');
  });

  it('writes zero as 0', () => {
    expect(fill('{n} points', { n: 0 })).toBe('0 points');
  });
});

describe('islandName (#844)', () => {
  const copy = {
    unnamedIsland: 'Milestone {n}',
    unnamedNoMilestone: 'More to come',
  };

  it('is the Public title when there is one', () => {
    expect(islandName({ name: 'The core', milestone: 1 }, copy)).toBe(
      'The core',
    );
  });

  it('is the milestone while there is none', () => {
    expect(islandName({ name: null, milestone: 3 }, copy)).toBe('Milestone 3');
  });

  it('is a plain placeholder with neither', () => {
    expect(islandName({ name: null, milestone: null }, copy)).toBe(
      'More to come',
    );
  });
});
