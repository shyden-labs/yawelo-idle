import type { ViteUserConfig } from 'vitest/config';
import { COVERAGE } from './scripts/coverage-config.ts';
import pacing from './vitest.pacing.config.ts';

// The pacing suite under coverage (#728), as its own config runs it: run by
// `npm run test:coverage`, never by hand. Spreads, not a call: tests load it.
export default {
  ...pacing,
  test: {
    ...pacing.test,
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/pacing' },
  },
} satisfies ViteUserConfig;
