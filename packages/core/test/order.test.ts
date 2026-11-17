import { describe, expect, it } from 'vitest';
import { byCodeUnit } from '../src/order';

/**
 * `byCodeUnit` is the explicit form of `Array.prototype.sort()`'s default
 * order (#1007): UTF-16 code units, never the runtime's locale. A hash, an
 * error naming the first unexpected field and a report's order all have to
 * read the same on every machine.
 */
describe('byCodeUnit (#1007)', () => {
  it('puts capitals before lower case, as code units do', () => {
    expect(['b', 'a', 'B', 'A'].sort(byCodeUnit)).toEqual(['A', 'B', 'a', 'b']);
  });

  it('puts an accented letter after every ASCII letter', () => {
    expect(['é', 'z', 'e'].sort(byCodeUnit)).toEqual(['e', 'z', 'é']);
  });

  it('puts a prefix before the longer string it starts', () => {
    expect(['ab', 'a'].sort(byCodeUnit)).toEqual(['a', 'ab']);
  });

  it('reads equal strings as equal', () => {
    expect(byCodeUnit('same', 'same')).toBe(0);
  });

  it('agrees with the default sort on mixed keys', () => {
    const keys = ['é', 'B', 'a', '_', '10', '9', 'Z', 'b', 'ä', ''];
    expect([...keys].sort(byCodeUnit)).toEqual([...keys].sort());
  });
});
