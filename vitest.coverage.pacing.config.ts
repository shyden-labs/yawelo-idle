import { configDefaults, type ViteUserConfig } from 'vitest/config';
import {
  BUDGET_TESTS,
  COVERAGE,
  COVERAGE_PLUGINS,
} from './scripts/coverage-config.ts';
import pacing from './vitest.pacing.config.ts';

// The pacing suite under coverage (#728), as its own config runs it, but for
// its time-budget tests (BUDGET_TESTS): run by `npm run test:coverage`,
// never by hand. Spreads, not a call: tests load it.
export default {
  ...pacing,
  plugins: [...(pacing.plugins ?? []), ...COVERAGE_PLUGINS],
  test: {
    ...pacing.test,
    exclude: [...configDefaults.exclude, ...BUDGET_TESTS],
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/pacing' },
  },
} satisfies ViteUserConfig;
