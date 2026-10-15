import { describe, expect, it } from 'vitest';
import {
  classify,
  classifyMutation,
  mutationFor,
  mutationInput,
  mutationReport,
  onAllowlist,
  parseNameStatus,
  report,
  scopeFor,
  type Change,
} from '../../scripts/ci-scope';
import { floorBreach } from '../floors';
import { searched } from '../searched';

/**
 * The docs-only fast path (#360). build-and-test classifies the change it
 * tests (the pull request's merge commit, or one commit under every-commit)
 * against its first parent. Docs-only means every changed path is
 * HANDOVER.md or Markdown under docs/, and then only Format and the unit
 * suite run. Anything else, and anything the classifier cannot read, is
 * full: every step runs as before.
 *
 * The pure half is tested here, on name-status text. The git half, on real
 * repositories and the script under Node, starts processes, so it is in
 * tests/integration/ci-scope.test.ts (#490).
 */

const NUL = '\0';
const z = (...fields: string[]) => fields.map((f) => f + NUL).join('');
const change = (status: string, path: string): Change => ({
  status,
  paths: [path],
});

describe('the allowlist (AC1)', () => {
  it.each([
    'HANDOVER.md',
    'docs/plan.md',
    'docs/superpowers/plans/2026-10-05-ci-360.md',
    'docs/compliance/trademark search.md',
  ])('admits %s', (path) => {
    expect(onAllowlist(path)).toBe(true);
  });

  it.each([
    ['other Markdown at the root', 'README.md'],
    ['a document a test reads', 'TRADEMARKS.md'],
    ['a file under docs/ that is not Markdown', 'docs/diagram.svg'],
    ['code under docs/', 'docs/tool.ts'],
    ['Markdown in a directory named like docs', 'docsx/plan.md'],
    ['a docs directory below the root', 'apps/web/docs/plan.md'],
    ['a file named docs.md', 'docs.md'],
    ['the handover spelled in another case', 'handover.md'],
    ['Markdown in upper case', 'docs/plan.MD'],
    ['a handover in a subdirectory', 'apps/HANDOVER.md'],
  ])('refuses %s (%s)', (_why, path) => {
    expect(onAllowlist(path)).toBe(false);
  });
});

describe('reading git diff --name-status -z (AC4)', () => {
  it('reads one change per status and path', () => {
    expect(
      parseNameStatus(z('M', 'HANDOVER.md', 'A', 'docs/a b.md', 'D', 'x.ts')),
    ).toEqual([
      change('M', 'HANDOVER.md'),
      change('A', 'docs/a b.md'),
      change('D', 'x.ts'),
    ]);
  });

  it('reads a rename or copy as one change with both paths', () => {
    expect(
      parseNameStatus(z('R100', 'docs/a.md', 'docs/b.md', 'C075', 'a', 'b')),
    ).toEqual([
      { status: 'R100', paths: ['docs/a.md', 'docs/b.md'] },
      { status: 'C075', paths: ['a', 'b'] },
    ]);
  });

  it('reads an empty diff as no changes', () => {
    expect(parseNameStatus('')).toEqual([]);
  });

  it.each([
    ['text that does not end in NUL', 'M\0HANDOVER.md'],
    ['a status with no path', z('M')],
    ['a rename with one path', z('R100', 'docs/a.md')],
    ['a field that is not a status', z('modified', 'HANDOVER.md')],
    ['an empty path', z('M', '')],
  ])('refuses %s by name', (_why, text) => {
    expect(() => parseNameStatus(text)).toThrow(/name-status/);
  });
});

describe('the classification (AC1, AC4)', () => {
  it('is docs-only when every path is on the allowlist, judging each', () => {
    const result = classify([
      change('M', 'HANDOVER.md'),
      change('A', 'docs/new.md'),
    ]);
    expect(result.scope).toBe('docs-only');
    expect(result.judged).toEqual(['HANDOVER.md', 'docs/new.md']);
  });

  it('is docs-only for a deletion on the allowlist', () => {
    expect(classify([change('D', 'docs/old.md')]).scope).toBe('docs-only');
  });

  it('is full for one code path, and names it', () => {
    const result = classify([change('M', 'scripts/every-commit.ts')]);
    expect(result.scope).toBe('full');
    expect(result.reason).toContain('scripts/every-commit.ts');
    expect(result.judged).toEqual(['scripts/every-commit.ts']);
  });

  it('is full for a deletion off the allowlist', () => {
    expect(classify([change('D', 'scripts/old.ts')]).scope).toBe('full');
  });

  it('is full for a mix with the code path first, judging both', () => {
    const result = classify([
      change('M', 'package.json'),
      change('M', 'HANDOVER.md'),
    ]);
    expect(result.scope).toBe('full');
    expect(result.reason).toContain('package.json');
    expect(result.reason).not.toContain('HANDOVER.md');
    expect(result.judged).toEqual(['package.json', 'HANDOVER.md']);
  });

  it('is full for a mix with the code path last, judging both', () => {
    const result = classify([
      change('M', 'HANDOVER.md'),
      change('A', 'docs/a.md'),
      change('M', 'TRADEMARKS.md'),
    ]);
    expect(result.scope).toBe('full');
    expect(result.reason).toContain('TRADEMARKS.md');
    expect(result.judged).toEqual([
      'HANDOVER.md',
      'docs/a.md',
      'TRADEMARKS.md',
    ]);
  });

  it('is full for an empty diff, saying there was nothing to judge', () => {
    const result = classify([]);
    expect(result.scope).toBe('full');
    expect(result.reason).toMatch(/empty/);
    expect(result.judged).toEqual([]);
  });

  it('is full for a rename record, which --no-renames never asks git for', () => {
    expect(
      classify([{ status: 'R100', paths: ['docs/a.md', 'docs/b.md'] }]).scope,
    ).toBe('full');
  });

  it.each([
    ['a type change', 'T'],
    ['an unmerged path', 'U'],
    ['an unknown change', 'X'],
    ['a broken pair', 'B'],
  ])('is full for %s on an allowlisted path, naming the status', (_why, s) => {
    const result = classify([change(s, 'docs/a.md')]);
    expect(result.scope).toBe('full');
    expect(result.reason).toContain(`${s} docs/a.md`);
  });
});

/** Events whose run is full whatever the diff holds, so the diff is never read. */
const FULL_EVENTS = ['push', 'workflow_dispatch', 'merge_group', ''] as const;

describe('the event decides whether the fast path applies at all (AC3)', () => {
  it.each(FULL_EVENTS)(
    'a %j event is full without reading the diff',
    (event) => {
      const reads: string[] = [];
      const result = scopeFor(event, () => {
        reads.push(event);
        return z('M', 'HANDOVER.md');
      });
      expect(result.scope).toBe('full');
      expect(result.reason).toContain(JSON.stringify(event));
      expect(searched(reads, { of: FULL_EVENTS, what: 'events' })).toEqual([]);
      expect(
        floorBreach('ci-scope/full-events', FULL_EVENTS.length),
      ).toBeUndefined();
    },
  );

  it('a pull_request event reads the diff once and classifies it', () => {
    let reads = 0;
    const result = scopeFor('pull_request', () => {
      reads += 1;
      return z('M', 'HANDOVER.md');
    });
    expect(result.scope).toBe('docs-only');
    expect(reads).toBe(1);
  });

  it('a diff that cannot be read is full, naming the reason', () => {
    const result = scopeFor('pull_request', () => {
      throw new Error('fatal: bad revision HEAD^1');
    });
    expect(result.scope).toBe('full');
    expect(result.reason).toContain('fatal: bad revision HEAD^1');
  });

  it('a diff that cannot be parsed is full, naming the reason', () => {
    const result = scopeFor('pull_request', () => 'M\0HANDOVER.md');
    expect(result.scope).toBe('full');
    expect(result.reason).toMatch(/name-status/);
  });
});

describe('the printed report (AC1)', () => {
  it('states the scope and reason, then every judged path and its side', () => {
    expect(
      report(classify([change('M', 'HANDOVER.md'), change('M', 'x.ts')])),
    ).toEqual([
      'scope: full (outside the docs-only allowlist: x.ts)',
      'judged 2 paths:',
      '  docs   HANDOVER.md',
      '  other  x.ts',
    ]);
  });

  it('counts one judged path in the singular', () => {
    expect(report(classify([change('M', 'HANDOVER.md')]))[1]).toBe(
      'judged 1 path:',
    );
  });

  it('counts no judged paths in the plural', () => {
    expect(report(classify([]))[1]).toBe('judged 0 paths:');
  });
});

describe('the mutation verdict (#36 AC2)', () => {
  it.each([
    'packages/core/src/sail.ts',
    'packages/core/test/sail.test.ts',
    'packages/core/package.json',
    'packages/core/tsconfig.json',
    'stryker.config.json',
    'vitest.stryker.config.ts',
    'package.json',
    'package-lock.json',
    '.nvmrc',
    '.github/workflows/mutation.yml',
    'scripts/ci-scope.ts',
    'scripts/fail-on-warnings.sh',
    'stryker.equivalents.json',
    'scripts/mutation-survivors.ts',
  ])('takes %s as something the mutation run reads', (path) => {
    expect(mutationInput(path)).toBe(true);
  });

  it.each([
    ['a doc', 'docs/plan.md'],
    ['the handover', 'HANDOVER.md'],
    ['another package', 'packages/progress/src/index.ts'],
    ['an app', 'apps/web/src/main.ts'],
    ['a repo test', 'tests/unit/ci-scope.test.ts'],
    ['another workflow', '.github/workflows/ci.yml'],
    ['another script', 'scripts/board-next.ts'],
    ['a package named like core', 'packages/core-extra/src/a.ts'],
    ['a core directory below the root', 'apps/packages/core/src/a.ts'],
    ['a workspace package.json', 'apps/web/package.json'],
  ])(
    'does not take %s (%s) as something the mutation run reads',
    (_why, path) => {
      expect(mutationInput(path)).toBe(false);
    },
  );

  it('runs when one path is read, naming it and not the others', () => {
    const verdict = classifyMutation([
      change('M', 'docs/plan.md'),
      change('M', 'packages/core/src/sail.ts'),
    ]);
    expect(verdict.mutation).toBe('run');
    expect(verdict.reason).toContain('packages/core/src/sail.ts');
    expect(verdict.reason).not.toContain('docs/plan.md');
  });

  it('runs when a deleted path is read', () => {
    expect(
      classifyMutation([change('D', 'packages/core/src/old.ts')]).mutation,
    ).toBe('run');
  });

  it('skips when no path is read, saying so', () => {
    expect(
      classifyMutation([
        change('M', 'docs/plan.md'),
        change('A', 'apps/web/src/a.ts'),
      ]),
    ).toEqual({
      mutation: 'skip',
      reason: 'the change touches nothing the core mutation run reads',
    });
  });

  it('runs for an empty diff, saying there was nothing to judge', () => {
    const verdict = classifyMutation([]);
    expect(verdict.mutation).toBe('run');
    expect(verdict.reason).toMatch(/empty/);
  });

  it.each([
    ['a rename record', { status: 'R100', paths: ['docs/a.md', 'docs/b.md'] }],
    ['a type change', { status: 'T', paths: ['docs/a.md'] }],
    ['an unmerged path', { status: 'U', paths: ['docs/a.md'] }],
  ])('runs for %s off the inputs, naming the status', (_why, c) => {
    const verdict = classifyMutation([c]);
    expect(verdict.mutation).toBe('run');
    expect(verdict.reason).toContain(c.status);
  });

  it('runs for any event but pull_request, naming it', () => {
    const verdict = mutationFor('push', () => 'M\0docs/plan.md\0');
    expect(verdict.mutation).toBe('run');
    expect(verdict.reason).toContain('"push"');
  });

  it('judges a pull request by its diff', () => {
    expect(
      mutationFor('pull_request', () => 'M\0docs/plan.md\0').mutation,
    ).toBe('skip');
  });

  it('runs when the diff cannot be read, naming the reason', () => {
    const verdict = mutationFor('pull_request', () => {
      throw new Error('fatal: bad revision HEAD^1');
    });
    expect(verdict.mutation).toBe('run');
    expect(verdict.reason).toContain('fatal: bad revision HEAD^1');
  });

  it('runs when the diff cannot be parsed, naming the reason', () => {
    const verdict = mutationFor('pull_request', () => 'M\0docs/plan.md');
    expect(verdict.mutation).toBe('run');
    expect(verdict.reason).toMatch(/name-status/);
  });

  it('prints its verdict and reason on one line', () => {
    expect(
      mutationReport(classifyMutation([change('M', 'docs/plan.md')])),
    ).toBe(
      'mutation: skip (the change touches nothing the core mutation run reads)',
    );
  });
});
