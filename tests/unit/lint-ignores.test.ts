import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * ESLint's ignores are derived from `.gitignore`, never listed by hand. A
 * hand-written list missed `.wrangler/` and a local agent's scratch files, so
 * an untracked TypeScript file on a contributor's machine failed `npm run lint`
 * while CI, which has no such file, stayed green.
 */
const ignoredEntries = readFileSync('.gitignore', 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(
    (line) => line !== '' && !line.startsWith('#') && !line.startsWith('!'),
  );

/** A directory entry is probed with a file inside it; a file entry as itself. */
const probeFor = (entry: string): string =>
  entry.endsWith('/') ? `${entry}probe.ts` : entry;

/**
 * Only entries ESLint would lint with every ignore switched off can show
 * anything. ESLint reports a file no config matches (`.dev.vars`, `.DS_Store`)
 * as ignored, and always ignores `node_modules/`, so those would pass with no
 * ignore config at all.
 */
const unignored = new ESLint({ ignore: false });
const lintableEntries: string[] = [];
for (const entry of ignoredEntries) {
  if (!(await unignored.isPathIgnored(probeFor(entry)))) {
    lintableEntries.push(entry);
  }
}

describe('lint ignores follow .gitignore', () => {
  it('checks the .gitignore entries ESLint would otherwise lint', () => {
    expect(lintableEntries).toEqual(
      expect.arrayContaining([
        '.wrangler/',
        '.superpowers/',
        '.remember/',
        'apps/sync-worker/worker-configuration.d.ts',
      ]),
    );
  });

  it.each(lintableEntries)('ESLint skips %s', async (entry) => {
    const eslint = new ESLint();
    expect(await eslint.isPathIgnored(probeFor(entry))).toBe(true);
  });
});
