/**
 * The mutation runner (#527, spec `docs/superpowers/specs/
 * 2026-10-17-mutation-runner-design.md`): `npm run mutate -- <file>...`
 * plants each mutation of each tracked mutation file (`tests/mutations/`,
 * shaped by `scripts/mutation-file.ts`), runs the whole suite its targets
 * belong to, puts the file back, and judges the run against the prediction
 * written before it. Any row not as predicted fails the run; nothing is
 * retried.
 *
 * The functions here are pure, and the unit suite proves them; `main`
 * wires them to processes and files, and the integration suite runs it.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  asMutationFile,
  FILE_SEPARATOR,
  mutationFileProblems,
  type Mutation,
  type MutationFile,
} from './mutation-file.ts';
import {
  readFloorsDir,
  RECORD_ENV,
  suiteFiles,
  type Observation,
  type Suite,
  type SuiteMutate,
} from './record-floors.ts';
import { REPORT_ENV, ROOT_ENV } from './mutate-reporter.ts';

/** The runner's reporter, by absolute path: a fixture repository runs it too. */
const REPORTER = fileURLToPath(
  new URL('./mutate-reporter.ts', import.meta.url),
);

/** A failing test: `<file> › <describe> > … > <title>`, and its whole error text. */
export interface FailedTest {
  readonly name: string;
  readonly text: string;
}

/** What one run reported, as far as a judge reads it (from `Written`). */
export interface Report {
  readonly total: number;
  /** Every test file the run reported, repository-relative. */
  readonly files: readonly string[];
  /** Each failing test, by full name, with its whole error text. */
  readonly failing: readonly FailedTest[];
  /** The failing tests that timed out. */
  readonly timedOut: readonly string[];
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const isCount = (x: unknown): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0;

const isTextList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((each) => typeof each === 'string');

/**
 * Reads what the runner's reporter wrote (`scripts/mutate-reporter.ts`),
 * refusing any shape it does not know rather than reading it as a clean run.
 */
export function readReport(json: unknown): Report {
  const refuse = (why: string): never => {
    throw new Error(`the runner's report is not readable: ${why}`);
  };
  if (!isRecord(json)) return refuse('is not an object');
  if (!isCount(json.total)) return refuse('total is not a count');
  if (!isTextList(json.files)) return refuse('files is not a list of paths');
  const failing = json.failing;
  if (
    !isRecord(failing) ||
    !Object.values(failing).every((text) => typeof text === 'string')
  )
    return refuse('failing is not a map of tests to text');
  if (!isTextList(json.timedOut))
    return refuse('timedOut is not a list of tests');
  return {
    total: json.total,
    files: json.files,
    failing: Object.entries(failing as Record<string, string>).map(
      ([name, text]) => ({ name, text }),
    ),
    timedOut: json.timedOut,
  };
}

/** A terminal colour or cursor code, which Playwright writes into its JSON even with FORCE_COLOR=0. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');

/** How Playwright ends a test (`TestCase.outcome()`). */
const OUTCOMES = new Set(['expected', 'unexpected', 'flaky', 'skipped']);

/**
 * Reads Playwright's JSON report (#649, spec §5) into the runner's report:
 * each test once per project, named `<file> › <project> > <describe> > … >
 * <title>`, files repository-relative from `root` (where the suite ran). A
 * flaky test counts failing (the runner allows no retry). An error outside
 * any test is named by its file, or by `config` when it has none. Any shape
 * it does not know is refused rather than read as a clean run.
 */
export function readPlaywrightReport(
  json: unknown,
  root: string,
  config: string,
): Report {
  const refuse = (why: string): never => {
    throw new Error(`the Playwright report ${why}`);
  };
  if (!isRecord(json)) return refuse('is not an object');
  const { config: run, suites, errors } = json;
  if (!isRecord(run) || typeof run.rootDir !== 'string')
    return refuse('names no rootDir');
  const rootDir = run.rootDir;
  if (!Array.isArray(suites)) return refuse('has no list of suites');
  if (!Array.isArray(errors)) return refuse('has no list of errors');
  const fromRoot = (path: string): string =>
    relative(root, path).split(sep).join(posix.sep);
  const textOf = (list: unknown, where: string): string => {
    if (!Array.isArray(list))
      return refuse(`has no list of errors for ${where}`);
    return list
      .flatMap((e: unknown) => {
        if (!isRecord(e) || typeof e.message !== 'string')
          return refuse(`has an error with no message for ${where}`);
        return [e.message, e.snippet, e.stack].filter(
          (part): part is string => typeof part === 'string' && part !== '',
        );
      })
      .join('\n')
      .replace(ANSI, '');
  };

  let total = 0;
  const files: string[] = [];
  const failing: FailedTest[] = [];
  const timedOut: string[] = [];
  const walk = (suite: unknown, file: string, titles: readonly string[]) => {
    if (!isRecord(suite))
      return refuse(`has a suite that is not an object in ${file}`);
    const specs = suite.specs ?? [];
    const inner = suite.suites ?? [];
    if (!Array.isArray(specs) || !Array.isArray(inner))
      return refuse(`has a suite with no specs or suites in ${file}`);
    for (const spec of specs) {
      if (
        !isRecord(spec) ||
        typeof spec.title !== 'string' ||
        !Array.isArray(spec.tests)
      )
        return refuse(`has a spec it cannot read in ${file}`);
      for (const test of spec.tests as unknown[]) {
        if (
          !isRecord(test) ||
          typeof test.projectName !== 'string' ||
          test.projectName === ''
        )
          return refuse(`has a test with no project in ${file}`);
        const name = `${file} › ${[test.projectName, ...titles, spec.title].join(' > ')}`;
        if (typeof test.status !== 'string' || !OUTCOMES.has(test.status))
          return refuse(`gives ${name} the status ${String(test.status)}`);
        if (!Array.isArray(test.results))
          return refuse(`has no results for ${name}`);
        total += 1;
        if (test.status !== 'unexpected' && test.status !== 'flaky') continue;
        const results = test.results as unknown[];
        failing.push({
          name,
          text: results
            .map((r) =>
              isRecord(r)
                ? textOf(r.errors, name)
                : refuse(`has a result it cannot read for ${name}`),
            )
            .filter((text) => text !== '')
            .join('\n'),
        });
        if (results.some((r) => isRecord(r) && r.status === 'timedOut'))
          timedOut.push(name);
      }
    }
    for (const each of inner) {
      if (!isRecord(each) || typeof each.title !== 'string')
        return refuse(`has a describe with no title in ${file}`);
      walk(each, file, [...titles, each.title]);
    }
  };
  for (const top of suites) {
    if (!isRecord(top) || typeof top.file !== 'string')
      return refuse('has a file suite that names no file');
    const file = fromRoot(join(rootDir, top.file));
    files.push(file);
    walk(top, file, []);
  }
  for (const error of errors) {
    const location = isRecord(error) ? error.location : undefined;
    const name =
      isRecord(location) && typeof location.file === 'string'
        ? `${fromRoot(location.file)} › (the file)`
        : `${config} › (the run)`;
    failing.push({ name, text: textOf([error], name) });
  }
  return { total, files, failing, timedOut };
}

/** `n test(s) timed out: <names>`, or nothing. */
const timedOutLine = (timedOut: readonly string[]): string[] =>
  timedOut.length === 0
    ? []
    : [
        `${String(timedOut.length)} test${timedOut.length === 1 ? '' : 's'} timed out: ${timedOut.join(', ')}`,
      ];

export type Planted = { readonly text: string } | { readonly matches: number };

/** `text` with `anchor` replaced, or how often it occurs when that is not once. */
export function plant(
  text: string,
  anchor: string,
  replacement: string,
): Planted {
  const parts = text.split(anchor);
  if (parts.length !== 2) return { matches: parts.length - 1 };
  return { text: parts.join(replacement) };
}

export type SuiteChoice =
  { readonly suite: string } | { readonly refusal: string };

/** The one suite, of `listings` (suite name to the files it lists), that runs every target. */
export function suiteOf(
  targets: readonly string[],
  listings: ReadonlyMap<string, readonly string[]>,
): SuiteChoice {
  const found: [string, string][] = [];
  for (const target of targets) {
    const suites = [...listings]
      .filter(([, files]) => files.includes(target))
      .map(([name]) => name);
    if (suites.length === 0)
      return {
        refusal: `${target} is in no suite the runner can run`,
      };
    if (suites.length > 1)
      return { refusal: `${target} is listed by ${suites.join(' and ')}` };
    found.push([target, suites[0] as string]);
  }
  const suites = new Set(found.map(([, suite]) => suite));
  if (suites.size > 1)
    return {
      refusal: `the targets are in more than one suite: ${found.map(([t, s]) => `${t} in ${s}`).join(', ')}`,
    };
  return { suite: found[0]?.[1] as string };
}

export const UNIT_SUITE = 'unit suite';

/** Why `targets`, which the unit suite does not list, cannot run here: the laptop runs the unit suite only. */
export function laptopRefusal(targets: readonly string[]): string {
  return `${targets.join(', ')}: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it`;
}

/** A whole-repo floor the planted text moves, and the text its failure shows. */
export interface CorpusPrediction {
  /** The file whose test checks the floor. */
  readonly file: string;
  readonly id: string;
  readonly actual: number;
  readonly recorded: number | undefined;
  /** What `floorBreach` says of it (`tests/floors.ts`). */
  readonly text: string;
}

/**
 * The floors a record-mode run of the guards suite saw away from their
 * recorded figures (spec §6), except those checked in `excluded`: the
 * targets, and every guard that imports the mutated file, whose moves are
 * the author's to predict.
 */
export function corpusPredictions(
  observations: readonly Observation[],
  floors: Readonly<Record<string, number>>,
  excluded: ReadonlySet<string>,
): CorpusPrediction[] {
  const predictions = new Map<string, CorpusPrediction>();
  for (const { id, actual, site } of observations) {
    const at = /^(.+):\d+$/.exec(site);
    if (at?.[1] === undefined)
      throw new Error(
        `cannot read a file:line from the site "${site}" of ${id}`,
      );
    const file = at[1];
    const recorded = floors[id];
    if (actual === recorded || excluded.has(file)) continue;
    const text =
      recorded === undefined
        ? `${id} is not recorded`
        : `${id}: read ${String(actual)}, recorded ${String(recorded)}`;
    predictions.set(`${file}\n${text}`, { file, id, actual, recorded, text });
  }
  return [...predictions.values()];
}

/** Terminal colour codes, which vitest leaves in some messages. */
const COLOURS = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const firstLine = (message: string): string =>
  (
    message
      .replace(COLOURS, '')
      .split('\n')
      .find((line) => line.trim() !== '') ?? ''
  )
    .trim()
    .slice(0, 300);

const NO_REPORT = 'no report: the run ended before the reporter wrote one';

/**
 * Each way the run differs from the prediction; none means it matched. The
 * failing tests must be exactly the predicted ones, each red for its stated
 * reason, plus those a corpus prediction accounts for in its own file.
 */
export function judge(
  mutation: Mutation,
  corpus: readonly CorpusPrediction[],
  report: Report | undefined,
  baselineTotal: number,
): string[] {
  if (report === undefined) return [NO_REPORT];
  const problems: string[] = [...timedOutLine(report.timedOut)];
  if (report.total !== baselineTotal)
    problems.push(
      `the total moved: ${String(report.total)} tests, not ${String(baselineTotal)}`,
    );
  for (const [test, text] of Object.entries(mutation.red)) {
    const failed = report.failing.find((f) => f.name === test);
    if (failed === undefined)
      problems.push(`predicted red, stayed green: ${test}`);
    else if (!failed.text.includes(text))
      problems.push(
        `red for another reason: ${test} (wanted "${text}"): ${firstLine(failed.text)}`,
      );
  }
  const accounts = (p: CorpusPrediction, f: FailedTest) =>
    f.name.startsWith(`${p.file}${FILE_SEPARATOR}`) && f.text.includes(p.text);
  for (const p of corpus) {
    if (!report.failing.some((f) => accounts(p, f)))
      problems.push(
        `whole-repo floor stayed green: ${p.id} ${String(p.recorded)} → ${String(p.actual)} in ${p.file}`,
      );
  }
  for (const f of report.failing) {
    if (f.name in mutation.red) continue;
    if (corpus.some((p) => accounts(p, f))) continue;
    problems.push(`unpredicted red: ${f.name}: ${firstLine(f.text)}`);
  }
  return problems;
}

/**
 * A suite the runner can run: its name in `SUITES`, the folder it runs from,
 * its runner and config (a vitest suite with none: vitest's default), and the
 * build it needs first, if any.
 */
export interface MutableSuite {
  readonly name: string;
  readonly cwd: string;
  readonly kind: 'vitest' | 'playwright';
  readonly config: string | undefined;
  readonly build: readonly string[] | undefined;
}

/** One vitest run of a whole suite. Paths are repository-relative. */
export interface RunRequest {
  readonly suite: MutableSuite;
  readonly json: string;
  readonly log: string;
  /** Record every floor check to this file (`FLOORS_RECORD`), failing none. */
  readonly recordTo?: string;
  /** List the suite's files that import this file, running no test. */
  readonly related?: string;
}

export interface RunOutcome {
  /** The parsed report the runner's reporter wrote; undefined when it wrote none. */
  readonly json: unknown;
  /** The default reporter's output. */
  readonly log: string;
  /** Whether the run passed the ceiling and was stopped. */
  readonly ceilingHit: boolean;
  /** The suite's build exited with this non-zero status, so it never ran. */
  readonly buildExit?: number;
}

/** Everything `runFile` does outside its own logic, so a stand-in can drive it. */
export interface Io {
  /** Whether this is CI (`CI=true`), where every suite may run. */
  readonly ci: boolean;
  /** The repository root, as vitest names files (real path). */
  readonly root: string;
  read(path: string): Uint8Array;
  write(path: string, bytes: Uint8Array): void;
  tracked(path: string): boolean;
  /** Whether `path` is as HEAD has it. */
  clean(path: string): boolean;
  /** The suite's test files, repository-relative. */
  list(suite: MutableSuite): readonly string[];
  run(request: RunRequest): Promise<RunOutcome>;
  observations(path: string): readonly Observation[];
  floors(): Readonly<Record<string, number>>;
  /** Restore `path` to these bytes if the process is stopped while it is planted. */
  guard(path: string, bytes: Uint8Array): void;
  release(path: string): void;
  print(line: string): void;
}

export const CEILING_SECONDS = 600;
export const GUARDS_SUITE = 'guards suite';
export const LOG_DIR = '.mutations';

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

/** How a run of `suite` ended without a report to judge, if it did. */
function unrun(outcome: RunOutcome, suite: string): string[] {
  if (outcome.ceilingHit)
    return [
      `${suite} ran past the ${String(CEILING_SECONDS)} s ceiling and was stopped`,
    ];
  if (outcome.buildExit !== undefined)
    return [`${suite}: build failed (exit ${String(outcome.buildExit)})`];
  return [];
}

/** The problems of one suite run that is meant to be clean. */
function redBaseline(
  outcome: RunOutcome,
  suite: string,
  read: (json: unknown) => Report,
): string[] {
  const stopped = unrun(outcome, suite);
  if (stopped.length > 0) return stopped;
  if (outcome.json === undefined) return [NO_REPORT];
  const report = read(outcome.json);
  return [
    ...report.failing.map((f) => `${f.name}: ${firstLine(f.text)}`),
    ...timedOutLine(report.timedOut),
  ];
}

/** Why `runFile` will not run a file; `runFiles` prints it and runs the next file. */
export class Refusal extends Error {
  readonly path: string;
  readonly why: string;
  constructor(path: string, why: string) {
    super(`${path}: ${why}`);
    this.path = path;
    this.why = why;
  }
}

/**
 * Runs one mutation file (spec §4): checks it, finds its suite, runs the
 * suite clean, then plants each mutation in turn, runs the whole suite, puts
 * the file back and judges the run. Refusals throw before anything is
 * planted; each row's verdict is printed, and the counts returned.
 */
export async function runFile(
  io: Io,
  path: string,
  file: MutationFile,
  suites: readonly MutableSuite[],
): Promise<{ readonly matched: number; readonly rows: number }> {
  const refuse = (why: string): never => {
    throw new Refusal(path, why);
  };
  const problems = mutationFileProblems(file);
  if (problems.length > 0) refuse(problems.join('\n  '));
  const touched = [
    ...new Set([...file.targets, ...file.mutations.map((m) => m.file)]),
  ];
  for (const each of touched) {
    if (!io.tracked(each)) refuse(`${each} is not tracked`);
    if (!io.clean(each))
      refuse(`${each} differs from HEAD: commit or restore it first`);
  }
  // The laptop lists the unit suite only: no other suite's listing starts there.
  const listings = new Map(
    (io.ci ? suites : suites.filter((s) => s.name === UNIT_SUITE)).map((s) => [
      s.name,
      io.list(s),
    ]),
  );
  const choice = suiteOf(file.targets, listings);
  if ('refusal' in choice) {
    if (io.ci) return refuse(choice.refusal);
    const unit = listings.get(UNIT_SUITE) ?? [];
    return refuse(laptopRefusal(file.targets.filter((t) => !unit.includes(t))));
  }
  const suite = suites.find((s) => s.name === choice.suite) as MutableSuite;
  const read = (json: unknown): Report =>
    suite.kind === 'playwright'
      ? readPlaywrightReport(json, io.root, suite.config ?? suite.name)
      : readReport(json);

  const dir = `${LOG_DIR}/${posix.basename(path).replace(/\.[^.]*$/, '')}`;
  const at = (name: string, ext: string) => `${dir}/${name}.${ext}`;
  const baseline = await io.run({
    suite,
    json: at('baseline', 'json'),
    log: at('baseline', 'log'),
  });
  const red = redBaseline(baseline, suite.name, read);
  if (red.length > 0)
    refuse(
      `the ${suite.name} is red before any mutation:\n  ${red.join('\n  ')}`,
    );
  const baselineTotal = read(baseline.json).total;

  const importers = new Map<string, ReadonlySet<string>>();
  const importersOf = async (target: string): Promise<ReadonlySet<string>> => {
    const known = importers.get(target);
    if (known !== undefined) return known;
    const name = `importers-${String(importers.size + 1)}`;
    const listed = await io.run({
      suite,
      json: at(name, 'json'),
      log: at(name, 'log'),
      related: target,
    });
    if (listed.ceilingHit || listed.json === undefined)
      refuse(`could not list the guards that import ${target}`);
    const found = new Set(readReport(listed.json).files);
    importers.set(target, found);
    return found;
  };

  let matched = 0;
  for (const mutation of file.mutations) {
    const original = io.read(mutation.file);
    const planted = plant(
      new TextDecoder('utf-8', { fatal: true }).decode(original),
      mutation.anchor,
      mutation.replacement,
    );
    if ('matches' in planted) {
      io.print(
        `ANCHOR ${mutation.name}: ${String(planted.matches)} matches in ${mutation.file}`,
      );
      continue;
    }
    const guards = suite.name === GUARDS_SUITE;
    const excluded = guards
      ? new Set([...file.targets, ...(await importersOf(mutation.file))])
      : new Set<string>();
    let corpus: CorpusPrediction[] = [];
    let outcome: RunOutcome;
    io.guard(mutation.file, original);
    try {
      io.write(mutation.file, new TextEncoder().encode(planted.text));
      if (guards) {
        const recordTo = at(mutation.name, 'observations.jsonl');
        await io.run({
          suite,
          json: at(mutation.name, 'record.json'),
          log: at(mutation.name, 'record.log'),
          recordTo,
        });
        corpus = corpusPredictions(
          io.observations(recordTo),
          io.floors(),
          excluded,
        );
      }
      outcome = await io.run({
        suite,
        json: at(mutation.name, 'json'),
        log: at(mutation.name, 'log'),
      });
    } finally {
      io.write(mutation.file, original);
      io.release(mutation.file);
    }
    if (!sameBytes(io.read(mutation.file), original))
      throw new Error(
        `${mutation.file} did not read back as it was before ${mutation.name}`,
      );
    const stopped = unrun(outcome, suite.name);
    const found =
      stopped.length > 0
        ? stopped
        : judge(
            mutation,
            corpus,
            outcome.json === undefined ? undefined : read(outcome.json),
            baselineTotal,
          );
    if (found.length === 0) matched += 1;
    io.print(
      found.length === 0 ? `ok   ${mutation.name}` : `MISS ${mutation.name}`,
    );
    for (const p of corpus)
      io.print(
        `  whole-repo floor: ${p.id} ${String(p.recorded)} → ${String(p.actual)}, ${p.file}`,
      );
    for (const problem of found) io.print(`  ${problem}`);
  }
  for (const each of new Set(file.mutations.map((m) => m.file)))
    if (!io.clean(each))
      refuse(`${each} differs from HEAD after every mutation was put back`);
  io.print(
    `${path}: ${String(matched)} of ${String(file.mutations.length)} matched`,
  );
  return { matched, rows: file.mutations.length };
}

/** Loads a mutation file by its repository-relative path and returns the module's default export. */
export type Load = (path: string) => Promise<unknown>;

/**
 * Runs each mutation file in turn (#652). A file that does not load, is not
 * a mutation file, or that `runFile` refuses is printed as `REFUSED`,
 * counted, and the next file still runs, so one refusal never hides the
 * others' rows. Anything else, such as a file that did not read back, stops
 * every file: the tree may no longer be as HEAD has it.
 */
export async function runFiles(
  io: Io,
  paths: readonly string[],
  load: Load,
  suites: readonly MutableSuite[],
): Promise<{
  readonly matched: number;
  readonly rows: number;
  readonly refused: number;
  readonly ok: boolean;
}> {
  let matched = 0;
  let rows = 0;
  let refused = 0;
  for (const path of paths) {
    let file: MutationFile;
    try {
      file = asMutationFile(await load(path));
    } catch (error) {
      refused += 1;
      io.print(
        `REFUSED ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    try {
      const counts = await runFile(io, path, file, suites);
      matched += counts.matched;
      rows += counts.rows;
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      refused += 1;
      io.print(`REFUSED ${path}: ${error.why}`);
    }
  }
  io.print(
    `mutate: ${String(matched)} of ${String(rows)} rows matched; ${String(refused)} of ${String(paths.length)} files refused`,
  );
  return { matched, rows, refused, ok: matched === rows && refused === 0 };
}

/**
 * The command line a package script would hold for `mutate`: the build (a
 * script runs local binaries without npx), then the suite. Each suite's own
 * script must read exactly this, so the runner builds as the suite does.
 */
export function mutateScript(mutate: SuiteMutate): string {
  const config = mutate.config === undefined ? [] : ['-c', mutate.config];
  const run =
    mutate.kind === 'vitest'
      ? ['vitest', 'run', ...config]
      : ['playwright', 'test', ...config];
  const build =
    mutate.build?.[0] === 'npx' ? mutate.build.slice(1) : mutate.build;
  return [
    ...(build === undefined ? [] : [build.join(' ')]),
    run.join(' '),
  ].join(' && ');
}

/** The suites in `suites` the runner can run: those with a `mutate` value. */
export function mutableSuites(suites: readonly Suite[]): MutableSuite[] {
  return suites.flatMap(({ name, cwd, mutate }) =>
    mutate === undefined
      ? []
      : [
          {
            name,
            cwd,
            kind: mutate.kind,
            config: mutate.config,
            build: mutate.build,
          },
        ],
  );
}

/** A test-name pattern no test matches: `related` then lists files and runs nothing. */
const NO_TEST = '^$';

/** The vitest arguments for one request: the default reporter for people, `reporter` for the runner. */
export function vitestArgs(request: RunRequest, reporter: string): string[] {
  return [
    'vitest',
    ...(request.related === undefined
      ? ['run']
      : ['related', request.related, '--run', '-t', NO_TEST]),
    ...(request.suite.config === undefined ? [] : ['-c', request.suite.config]),
    '--reporter=default',
    `--reporter=${reporter}`,
  ];
}

/** The Playwright arguments for one request: the list reporter for people, JSON for the runner. */
export function playwrightArgs(request: RunRequest): string[] {
  const { suite } = request;
  if (suite.config === undefined)
    throw new Error(`${suite.name} names no Playwright config`);
  if (request.related !== undefined || request.recordTo !== undefined)
    throw new Error(
      `${suite.name}: only the guards suite records floors or lists importers`,
    );
  return ['playwright', 'test', '-c', suite.config, '--reporter=list,json'];
}

/** The environment a Playwright run gets: the caller's, with its JSON report's file named, recording no floors. */
export function playwrightEnv(
  base: Readonly<Record<string, string | undefined>>,
  request: RunRequest,
  root: string,
): Record<string, string | undefined> {
  return {
    ...Object.fromEntries(
      Object.entries(base).filter(([key]) => key !== RECORD_ENV),
    ),
    PLAYWRIGHT_JSON_OUTPUT_FILE: join(root, request.json),
  };
}

/**
 * The environment a run gets: the caller's, the report file and the
 * repository root named, floors recorded only when asked.
 */
export function runEnv(
  base: Readonly<Record<string, string | undefined>>,
  request: RunRequest,
  root: string,
): Record<string, string | undefined> {
  const env = Object.fromEntries(
    Object.entries(base).filter(([key]) => key !== RECORD_ENV),
  );
  env[REPORT_ENV] = join(root, request.json);
  env[ROOT_ENV] = root;
  if (request.recordTo !== undefined)
    env[RECORD_ENV] = join(root, request.recordTo);
  return env;
}

/** The floor checks a record-mode run wrote, one JSON object a line. */
export function readObservations(text: string, path: string): Observation[] {
  const lines = text.split('\n').filter((line) => line !== '');
  if (lines.length === 0)
    throw new Error(`no floor check was recorded to ${path}`);
  return lines.map((line) => {
    const o = JSON.parse(line) as unknown;
    if (
      !isRecord(o) ||
      typeof o.id !== 'string' ||
      !isCount(o.actual) ||
      typeof o.site !== 'string'
    )
      throw new Error(
        `${path} holds a line that is not a floor check: ${line}`,
      );
    return { id: o.id, actual: o.actual, site: o.site };
  });
}

/**
 * Runs `command` until `deadline` (epoch ms), killing its whole process group
 * past it. `exit` is the status it ended with (null: ended by a signal).
 */
function spawnBounded(
  command: string,
  args: readonly string[],
  options: { cwd: string; env: Record<string, string | undefined> },
  deadline: number,
): Promise<{ log: string; ceilingHit: boolean; exit: number | null }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, detached: true });
    let log = '';
    let ceilingHit = false;
    child.stdout.on('data', (chunk: Buffer) => (log += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (log += chunk.toString()));
    const timer = setTimeout(
      () => {
        ceilingHit = true;
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
      },
      Math.max(0, deadline - Date.now()),
    );
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (exit: number | null) => {
      clearTimeout(timer);
      resolvePromise({ log, ceilingHit, exit });
    });
  });
}

/** The real `Io`: files and git under `root`, suites run with npx. */
export function realIo(options: {
  readonly root: string;
  readonly ci: boolean;
  readonly suites: readonly Suite[];
  readonly floorsDir: string;
}): Io & { readonly restoreAll: () => void } {
  const { root } = options;
  const at = (path: string) => join(root, path);
  const guarded = new Map<string, Uint8Array>();
  return {
    ci: options.ci,
    root,
    read: (path) => readFileSync(at(path)),
    write: (path, bytes) => {
      writeFileSync(at(path), bytes);
    },
    // Committed at HEAD: the restore is checked against HEAD's bytes.
    tracked: (path) =>
      spawnSync('git', ['cat-file', '-e', `HEAD:${path}`], { cwd: root })
        .status === 0,
    clean: (path) =>
      spawnSync('git', ['diff', '--quiet', 'HEAD', '--', path], { cwd: root })
        .status === 0,
    list: (mutable) => {
      const entry = options.suites.find((s) => s.name === mutable.name);
      if (entry === undefined)
        throw new Error(`no entry named ${mutable.name}`);
      const [command, ...args] = entry.list;
      if (command === undefined)
        throw new Error(`${entry.name} has no list command`);
      const listed = spawnSync(command, args, {
        cwd: at(entry.cwd),
        encoding: 'utf8',
      });
      if (listed.status !== 0)
        throw new Error(
          `${entry.list.join(' ')} failed: ${listed.stderr.trim()}`,
        );
      return suiteFiles(entry, listed.stdout);
    },
    run: async (request) => {
      const { suite } = request;
      mkdirSync(dirname(at(request.json)), { recursive: true });
      rmSync(at(request.json), { force: true });
      if (request.recordTo !== undefined)
        rmSync(at(request.recordTo), { force: true });
      // One ceiling for the build and the suite together (spec §6).
      const deadline = Date.now() + CEILING_SECONDS * 1_000;
      const cwd = at(suite.cwd);
      let log = '';
      if (suite.build !== undefined) {
        const [command, ...args] = suite.build;
        if (command === undefined)
          throw new Error(`${suite.name} has an empty build`);
        const built = await spawnBounded(
          command,
          args,
          { cwd, env: process.env },
          deadline,
        );
        log += built.log;
        if (built.ceilingHit || built.exit !== 0) {
          writeFileSync(at(request.log), log);
          return built.ceilingHit
            ? { json: undefined, log, ceilingHit: true }
            : {
                json: undefined,
                log,
                ceilingHit: false,
                buildExit: built.exit ?? -1,
              };
        }
      }
      const ran = await spawnBounded(
        'npx',
        suite.kind === 'playwright'
          ? playwrightArgs(request)
          : vitestArgs(request, REPORTER),
        {
          cwd,
          env:
            suite.kind === 'playwright'
              ? playwrightEnv(process.env, request, root)
              : runEnv(process.env, request, root),
        },
        deadline,
      );
      log += ran.log;
      writeFileSync(at(request.log), log);
      const json = existsSync(at(request.json))
        ? (JSON.parse(readFileSync(at(request.json), 'utf8')) as unknown)
        : undefined;
      return { json, log, ceilingHit: ran.ceilingHit };
    },
    observations: (path) =>
      readObservations(
        existsSync(at(path)) ? readFileSync(at(path), 'utf8') : '',
        path,
      ),
    floors: () => readFloorsDir(at(options.floorsDir)),
    guard: (path, bytes) => guarded.set(path, bytes),
    release: (path) => guarded.delete(path),
    print: (line) => {
      console.log(line);
    },
    restoreAll: () => {
      for (const [path, bytes] of guarded) writeFileSync(at(path), bytes);
      guarded.clear();
    },
  };
}
