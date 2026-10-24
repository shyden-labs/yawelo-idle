import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { floorBreach } from '../floors.ts';
import { searched } from '../searched.ts';
import { relativeSpecifiers } from '../unit/helper-modules.ts';
import { unnamedFiles } from '../unit/relative-imports.ts';
import { committableFiles } from '../unit/tracked-files.ts';

/**
 * Every relative specifier in the tree names its file (#762), so every file
 * loads under Node's own loader, as the coverage runs load them and as Node
 * runs the scripts. It reads every tracked code file, so it runs in the
 * guards suite; the reader's and judge's planted forms are unit tests
 * (tests/unit/relative-imports.test.ts). There is no allow-list.
 */

const CODE = ['*.ts', '*.mts', '*.cts', '*.js', '*.mjs', '*.cjs'];

let walked:
  | {
      files: readonly string[];
      specifiers: readonly string[];
      unread: readonly string[];
      findings: readonly string[];
      blind: readonly string[];
    }
  | undefined;

/** Every code file and what the reader found in each, read inside a test, never at collection. */
const walk = (): NonNullable<typeof walked> => {
  if (walked !== undefined) return walked;
  const files = committableFiles(CODE);
  const known = new Set(committableFiles());
  const read = files.map((file) => {
    const source = readFileSync(file, 'utf8');
    return { file, source, ...relativeSpecifiers(file, source) };
  });
  walked = {
    files,
    specifiers: read.flatMap(({ file, specifiers }) =>
      specifiers.map(
        ({ specifier, line }) => `${file}:${String(line)} ${specifier}`,
      ),
    ),
    unread: read.flatMap(({ file, unread }) =>
      unread.map(({ line, what }) => `${file}:${String(line)}: ${what}`),
    ),
    findings: read.flatMap(({ file, specifiers }) =>
      unnamedFiles(file, specifiers, (path) => known.has(path)),
    ),
    // TypeScript's own import reader, independent of this one: a file where
    // it meets more relative specifiers than the reader did, outside `vi`
    // calls it does not read, is a file the reader is blind in.
    blind: read
      .filter(({ source, specifiers }) => {
        const theirs = ts
          .preProcessFile(source, true, true)
          .importedFiles.filter(({ fileName }) => fileName.startsWith('.'));
        const ours = specifiers.filter(({ form }) => form !== 'vi');
        return theirs.length > ours.length;
      })
      .map(({ file }) => file),
  };
  return walked;
};

describe('every relative specifier names its file (#762)', () => {
  it('reads every tracked code file', () => {
    const { files } = walk();
    expect(files).toContain('scripts/coverage.ts');
    expect(files).toContain('tests/unit/helper-modules.ts');
    expect(files).toContain('packages/core/src/sim.ts');
    expect(floorBreach('relative-imports/files', files.length)).toBeUndefined();
  });

  it('reads every relative specifier TypeScript reads in each file', () => {
    const { files, blind } = walk();
    expect(searched(blind, { of: files, what: 'tracked code files' })).toEqual(
      [],
    );
  });

  it('reads every specifier it meets, refusing none', () => {
    const { files, unread } = walk();
    expect(searched(unread, { of: files, what: 'tracked code files' })).toEqual(
      [],
    );
  });

  it('finds no relative specifier that names no file', () => {
    const { specifiers, findings } = walk();
    expect(
      searched(findings, { of: specifiers, what: 'relative specifiers' }),
    ).toEqual([]);
    expect(
      floorBreach('relative-imports/specifiers', specifiers.length),
    ).toBeUndefined();
  });
});
