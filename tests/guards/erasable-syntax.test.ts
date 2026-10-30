import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'jsonc-parser';
import { committableFiles } from '../unit/tracked-files';

/**
 * Every tsconfig the typecheck reads sets `erasableSyntaxOnly` (#653), so
 * `npm run typecheck` refuses the TypeScript Node cannot run by stripping
 * types (enums, runtime namespaces, `import =`, parameter properties). In
 * #652 a parameter property passed Vitest and `tsc`, then `node` refused to
 * load the script.
 *
 * Each tsconfig is required to set the flag itself, not inherit it, so a
 * change to the file it extends cannot drop it from many at once.
 *
 * In the guards suite: finding the tsconfigs walks the tree.
 */

/**
 * Written out, so each tsconfig gets its own test without running repo code
 * at collection (tests/guards/collection-calls.test.ts). The first test
 * derives the list from git and, independently, from the typecheck scripts,
 * and fails on any difference.
 */
const TSCONFIGS = [
  'apps/dev-hosts/functions/tsconfig.json',
  'apps/dev-hosts/tsconfig.json',
  'apps/site/test/roadmap-worker/tsconfig.json',
  'apps/site/tsconfig.json',
  'apps/site/worker/tsconfig.json',
  'apps/sync-worker/tsconfig.json',
  'apps/web/tsconfig.json',
  'apps/web/worker/tsconfig.json',
  'packages/bots/tsconfig.json',
  'packages/content/tsconfig.json',
  'packages/core/logs/tsconfig.json',
  'packages/core/properties/tsconfig.json',
  'packages/core/test/tsconfig.json',
  'packages/core/tsconfig.json',
  'packages/lockdown/test/tsconfig.json',
  'packages/lockdown/tsconfig.json',
  'packages/progress/tsconfig.json',
  'packages/ui/tsconfig.json',
  'tests/web/tsconfig.json',
  'tsconfig.json',
] as const;

/** The tsconfig one typecheck command in `dir`'s package.json reads. */
function tsconfigOf(dir: string, command: string): string | undefined {
  const words = command.trim().split(/\s+/);
  const at = (flag: string): string | undefined => {
    const i = words.indexOf(flag);
    return i === -1 ? undefined : words[i + 1];
  };
  const [tool] = words;
  if (tool === 'npm' && command.includes('--workspaces')) return undefined;
  let named: string;
  if (tool === 'tsc') named = at('-p') ?? '.';
  else if (tool === 'svelte-check') named = at('--tsconfig') ?? '.';
  else if (tool === 'astro' && words[1] === 'check') named = '.';
  else
    throw new Error(
      `${dir}/package.json: unknown typecheck command "${command}"`,
    );
  const file = named.endsWith('.json') ? named : join(named, 'tsconfig.json');
  return normalize(join(dir, file));
}

type Manifest = { workspaces?: string[]; scripts?: Record<string, string> };

/** Every tsconfig named by a `typecheck` script, root and workspaces. */
function tsconfigsTheTypecheckReads(): string[] {
  const root = JSON.parse(readFileSync('package.json', 'utf8')) as Manifest;
  // Each workspace glob is `<dir>/*`; any other form fails, not skipped.
  const dirs = (root.workspaces ?? []).map((glob) => {
    if (!/^[\w-]+\/\*$/.test(glob))
      throw new Error(`package.json: unknown workspaces form "${glob}"`);
    return glob.slice(0, -2);
  });
  const packages = committableFiles(['package.json', '*/package.json']).filter(
    (path) =>
      path === 'package.json' ||
      dirs.some(
        (dir) => path.split('/').length === 3 && path.startsWith(`${dir}/`),
      ),
  );
  const read = new Set<string>();
  // runtime population: the manifests git holds, read at run time.
  for (const path of packages) {
    const script = (JSON.parse(readFileSync(path, 'utf8')) as Manifest).scripts
      ?.typecheck;
    if (script === undefined) continue;
    for (const command of script.split('&&')) {
      const tsconfig = tsconfigOf(dirname(path), command);
      if (tsconfig !== undefined) read.add(tsconfig);
    }
  }
  return [...read].sort();
}

describe('erasable syntax only (#653)', () => {
  it('lists every tsconfig git has, each one the typecheck reads', () => {
    const derived = committableFiles(['tsconfig.json', '*/tsconfig.json']);
    expect(tsconfigsTheTypecheckReads()).toEqual(derived);
    expect(TSCONFIGS).toEqual(derived);
  });

  it.each(TSCONFIGS)('%s sets erasableSyntaxOnly itself', (path) => {
    const tsconfig = parse(readFileSync(path, 'utf8')) as {
      compilerOptions?: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions?.erasableSyntaxOnly).toBe(true);
  });
});
