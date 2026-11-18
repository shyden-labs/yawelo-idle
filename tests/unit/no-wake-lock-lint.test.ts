import { describe, expect, it } from 'vitest';
import { ESLint, type Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { coreDeterminismBlock } from '../../eslint.core-determinism';
import { noWakeLockBlock } from '../../eslint.no-wake-lock';
import { platformOnlyBlock } from '../../eslint.platform-only';

/**
 * Nothing ever keeps the device awake (#128 AC4; spec §6.3, DN22): every way
 * to reach `navigator.wakeLock` is reported in game code, in core and in
 * packages/platform alike. The three blocks are loaded in eslint.config.js's
 * order, because a later block's `no-restricted-syntax` replaces an earlier
 * one's. ESLint reads the parse tree, so a comment or a string naming it is
 * never reported.
 */

const BAN_RULE = 'no-restricted-syntax';
const PATHS = [
  'packages/ui/src/fixture.ts',
  'packages/core/src/fixture.ts',
  'packages/platform/src/fixture.ts',
] as const;

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
    platformOnlyBlock,
    coreDeterminismBlock,
    noWakeLockBlock,
  ],
});
// The first lint warms the parser and the rules' schemas (#544).
await eslint.lintText('export {};\n', { filePath: PATHS[0] });

async function bans(
  code: string,
  filePath: string,
): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (result === undefined) throw new Error(`no lint result for ${filePath}`);
  expect(
    result.messages.filter((m) => m.fatal === true),
    `fixture must parse: ${code}`,
  ).toEqual([]);
  return result.messages.filter(
    (m) => m.ruleId === BAN_RULE && m.message.includes('wakeLock'),
  );
}

const DECLARE =
  'declare const window: { navigator: Record<string, unknown> };\n';

describe.each(PATHS)(
  'in %s, every way to reach wakeLock is reported (#128 AC4)',
  (path) => {
    it('navigator.wakeLock', async () => {
      expect(
        await bans(
          "export const x = navigator.wakeLock.request('screen');",
          path,
        ),
      ).toHaveLength(1);
    });
    it('window.navigator.wakeLock', async () => {
      expect(
        await bans(
          `${DECLARE}export const x = window.navigator.wakeLock;`,
          path,
        ),
      ).toHaveLength(1);
    });
    it("navigator['wakeLock']", async () => {
      expect(
        await bans("export const x = navigator['wakeLock'];", path),
      ).toHaveLength(1);
    });
    it('wakeLock destructured from navigator', async () => {
      expect(
        await bans(
          'const { wakeLock } = navigator;\nexport const x = wakeLock;',
          path,
        ),
      ).toHaveLength(1);
    });
    it('a comment or a string naming it is not', async () => {
      expect(
        await bans(
          "// navigator.wakeLock is never used\nexport const x = 'wakeLock';",
          path,
        ),
      ).toEqual([]);
    });
  },
);
