import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import unit from '../../vitest.config';
import { floorBreach } from '../floors';
import { searched } from '../searched';
import { raisedLimitFiles, raisedLimitsIn } from '../unit/raised-limits';
import { codeWithoutLiterals } from '../unit/source-text';
import {
  NON_UNIT_VITEST_CONFIGS,
  PLAYWRIGHT_CONFIGS,
} from '../unit/suite-configs';
import { committableFiles } from '../unit/tracked-files';

/**
 * No unit test file or unit config raises a limit (#477 AC3, AC4): every unit
 * test runs in under 1 s, and no limit is ever raised (global rule,
 * 2026-10-07). It reads every file the unit suite loads, a cost that grows
 * with the tree, so it runs in the guards suite. The reader's planted forms
 * are unit tests (tests/unit/raised-limits.test.ts). There is no allow-list.
 *
 * The files are the unit config and every file the unit suite loads, found
 * as the fast-check guard finds them (#551, #559): the config's globs over
 * the files git has, its setup files, and every helper they load, wherever
 * it lives. A glob added to the config, or a helper imported from anywhere,
 * widens the guard with it. Another suite's config that a unit test loads to
 * check it is data; its limits are that suite's own, held by
 * suite-limits.test.ts.
 */

const UNIT_CONFIG = 'vitest.config.ts';

/** The unit suite's files and what the follower could not follow. */
const unitFiles = () => {
  const tracked = committableFiles();
  const known = new Set(tracked);
  return raisedLimitFiles({
    tracked,
    read: (path) => (known.has(path) ? readFileSync(path, 'utf8') : undefined),
    include: unit.test?.include ?? [],
    exclude: unit.test?.exclude ?? [],
    setupFiles: [unit.test?.setupFiles ?? []].flat(),
    unitConfig: UNIT_CONFIG,
    otherConfigs: [...NON_UNIT_VITEST_CONFIGS, ...PLAYWRIGHT_CONFIGS],
  });
};

/**
 * What each file writes, counted in its code without literals or comments:
 * each name called or declared, type arguments allowed, a function type in
 * them too (`it.each<[string, (b: B) => unknown]>(`).
 */
const WRITTEN = [
  /(?<![\w$.])(?:it|test|describe|suite)(?:\.[A-Za-z]+)*\s*(?:<[^;{}]*?>)?\s*\(/g,
  /(?<![\w$.])(?:beforeAll|afterAll|beforeEach|afterEach|onTestFinished|onTestFailed)\s*(?:<[^;{}]*?>)?\s*\(/g,
  /(?<![\w$])vi\s*\.\s*setConfig\b/g,
  /(?<![\w$.])(?:testTimeout|hookTimeout|teardownTimeout)\s*[:,}]/g,
];

let walked:
  | {
      files: readonly string[];
      unresolved: readonly string[];
      readings: {
        file: string;
        code: string;
        findings: string[];
        sites: number;
        declarations: number;
      }[];
    }
  | undefined;
const repository = (): NonNullable<typeof walked> => {
  if (walked !== undefined) return walked;
  const { files, unresolved } = unitFiles();
  walked = {
    files,
    unresolved,
    readings: files.map((file) => {
      const sf = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      return { file, code: codeWithoutLiterals(sf), ...raisedLimitsIn(sf) };
    }),
  };
  return walked;
};

describe('no unit test or unit config raises a limit (#477 AC3, AC4)', () => {
  it('finds none in any file the unit suite loads', () => {
    const { files, readings, unresolved } = repository();
    expect(
      searched(unresolved, { of: files, what: 'unit suite files' }),
    ).toEqual([]);
    const findings = readings.flatMap(({ findings }) => findings);
    expect(
      searched(findings, { of: files, what: 'unit suite files' }),
      findings.join('\n'),
    ).toEqual([]);
    expect(floorBreach('raised-limits/files', files.length)).toBeUndefined();
  });

  it('reads as many tests, suites, hooks and limit keys in each file as its text writes, every call judged and declarations counted', () => {
    const { files, readings } = repository();
    const written = (code: string): number =>
      WRITTEN.reduce(
        (sum, pattern) => sum + (code.match(pattern) ?? []).length,
        0,
      );
    const misread = readings
      .filter(
        ({ code, sites, declarations }) =>
          written(code) !== sites + declarations,
      )
      .map(
        ({ file, code, sites, declarations }) =>
          `${file}: ${String(written(code))} written, ${String(sites)} judged + ${String(declarations)} declared`,
      );
    expect(
      searched(misread, { of: files, what: 'unit suite files' }),
      misread.join('\n'),
    ).toEqual([]);
    expect(
      floorBreach('raised-limits/cross-checked-files', files.length),
    ).toBeUndefined();
    const sites = readings.reduce((sum, { sites }) => sum + sites, 0);
    expect(floorBreach('raised-limits/sites', sites)).toBeUndefined();
  });

  it('reads the unit config and the setup file it names', () => {
    const { files } = repository();
    const setup = [unit.test?.setupFiles ?? []].flat();
    expect(setup).toEqual(['tests/unit/setup.ts']);
    expect(
      files
        .filter((path) => path === UNIT_CONFIG || setup.includes(path))
        .sort(),
    ).toEqual([UNIT_CONFIG, ...setup].sort());
  });
});
