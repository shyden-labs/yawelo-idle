import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { kindOf } from '../../scripts/coverage-kinds.ts';
import { floorBreach } from '../floors';
import { searched } from '../searched';
import { skipCommentsIn } from '../unit/coverage-skip';
import { committableFiles } from '../unit/tracked-files';

/**
 * The coverage record's two whole-tree rules (#728).
 *
 * Every committable file is of a kind the record names (code measured by
 * V8, code counted by lines, or not code), so a new kind of file is
 * classified before the record meets it. And no JavaScript or TypeScript
 * file carries a comment telling a coverage tool to skip lines: the global
 * ruling (2026-10-22) counts those lines as unrun, with no exemption by kind
 * of line, so the comment is refused where it is written.
 */
const files = (): string[] => committableFiles();

const firstLine = (path: string): string =>
  extname(path) === ''
    ? (readFileSync(path, 'utf8').split('\n', 1)[0] ?? '')
    : '';

describe('coverage (#728)', () => {
  it('every committable file is of a kind the coverage record names', () => {
    const all = files();
    const unlisted = all.filter(
      (path) => kindOf(path, firstLine(path)) === undefined,
    );
    expect(
      searched(unlisted, { of: all, what: 'committable files' }),
      'add the kind to scripts/coverage-kinds.ts',
    ).toEqual([]);
    expect(floorBreach('coverage/kind-files', all.length)).toBeUndefined();
  });

  it('no JavaScript or TypeScript file tells a coverage tool to skip lines', () => {
    const code = files().filter((path) => kindOf(path, '') === 'v8');
    const skips = code.flatMap((path) =>
      skipCommentsIn(path, readFileSync(path, 'utf8')),
    );
    expect(
      searched(skips, { of: code, what: 'JavaScript and TypeScript files' }),
      'a skipped line counts as unrun: test it instead',
    ).toEqual([]);
    expect(floorBreach('coverage/code-files', code.length)).toBeUndefined();
  });
});
