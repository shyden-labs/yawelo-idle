import { describe, expect, it } from 'vitest';
import { leftOut } from './left-out';

/**
 * The reader behind the no-skip guard (#883 AC4,
 * tests/guards/no-skipped-browser-tests.test.ts): each way Playwright can
 * leave a test out of a run is found, named by file and line.
 */

describe('leftOut', () => {
  it.each([
    "test.skip('x', () => {});",
    'test.describe.skip(() => {});',
    "test.fixme('x', () => {});",
    'test.fixme();',
    "test.todo('x');",
    'it.skipIf(true)',
    'it.runIf(false)',
    'test.skip(browserName === "webkit");',
    '  grepInvert: /phone/,',
    "  testIgnore: '**/slow/**',",
  ])('finds %s', (line) => {
    expect(leftOut('a.spec.ts', `ok\n${line}\n`)).toEqual([
      `a.spec.ts:2: ${line.trim()}`,
    ]);
  });

  it.each([
    "test('skips nothing', () => {});",
    'const skipped = 0;',
    "await page.getByRole('button', { name: 'Skip intro' }).click();",
    'expect(todoList).toHaveLength(1);',
  ])('passes %s', (line) => {
    expect(leftOut('a.spec.ts', line)).toEqual([]);
  });
});
