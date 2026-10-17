import { describe, expect, it } from 'vitest';
import { watched } from '../watched';

/** Three sails a check could read, each its own object. */
const sails = () => [
  { destination: 1, day: 0.5 },
  { destination: 2, day: 2.5 },
  { destination: 3, day: 4.5 },
];

describe('watched', () => {
  it('records each member whose key was read, in the order first read', () => {
    const given = sails();
    const { items, read } = watched(given, 'day');
    expect([items[2]?.day, items[0]?.day]).toStrictEqual([4.5, 0.5]);
    expect(read).toStrictEqual([given[2], given[0]]);
  });

  it('records a member once however often its key is read', () => {
    const given = sails();
    const { items, read } = watched(given, 'day');
    expect([items[1]?.day, items[1]?.day]).toStrictEqual([2.5, 2.5]);
    expect(read).toStrictEqual([given[1]]);
  });

  it('does not record a member read only for another key', () => {
    const given = sails();
    const { items, read } = watched(given, 'day');
    expect([items[0]?.destination, items[1]?.day]).toStrictEqual([1, 2.5]);
    expect(read).toStrictEqual([given[1]]);
  });

  it('does not record a read of the original member', () => {
    const given = sails();
    const { items, read } = watched(given, 'day');
    expect([given[0]?.day, items[1]?.day]).toStrictEqual([0.5, 2.5]);
    expect(read).toStrictEqual([given[1]]);
  });

  it('hands back members that read as the originals do', () => {
    const given = sails();
    expect(watched(given, 'day').items).toStrictEqual(given);
  });
});
