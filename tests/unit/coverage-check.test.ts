import { describe, expect, it } from 'vitest';
import type { Entry, Table } from '../../scripts/coverage-table.ts';
import { unrecorded } from '../../scripts/coverage-table.ts';
import { checkProblems, docsOnlyProblems } from '../../scripts/coverage.ts';

const entry = (statements: number, branches = 0, total = 10): Entry => ({
  measure: 'v8',
  statements: { untested: statements, total },
  branches: { untested: branches, total },
});

/**
 * Check (a), recorded: the measured table equals the record, file by file
 * (Shyden, 2026-10-22: "Must be recorded"). A difference either way is a
 * gain or a loss nobody recorded, and every file is named.
 */
describe('the measured table equals the record (#728)', () => {
  it('names only the file that differs, beside one that matches', () => {
    expect(
      unrecorded(
        { 'a.ts': entry(1), 'b.ts': entry(2) },
        { 'a.ts': entry(1), 'b.ts': entry(3) },
      ),
    ).toEqual([
      'b.ts: measured 2/10 statements and 0/10 branch arms untested, recorded 3/10 and 0/10',
    ]);
  });

  it('a total that moved is a difference too', () => {
    expect(
      unrecorded({ 'a.ts': entry(1, 0, 11) }, { 'a.ts': entry(1) }),
    ).toEqual([
      'a.ts: measured 1/11 statements and 0/11 branch arms untested, recorded 1/10 and 0/10',
    ]);
  });

  it('a measured file the record lacks is named', () => {
    expect(
      unrecorded({ 'a.ts': entry(0), 'n.ts': entry(0) }, { 'a.ts': entry(1) }),
    ).toEqual([
      'a.ts: measured 0/10 statements and 0/10 branch arms untested, recorded 1/10 and 0/10',
      'n.ts is measured but not recorded',
    ]);
  });

  it('a recorded file nothing measured is named', () => {
    expect(
      unrecorded({ 'a.ts': entry(2) }, { 'a.ts': entry(1), 'g.ts': entry(0) }),
    ).toEqual([
      'a.ts: measured 2/10 statements and 0/10 branch arms untested, recorded 1/10 and 0/10',
      'g.ts is recorded but was not measured',
    ]);
  });

  it('a file whose measure changed is a difference', () => {
    const lines: Entry = { ...entry(1), measure: 'lines' };
    expect(
      unrecorded(
        { 'a.ts': entry(1), 'b.ts': entry(0) },
        { 'a.ts': lines, 'b.ts': entry(1) },
      ),
    ).toEqual([
      'a.ts: measured by v8, recorded by lines',
      'b.ts: measured 0/10 statements and 0/10 branch arms untested, recorded 1/10 and 0/10',
    ]);
  });
});

const table = (files: Table): Table => files;

/**
 * The job's whole verdict: (a) and (b) together, and the one pull request
 * allowed no record at its base, the one that adds it.
 */
describe('the coverage check (#728)', () => {
  it('names a rise against the base and an unrecorded gain in the same run', () => {
    expect(
      checkProblems({
        measured: table({ 'a.ts': entry(2), 'b.ts': entry(0) }),
        recorded: table({ 'a.ts': entry(2), 'b.ts': entry(1) }),
        base: table({ 'a.ts': entry(1), 'b.ts': entry(1) }),
        addsRecord: false,
        renamed: new Map(),
      }),
    ).toEqual([
      'b.ts: measured 0/10 statements and 0/10 branch arms untested, recorded 1/10 and 0/10',
      'a.ts: untested statements rose from 1 to 2',
    ]);
  });

  it('lets the pull request that adds the record judge it against nothing, where any other is refused', () => {
    const run = (addsRecord: boolean) =>
      checkProblems({
        measured: table({ 'a.ts': entry(3) }),
        recorded: table({ 'a.ts': entry(3) }),
        base: undefined,
        addsRecord,
        renamed: new Map(),
      });
    expect([run(true), run(false)]).toEqual([
      [],
      [
        'no coverage record at the merge base, and this pull request does not add one: merge develop in',
      ],
    ]);
  });

  it('judges a renamed file against its old path at the base', () => {
    expect(
      checkProblems({
        measured: table({ 'new.ts': entry(4) }),
        recorded: table({ 'new.ts': entry(4) }),
        base: table({ 'old.ts': entry(3) }),
        addsRecord: false,
        renamed: new Map([['new.ts', 'old.ts']]),
      }),
    ).toEqual(['new.ts (was old.ts): untested statements rose from 3 to 4']);
  });
});

/**
 * A documents-only pull request proves nothing measured changed (ruling on
 * #728, "Prove nothing changed"): every changed file is one ci-scope.ts calls
 * a document, and none is in the record.
 */
describe('a documents-only pull request proves nothing measured changed (#728)', () => {
  const RECORDED = new Set(['scripts/a.ts', 'docs/odd.md']);

  it('passes documents the record does not hold, beside one it does', () => {
    expect([
      docsOnlyProblems(['HANDOVER.md', 'docs/x.md'], RECORDED),
      docsOnlyProblems(['HANDOVER.md', 'docs/odd.md'], RECORDED),
    ]).toEqual([[], ['docs/odd.md is in the coverage record']]);
  });

  it('refuses a changed file that is not a document', () => {
    expect(docsOnlyProblems(['docs/x.md', 'scripts/a.ts'], RECORDED)).toEqual([
      'scripts/a.ts is not a document: the full coverage run judges it',
      'scripts/a.ts is in the coverage record',
    ]);
  });

  it('refuses a pull request that changed nothing it can read', () => {
    expect(docsOnlyProblems([], RECORDED)).toEqual([
      'no changed file to judge: the documents-only proof fails closed',
    ]);
  });
});
