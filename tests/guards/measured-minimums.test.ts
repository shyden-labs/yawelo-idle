import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { assess } from '../../scripts/minimums-method.ts';
import { floorBreach } from '../floors.ts';
import { readMinimums } from '../minimums.ts';
import { SEED_ENV } from '../properties-seed.ts';
import { searched } from '../searched.ts';
import { helperModules } from '../unit/helper-modules.ts';
import {
  CHECK_HOME,
  checkReadingOf,
  EXEMPT,
  isPropertiesFile,
  SEED_HOME,
  seedReadingOf,
} from '../unit/measured-minimums.ts';
import { codeWithoutLiterals } from '../unit/source-text.ts';
import { committableFiles } from '../unit/tracked-files.ts';

/**
 * The measured-minimums guard over the whole repository (#84, spec §5.8), in
 * the guards suite: it parses every TypeScript file git has. The reader's
 * tests on planted source are unit tests (tests/unit/measured-minimums.test.ts).
 *
 * A measured minimum is an exemption from exact floors Shyden granted for ten
 * properties alone (2026-10-12: "Fresh cases, safe minimums"; 2026-10-16:
 * "Yes, all 10"), and those properties draw fresh cases on every run
 * (2026-10-12: "don't repeat."). So the checks are called only in the
 * exempted files, each its pinned number of times; the properties suite sets
 * a seed in its one home alone; no suite config or npm script fixes one; and
 * every recorded minimum is what the method gives for its own figures.
 */

const parse = (file: string) =>
  ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

/** A check call in code with literals and comments gone: the cross-check. */
const CHECK_CALL = /(^|[^\w.$])(minimumBreach|minimumsBreach)\s*\(/g;
/** A fast-check runner call through `fc`, the name every file imports it by. */
const RUNNER_CALL =
  /(^|[^\w.$])fc\s*\.\s*(assert|check|sample|statistics)\s*\(/g;
const count = (re: RegExp, text: string) => [...text.matchAll(re)].length;

describe('the minimum checks are called only where Shyden exempted them (#84)', () => {
  it('finds each exempt file’s pinned calls and no call or other use anywhere else, over every TypeScript file git has', () => {
    const files = committableFiles(['*.ts', '*.mts', '*.cts']);
    const readings = files.map((file) => {
      const sf = parse(file);
      return {
        file,
        reading: checkReadingOf(file, sf),
        written: count(CHECK_CALL, codeWithoutLiterals(sf)),
      };
    });
    const findings = [
      ...readings.flatMap(({ reading }) => reading.refusals),
      ...readings
        .filter(({ file, reading }) => reading.calls !== (EXEMPT[file] ?? 0))
        .map(
          ({ file, reading }) =>
            `${file}: ${String(reading.calls)} calls, ${String(EXEMPT[file] ?? 0)} exempted`,
        ),
      ...Object.keys(EXEMPT)
        .filter((file) => !files.includes(file))
        .map((file) => `${file} is exempted but git has no such file`),
    ];
    // Independent of the parse tree (control c): the calls each file's text
    // writes, literals and comments gone, against the reader's count.
    const misread = readings
      .filter(
        ({ file, reading, written }) =>
          file !== CHECK_HOME && written !== reading.calls,
      )
      .map(
        ({ file, reading, written }) =>
          `${file}: ${String(written)} calls written, ${String(reading.calls)} read`,
      );
    expect(
      searched(findings, { of: files, what: 'TypeScript files' }),
      findings.join('\n'),
    ).toEqual([]);
    expect(
      searched(misread, { of: files, what: 'TypeScript files' }),
      misread.join('\n'),
    ).toEqual([]);
    expect(
      floorBreach('measured-minimums/files', files.length),
    ).toBeUndefined();
  });
});

describe('the properties suite sets no fast-check seed but in its one home (#84)', () => {
  it('reads every runner in the properties, the helpers they load and the suite’s setup, and finds no seed set there', () => {
    const tracked = new Set(committableFiles());
    const properties = [...tracked].filter(isPropertiesFile);
    const reach = helperModules(properties, (path) =>
      tracked.has(path) ? readFileSync(path, 'utf8') : undefined,
    );
    const files = [
      ...properties,
      ...reach.helpers,
      SEED_HOME,
      'vitest.properties.config.ts',
      'vitest.logs.config.ts',
    ];
    const readings = files.map((file) => {
      const sf = parse(file);
      return {
        file,
        reading: seedReadingOf(file, sf),
        written: count(RUNNER_CALL, codeWithoutLiterals(sf)),
      };
    });
    const findings = [
      ...reach.unresolved,
      ...readings.flatMap(({ reading }) => reading.refusals),
    ];
    const misread = readings
      .filter(({ reading, written }) => written !== reading.runners)
      .map(
        ({ file, reading, written }) =>
          `${file}: ${String(written)} runner calls written, ${String(reading.runners)} read`,
      );
    const home = readings.find(({ file }) => file === SEED_HOME);
    expect(
      searched(findings, { of: files, what: 'properties files and helpers' }),
      findings.join('\n'),
    ).toEqual([]);
    expect(
      searched(misread, { of: files, what: 'properties files and helpers' }),
      misread.join('\n'),
    ).toEqual([]);
    // The home configures fast-check once, so its seed reaches every file.
    expect(home?.reading.configures).toBe(1);
    expect(
      floorBreach('measured-minimums/seed-files', files.length),
    ).toBeUndefined();
    expect(
      floorBreach(
        'measured-minimums/runner-calls',
        readings.reduce((sum, { reading }) => sum + reading.runners, 0),
      ),
    ).toBeUndefined();
  });

  it('keeps the replay seed out of every suite config and npm script', () => {
    const files = committableFiles([
      'vitest*.config.ts',
      '**/vitest*.config.ts',
      'package.json',
      '**/package.json',
    ]);
    const findings = files
      .filter((file) => readFileSync(file, 'utf8').includes(SEED_ENV))
      .map(
        (file) =>
          `${file} names ${SEED_ENV}: only a person replaying a run sets it`,
      );
    expect(
      searched(findings, {
        of: files,
        what: 'suite configs and package files',
      }),
    ).toEqual([]);
    expect(
      floorBreach('measured-minimums/config-files', files.length),
    ).toBeUndefined();
  });
});

describe('every recorded minimum is what the method gives for its figures (#84)', () => {
  it('recomputes each minimum from the runs, lowest, mean and spread it was recorded with', () => {
    const recorded = readMinimums();
    const ids = Object.keys(recorded).sort();
    const findings = ids.flatMap((id) => {
      const entry = recorded[id];
      if (entry === undefined) return [`${id} reads as nothing`];
      const assessed = assess(entry);
      return assessed.kind === 'minimum' && assessed.minimum === entry.minimum
        ? []
        : [
            `${id}: recorded ${String(entry.minimum)}, the method gives ${JSON.stringify(assessed)}`,
          ];
    });
    expect(
      searched(findings, { of: ids, what: 'recorded minimums' }),
      findings.join('\n'),
    ).toEqual([]);
    expect(
      floorBreach('measured-minimums/recorded', ids.length),
    ).toBeUndefined();
  });
});
