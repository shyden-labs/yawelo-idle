import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  counted,
  withLock,
  type LedgerPaths,
} from '../../scripts/google-ledger';
import { machineDeps } from '../../scripts/google-read-back';

/**
 * #638 AC5: two read-backs at once, on the real file system, against a
 * temporary ledger and lock. The second waits on the first's lock, and the
 * ledger ends with both counts: neither run erases the other's. Google is
 * stood in by a send that takes a moment.
 */
let dir: string | undefined;

afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('two read-backs at once (#638 AC5)', () => {
  it('end with both counts on the ledger, one after the other', async () => {
    dir = mkdtempSync(join(tmpdir(), 'google-ledger-'));
    const paths: LedgerPaths = {
      ledger: join(dir, 'ledger.json'),
      lock: join(dir, 'google-translate.lock'),
    };
    const deps = machineDeps(dir);
    const order: string[] = [];
    const run = (name: string, characters: number) =>
      withLock(paths, deps, async () => {
        order.push(`${name} in`);
        await counted(paths, deps, characters, settle);
        order.push(`${name} out`);
      });

    await Promise.all([run('first', 120), run('second', 80)]);

    // Summed over days, so a Google day turning mid-test cannot fail it.
    const ledger = JSON.parse(readFileSync(paths.ledger, 'utf8')) as Record<
      string,
      number
    >;
    expect(Object.values(ledger).reduce((a, b) => a + b, 0)).toBe(200);
    expect(order).toEqual(['first in', 'first out', 'second in', 'second out']);
  });
});
