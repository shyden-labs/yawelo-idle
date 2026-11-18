import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

/**
 * Every unused parameter is refused (#833): `contextAt` in core carried an
 * unused `state` before a used one, and ESLint's default `args: "after-used"`
 * let it through. The full eslint.config.js lints planted samples here, with
 * type information off: the rule is syntactic, and the project service
 * refuses a path that is not on disk.
 */
const FIXTURE = 'packages/core/src/fixture.ts';
const REFUSED =
  "'unused' is defined but never used. Allowed unused args must match /^_/u.";

const eslint = new ESLint({
  overrideConfig: [
    { files: ['**/*.ts'], ...tseslint.configs.disableTypeChecked },
  ],
});

const unusedVars = async (sample: string): Promise<string[]> => {
  const [result] = await eslint.lintText(sample, { filePath: FIXTURE });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === '@typescript-eslint/no-unused-vars')
    .map((m) => m.message);
};

describe('the full ESLint config refuses unused parameters (#833)', () => {
  it('refuses an unused parameter before a used one', async () => {
    expect(
      await unusedVars(
        'export function f(unused: number, used: number): number {\n  return used;\n}\n',
      ),
    ).toEqual([REFUSED]);
  });

  it('refuses an unused last parameter', async () => {
    expect(
      await unusedVars(
        'export function f(used: number, unused: number): number {\n  return used;\n}\n',
      ),
    ).toEqual([REFUSED]);
  });

  it('lets an underscore-named slot a callback signature needs through', async () => {
    expect(
      await unusedVars('export const g = [1].map((_value, index) => index);\n'),
    ).toEqual([]);
  });

  it('lets a used parameter through', async () => {
    expect(
      await unusedVars(
        'export function f(used: number): number {\n  return used;\n}\n',
      ),
    ).toEqual([]);
  });
});
