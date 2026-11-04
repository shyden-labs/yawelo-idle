import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Each Worker's generated types (`wrangler types`, git-ignored) are rebuilt
 * before lint and typecheck judge them (#591): a types file left from an
 * older wrangler.jsonc failed pre-push with 32 errors CI never saw
 * (2026-10-15), and the opposite, a removed binding still declared, would
 * pass locally and fail only in CI.
 */
type Scripts = Record<string, string>;
const scriptsOf = (path: string): Scripts =>
  (JSON.parse(readFileSync(path, 'utf8')) as { scripts?: Scripts }).scripts ??
  {};
const root = scriptsOf('package.json');
const workspaceName = (dir: string): string =>
  (
    JSON.parse(readFileSync(`apps/${dir}/package.json`, 'utf8')) as {
      name: string;
    }
  ).name;

// runtime population: the apps on disk, each with its own wrangler.jsonc.
const WORKERS = readdirSync('apps').filter((dir) =>
  existsSync(`apps/${dir}/wrangler.jsonc`),
);

describe('fresh Worker types (#591)', () => {
  it('lint rebuilds every Worker’s types before it judges them', () => {
    expect(root['lint']).toMatch(/^npm run --silent types && eslint /);
  });

  it('typecheck rebuilds every Worker’s types before it judges them', () => {
    expect(root['typecheck']).toMatch(/^npm run --silent types && tsc /);
  });

  it('a fresh install rebuilds them the same way', () => {
    expect(root['postinstall']).toBe('npm run --silent types');
  });

  it('finds the Workers on disk', () => {
    expect(WORKERS.sort()).toEqual(['dev-hosts', 'site', 'sync-worker', 'web']);
  });

  it('rebuilds exactly the Workers on disk, each by its own types script', () => {
    const named = [...(root['types'] ?? '').matchAll(/--workspace (\S+)/g)].map(
      (m) => m[1],
    );
    expect(named.sort()).toEqual(WORKERS.map(workspaceName).sort());
    expect(
      WORKERS.filter((dir) => !scriptsOf(`apps/${dir}/package.json`)['types']),
    ).toEqual([]);
  });
});
