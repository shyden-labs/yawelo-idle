import { describe, expect, it } from 'vitest';
import { skipCommentsIn } from './coverage-skip';

/**
 * A comment telling coverage to skip lines (#728): the ruling counts those
 * lines as unrun, so the guards refuse the comment itself. Every form the
 * three tools read, and the decoys a text search would trip on.
 */
const SKIPS: readonly (readonly [string, string, number])[] = [
  ['v8, next', '/* v8 ignore next */\nconst a = 1;\n', 1],
  ['v8, next with a count', '/* v8 ignore next 3 */\nconst a = 1;\n', 1],
  [
    'v8, start',
    '/* v8 ignore start */\nconst a = 1;\n/* v8 ignore stop */\n',
    2,
  ],
  ['v8, if', 'if (a) {} /* v8 ignore if */\n', 1],
  [
    'v8, kept through a bundler',
    '/* v8 ignore next -- @preserve */\nconst a = 1;\n',
    1,
  ],
  ['c8, next', '/* c8 ignore next */\nconst a = 1;\n', 1],
  ['c8, a line comment', '// c8 ignore next\nconst a = 1;\n', 1],
  ['istanbul, else', 'if (a) {} /* istanbul ignore else */ else {}\n', 1],
  ['istanbul, file', '/* istanbul ignore file */\n', 1],
  ['upper case', '/* V8 IGNORE NEXT */\nconst a = 1;\n', 1],
  ['two spaces', '/* v8  ignore next */\nconst a = 1;\n', 1],
  ['inside a JSDoc block', '/**\n * v8 ignore next\n */\nconst a = 1;\n', 1],
];

describe('every form of a skip comment is found (#728)', () => {
  for (const [form, text, count] of SKIPS)
    it(`${form} (${String(count)})`, () => {
      expect(skipCommentsIn('a.ts', text)).toHaveLength(count);
    });
});

const DECOYS: readonly (readonly [string, string])[] = [
  ['a string', "const a = '/* v8 ignore next */';\n"],
  ['a template', 'const a = `// c8 ignore next`;\n'],
  ['a regex', 'const a = /istanbul ignore/;\n'],
  ['prose naming the tool', '// v8 measures this; nothing is ignored\n'],
];

/** A real skip comment written after each decoy: the only one found. */
const REAL = '/* c8 ignore next */\n';

describe('the same words outside a comment are not a skip (#728)', () => {
  for (const [form, text] of DECOYS)
    it(form, () => {
      expect(skipCommentsIn('a.ts', `${text}${REAL}`)).toEqual([
        'a.ts: /* c8 ignore next */',
      ]);
    });
});

describe('a finding names the file and the comment (#728)', () => {
  it('reads like a reason', () => {
    expect(skipCommentsIn('x/a.ts', '/* c8 ignore next */\n')).toEqual([
      'x/a.ts: /* c8 ignore next */',
    ]);
  });
});
