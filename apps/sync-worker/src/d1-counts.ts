/**
 * Request counts kept in D1 (#164 AC5; Shyden, 2026-11-18): one exact count
 * shared by every isolate and location. Each request runs one batch, which
 * D1 applies as a transaction: it deletes every count whose window has ended
 * (no scheduled job; Shyden, 2026-11-19), then adds one to this request's
 * count and reads the new value back.
 */
import type { Counts } from './limit';
import type { SyncEnv } from './routes';

const DELETE_FINISHED = 'DELETE FROM rate_counts WHERE window_end <= ?';

const ADD_ONE = `INSERT INTO rate_counts (route, key, window_end, count)
  VALUES (?, ?, ?, 1)
  ON CONFLICT (route, key, window_end) DO UPDATE SET count = count + 1
  RETURNING count`;

/** One statement's answer in a D1 batch, as far as the count needs it. */
interface BatchResult {
  readonly results?: readonly { readonly count?: unknown }[];
}

export function d1Counts(db: SyncEnv['DB']): Counts {
  return {
    add: async (routePath, key, windowEnd, nowSeconds) => {
      const answers = (await db.batch([
        db.prepare(DELETE_FINISHED).bind(nowSeconds),
        db.prepare(ADD_ONE).bind(routePath, key, windowEnd),
      ])) as readonly BatchResult[];
      const count = answers[1]?.results?.[0]?.count;
      if (typeof count !== 'number')
        throw new Error('rate_counts: the new count was not returned');
      return count;
    },
  };
}
