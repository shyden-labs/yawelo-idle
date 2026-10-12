import { matchesGlob } from 'node:path';
import { helperModules } from './helper-modules';

/**
 * The files the unit suite loads (#551): the unit config's include globs over
 * the files git has, less its exclude globs, its setup files, and every
 * helper module those load by a relative import (#554's follower). Guards
 * that judge what the unit suite runs share this one derivation, so a glob
 * added to the config, or a helper imported from anywhere, widens them all.
 */

export interface UnitSuiteFiles {
  /** Test files the config's globs take, sorted. */
  readonly tests: readonly string[];
  /** The config's setup files that git has. */
  readonly setup: readonly string[];
  /** Helper modules the tests and setup files load, sorted. */
  readonly helpers: readonly string[];
  /** All of the above, sorted. */
  readonly all: readonly string[];
  /** Every relative specifier the follower met, as `file: specifier`. */
  readonly imports: readonly string[];
  /** What the follower could not follow. */
  readonly unresolved: readonly string[];
}

export function unitSuiteFiles({
  tracked,
  read,
  include,
  exclude,
  setupFiles,
}: {
  readonly tracked: readonly string[];
  readonly read: (path: string) => string | undefined;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly setupFiles: readonly string[];
}): UnitSuiteFiles {
  const tests = tracked
    .filter(
      (path) =>
        include.some((glob) => matchesGlob(path, glob)) &&
        !exclude.some((glob) => matchesGlob(path, glob)),
    )
    .sort();
  const setup = setupFiles.filter((path) => tracked.includes(path));
  const reach = helperModules([...tests, ...setup], read);
  return {
    tests,
    setup,
    helpers: reach.helpers,
    all: [...new Set([...tests, ...setup, ...reach.helpers])].sort(),
    imports: reach.imports,
    unresolved: reach.unresolved,
  };
}
