import type { ViteUserConfig } from 'vitest/config';
import { COVERAGE } from './scripts/coverage-config.ts';
import unit from './vitest.config.ts';

// The unit suite under coverage (#728): run by `npm run test:coverage`,
// never by hand. It keeps every refusal (process, socket, checkout reads)
// and carries no per-test timeout, since coverage slows every test.
// Spreads, not a call: tests load it.
export default {
  ...unit,
  test: {
    ...unit.test,
    setupFiles: ['tests/unit/setup-refusals.ts'],
    testTimeout: 0,
    hookTimeout: 0,
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/unit' },
  },
} satisfies ViteUserConfig;
