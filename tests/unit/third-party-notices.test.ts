import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  pickFile,
  shippedPackages,
  type Lockfile,
} from '../../scripts/third-party-notices';

/**
 * Third-party notices for everything a shipped build bundles (#26 AC11).
 *
 * Apache-2.0 §4 requires a copy of the licence and every NOTICE text of the
 * works we redistribute, and MIT requires its copyright line. The six direct
 * @stdlib packages pull in 152, several of whose LICENSE files append
 * upstream copyrights (Sun, the Go Authors) to the Apache text, so the listing is
 * derived from the lockfile and the installed files, never kept by hand.
 */

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as Lockfile;
const listing = readFileSync('THIRD-PARTY-NOTICES.md', 'utf8');

function directDependencies(workspace: string): string[] {
  const pkg = JSON.parse(readFileSync(`${workspace}/package.json`, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(pkg.dependencies ?? {});
}

describe('THIRD-PARTY-NOTICES.md', () => {
  // That the file is exactly what the generator renders reads every bundled
  // package's folder: a guard (#530, tests/guards/third-party-notices.test.ts).

  // The lockfile is fixture data, read here so each dependency is its own test.
  const workspaces = Object.keys(lock.packages).filter(
    (path) => path !== '' && !path.includes('node_modules/'),
  );

  for (const workspace of workspaces)
    for (const name of directDependencies(workspace).filter(
      (dependency) => !dependency.startsWith('@yawelo-idle/'),
    ))
      it(`the shipped set holds ${workspace}'s dependency ${name}`, () => {
        expect(shippedPackages(lock).map((p) => p.name)).toContain(name);
      });

  it('leaves out a package npm marks as build-only, and the workspaces themselves', () => {
    const fixture: Lockfile = {
      packages: {
        '': {},
        'packages/core': { version: '0.0.0' },
        'node_modules/@yawelo-idle/core': { link: true },
        'node_modules/shipped': { version: '1.0.0', license: 'MIT' },
        'node_modules/tool': { version: '2.0.0', license: 'MIT', dev: true },
        'node_modules/a/node_modules/nested': {
          version: '3.0.0',
          license: 'ISC',
        },
      },
    };
    expect(shippedPackages(fixture)).toEqual([
      {
        name: 'nested',
        version: '3.0.0',
        license: 'ISC',
        path: 'node_modules/a/node_modules/nested',
      },
      {
        name: 'shipped',
        version: '1.0.0',
        license: 'MIT',
        path: 'node_modules/shipped',
      },
    ]);
  });

  it('refuses a shipped package with no licence in the lockfile', () => {
    expect(() =>
      shippedPackages({
        packages: { 'node_modules/bare': { version: '1.0.0' } },
      }),
    ).toThrow(
      'node_modules/bare has no version or licence in package-lock.json',
    );
  });

  it('lists every shipped package', () => {
    // runtime population: the set shippedPackages derives from the lockfile.
    // Listing it at collection would run the code under test there.
    for (const { name } of shippedPackages(lock)) {
      expect(listing, name).toContain(`\`${name}\``);
    }
  });

  it('carries every distinct licence text, including the upstream Sun and Go copyrights', () => {
    expect(listing).toContain('Apache License');
    expect(listing).toContain(
      'Copyright (C) 1993-2004 by Sun Microsystems, Inc.',
    );
    expect(listing).toContain('Copyright (c) 2009 The Go Authors.');
    expect(listing).toContain('Copyright (c) 2016-2026 The Stdlib Authors.');
  });
});

describe('pickFile, the same on every filesystem', () => {
  // Pure over a list of names, so Linux's case-sensitive behaviour is tested
  // on any OS. `ms` 2.0.0 ships `license.md`; CI (Linux) failed on it while
  // macOS's case-insensitive lookup found it.
  it.each<[string[], string | undefined]>([
    [['license.md', 'index.js'], 'license.md'],
    [['LICENSE', 'license.md'], 'LICENSE'],
    [['LICENCE.txt'], 'LICENCE.txt'],
    [['license.txt', 'LICENSE.md'], 'LICENSE.md'],
    [['LICENSE.md', 'license.txt'], 'LICENSE.md'],
    // One rank: the name decides, never the listing order.
    [['license', 'LICENSE'], 'LICENSE'],
    [['LICENSE', 'LICENCE'], 'LICENCE'],
    [['README.md', 'package.json'], undefined],
    [['LICENSE-MIT'], undefined],
  ])('picks the licence file from %j', (names, want) => {
    expect(pickFile(names, 'licence')).toBe(want);
  });

  it.each<[string[], string | undefined]>([
    [['NOTICE', 'LICENSE'], 'NOTICE'],
    [['notice.md'], 'notice.md'],
    [['LICENSE'], undefined],
  ])('picks the notice file from %j', (names, want) => {
    expect(pickFile(names, 'notice')).toBe(want);
  });
});

describe('NOTICE', () => {
  const notice = readFileSync('NOTICE', 'utf8');

  // package.json is fixture data, read here so each package is its own test.
  const stdlib = directDependencies('packages/core').filter((n) =>
    n.startsWith('@stdlib/'),
  );

  it('has bundled Apache-2.0 @stdlib packages to name', () => {
    // Measured 6 at b2a6f3f (#82). Lower it only in the commit that removes one.
    expect(stdlib.length).toBeGreaterThan(5);
  });

  for (const name of stdlib)
    it(`names the bundled Apache-2.0 package ${name}`, () => {
      expect(notice, name).toContain(name);
    });

  it('points to the full licence texts', () => {
    expect(notice).toContain('THIRD-PARTY-NOTICES.md');
  });
});
