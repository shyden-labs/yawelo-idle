import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { committableFiles } from '../unit/tracked-files';

/**
 * Every test that isn't a unit test runs against the real thing (#813, global
 * real-tests rule). A non-unit suite may hold a stand-in (a fake, stub, echo,
 * mock or test double) only where Shyden has ruled it stays, recorded on
 * #813. Unit tests keep their mocks and are not judged here.
 */

/** Where the non-unit suites live: integration, Playwright (game and site, #827), Worker harnesses. */
const NON_UNIT =
  /^(tests\/(integration|web|engines|site)\/|apps\/[^/]+\/test\/)/;

/**
 * The stand-ins Shyden ruled may stay (#813, 2026-11-01): the roadmap's fake
 * GitHub (#814 closed as not worth it), and the stand-in `gh` that
 * board-progress's test puts first on PATH.
 */
const RULED: readonly string[] = [
  'apps/site/test/github-fake/',
  'apps/site/test/roadmap/',
  'apps/site/test/roadmap-worker/',
  'tests/integration/board-progress.test.ts',
];

const NAMED = /(^|[-_.])(fake|stub|mock|echo|stand-?in)s?([-_.]|$)/i;

const CONTENT: readonly (readonly [RegExp, string])[] = [
  [/\bfak(e|es|ed)\b/i, 'says "fake"'],
  [/\bstub(s|bed)?\b/i, 'says "stub"'],
  [/\bstand-?ins?\b/i, 'says "stand-in"'],
  [/\bmock(s|ed)?\b/i, 'says "mock"'],
  // An identifier such as fakeNpm, stubServer, echoWorker or FAKE_ID.
  [
    /\b(fake|stub|mock|echo|Fake|Stub|Mock|Echo|FAKE|STUB|MOCK|ECHO)(?=[A-Z0-9_])/,
    'names a stand-in identifier',
  ],
  [
    /\bvi\.(mock|doMock|fn|spyOn|stubGlobal|stubEnv|useFakeTimers)\b/,
    'uses a vitest test double',
  ],
  [/\b(page|context)\.route\(/, 'intercepts the network'],
];

/** Why `path`, holding `text`, looks like a stand-in; empty when it does not. */
function standInReasons(path: string, text: string): string[] {
  if (!NON_UNIT.test(path)) return [];
  // A folder entry (ending in /) rules everything under it; a file, itself.
  if (
    RULED.some((ruled) =>
      ruled.endsWith('/') ? path.startsWith(ruled) : path === ruled,
    )
  )
    return [];
  const reasons = path
    .split('/')
    .filter((segment) => NAMED.test(segment))
    .map((segment) => `is named "${segment}"`);
  for (const [pattern, reason] of CONTENT)
    if (pattern.test(text)) reasons.push(reason);
  return reasons;
}

describe('no stand-in in a non-unit suite without a ruling (#813)', () => {
  it('finds none in the tree', () => {
    // runtime population: the files are whatever git would commit now.
    const searched = committableFiles().filter((path) => NON_UNIT.test(path));
    const found = searched
      .map((path) => ({
        path,
        reasons: standInReasons(path, readFileSync(path, 'utf8')),
      }))
      .filter(({ reasons }) => reasons.length > 0)
      .map(({ path, reasons }) => `${path} ${reasons.join(', ')}`);
    expect(searched.length).toBeGreaterThan(0);
    expect(found, found[0]).toEqual([]);
  });

  it('refuses a file named fake', () => {
    expect(standInReasons('tests/integration/fake-npm.ts', '')).toEqual([
      'is named "fake-npm.ts"',
    ]);
  });

  it('refuses a folder named stub', () => {
    expect(standInReasons('apps/web/test/stubs/a.ts', '')).toEqual([
      'is named "stubs"',
    ]);
  });

  it('refuses a file named echo', () => {
    expect(standInReasons('apps/site/test/game-echo.ts', '')).toEqual([
      'is named "game-echo.ts"',
    ]);
  });

  it('refuses a file named mock', () => {
    expect(standInReasons('tests/web/mock.ts', '')).toEqual([
      'is named "mock.ts"',
    ]);
  });

  it('refuses a file named stand-in', () => {
    expect(standInReasons('tests/engines/standin.ts', '')).toEqual([
      'is named "standin.ts"',
    ]);
  });

  it('refuses text saying fake', () => {
    expect(standInReasons('tests/web/a.spec.ts', 'a faked beacon')).toEqual([
      'says "fake"',
    ]);
  });

  it('refuses text saying stub', () => {
    expect(standInReasons('tests/web/a.spec.ts', 'serves a stub')).toEqual([
      'says "stub"',
    ]);
  });

  it('refuses text saying stand-in', () => {
    expect(standInReasons('tests/web/a.spec.ts', 'a stand-in npm')).toEqual([
      'says "stand-in"',
    ]);
  });

  it('refuses text saying mock', () => {
    expect(standInReasons('tests/web/a.spec.ts', 'mocked D1')).toEqual([
      'says "mock"',
    ]);
  });

  it('refuses a stand-in identifier', () => {
    expect(standInReasons('tests/web/a.spec.ts', 'const echoWorker =')).toEqual(
      ['names a stand-in identifier'],
    );
  });

  it('refuses a constant naming a fake', () => {
    expect(standInReasons('tests/web/a.spec.ts', 'FAKE_BOARD_ID')).toEqual([
      'names a stand-in identifier',
    ]);
  });

  it('lets the shell command echo through', () => {
    expect(standInReasons('tests/integration/a.ts', "run(`echo 'x'`)")).toEqual(
      [],
    );
  });

  it('refuses a vitest test double', () => {
    expect(
      standInReasons('apps/sync-worker/test/a.test.ts', 'vi.spyOn(db, "x")'),
    ).toEqual(['uses a vitest test double']);
  });

  it('refuses network interception', () => {
    expect(standInReasons('tests/web/a.spec.ts', 'await page.route(')).toEqual([
      'intercepts the network',
    ]);
  });

  it('lets a ruled path through', () => {
    expect(
      standInReasons('apps/site/test/github-fake/fake-github.ts', 'fake'),
    ).toEqual([]);
  });

  it('does not let a near-miss of a ruled file through', () => {
    expect(
      standInReasons('tests/integration/board-progress.test.ts.bak', 'fake'),
    ).toEqual(['says "fake"']);
  });

  it('leaves unit tests alone', () => {
    expect(standInReasons('tests/unit/a.test.ts', 'vi.mock("x")')).toEqual([]);
  });

  it('reads words whole, so "mockingbird" and "echoes" pass', () => {
    expect(
      standInReasons('tests/web/a.spec.ts', 'mockingbird echoes stubborn'),
    ).toEqual([]);
  });
});
