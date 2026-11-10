import { defineConfig } from 'vitest/config';

/**
 * The door's harness tests (#784 AC4): the real door in front of the real
 * Workers, each started by wrangler from its real wrangler.jsonc in local
 * workerd. Run by CI's Worker tests step, never on the laptop.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // One limit, at the CI step (#476): none per test or per hook.
    testTimeout: 0,
    hookTimeout: 0,
  },
});
