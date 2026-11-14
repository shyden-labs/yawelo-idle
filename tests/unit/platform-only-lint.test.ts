import { describe, expect, it } from 'vitest';
import { ESLint, type Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { coreDeterminismBlock } from '../../eslint.core-determinism';
import { platformOnlyBlock } from '../../eslint.platform-only';

/**
 * Only packages/platform touches `indexedDB`, `Notification` or
 * `navigator.vibrate` (#124 AC3). Each form is linted as real code at a
 * game source path and must be reported; the same code inside
 * packages/platform must not be. ESLint reads the parse tree, so a comment or
 * a string naming them is never reported. The bans alone are loaded, after
 * core's block as eslint.config.js orders them, so core's own source is
 * judged too; tests/guards/platform-only-config.test.ts holds the full
 * config to this block.
 */

const BAN_RULES = new Set(['no-restricted-globals', 'no-restricted-syntax']);
const GAME_FIXTURE = 'packages/ui/src/fixture.ts';
const PLATFORM_FIXTURE = 'packages/platform/src/fixture.ts';
const CORE_FIXTURE = 'packages/core/src/fixture.ts';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
    platformOnlyBlock,
    coreDeterminismBlock,
  ],
});
// The first lint warms the parser and the rules' schemas (#544).
await eslint.lintText('export {};\n', { filePath: GAME_FIXTURE });

async function bans(
  code: string,
  filePath = GAME_FIXTURE,
): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (result === undefined) throw new Error(`no lint result for ${filePath}`);
  expect(
    result.messages.filter((m) => m.fatal === true),
    `fixture must parse: ${code}`,
  ).toEqual([]);
  return result.messages.filter(
    (m) => m.ruleId !== null && BAN_RULES.has(m.ruleId),
  );
}

const DECLARE =
  'declare const window: Record<string, unknown> & { navigator: Record<string, (n: number) => void> };\n';

describe('outside packages/platform, every way to reach the host directly is reported (#124 AC3)', () => {
  it('the indexedDB global', async () => {
    expect(await bans('export const x = indexedDB;')).toHaveLength(1);
  });
  it('globalThis.indexedDB', async () => {
    expect(await bans('export const x = globalThis.indexedDB;')).not.toEqual(
      [],
    );
  });
  it('window.indexedDB', async () => {
    expect(
      await bans(`${DECLARE}export const x = window.indexedDB;`),
    ).not.toEqual([]);
  });
  it("window['indexedDB']", async () => {
    expect(
      await bans(`${DECLARE}export const x = window['indexedDB'];`),
    ).not.toEqual([]);
  });
  it('indexedDB destructured from window', async () => {
    expect(
      await bans(
        `${DECLARE}const { indexedDB } = window;\nexport const x = indexedDB;`,
      ),
    ).not.toEqual([]);
  });
  it('a new Notification', async () => {
    expect(await bans("export const x = new Notification('hi');")).toHaveLength(
      1,
    );
  });
  it('Notification.requestPermission', async () => {
    expect(
      await bans('export const x = Notification.requestPermission();'),
    ).not.toEqual([]);
  });
  it('window.Notification', async () => {
    expect(
      await bans(`${DECLARE}export const x = window.Notification;`),
    ).not.toEqual([]);
  });
  it('navigator.vibrate', async () => {
    expect(await bans('export const x = navigator.vibrate(10);')).toHaveLength(
      1,
    );
  });
  it('window.navigator.vibrate', async () => {
    expect(await bans(`${DECLARE}window.navigator.vibrate(10);`)).not.toEqual(
      [],
    );
  });
  it("navigator['vibrate']", async () => {
    expect(
      await bans("export const x = navigator['vibrate'](10);"),
    ).not.toEqual([]);
  });
  it('vibrate destructured from navigator', async () => {
    expect(
      await bans('const { vibrate } = navigator;\nexport const x = vibrate;'),
    ).not.toEqual([]);
  });
  it('the indexedDB global in core’s source, where core’s own bans also apply', async () => {
    expect(
      await bans('export const x = indexedDB;', CORE_FIXTURE),
    ).toHaveLength(1);
  });
});

describe('the ban leaves everything else alone (#124 AC3)', () => {
  const CODE =
    "export const x = [indexedDB, new Notification('hi'), navigator.vibrate(10)];";

  it('the same code inside packages/platform', async () => {
    expect(await bans(CODE, PLATFORM_FIXTURE)).toEqual([]);
    // Liveness: the same text is reported at a game path, once per form.
    expect(await bans(CODE)).toHaveLength(3);
  });
  it('a comment naming them', async () => {
    const commented =
      '// indexedDB, Notification and navigator.vibrate live in packages/platform.\n/* window.indexedDB */\nexport const x = 1;';
    expect(await bans(commented)).toEqual([]);
    // Liveness: uncommented, the same names are reported.
    expect(
      await bans(
        `export const x = [indexedDB, Notification, navigator.vibrate];`,
      ),
    ).toHaveLength(3);
  });
  it('a string naming them', async () => {
    expect(
      await bans("export const x = ['indexedDB', 'Notification', 'vibrate'];"),
    ).toEqual([]);
  });
  it('other navigator members', async () => {
    expect(await bans('export const x = navigator.language;')).toEqual([]);
  });
});
