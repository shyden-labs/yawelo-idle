import type { ViteUserConfig } from 'vitest/config';
import unit from '../vitest.config.ts';
import guards from '../vitest.guards.config.ts';
import integration from '../vitest.integration.config.ts';
import pacing from '../vitest.pacing.config.ts';
import properties from '../vitest.properties.config.ts';

/**
 * Coverage runs each suite pull-request CI runs, one at a time, under that
 * suite's own config with a coverage block added (#728): one config each,
 * `vitest.coverage.<name>.config.ts`. The logs suite is left out: it runs
 * before each release, not on pull requests (global logging rule), and unit
 * keeps its stand-ins.
 */
export const COVERAGE_SUITES: readonly {
  name: string;
  config: ViteUserConfig;
}[] = [
  { name: 'unit', config: unit },
  { name: 'guards', config: guards },
  { name: 'integration', config: integration },
  { name: 'properties', config: properties },
  { name: 'pacing', config: pacing },
];

/** The config file that runs a suite under coverage. */
export const coverageConfigFile = (name: string): string =>
  `vitest.coverage.${name}.config.ts`;

/**
 * What the provider leaves out: dependencies, build output and the reports
 * themselves. Nothing else, since tests and tool configs are code (global
 * ruling 2026-10-22), and Vitest's own hard-coded excludes would drop them
 * (scripts/coverage-provider.ts).
 */
export const COVERAGE_EXCLUDE: readonly string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.build/**',
  'coverage/**',
];

/**
 * Test files that hold a time budget (CPU per operation, wall time per
 * run). Instrumentation slows the code they time, and a coverage run carries
 * no per-test limit (global rule, "Both global"), so the coverage run of
 * their suite leaves them out. Their budgets stay in force in their own CI
 * step, and their own lines stay in the record, untested. Measured
 * 2026-10-21 (PR #741's coverage job): pemandu-perf's fastest purchase took
 * 183 µs of CPU under coverage against its 100 µs budget.
 */
export const BUDGET_TESTS: readonly string[] = [
  'packages/bots/pacing/pemandu-perf.test.ts',
];

/**
 * The coverage block every suite's coverage config adds, all but its
 * `reportsDirectory` (`coverage/<suite>`). Data, not a function: the configs
 * are loaded by tests, and a call into workspace code while a test file is
 * collected is refused (tests/guards/collection-calls.test.ts).
 */
export const COVERAGE: NonNullable<
  NonNullable<ViteUserConfig['test']>['coverage']
> = {
  enabled: true,
  provider: 'custom',
  customProviderModule: 'scripts/coverage-provider.ts',
  include: ['**/*.{ts,js,mjs,cjs,mts,cts}'],
  exclude: [...COVERAGE_EXCLUDE],
  reporter: [
    ['json', { file: 'coverage-final.json' }],
    ['lcovonly', { file: 'lcov.info' }],
  ],
  reportOnFailure: false,
  clean: true,
};
