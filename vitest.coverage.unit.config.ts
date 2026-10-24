import type { ViteUserConfig } from 'vitest/config';
import { COVERAGE } from './scripts/coverage-config.ts';
import unit from './vitest.config.ts';

// The unit suite under coverage (#728): run by `npm run test:coverage`,
// never by hand. It keeps every refusal (process, socket, checkout reads)
// but not the CPU check, and carries no per-test limit: the unit step judges
// those with coverage off (global rule, "Both global"), and suite-limits
// holds this non-unit config to no limit of its own. Spreads, not a call:
// tests load it.
export default {
  ...unit,
  test: {
    ...unit.test,
    setupFiles: ['tests/unit/setup-refusals.ts'],
    testTimeout: 0,
    hookTimeout: 0,
    // Node's own loader, as the scripts the tests start run (#762): test
    // and child-process coverage then land on one map.
    experimental: { viteModuleRunner: false },
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/unit' },
  },
} satisfies ViteUserConfig;
