import { relative, sep } from 'node:path';
import libCoverage from 'istanbul-lib-coverage';
import type { CoverageMapData, FileCoverageData } from 'istanbul-lib-coverage';
import { codeLines, kindOf } from './coverage-kinds.ts';

/**
 * The coverage record's table (#728): for every tracked code file, its
 * untested statements and untested branch arms, of how many. The ratchet
 * compares these counts, file by file (Shyden, 2026-10-22: "Untested count",
 * then "make this apply to every project").
 */
export interface Count {
  untested: number;
  total: number;
}

export interface Untested {
  statements: Count;
  branches: Count;
}

export interface Entry extends Untested {
  measure: 'v8' | 'lines';
}

export type Table = Record<string, Entry>;

const count = (hits: readonly number[]): Count => ({
  untested: hits.filter((hit) => hit === 0).length,
  total: hits.length,
});

/** One file's statements and branch arms no test ran. */
export const untested = (data: FileCoverageData): Untested => ({
  statements: count(Object.values(data.s)),
  branches: count(Object.values(data.b).flat()),
});

/** Every suite's map joined: a statement or arm any suite ran counts as run. */
export const joinMaps = (maps: readonly CoverageMapData[]): CoverageMapData => {
  const joined = libCoverage.createCoverageMap({});
  for (const map of maps) joined.merge(map);
  return joined.toJSON();
};

/**
 * The table for the tracked files. A `v8` file missing from the report and a
 * file of no listed kind are problems, never zero: absence fails closed. A
 * reported file nobody tracks (generated types) is left out.
 */
export function buildTable(
  joined: CoverageMapData,
  tracked: readonly { path: string; firstLine: string }[],
  read: (path: string) => string,
  root: string,
): { table: Table; problems: string[] } {
  const reported = new Map(
    Object.values(joined).map((data) => [
      relative(root, data.path).split(sep).join('/'),
      data,
    ]),
  );
  const table: Table = {};
  const problems: string[] = [];
  for (const { path, firstLine } of tracked) {
    const kind = kindOf(path, firstLine);
    if (kind === undefined)
      problems.push(`${path} is of no listed kind (scripts/coverage-kinds.ts)`);
    else if (kind === 'lines') {
      const lines = codeLines(path, read(path));
      table[path] = {
        measure: 'lines',
        statements: { untested: lines, total: lines },
        branches: { untested: 0, total: 0 },
      };
    } else if (kind === 'v8') {
      const data = reported.get(path);
      if (data === undefined)
        problems.push(`${path} is tracked code but no suite reported it`);
      else table[path] = { measure: 'v8', ...untested(data) };
    }
  }
  return { table, problems };
}

const sum = (entries: readonly Entry[], key: keyof Untested): Count => ({
  untested: entries.reduce((total, entry) => total + entry[key].untested, 0),
  total: entries.reduce((total, entry) => total + entry[key].total, 0),
});

/** The record's bytes: files sorted by path, totals, a final newline. */
export function formatTable(table: Table): string {
  const paths = Object.keys(table).sort();
  const files = Object.fromEntries(
    paths.map((path) => [path, table[path] as Entry]),
  );
  const entries = Object.values(files);
  return `${JSON.stringify(
    {
      files,
      totals: {
        statements: sum(entries, 'statements'),
        branches: sum(entries, 'branches'),
      },
    },
    null,
    2,
  )}\n`;
}

const LABELS: readonly (readonly [keyof Untested, string])[] = [
  ['statements', 'statements'],
  ['branches', 'branch arms'],
];

/**
 * Every file whose untested code grew against the record at the base: the
 * ratchet (Shyden, 2026-10-22). A file new to the record enters at zero, and
 * a renamed file (`renamed`: new path to old) is judged against its old path.
 * Every rise is named, not only the first.
 */
export function rises(
  base: Table,
  next: Table,
  renamed: ReadonlyMap<string, string>,
): string[] {
  const problems: string[] = [];
  for (const path of Object.keys(next).sort()) {
    const old = renamed.get(path) ?? path;
    const before = base[old];
    const after = next[path] as Entry;
    for (const [key, label] of LABELS) {
      const was = before?.[key].untested ?? 0;
      const now = after[key].untested;
      if (now <= was) continue;
      problems.push(
        before === undefined
          ? `${path} enters the record with ${String(now)} untested ${label}; a file new to the record enters at zero`
          : `${old === path ? path : `${path} (was ${old})`}: untested ${label} rose from ${String(was)} to ${String(now)}`,
      );
    }
  }
  return problems;
}

/** `2/10 and 0/10`: untested statements and branch arms, of how many. */
const counts = ({ statements, branches }: Untested): string =>
  `${String(statements.untested)}/${String(statements.total)} and ${String(branches.untested)}/${String(branches.total)}`;

/** The same, with its units named once. */
const countsNamed = ({ statements, branches }: Untested): string =>
  `${String(statements.untested)}/${String(statements.total)} statements and ${String(branches.untested)}/${String(branches.total)} branch arms untested`;

const sameCounts = (a: Untested, b: Untested): boolean =>
  a.statements.untested === b.statements.untested &&
  a.statements.total === b.statements.total &&
  a.branches.untested === b.branches.untested &&
  a.branches.total === b.branches.total;

/**
 * Every file whose measured counts differ from the record: check (a), a gain
 * or a loss nobody recorded (Shyden, 2026-10-22: "Must be recorded"). Both
 * directions, every file named, in path order.
 */
export function unrecorded(measured: Table, recorded: Table): string[] {
  const paths = [
    ...new Set([...Object.keys(measured), ...Object.keys(recorded)]),
  ].sort();
  const problems: string[] = [];
  for (const path of paths) {
    const now = measured[path];
    const then = recorded[path];
    if (then === undefined)
      problems.push(`${path} is measured but not recorded`);
    else if (now === undefined)
      problems.push(`${path} is recorded but was not measured`);
    else if (now.measure !== then.measure)
      problems.push(
        `${path}: measured by ${now.measure}, recorded by ${then.measure}`,
      );
    else if (!sameCounts(now, then))
      problems.push(
        `${path}: measured ${countsNamed(now)}, recorded ${counts(then)}`,
      );
  }
  return problems;
}
