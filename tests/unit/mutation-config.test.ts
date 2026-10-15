import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEquivalents } from '../../scripts/mutation-survivors';
import stryker from '../../vitest.stryker.config';

/**
 * The core mutation run's config (#36): Stryker mutates the economy and
 * memory code in packages/core/src (spec 2026-10-01-m1 §7) and kills each
 * mutant with packages/core's unit tests, driven through
 * vitest.stryker.config.ts. A score under 90 fails the run (AC2). The HTML
 * report lands where the workflow uploads it from (AC5).
 */

interface StrykerConfig {
  readonly $schema?: string;
  readonly testRunner?: string;
  readonly vitest?: Readonly<Record<string, unknown>>;
  readonly checkers?: readonly string[];
  readonly tsconfigFile?: string;
  readonly mutate?: readonly string[];
  readonly coverageAnalysis?: string;
  readonly ignoreStatic?: boolean;
  readonly thresholds?: Readonly<Record<string, unknown>>;
  readonly reporters?: readonly string[];
  readonly htmlReporter?: Readonly<Record<string, unknown>>;
  readonly jsonReporter?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

const config = (): StrykerConfig =>
  JSON.parse(readFileSync('stryker.config.json', 'utf8')) as StrykerConfig;

/** The nine modules the spec names, in its order (§7, #36 AC1). */
const MODULES = [
  'encounters',
  'words',
  'memory',
  'production',
  'sail',
  'journeys',
  'upgrades',
  'grammar',
  'automation',
] as const;

describe('stryker.config.json (#36)', () => {
  it('mutates exactly the nine modules the spec names, in packages/core/src (AC1)', () => {
    expect(config().mutate).toEqual(
      MODULES.map((m) => `packages/core/src/${m}.ts`),
    );
  });

  it('runs packages/core’s unit tests through Vitest, under its own config', () => {
    const c = config();
    expect([c.testRunner, c.vitest]).toEqual([
      'vitest',
      { configFile: 'vitest.stryker.config.ts' },
    ]);
  });

  // Not "perTest": its Vitest runner (10.0.0) picks each mutant's tests by a
  // name pattern joined with spaces, while Vitest 5 matches names joined
  // with " > ", so no test inside a describe ran and every mutant survived
  // (first run, 2026-10-16: 6 of 1,291 killed, testsCompleted 0;
  // stryker-js#6210, fix unreleased). "all" runs every test related to the
  // mutated file with no name pattern, and still marks uncovered mutants.
  it('runs every related test against each covered mutant, and mutates static code too', () => {
    const c = config();
    expect([c.coverageAnalysis, c.ignoreStatic]).toEqual(['all', undefined]);
  });

  it('drops a mutant that does not compile against packages/core’s tsconfig', () => {
    const c = config();
    expect([c.checkers, c.tsconfigFile]).toEqual([
      ['typescript'],
      'packages/core/tsconfig.json',
    ]);
  });

  it('fails the run under a score of 90 (AC2)', () => {
    expect(config().thresholds).toEqual({ high: 95, low: 90, break: 90 });
  });

  it('writes the HTML report the workflow uploads, a JSON report beside it, and a log in CI (AC5)', () => {
    const c = config();
    expect(c.reporters).toEqual([
      'clear-text',
      'progress-append-only',
      'html',
      'json',
    ]);
    expect(c.htmlReporter).toEqual({ fileName: 'reports/mutation/index.html' });
    expect(c.jsonReporter).toEqual({
      fileName: 'reports/mutation/mutation.json',
    });
  });

  it('sets nothing else, so a default cannot change under it unseen', () => {
    expect(Object.keys(config()).sort()).toEqual(
      [
        '$schema',
        'checkers',
        'coverageAnalysis',
        'htmlReporter',
        'jsonReporter',
        'mutate',
        'reporters',
        'testRunner',
        'thresholds',
        'tsconfigFile',
        'vitest',
      ].sort(),
    );
  });
});

describe('vitest.stryker.config.ts (#36)', () => {
  it('includes packages/core’s unit tests and nothing else', () => {
    expect(stryker.test?.include).toEqual(['packages/core/test/**/*.test.ts']);
  });

  it('leaves out the unit setup, whose CPU check judges the unit step', () => {
    expect(stryker.test?.setupFiles).toBeUndefined();
  });
});

describe('stryker.equivalents.json (#36)', () => {
  it('is a list the survivor check reads, each entry with its reason', () => {
    expect(() =>
      parseEquivalents(
        JSON.parse(readFileSync('stryker.equivalents.json', 'utf8')),
      ),
    ).not.toThrow();
  });
});

describe('the mutation script (#36)', () => {
  it('runs Stryker with the config at the root', () => {
    const scripts = (
      JSON.parse(readFileSync('package.json', 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    expect(scripts['test:mutation']).toBe('stryker run');
  });
});
