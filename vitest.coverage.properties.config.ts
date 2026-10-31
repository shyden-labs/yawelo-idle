import type { ViteUserConfig } from 'vitest/config';
import { COVERAGE } from './scripts/coverage-config.ts';
import properties from './vitest.properties.config.ts';

// The properties suite under coverage (#728), as its own config runs it: run by
// `npm run test:coverage`, never by hand. Spreads, not a call: tests load it.
export default {
  ...properties,
  test: {
    ...properties.test,
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/properties' },
  },
} satisfies ViteUserConfig;
