/**
 * Request counts kept in D1 (#164 AC5). Not written yet (TDD stub).
 */
import type { Counts } from './limit';
import type { SyncEnv } from './routes';

export function d1Counts(_db: SyncEnv['DB']): Counts {
  return {
    add: () => Promise.reject(new Error('d1Counts: not written yet')),
  };
}
