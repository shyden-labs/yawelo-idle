import { describe, expect, it } from 'vitest';
import { fastCheckLoads } from './fast-check-loads.ts';

/**
 * Every way a file loads fast-check at run time (#551). The unit suite keeps
 * stand-ins on chosen cases with no random draw, and every property runs in
 * the properties suite (#543, global rule 2026-10-12), so a file the unit
 * suite loads loads no fast-check at all. A type-only import loads nothing
 * and is allowed. Each case reads one in-memory file.
 */
const loads = (code: string): readonly string[] =>
  fastCheckLoads(code, 'fixture.test.ts').loads;

describe('the reader finds fast-check loaded', () => {
  const FORMS: readonly (readonly [string, string, string])[] = [
    [
      'a default import',
      "import fc from 'fast-check';",
      "line 1: import from 'fast-check'",
    ],
    [
      'a namespace import',
      "import * as fc from 'fast-check';",
      "line 1: import from 'fast-check'",
    ],
    [
      'a named import of assert',
      "import { assert } from 'fast-check';",
      "line 1: import from 'fast-check'",
    ],
    [
      'a renamed import',
      "import { assert as run } from 'fast-check';",
      "line 1: import from 'fast-check'",
    ],
    [
      'a mixed import whose value part loads it',
      "import { type Arbitrary, check } from 'fast-check';",
      "line 1: import from 'fast-check'",
    ],
    [
      'an import for its effects alone',
      "import 'fast-check';",
      "line 1: import from 'fast-check'",
    ],
    [
      'a named re-export',
      "export { assert } from 'fast-check';",
      "line 1: re-export from 'fast-check'",
    ],
    [
      'a re-export of everything',
      "export * from 'fast-check';",
      "line 1: re-export from 'fast-check'",
    ],
    [
      'a dynamic import',
      "const fc = await import('fast-check');",
      "line 1: import('fast-check')",
    ],
    [
      'a require',
      "const fc = require('fast-check');",
      "line 1: require('fast-check')",
    ],
    [
      'a createRequire loader',
      "import { createRequire } from 'node:module';\nconst load = createRequire(import.meta.url);\nconst fc = load('fast-check');",
      "line 3: load('fast-check')",
    ],
    [
      'a subpath',
      "import { assert } from 'fast-check/lib/check';",
      "line 1: import from 'fast-check/lib/check'",
    ],
    [
      'the Vitest integration',
      "import { test } from '@fast-check/vitest';",
      "line 1: import from '@fast-check/vitest'",
    ],
    [
      'an import written over lines',
      "import {\n  assert,\n  property,\n} from 'fast-check';",
      "line 1: import from 'fast-check'",
    ],
  ];

  it.each(FORMS)('through %s', (_form, code, site) => {
    expect(loads(code)).toEqual([site]);
  });

  it('once for each site, in source order', () => {
    expect(
      loads("import fc from 'fast-check';\nexport * from 'fast-check';"),
    ).toEqual([
      "line 1: import from 'fast-check'",
      "line 2: re-export from 'fast-check'",
    ]);
  });
});

describe('the reader allows', () => {
  // Each case also loads one package that is not fast-check, so what it
  // allows is read against a specifier the reader met.
  const ALLOWED: readonly (readonly [string, string, readonly string[]])[] = [
    [
      'a type-only import',
      "import type { Arbitrary } from 'fast-check';",
      ["'fast-check'"],
    ],
    [
      'an import whose every name is a type',
      "import { type Arbitrary } from 'fast-check';",
      ["'fast-check'"],
    ],
    [
      'a type-only re-export',
      "export type { Arbitrary } from 'fast-check';",
      ["'fast-check'"],
    ],
    [
      'fast-check named in a comment',
      '// properties run with fast-check (#543)',
      [],
    ],
    [
      'fast-check named in a string',
      "const why = 'fast-check runs in properties';",
      [],
    ],
    [
      'a package whose name only starts alike',
      "import x from 'fast-checker';",
      ["'fast-checker'"],
    ],
  ];

  it.each(ALLOWED)('%s', (_label, code, met) => {
    expect(
      fastCheckLoads(`${code}\nimport { z } from 'zod';`, 'fixture.test.ts'),
    ).toEqual({ loads: [], specifiers: [...met, "'zod'"] });
  });
});

describe('the reader counts what it read', () => {
  it('lists every module specifier it met, runtime or type-only, as the population it judged', () => {
    expect(
      fastCheckLoads(
        "import type { A } from 'fast-check';\nimport fc from 'fast-check';\nimport { x } from './h';\nconst y = await import('./y');",
        'fixture.test.ts',
      ).specifiers,
    ).toEqual(["'fast-check'", "'fast-check'", "'./h'", "'./y'"]);
  });

  it('refuses a dynamic import of a computed path by name, since it may be fast-check', () => {
    expect(
      fastCheckLoads(
        "const p = 'fast-' + 'check';\nawait import(p);",
        'fixture.test.ts',
      ).loads,
    ).toEqual(['line 2: import(p) is not a literal path']);
  });
});
