import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { skipCommentsIn } from '../unit/coverage-skip';
import { committableFiles } from '../unit/tracked-files';

/**
 * No JavaScript or TypeScript file carries a comment telling a coverage tool
 * to skip lines (#728, #795): a skipped line would count as run, so the
 * comment is refused where it is written.
 */
const CODE = new Set(['.ts', '.js', '.mjs', '.cjs', '.mts', '.cts']);

describe('coverage skips (#728)', () => {
  it('no code file tells a coverage tool to skip lines', () => {
    const skips = committableFiles()
      .filter((path) => CODE.has(extname(path)))
      .flatMap((path) => skipCommentsIn(path, readFileSync(path, 'utf8')));
    expect(skips, 'a skipped line counts as run: test it instead').toEqual([]);
  });
});
