import { describe, expect, it } from 'vitest';
import { minus } from './burn-down';

describe('minus', () => {
  it('takes one occurrence per match, so two identical sites need two entries', () => {
    expect(minus(['a', 'a', 'b'], ['a'])).toEqual(['a', 'b']);
  });

  it('keeps every item no entry matches, in order', () => {
    expect(minus(['c', 'a', 'b'], ['x'])).toEqual(['c', 'a', 'b']);
  });

  it('leaves nothing when every item is matched', () => {
    expect(minus(['a', 'b', 'a'], ['a', 'b', 'a'])).toEqual([]);
  });

  it('ignores entries left over once their items are taken', () => {
    expect(minus(['a'], ['a', 'a', 'z'])).toEqual([]);
  });
});
