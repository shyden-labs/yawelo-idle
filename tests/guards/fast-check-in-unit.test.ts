import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import unit from '../../vitest.config';
import { floorBreach } from '../floors';
import { searched } from '../searched';
import { fastCheckLoads } from '../unit/fast-check-loads';
import { committableFiles } from '../unit/tracked-files';
import { unitSuiteFiles } from '../unit/unit-suite-files';

/**
 * No file the unit suite loads loads fast-check (#551). Every property runs
 * at its full count, with fresh cases, in the properties suite, and the unit
 * suite keeps stand-ins on chosen cases with no random draw (#543, global
 * rule 2026-10-12). The files are the unit config's own globs over the files
 * git has, its setup files, and every helper module those load (#554). It
 * reads the whole tree, so it runs in the guards suite; the reader's planted
 * forms are unit tests (tests/unit/fast-check-loads.test.ts). There is no
 * allow-list.
 */

const FAST_CHECK = /^(fast-check(\/|$)|@fast-check\/)/;

let walked:
  | {
      files: readonly string[];
      imports: readonly string[];
      unresolved: readonly string[];
      specifiers: readonly string[];
      loads: readonly string[];
      blind: readonly string[];
    }
  | undefined;

/** The unit suite's files and what the reader found in each, read inside a test, never at collection. */
const walk = (): NonNullable<typeof walked> => {
  if (walked !== undefined) return walked;
  const tracked = committableFiles();
  const known = new Set(tracked);
  const suite = unitSuiteFiles({
    tracked,
    read: (path) => (known.has(path) ? readFileSync(path, 'utf8') : undefined),
    include: unit.test?.include ?? [],
    exclude: unit.test?.exclude ?? [],
    setupFiles: [unit.test?.setupFiles ?? []].flat(),
  });
  const read = suite.all.map((file) => {
    const source = readFileSync(file, 'utf8');
    return { file, source, found: fastCheckLoads(source, file) };
  });
  walked = {
    files: suite.all,
    imports: suite.imports,
    unresolved: suite.unresolved,
    specifiers: read.flatMap(({ file, found }) =>
      found.specifiers.map((specifier) => `${file} ${specifier}`),
    ),
    loads: read.flatMap(({ file, found }) =>
      found.loads.map((site) => `${file} ${site}`),
    ),
    // TypeScript's own import reader, independent of this one: a file where
    // it meets more fast-check specifiers than the reader did is a file the
    // reader is blind in.
    blind: read
      .filter(({ source, found }) => {
        const theirs = ts
          .preProcessFile(source, true, true)
          .importedFiles.filter(({ fileName }) => FAST_CHECK.test(fileName));
        const ours = found.specifiers.filter((quoted) =>
          FAST_CHECK.test(quoted.slice(1, -1)),
        );
        return theirs.length > ours.length;
      })
      .map(({ file }) => file),
  };
  return walked;
};

describe('fast-check in the unit suite (#551)', () => {
  it('reads every file the unit suite loads: its tests, setup files and their helpers', () => {
    const { files } = walk();
    expect(files).toContain('tests/unit/setup.ts');
    expect(files).toContain('packages/core/test/sim.test.ts');
    expect(files).toContain('packages/core/test/sim-laws.ts');
    expect(
      floorBreach('fast-check-in-unit/files', files.length),
    ).toBeUndefined();
  });

  it('follows every helper import those files make', () => {
    const { imports, unresolved } = walk();
    expect(
      searched(unresolved, {
        of: imports,
        what: 'relative imports in the unit suite',
      }),
    ).toEqual([]);
    expect(
      floorBreach('fast-check-in-unit/imports', imports.length),
    ).toBeUndefined();
  });

  it('finds no load of fast-check in them, of any spelling', () => {
    const { loads, specifiers } = walk();
    expect(
      searched(loads, {
        of: specifiers,
        what: 'module specifiers in the unit suite',
      }),
    ).toEqual([]);
    expect(
      floorBreach('fast-check-in-unit/specifiers', specifiers.length),
    ).toBeUndefined();
  });

  it('meets every fast-check specifier TypeScript’s own reader meets, file by file', () => {
    const { blind, files } = walk();
    expect(
      searched(blind, { of: files, what: 'files the unit suite loads' }),
    ).toEqual([]);
    expect(
      floorBreach('fast-check-in-unit/cross-checked', files.length),
    ).toBeUndefined();
  });
});
