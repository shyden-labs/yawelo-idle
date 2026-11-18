/**
 * The members of a population that a function under test actually read (#368).
 *
 * A floor on a fixture's own length counts the fixture, not the check: a
 * check that skipped the last sail still sees `run.sails.length` at 12. So a
 * check over a population written in the test is handed watched copies, and
 * its search names what it read:
 *
 *     const { items, read } = watched(r.sails, 'day');
 *     const findings = gaps({ ...r, sails: items }, CI_BOUNDS);
 *     expect(searched(findings, { of: read, what: 'sails gaps read' })).toEqual([]);
 *     expect(floorBreach('targets/gaps-1-day', read.length)).toBeUndefined();
 *
 * `items` are proxies that read as the originals do; reading `key` of one
 * records its original in `read`, once, in the order first read. Reads of
 * other keys and of the originals record nothing. Members are told apart by
 * identity, so each must be its own object.
 */
export function watched<T extends object>(
  items: readonly T[],
  key: keyof T,
): { readonly items: T[]; readonly read: T[] } {
  const read: T[] = [];
  return {
    items: items.map(
      (item) =>
        new Proxy(item, {
          get(target, property, receiver): unknown {
            if (property === key && !read.includes(target)) read.push(target);
            return Reflect.get(target, property, receiver);
          },
        }),
    ),
    read,
  };
}
