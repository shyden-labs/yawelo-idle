import v8 from '@vitest/coverage-v8';
import { COVERAGE_EXCLUDE } from './coverage-config.ts';

/**
 * The v8 provider, measuring tests and configs too (#728).
 *
 * Vitest adds the run's own test files, setup files and config to the
 * coverage exclude list as "hard-coded default coverage exclusions. These
 * cannot be overridden by user config" (vitest 5.0.3,
 * `dist/chunks/index.DpLw24bj.js`). Measured 2026-10-21: the unit suite's
 * report then left out 190 test files, `tests/unit/setup.ts` and
 * `vitest.config.ts`. The global ruling counts tests and tool configs as
 * code, so this provider replaces the resolved list with exactly ours.
 */

/** The members of `V8CoverageProvider` this provider touches. */
interface V8Provider {
  initialize(ctx: unknown): void;
  options: { exclude: string[] };
  globMatchers: unknown;
  globCache: Map<string, boolean>;
}

/**
 * The class is loaded at run time, by a specifier TypeScript does not
 * follow: its declarations import magicast's and Babel's types, and with
 * them in the program `npm run lint` ran out of heap (measured 2026-10-21:
 * over 2.2 GB resident and "JavaScript heap out of memory"; 1.6 GB with
 * this file left out). It is a supported path, through the package's `./*`
 * export, at the version the pin test holds.
 */
const PROVIDER = '@vitest/coverage-v8/dist/provider.js';

export default {
  ...v8,
  async getProvider(): Promise<V8Provider> {
    const { V8CoverageProvider } = (await import(PROVIDER)) as {
      V8CoverageProvider: new () => V8Provider;
    };
    class AllCodeProvider extends V8CoverageProvider {
      override initialize(ctx: unknown): void {
        super.initialize(ctx);
        this.options.exclude = [...COVERAGE_EXCLUDE];
        this.globMatchers = undefined;
        this.globCache.clear();
      }
    }
    return new AllCodeProvider();
  },
};
