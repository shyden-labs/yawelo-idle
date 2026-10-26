import { configDefaults, type ViteUserConfig } from 'vitest/config';
import { BUDGET_TESTS, COVERAGE } from './scripts/coverage-config.ts';
import pacing from './vitest.pacing.config.ts';

// The pacing suite under coverage (#728), as its own config runs it, but for
// its time-budget tests (BUDGET_TESTS): run by `npm run test:coverage`,
// never by hand. Spreads, not a call: tests load it.
export default {
  ...pacing,
  test: {
    ...pacing.test,
    exclude: [...configDefaults.exclude, ...BUDGET_TESTS],
    // Node's own loader, as the scripts the tests start run (#762): test
    // and child-process coverage then land on one map.
    experimental: { viteModuleRunner: false },
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/pacing' },
  },
} satisfies ViteUserConfig;
