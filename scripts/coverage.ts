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
import {
  onAllowlist,
  parseNameStatus,
  readDiff,
  type Change,
} from './ci-scope.ts';
import { COVERAGE_SUITES, coverageConfigFile } from './coverage-config.ts';
import {
  buildTable,
  formatTable,
  joinMaps,
  rises,
  unrecorded,
  type Count,
  type Table,
} from './coverage-table.ts';
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

/**
 * The coverage job's verdict: (a) the measured table equals the record, and
 * (b) no file's untested code grew against the record at the merge base. Only
 * the pull request that adds the record may have none at its base.
 */
export function checkProblems({
  measured,
  recorded,
  base,
  addsRecord,
  renamed,
}: {
  measured: Table;
  recorded: Table;
  base: Table | undefined;
  addsRecord: boolean;
  renamed: ReadonlyMap<string, string>;
}): string[] {
  const ratchet =
    base !== undefined
      ? rises(base, recorded, renamed)
      : addsRecord
        ? []
        : [
            'no coverage record at the merge base, and this pull request does not add one: merge develop in',
          ];
  return [...unrecorded(measured, recorded), ...ratchet];
}

/**
 * Why a documents-only pull request has not proved nothing measured changed
 * (ruling on #728, "Prove nothing changed"): every changed file must be one
 * ci-scope.ts calls a document, and none may be in the record. An empty
 * change fails closed.
 */
export function docsOnlyProblems(
  changed: readonly string[],
  recorded: ReadonlySet<string>,
): string[] {
  if (changed.length === 0)
    return ['no changed file to judge: the documents-only proof fails closed'];
  return changed.flatMap((path) => [
    ...(onAllowlist(path)
      ? []
      : [`${path} is not a document: the full coverage run judges it`]),
    ...(recorded.has(path) ? [`${path} is in the coverage record`] : []),
  ]);
}

/**
 * The record written where it belongs, its folder made first: the first
 * record lands in a folder the tree does not hold yet (#728, PR 2's first
 * floors:fetch died on it with ENOENT).
 */
export const writeRecord = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

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
    const run = spawnSync(
      'npx',
      ['vitest', 'run', '-c', coverageConfigFile(name)],
      { stdio: 'inherit', env: childEnv(process.env) },
    );
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
  writeRecord(RECORD_FILE, readFileSync(TABLE_FILE, 'utf8'));
  console.log(`coverage: recorded ${RECORD_FILE} at ${head}`);
}

/** A record's files, or death naming what could not be read. */
const filesOf = (path: string, text: string | undefined): Table => {
  if (text === undefined) return die(`no ${path}`);
  const files = recordFiles(text);
  return files ?? die(`${path} is not a coverage record`);
};

/**
 * The coverage job's check: the measured table against the committed record
 * (a), and the record against the one at the merge base with origin/develop
 * (b). Every problem is named; any fails the job.
 */
function check(): void {
  const head = output('git', ['rev-parse', 'HEAD']);
  const stale = metaRefusal(readOrUndefined(META_FILE), head);
  if (stale !== undefined) die(stale);
  const measured = filesOf(TABLE_FILE, readOrUndefined(TABLE_FILE));
  const recorded = filesOf(
    RECORD_FILE,
    readOrUndefined(RECORD_FILE) ??
      die(
        `no ${RECORD_FILE}: dispatch record-floors on this commit and run npm run floors:fetch`,
      ),
  );
  const base = output('git', ['merge-base', 'HEAD', 'origin/develop']);
  const shown = spawnSync('git', ['show', `${base}:${RECORD_FILE}`], {
    encoding: 'utf8',
  });
  // `output` trims whitespace only, so -z's closing NUL is kept.
  const changes = parseNameStatus(
    output('git', ['diff', '--name-status', '-z', '-M', base, 'HEAD']),
  );
  const problems = checkProblems({
    measured,
    recorded,
    base:
      shown.status === 0
        ? filesOf(`${RECORD_FILE} at ${base}`, shown.stdout)
        : undefined,
    addsRecord: changes.some(
      ({ status, paths }) => status === 'A' && paths[0] === RECORD_FILE,
    ),
    renamed: renamesFrom(changes),
  });
  if (problems.length > 0)
    die(
      `${String(problems.length)} file(s) differ from the record or grew:\n  ${problems.join('\n  ')}`,
    );
  console.log(
    `coverage: all ${String(Object.keys(measured).length)} files match the record, and none grew against ${base}`,
  );
}

/**
 * A documents-only pull request's proof: the diff build-and-test classified
 * (HEAD^1..HEAD) changes only documents, and none is in the record.
 */
function docsOnly(): void {
  const changed = parseNameStatus(readDiff(process.cwd())).flatMap(
    ({ paths }) => paths,
  );
  const recorded = new Set(
    Object.keys(filesOf(RECORD_FILE, readOrUndefined(RECORD_FILE))),
  );
  const problems = docsOnlyProblems(changed, recorded);
  if (problems.length > 0)
    die(`not proved documents-only:\n  ${problems.join('\n  ')}`);
  console.log(
    `coverage: ${String(changed.length)} changed file(s), all documents, none in the record: nothing measured changed`,
  );
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === 'measure') measure();
  else if (command === 'record') record();
  else if (command === 'check') check();
  else if (command === 'docs-only') docsOnly();
  else die('name a command: measure, record, check or docs-only');
}
