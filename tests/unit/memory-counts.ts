import type { Counts } from '../../apps/sync-worker/src/limit';

/**
 * Request counts held in memory, as D1 holds them in the Worker: by route,
 * key and window end (#164 AC2). Every key it was given is kept in `keys`.
 */
export function memoryCounts(): Counts & { readonly keys: string[] } {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    add: (routePath, key, windowEnd) => {
      keys.push(key);
      const id = `${routePath} ${key} ${String(windowEnd)}`;
      const count = (counts.get(id) ?? 0) + 1;
      counts.set(id, count);
      return Promise.resolve(count);
    },
  };
}
