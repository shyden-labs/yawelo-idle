import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { googleCallsIn } from '../unit/google-callers';
import { committableFiles } from '../unit/tracked-files';

/**
 * #638 AC1: the repo has one Google Cloud Translation caller, the read-back
 * under the shared lock and ledger. A second caller would spend the shared
 * key's free tier uncounted. Each file is judged by tests/unit/google-callers.ts.
 */
const TEXT = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.svelte',
  '.astro',
  '.json',
  '.jsonc',
  '.yml',
  '.yaml',
  '.sh',
  '.py',
]);

describe('Google Cloud Translation callers (#638)', () => {
  it('are scripts/google-read-back.ts alone', () => {
    const callers = committableFiles()
      .filter((path) => TEXT.has(extname(path)))
      .filter((path) => googleCallsIn(readFileSync(path, 'utf8')));
    expect(callers).toEqual(['scripts/google-read-back.ts']);
  });
});
