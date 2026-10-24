/**
 * Coverage (#728): `npm run test:coverage` measures every suite pull-request
 * CI runs, joins them and writes the table of each tracked code file's
 * untested statements and branch arms; `record` writes that table as the
 * committed record, in the record-floors workflow only.
 *
 *   node scripts/coverage.ts measure
 *   node scripts/coverage.ts record
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import type { Change } from './ci-scope.ts';
import { COVERAGE_SUITES, coverageConfigFile } from './coverage-config.ts';
import {
  buildTable,
  formatTable,
  joinMaps,
  rises,
  type Count,
  type Table,
} from './coverage-table.ts';
import { coverageReport, reporterArgs } from './coverage-same-tests.ts';
import { RECORD_JOB_ENV, recordRefusal } from './record-floors.ts';

export const RECORD_FILE = 'tests/coverage/record.json';
export const TABLE_FILE = 'coverage/table.json';
export const META_FILE = 'coverage/meta.json';

/**
 * A suite's environment under coverage: the run's own, without the record
 * switch, so the measured code takes the paths it takes on a pull request
 * (#728 design, Wobble).
 */
export const childEnv = (
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== RECORD_JOB_ENV && entry[1] !== undefined,
    ),
  );

/**
 * What runs a suite under coverage: its coverage config, with the JSON test
 * report the coverage-same-tests job compares with the suite's own step
 * (#762 AC3).
 */
export const suiteArgs = (name: string): string[] => [
  'vitest',
  'run',
  '-c',
  coverageConfigFile(name),
  ...reporterArgs(coverageReport(name)),
];

/** Why a report cannot be judged at `head`, or nothing. */
export function metaRefusal(
  text: string | undefined,
  head: string,
): string | undefined {
  if (text === undefined)
    return `no coverage report (${META_FILE}): run npm run test:coverage first`;
  let commit: unknown;
  try {
    commit = (JSON.parse(text) as { commit?: unknown }).commit;
  } catch {
    commit = undefined;
  }
  if (typeof commit !== 'string')
    return `${META_FILE} is not a coverage report: run npm run test:coverage again`;
  return commit === head
    ? undefined
    : `the coverage report measured ${commit}, not ${head}: run npm run test:coverage again`;
}

/**
 * What floors:fetch does with the coverage record: a run from before the
 * record existed uploads none and nothing is lost, but a tree that holds a
 * record must get one back.
 */
export function coveragePlan(uploaded: boolean, local: boolean): string {
  if (uploaded) return 'fetch';
  return local
    ? `the tree holds ${RECORD_FILE} but the run uploaded no coverage record: dispatch record-floors again`
    : 'skip';
}

/** Renames in a `git diff --name-status -M` reading: new path to old. */
export const renamesFrom = (changes: readonly Change[]): Map<string, string> =>
  new Map(
    changes
      .filter(({ status }) => status.startsWith('R'))
      .map(({ paths }) => [paths[1] as string, paths[0] as string]),
  );

/** A record's files, or undefined when the text is not a record. */
const recordFiles = (text: string): Table | undefined => {
  try {
    const files = (JSON.parse(text) as { files?: unknown }).files;
    return typeof files === 'object' && files !== null && !Array.isArray(files)
      ? (files as Table)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Why floors:fetch must not write a fetched coverage record: every file
 * whose untested code grew against the record at the merge base (`base`,
 * undefined before the first record), or a record it cannot read.
 */
export function fetchedRecordRefusals(
  base: string | undefined,
  fetched: string,
  renamed: ReadonlyMap<string, string>,
): string[] {
  const next = recordFiles(fetched);
  if (next === undefined)
    return ['the fetched coverage record is not a record'];
  if (base === undefined) return [];
  const before = recordFiles(base);
  if (before === undefined)
    return ['the coverage record at the merge base is not a record'];
  return rises(before, next, renamed);
}

const die = (message: string): never => {
  console.error(`coverage: ${message}`);
  process.exit(1);
};

function output(command: string, args: readonly string[]): string {
  const run = spawnSync(command, args, { encoding: 'utf8' });
  if (run.error !== undefined)
    die(`${command} did not start: ${run.error.message}`);
  if (run.status !== 0)
    die(`${command} ${args.join(' ')} failed: ${run.stderr.trim()}`);
  return run.stdout.trim();
}

const readOrUndefined = (path: string): string | undefined => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

/** A count as the run prints it: the share run, then both counts. */
export const percent = ({ untested, total }: Count): string =>
  `${(total === 0 ? 100 : (100 * (total - untested)) / total).toFixed(1)}% run (${untested.toLocaleString('en')} of ${total.toLocaleString('en')} untested)`;

function measure(): void {
  const head = output('git', ['rev-parse', 'HEAD']);
  for (const { name } of COVERAGE_SUITES) {
    console.log(`coverage: the ${name} suite`);
    const run = spawnSync('npx', suiteArgs(name), {
      stdio: 'inherit',
      env: childEnv(process.env),
    });
    if (run.error !== undefined)
      die(`the ${name} suite did not start: ${run.error.message}`);
    if (run.status !== 0)
      die(
        `the ${name} suite failed (exit ${String(run.status)}): nothing measured`,
      );
  }
  const maps = COVERAGE_SUITES.map(
    ({ name }) =>
      JSON.parse(
        readFileSync(join('coverage', name, 'coverage-final.json'), 'utf8'),
      ) as CoverageMapData,
  );
  const tracked = output('git', ['ls-files', '-z'])
    .split('\0')
    .filter((path) => path !== '')
    .map((path) => ({
      path,
      // Only an extensionless file's kind depends on its first line.
      firstLine:
        extname(path) === ''
          ? (readFileSync(path, 'utf8').split('\n', 1)[0] ?? '')
          : '',
    }));
  const { table, problems } = buildTable(
    joinMaps(maps),
    tracked,
    (path) => readFileSync(path, 'utf8'),
    process.cwd(),
  );
  if (problems.length > 0) die(`nothing written:\n  ${problems.join('\n  ')}`);
  const text = formatTable(table);
  writeFileSync(TABLE_FILE, text);
  writeFileSync(META_FILE, `${JSON.stringify({ commit: head })}\n`);
  const { totals } = JSON.parse(text) as {
    totals: { statements: Count; branches: Count };
  };
  console.log(
    `coverage: ${String(Object.keys(table).length)} files at ${head}\n` +
      `  statements: ${percent(totals.statements)}\n` +
      `  branch arms: ${percent(totals.branches)}`,
  );
}

function record(): void {
  const refusal = recordRefusal(process.env);
  if (refusal !== undefined) die(refusal.replace('floors are', 'coverage is'));
  const head = output('git', ['rev-parse', 'HEAD']);
  const stale = metaRefusal(readOrUndefined(META_FILE), head);
  if (stale !== undefined) die(stale);
  mkdirSync(dirname(RECORD_FILE), { recursive: true });
  writeFileSync(RECORD_FILE, readFileSync(TABLE_FILE, 'utf8'));
  console.log(`coverage: recorded ${RECORD_FILE} at ${head}`);
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === 'measure') measure();
  else if (command === 'record') record();
  else die('name a command: measure or record');
}
