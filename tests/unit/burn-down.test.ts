import { describe, expect, it } from 'vitest';
import { minus } from './burn-down';
import { floorBreach } from '../floors';
import { searched } from '../searched';

describe('minus', () => {
  it('takes one occurrence per match, so two identical sites need two entries', () => {
    expect(minus(['a', 'a', 'b'], ['a'])).toEqual(['a', 'b']);
  });

  it('keeps every item no entry matches, in order', () => {
    expect(minus(['c', 'a', 'b'], ['x'])).toEqual(['c', 'a', 'b']);
  });

  it('leaves nothing when every item is matched', () => {
    const items = ['a', 'b', 'a'];
    expect(
      searched(minus(items, ['a', 'b', 'a']), { of: items, what: 'items' }),
    ).toEqual([]);
    expect(
      floorBreach('burn-down/every item matched', items.length),
    ).toBeUndefined();
  });

  it('ignores entries left over once their items are taken', () => {
    const items = ['a'];
    expect(
      searched(minus(items, ['a', 'a', 'z']), { of: items, what: 'items' }),
    ).toEqual([]);
    expect(
      floorBreach('burn-down/entries left over', items.length),
    ).toBeUndefined();
  });
});
