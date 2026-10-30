import type { ViteUserConfig } from 'vitest/config';
import { COVERAGE, COVERAGE_PLUGINS } from './scripts/coverage-config.ts';
import properties from './vitest.properties.config.ts';

// The properties suite under coverage (#728), as its own config runs it: run by
// `npm run test:coverage`, never by hand. Spreads, not a call: tests load it.
export default {
  ...properties,
  plugins: [...(properties.plugins ?? []), ...COVERAGE_PLUGINS],
  test: {
    ...properties.test,
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/properties' },
  },
} satisfies ViteUserConfig;
