import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkLicences,
  describeFindings,
  judge,
  PERMISSIVE,
  WEAK_COPYLEFT,
} from '../../scripts/licence-check';
import type { Lockfile } from '../../scripts/third-party-notices';

/**
 * Every package's licence is compatible with ours (#464, Shyden 2026-10-07):
 * what ships to players must be permissive; build and test tools may also be
 * weak copyleft; GPL, AGPL, SSPL, a missing or an unreadable licence is red.
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
});

describe('weak copyleft', () => {
  it('is allowed for build and test tools only', () => {
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

  it('refuses a weak-copyleft package that ships', () => {
    expect(judge('MPL-2.0', 'shipped')).toBe(
      'it ships to players, so it must be permissive',
    );
  });

  it('passes a weak-copyleft build tool', () => {
    expect(judge('MPL-2.0', 'build')).toBeUndefined();
  });

  it('refuses a GPL build tool', () => {
    expect(judge('GPL-3.0-only', 'build')).toBe(
      'not permissive or weak copyleft',
    );
  });

  it('refuses AGPL', () => {
    expect(judge('AGPL-3.0-only', 'build')).toBe(
      'not permissive or weak copyleft',
    );
  });

  it('refuses SSPL', () => {
    expect(judge('SSPL-1.0', 'build')).toBe('not permissive or weak copyleft');
  });

  it('refuses a package with no licence', () => {
    expect(judge(undefined, 'build')).toBe('it has no licence');
  });

  it('refuses a blank licence', () => {
    expect(judge('  ', 'build')).toBe('it has no licence');
  });

  it('passes an OR with one allowed branch', () => {
    expect(judge('GPL-2.0-only OR MIT', 'shipped')).toBeUndefined();
  });

  it('refuses an OR with no allowed branch', () => {
    expect(judge('GPL-2.0-only OR SSPL-1.0', 'build')).toBe(
      'not permissive or weak copyleft',
    );
  });

  it('refuses an AND with one disallowed part', () => {
    expect(judge('MIT AND GPL-2.0-only', 'build')).toBe(
      'not permissive or weak copyleft',
    );
  });

  it('passes an AND of weak copyleft and permissive for a build tool', () => {
    expect(
      judge('Apache-2.0 AND LGPL-3.0-or-later AND MIT', 'build'),
    ).toBeUndefined();
  });

  it('binds AND tighter than OR', () => {
    expect(judge('MIT OR ISC AND GPL-3.0-only', 'shipped')).toBeUndefined();
  });

  it('refuses an expression it cannot read: a slash', () => {
    expect(judge('MIT/Apache', 'build')).toBe(
      'cannot read licence "MIT/Apache"',
    );
  });

  it('passes a bracketed choice of allowed licences, as npm often writes it', () => {
    expect(judge('(MIT OR Apache-2.0)', 'shipped')).toBeUndefined();
  });

  it('reads brackets before AND', () => {
    expect(judge('(MIT OR GPL-3.0-only) AND BSD-2-Clause', 'shipped')).toBe(
      undefined,
    );
  });

  it('refuses a bracket whose every branch is disallowed', () => {
    expect(judge('(GPL-2.0-only OR SSPL-1.0) AND MIT', 'build')).toBe(
      'not permissive or weak copyleft',
    );
  });

  it('reads nested brackets', () => {
    expect(
      judge('((GPL-3.0-only OR MIT) AND (ISC OR AGPL-3.0-only))', 'shipped'),
    ).toBeUndefined();
  });

  it('refuses an expression it cannot read: a bracket left open', () => {
    expect(judge('(MIT OR ISC', 'build')).toBe(
      'cannot read licence "(MIT OR ISC"',
    );
  });

  it('refuses an expression it cannot read: a bracket closed by a licence', () => {
    expect(judge('(MIT ISC', 'build')).toBe('cannot read licence "(MIT ISC"');
  });

  it('refuses an expression it cannot read: an operator after an operator', () => {
    expect(judge('MIT OR AND', 'build')).toBe(
      'cannot read licence "MIT OR AND"',
    );
  });

  it('refuses an expression it cannot read: a stray closing bracket', () => {
    expect(judge('MIT) OR (ISC', 'build')).toBe(
      'cannot read licence "MIT) OR (ISC"',
    );
  });

  it('refuses an expression it cannot read: empty brackets', () => {
    expect(judge('() OR MIT', 'build')).toBe('cannot read licence "() OR MIT"');
  });

  it('refuses an expression it cannot read: a WITH exception', () => {
    expect(judge('GPL-2.0-only WITH Classpath-exception-2.0', 'build')).toBe(
      'cannot read licence "GPL-2.0-only WITH Classpath-exception-2.0"',
    );
  });

  it('refuses an expression it cannot read: a lowercase operator', () => {
    expect(judge('MIT or ISC', 'build')).toBe(
      'cannot read licence "MIT or ISC"',
    );
  });

  it('refuses an expression it cannot read: a dangling operator', () => {
    expect(judge('MIT OR', 'build')).toBe('cannot read licence "MIT OR"');
  });

  it('refuses an expression it cannot read: an operator in place of a licence', () => {
    expect(judge('AND MIT', 'build')).toBe('cannot read licence "AND MIT"');
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
        license: 'GPL-3.0-only',
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
        'gpl-tool 3.0.0 (GPL-3.0-only, build): not permissive or weak copyleft',
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
