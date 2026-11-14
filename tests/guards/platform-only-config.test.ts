import { ESLint, type Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { platformOnly } from '../../eslint.platform-only';

/**
 * The full eslint.config.js applies the platform-only bans (#124 AC3) to
 * every kind of source file outside packages/platform, exactly as
 * eslint.platform-only.ts writes them, and to core's source through core's
 * own block. It loads the full config and every plugin it names, so it runs
 * here rather than in the unit suite (#477). Type information is off: the
 * bans are syntactic.
 */

const eslint = new ESLint({
  overrideConfig: [
    // A fixture path is not on disk, and the project service refuses a
    // file it cannot find, a .svelte one included (measured on #124's CI).
    {
      files: ['**/*.ts', '**/*.svelte'],
      ...tseslint.configs.disableTypeChecked,
    },
  ],
});
const configFor = (filePath: string): Promise<Linter.Config> =>
  eslint.calculateConfigForFile(filePath) as Promise<Linter.Config>;

/** The options a rule carries after its severity. */
const optionsOf = (entry: unknown): unknown[] => [entry].flat().slice(1);

describe('the full ESLint config holds every source file outside packages/platform to the bans (#124 AC3)', () => {
  it.each([
    'packages/ui/src/fixture.ts',
    'packages/ui/src/Fixture.svelte',
    'packages/content/src/fixture.ts',
    'packages/core/src/fixture.ts',
    'apps/web/src/fixture.ts',
    'apps/site/src/pages/fixture.astro',
    'apps/site/holding/public/fixture.js',
    'scripts/fixture.ts',
  ])('%s', async (filePath) => {
    const rules = (await configFor(filePath)).rules ?? {};
    expect
      .soft(optionsOf(rules['no-restricted-globals']), 'no-restricted-globals')
      .toEqual(
        expect.arrayContaining(
          optionsOf(platformOnly['no-restricted-globals']),
        ),
      );
    expect
      .soft(optionsOf(rules['no-restricted-syntax']), 'no-restricted-syntax')
      .toEqual(
        expect.arrayContaining(optionsOf(platformOnly['no-restricted-syntax'])),
      );
  });
});

describe('packages/platform itself is not held to them (#124 AC3)', () => {
  it.each([
    'packages/platform/src/web.ts',
    'packages/platform/test/web.test.ts',
  ])('%s', async (filePath) => {
    const rules = (await configFor(filePath)).rules ?? {};
    expect.soft(rules['no-restricted-globals']).toBeUndefined();
    expect.soft(rules['no-restricted-syntax']).toBeUndefined();
  });
});

describe('a ban linted through the full config is reported (#124 AC3)', () => {
  it('navigator.vibrate in a Svelte component', async () => {
    const [result] = await eslint.lintText(
      '<script lang="ts">\n  navigator.vibrate(10);\n</script>\n',
      { filePath: 'packages/ui/src/Fixture.svelte' },
    );
    expect(result?.messages.map((m) => m.ruleId)).toEqual([
      'no-restricted-syntax',
    ]);
  });
});
