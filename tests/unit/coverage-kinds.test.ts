import { describe, expect, it } from 'vitest';
import { codeLines, kindOf } from '../../scripts/coverage-kinds.ts';

/**
 * Every tracked file is code measured by V8, code counted by lines until its
 * own story measures it, or not code (#728). From the census of tracked
 * extensions on 2026-10-21: one case per kind the tree holds, plus the
 * near-misses each rule must not catch.
 */
const KINDS: readonly (readonly [string, string, string | undefined])[] = [
  ['scripts/ci-scope.ts', '', 'v8'],
  ['apps/web/worker/env.d.ts', '', 'v8'],
  ['tests/unit/setup.ts', '', 'v8'],
  ['eslint.config.js', '', 'v8'],
  ['apps/site/astro.config.mjs', '', 'v8'],
  ['tools/x.cjs', '', 'v8'],
  ['tools/x.mts', '', 'v8'],
  ['tools/x.cts', '', 'v8'],
  ['.github/workflows/ci.yml', '', 'lines'],
  ['.github/workflows/x.yaml', '', 'lines'],
  ['apps/web/src/App.svelte', '', 'lines'],
  ['apps/site/src/pages/index.astro', '', 'lines'],
  ['apps/web/index.html', '', 'lines'],
  ['scripts/fail-on-warnings.sh', '', 'lines'],
  ['.githooks/pre-push', '#!/bin/sh', 'lines'],
  ['.github/dependabot.yml', '', 'not-code'],
  ['.github/ISSUE_TEMPLATE/story.yml', '', 'not-code'],
  ['package.json', '', 'not-code'],
  ['apps/site/wrangler.jsonc', '', 'not-code'],
  ['tests/fixtures/x.jsonl', '', 'not-code'],
  ['README.md', '', 'not-code'],
  ['docs/x.txt', '', 'not-code'],
  ['apps/site/src/styles/holding.css', '', 'not-code'],
  ['apps/site/holding/public/media/a.webm', '', 'not-code'],
  ['apps/site/holding/public/media/a.mp4', '', 'not-code'],
  ['apps/site/holding/public/media/a.jpg', '', 'not-code'],
  ['.gitignore', '', 'not-code'],
  ['.nvmrc', '', 'not-code'],
  ['.npmrc', '', 'not-code'],
  ['.prettierignore', '', 'not-code'],
  ['apps/site/holding/public/_headers', '', 'not-code'],
  ['NOTICE', '', 'not-code'],
  ['LICENSE', '', 'not-code'],
  ['.github/CODEOWNERS', '', 'not-code'],
  // Unknown kinds fail closed: the table must name every kind the tree holds.
  ['apps/x/y.py', '', undefined],
  ['apps/x/y.png', '', undefined],
  ['apps/x/Makefile', '', undefined],
  ['apps/x/y.tsx', '', undefined],
];

describe('every tracked file has one kind (#728)', () => {
  for (const [path, firstLine, kind] of KINDS)
    it(`${path} is ${String(kind)}`, () => {
      expect(kindOf(path, firstLine)).toBe(kind);
    });
});

/**
 * A file counted by lines enters the record at full size: every non-blank
 * line that is not wholly a comment in its kind's syntax is one untested
 * statement, until the story that measures its kind lands.
 */
const LINES: readonly (readonly [string, string, string, number])[] = [
  ['a blank line is not code', 'x.sh', 'echo a\n\n   \necho b\n', 2],
  ['a shell comment is not code', 'x.sh', '#!/bin/sh\n# note\necho a\n', 2],
  [
    'a YAML comment is not code',
    '.github/workflows/x.yml',
    'on: push\n  # why\njobs: {}\n',
    2,
  ],
  [
    'a comment after code is code',
    '.github/workflows/x.yml',
    'on: push # why\n',
    1,
  ],
  [
    'an HTML comment line is not code',
    'x.html',
    '<!-- note -->\n<p>a</p>\n',
    1,
  ],
  [
    'a template line holding markup is code',
    'x.astro',
    '---\nconst a = 1;\n---\n<p>{a}</p>\n',
    4,
  ],
  [
    'a file without a final newline counts its last line',
    'x.svelte',
    '<p>a</p>\n<p>b</p>',
    2,
  ],
  ['an empty file has no code', 'x.sh', '', 0],
];

describe('a file counted by lines is counted at full size (#728)', () => {
  for (const [title, path, text, count] of LINES)
    it(`${title} (${String(count)})`, () => {
      expect(codeLines(path, text)).toBe(count);
    });

  it('refuses to count a kind V8 measures', () => {
    expect(() => codeLines('x.ts', 'a\n')).toThrow(
      'x.ts is measured by v8, not counted by lines',
    );
  });

  it('refuses to count a file that is not code', () => {
    expect(() => codeLines('README.md', 'a\n')).toThrow(
      'README.md is not-code, not counted by lines',
    );
  });

  it('refuses to count a file of no listed kind', () => {
    expect(() => codeLines('x.py', 'a\n')).toThrow(
      'x.py is of no listed kind, not counted by lines',
    );
  });
});
