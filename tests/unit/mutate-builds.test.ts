import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mutableSuites, mutateScript } from '../../scripts/mutate.ts';
import { SUITES } from '../../scripts/record-floors.ts';

/**
 * The mutation runner builds and runs each suite exactly as the suite's own
 * package script does (#649, spec §3): a build changed in one place and not
 * the other would let a mutation run against a stale build.
 */

/** Each suite the runner can run, and the package script that runs it. */
const SCRIPTS: readonly (readonly [string, string, string])[] = [
  ['unit suite', 'package.json', 'test:unit'],
  ['guards suite', 'package.json', 'test:guards'],
  ['integration suite', 'package.json', 'test:integration'],
  ['properties suite', 'package.json', 'test:properties'],
  ['logs suite', 'package.json', 'test:logs'],
  ['pacing suite', 'package.json', 'test:pacing'],
  ['game harness', 'apps/web/package.json', 'test'],
  ['site harness', 'apps/site/package.json', 'test'],
  ['dev hosts harness', 'apps/dev-hosts/package.json', 'test'],
  ['sync Worker harness', 'apps/sync-worker/package.json', 'test'],
  ['engines suite', 'package.json', 'test:engines'],
  ['web smoke suite', 'package.json', 'test:web'],
];

const scriptOf = (path: string, name: string): unknown =>
  (
    JSON.parse(readFileSync(path, 'utf8')) as {
      readonly scripts: Readonly<Record<string, string>>;
    }
  ).scripts[name];

describe('mutateScript', () => {
  it('names a vitest suite under vitest’s default config', () => {
    expect(mutateScript({ kind: 'vitest' })).toBe('vitest run');
  });

  it('drops npx from a build, as a package script runs local binaries itself', () => {
    expect(
      mutateScript({
        kind: 'vitest',
        config: 'vitest.harness.config.ts',
        build: ['npx', 'vite', 'build'],
      }),
    ).toBe('vite build && vitest run -c vitest.harness.config.ts');
  });

  it('keeps an npm build whole', () => {
    expect(
      mutateScript({
        kind: 'playwright',
        config: 'playwright.web.config.ts',
        build: ['npm', 'run', 'build'],
      }),
    ).toBe('npm run build && playwright test -c playwright.web.config.ts');
  });
});

describe('each suite runs as its package script does', () => {
  it('pairs every suite the runner can run with its script', () => {
    expect(SCRIPTS.map(([name]) => name)).toEqual(
      mutableSuites(SUITES).map((s) => s.name),
    );
  });

  it.each(SCRIPTS)('%s: %s "%s"', (name, path, script) => {
    const mutate = SUITES.find((s) => s.name === name)?.mutate;
    expect(mutate, `${name} has a mutate value`).toBeDefined();
    if (mutate === undefined) return;
    expect(scriptOf(path, script)).toBe(mutateScript(mutate));
  });
});
