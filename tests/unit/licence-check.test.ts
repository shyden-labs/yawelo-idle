import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkLicences,
  describeFindings,
  judge,
  parseSpdx,
  PERMISSIVE,
  WEAK_COPYLEFT,
} from '../../scripts/licence-check';
import type { Lockfile } from '../../scripts/third-party-notices';

/**
 * Every package's licence is compatible with ours (#464, Shyden 2026-10-07):
 * shipped packages permissive, build and test tools may also be weak
 * copyleft, and GPL, AGPL, SSPL, a missing or an unreadable licence are red.
 */

describe('the allowed licences', () => {
  it('permissive, for anything that ships', () => {
    expect(PERMISSIVE).toEqual([
      '0BSD',
      'Apache-2.0',
      'BlueOak-1.0.0',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'CC0-1.0',
      'ISC',
      'MIT',
      'MIT-0',
      'Python-2.0',
      'Unlicense',
    ]);
  });

  it('weak copyleft, for build and test tools only', () => {
    expect(WEAK_COPYLEFT).toEqual([
      'LGPL-2.1-only',
      'LGPL-2.1-or-later',
      'LGPL-3.0-only',
      'LGPL-3.0-or-later',
      'MPL-2.0',
    ]);
  });
});

describe('judge', () => {
  it('passes a permissive package that ships', () => {
    expect(judge('MIT', 'shipped')).toBeUndefined();
  });

  it('passes a weak-copyleft build tool', () => {
    expect(judge('MPL-2.0', 'build')).toBeUndefined();
  });

  it('refuses a weak-copyleft package that ships', () => {
    expect(judge('MPL-2.0', 'shipped')).toBe(
      'it ships to players, so it must be permissive',
    );
  });

  it('refuses a GPL build tool', () => {
    expect(judge('GPL-3.0', 'build')).toBe('not permissive or weak copyleft');
  });

  it('refuses AGPL', () => {
    expect(judge('AGPL-3.0-only', 'build')).toBe(
      'not permissive or weak copyleft',
    );
  });

  it('refuses SSPL', () => {
    expect(judge('SSPL-1.0', 'build')).toBe('not permissive or weak copyleft');
  });

  it('refuses a missing licence', () => {
    expect(judge(undefined, 'build')).toBe('it has no licence');
  });

  it('refuses a blank licence', () => {
    expect(judge('  ', 'build')).toBe('it has no licence');
  });

  it('refuses an AND with one disallowed part', () => {
    expect(judge('MIT AND GPL-2.0', 'build')).toBe(
      'not permissive or weak copyleft',
    );
  });

  it('passes an OR with one allowed branch', () => {
    expect(judge('GPL-2.0 OR MIT', 'shipped')).toBeUndefined();
  });

  it('passes an AND of weak copyleft and permissive for a build tool', () => {
    expect(
      judge('Apache-2.0 AND LGPL-3.0-or-later AND MIT', 'build'),
    ).toBeUndefined();
  });

  it('refuses an expression it cannot parse', () => {
    expect(judge('MIT/Apache', 'build')).toBe(
      'cannot parse licence "MIT/Apache": "MIT/Apache" is not a licence identifier',
    );
  });
});

describe('parseSpdx', () => {
  it('binds AND tighter than OR', () => {
    expect(parseSpdx('MIT OR ISC AND GPL-3.0')).toEqual({
      kind: 'or',
      parts: [
        { kind: 'id', id: 'MIT' },
        {
          kind: 'and',
          parts: [
            { kind: 'id', id: 'ISC' },
            { kind: 'id', id: 'GPL-3.0' },
          ],
        },
      ],
    });
  });

  it('follows brackets', () => {
    expect(parseSpdx('(MIT OR ISC) AND BSD-2-Clause')).toEqual({
      kind: 'and',
      parts: [
        {
          kind: 'or',
          parts: [
            { kind: 'id', id: 'MIT' },
            { kind: 'id', id: 'ISC' },
          ],
        },
        { kind: 'id', id: 'BSD-2-Clause' },
      ],
    });
  });

  it('refuses a WITH exception, which it does not judge', () => {
    expect(() => parseSpdx('GPL-2.0 WITH Classpath-exception-2.0')).toThrow(
      '"WITH" is not expected here',
    );
  });

  it('refuses a bracket left open', () => {
    expect(() => parseSpdx('(MIT OR ISC')).toThrow('a bracket is not closed');
  });

  it('refuses a dangling operator', () => {
    expect(() => parseSpdx('MIT OR')).toThrow('it ends early');
  });

  it('refuses an operator in place of a licence', () => {
    expect(() => parseSpdx('AND MIT')).toThrow(
      '"AND" is not a licence identifier',
    );
  });

  it('refuses a lowercase operator', () => {
    expect(() => parseSpdx('MIT or ISC')).toThrow('"or" is not expected here');
  });
});

describe('checkLicences', () => {
  const planted: Lockfile = {
    packages: {
      '': {},
      'apps/web': { version: '0.0.0' },
      'node_modules/@yawelo-idle/web': { link: true },
      'node_modules/fine': { version: '1.0.0', license: 'MIT' },
      'node_modules/mpl-shipped': { version: '2.0.0', license: 'MPL-2.0' },
      'node_modules/gpl-tool': {
        version: '3.0.0',
        license: 'GPL-3.0',
        dev: true,
      },
      'node_modules/a/node_modules/bare': { version: '4.0.0', dev: true },
    },
  };

  it('judges every third-party package and skips the workspaces', () => {
    expect(checkLicences(planted).judged).toBe(4);
  });

  it('names each refused package with its version, licence, tier and reason', () => {
    expect(describeFindings(checkLicences(planted).findings)).toBe(
      [
        'mpl-shipped 2.0.0 (MPL-2.0, shipped): it ships to players, so it must be permissive',
        'gpl-tool 3.0.0 (GPL-3.0, build): not permissive or weak copyleft',
        'bare 4.0.0 ((none), build): it has no licence',
      ].join('\n'),
    );
  });
});

describe("this repository's lockfile", () => {
  it('holds no package whose licence is refused (npm run licences)', () => {
    const lock = JSON.parse(
      readFileSync('package-lock.json', 'utf8'),
    ) as Lockfile;
    const { findings } = checkLicences(lock);
    expect(findings, describeFindings(findings)).toEqual([]);
  });
});
