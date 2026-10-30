import type { ViteUserConfig } from 'vitest/config';
import { COVERAGE, COVERAGE_PLUGINS } from './scripts/coverage-config.ts';
import integration from './vitest.integration.config.ts';

// The integration suite under coverage (#728), as its own config runs it: run by
// `npm run test:coverage`, never by hand. Spreads, not a call: tests load it.
export default {
  ...integration,
  plugins: [...(integration.plugins ?? []), ...COVERAGE_PLUGINS],
  test: {
    ...integration.test,
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/integration' },
  },
} satisfies ViteUserConfig;
