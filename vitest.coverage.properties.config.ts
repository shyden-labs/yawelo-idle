import type { ViteUserConfig } from 'vitest/config';
import { COVERAGE } from './scripts/coverage-config.ts';
import properties from './vitest.properties.config.ts';

// The properties suite under coverage (#728), as its own config runs it: run by
// `npm run test:coverage`, never by hand. Spreads, not a call: tests load it.
export default {
  ...properties,
  test: {
    ...properties.test,
    // Node's own loader, as the scripts the tests start run (#762): test
    // and child-process coverage then land on one map.
    experimental: { viteModuleRunner: false },
    coverage: { ...COVERAGE, reportsDirectory: 'coverage/properties' },
  },
} satisfies ViteUserConfig;
