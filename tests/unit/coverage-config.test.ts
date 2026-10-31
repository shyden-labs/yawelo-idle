import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import unit from '../../vitest.config.ts';
import guards from '../../vitest.guards.config.ts';
import pacing from '../../vitest.pacing.config.ts';
import coverageGuards from '../../vitest.coverage.guards.config.ts';
import coverageIntegration from '../../vitest.coverage.integration.config.ts';
import coveragePacing from '../../vitest.coverage.pacing.config.ts';
import coverageProperties from '../../vitest.coverage.properties.config.ts';
import coverageUnit from '../../vitest.coverage.unit.config.ts';
import {
  BUDGET_TESTS,
  COVERAGE_EXCLUDE,
  COVERAGE_SUITES,
  coverageConfigFile,
} from '../../scripts/coverage-config.ts';

/**
 * Coverage runs each suite PR CI runs, one at a time, under that suite's own
 * config with a coverage block added (#728), one config file each. The plain
 * unit step keeps coverage off and every limit (global rule: the 1 s step
 * runs with coverage OFF, and coverage steps carry no per-test limit).
 */
describe('the plain unit step keeps coverage off and its limits (#728)', () => {
  it('names no coverage block', () => {
    expect(unit.test?.coverage).toBeUndefined();
  });

  it('keeps the 1 s limit and the setup that holds each test to its CPU', () => {
    expect([
      unit.test?.testTimeout,
      unit.test?.hookTimeout,
      unit.test?.setupFiles,
    ]).toEqual([1_000, 1_000, ['tests/unit/setup.ts']]);
  });
});

describe('the suites coverage measures are the ones PR CI runs (#728)', () => {
  it('in CI step order, the logs suite left out (it runs before each release, not on pull requests)', () => {
    expect(COVERAGE_SUITES.map(({ name }) => name)).toEqual([
      'unit',
      'guards',
      'integration',
      'properties',
      'pacing',
    ]);
  });

  it('names one config file per suite', () => {
    expect(coverageConfigFile('pacing')).toBe(
      'vitest.coverage.pacing.config.ts',
    );
  });
});

describe('every suite coverage runs has its config file (#728)', () => {
  for (const { name } of COVERAGE_SUITES)
    it(`${name}: its config file exists`, () => {
      expect(existsSync(coverageConfigFile(name))).toBe(true);
    });
});

describe('the unit suite under coverage (#728)', () => {
  it('runs the same test files as the unit step', () => {
    expect([coverageUnit.test.include, coverageUnit.test.exclude]).toEqual([
      unit.test?.include,
      unit.test?.exclude,
    ]);
  });

  it('keeps every refusal (process, socket, checkout reads) but not the CPU check', () => {
    expect(coverageUnit.test.setupFiles).toEqual([
      'tests/unit/setup-refusals.ts',
    ]);
  });

  it('carries no per-test limit', () => {
    expect([
      coverageUnit.test.testTimeout,
      coverageUnit.test.hookTimeout,
    ]).toEqual([0, 0]);
  });
});

describe('the pacing suite under coverage leaves out its time budgets (#728)', () => {
  it('excludes exactly the budget tests, beside Vitest’s own defaults', () => {
    expect(coveragePacing.test.exclude).toEqual([
      '**/node_modules/**',
      '**/.git/**',
      'packages/bots/pacing/pemandu-perf.test.ts',
    ]);
  });

  it('while the pacing step itself runs every pacing test, budgets included', () => {
    expect([pacing.test?.include, pacing.test?.exclude]).toEqual([
      ['packages/bots/pacing/**/*.test.ts'],
      undefined,
    ]);
  });

  for (const file of BUDGET_TESTS)
    it(`${file} holds a time budget: it reads a CPU clock`, () => {
      expect(readFileSync(file, 'utf8')).toContain('threadCpuUsage');
    });
});

describe('another suite under coverage keeps its own settings (#728)', () => {
  it('the guards suite keeps its files, setup and limits', () => {
    const { coverage, ...rest } = coverageGuards.test;
    expect(coverage.enabled).toBe(true);
    expect(rest).toEqual(guards.test);
  });
});

const CONFIGS = [
  ['unit', coverageUnit],
  ['guards', coverageGuards],
  ['integration', coverageIntegration],
  ['properties', coverageProperties],
  ['pacing', coveragePacing],
] as const;

describe('every suite writes one report the measure step joins (#728)', () => {
  it('has a config for every suite coverage runs', () => {
    expect(CONFIGS.map(([name]) => name)).toEqual(
      COVERAGE_SUITES.map(({ name }) => name),
    );
  });

  // Svelte is measured in the unit suite alone, where screens are rendered
  // (#806): another suite would compile an unloaded screen for the server,
  // a different map that merges in as unrun lines.
  const INCLUDE: Record<string, string> = {
    unit: '**/*.{ts,js,mjs,cjs,mts,cts,svelte}',
    guards: '**/*.{ts,js,mjs,cjs,mts,cts}',
    integration: '**/*.{ts,js,mjs,cjs,mts,cts}',
    properties: '**/*.{ts,js,mjs,cjs,mts,cts}',
    pacing: '**/*.{ts,js,mjs,cjs,mts,cts}',
  };

  for (const [name, config] of CONFIGS)
    it(`${name}: the custom provider, its files, our exclude only`, () => {
      expect(config.test.coverage).toEqual({
        enabled: true,
        provider: 'custom',
        customProviderModule: 'scripts/coverage-provider.ts',
        include: [INCLUDE[name]],
        exclude: [...COVERAGE_EXCLUDE],
        reporter: [
          ['json', { file: 'coverage-final.json' }],
          ['lcovonly', { file: 'lcov.info' }],
        ],
        reportsDirectory: `coverage/${name}`,
        reportOnFailure: false,
        clean: true,
      });
    });
});

describe('only the unit suite compiles Svelte under coverage (#798, #806)', () => {
  const svelteCopies = (config: (typeof CONFIGS)[number][1]): number =>
    (config.plugins ?? [])
      .flat()
      .filter(
        (plugin) =>
          plugin !== null &&
          typeof plugin === 'object' &&
          'name' in plugin &&
          plugin.name === 'vite-plugin-svelte:config',
      ).length;

  for (const [name, config] of CONFIGS)
    it(`${name}: carries the Svelte plugin ${name === 'unit' ? 'once' : 'not at all'}`, () => {
      expect(svelteCopies(config)).toBe(name === 'unit' ? 1 : 0);
    });
});

describe('the provider excludes only what is not ours (#728)', () => {
  it('dependencies, build output and the coverage reports themselves', () => {
    expect(COVERAGE_EXCLUDE).toEqual([
      '**/node_modules/**',
      '**/dist/**',
      '**/.build/**',
      'coverage/**',
    ]);
  });
});
