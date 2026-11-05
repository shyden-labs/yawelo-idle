import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leftOut } from '../unit/left-out';

/**
 * No browser test is skipped on any target, or anywhere (#883 AC4): a test
 * is made useful on every target or removed. Each browser suite's files and
 * every Playwright config are read for each way Playwright can leave a test
 * out. It walks folders, so it is a guard (#530), and reads nothing until
 * the test runs.
 */

const SUITES = ['tests/web', 'tests/engines', 'tests/site'];

const browserFiles = () =>
  [
    ...SUITES.flatMap((dir) =>
      readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter((name) => name.endsWith('.ts'))
        .map((name) => join(dir, name)),
    ),
    ...readdirSync('.').filter((name) =>
      /^playwright\..+\.config\.ts$/.test(name),
    ),
  ].sort();

describe('the browser suites skip nothing (#883 AC4)', () => {
  it('reads every suite and every config', () => {
    const files = browserFiles();
    expect(files).toEqual(
      expect.arrayContaining([
        'playwright.engines.config.ts',
        'playwright.site.config.ts',
        'playwright.web.config.ts',
        'tests/engines/determinism.spec.ts',
        'tests/site/smoke-config.ts',
        'tests/web/shell.spec.ts',
      ]),
    );
  });

  it('finds no test left out in any of them', () => {
    // runtime population: the suites' files are whatever the folders hold.
    const found = browserFiles().flatMap((file) =>
      leftOut(file, readFileSync(file, 'utf8')),
    );
    expect(found).toEqual([]);
  });
});
