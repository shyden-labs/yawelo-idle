import type { ViteUserConfig } from 'vitest/config';
import { COVERAGE, COVERAGE_PLUGINS } from './scripts/coverage-config.ts';
import guards from './vitest.guards.config.ts';

// The guards suite under coverage (#728), as its own config runs it: run by
// `npm run test:coverage`, never by hand. Spreads, not a call: tests load it.
export default {
  ...guards,
  plugins: [...(guards.plugins ?? []), ...COVERAGE_PLUGINS],
  test: {
    ...guards.test,
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/guards' },
  },
} satisfies ViteUserConfig;
