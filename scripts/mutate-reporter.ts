/**
 * The mutation runner's own vitest reporter (#527, spec §4a). Vitest's JSON
 * reporter keeps only a failure's headline, cutting strings at about 30
 * characters and printing objects as `[ …(n) ]`, so a prediction could never
 * name a floor id past the cut or a guard's finding. The error objects a
 * reporter receives carry the whole diff, and a timed-out test's message
 * says so, where the log's own words can be quoted by a code frame.
 *
 * `scripts/mutate.ts` runs every suite with `--reporter=<this file>` and
 * `MUTATE_REPORT=<path>`; at the end of the run this writes `Written` there.
 */
import { writeFileSync } from 'node:fs';
import { isAbsolute, posix, relative, sep } from 'node:path';
import type { Reporter, TestModule, Vitest } from 'vitest/node';

/** The environment variable naming the file the report is written to. */
export const REPORT_ENV = 'MUTATE_REPORT';

/**
 * The environment variable naming the repository root, when a suite runs from
 * its own folder (#649): files are named from it, not from vitest's root.
 */
export const ROOT_ENV = 'MUTATE_ROOT';

/** The root a report names files from: `MUTATE_ROOT` when set, else vitest's. */
export function reportRoot(
  env: Readonly<Record<string, string | undefined>>,
  vitestRoot: string,
): string {
  const named = env[ROOT_ENV];
  if (named === undefined) return vitestRoot;
  if (named === '') throw new Error(`${ROOT_ENV} is set but empty`);
  if (!isAbsolute(named))
    throw new Error(`${ROOT_ENV} must be an absolute path, not ${named}`);
  return named;
}

/** What the reporter writes: the run as the runner judges it. */
export interface Written {
  /** Every test the run collected, skipped ones too. */
  readonly total: number;
  /** Every test file the run reported, repository-relative. */
  readonly files: readonly string[];
  /** Each failing test, `<file> › <describe> > … > <title>`, to its whole error text. */
  readonly failing: Readonly<Record<string, string>>;
  /** The failing tests that timed out. */
  readonly timedOut: readonly string[];
}

/** As much of vitest's `TestError` as the report reads. */
export interface ErrorView {
  readonly message: string;
  readonly diff?: string;
  readonly actual?: string;
  readonly expected?: string;
}

/** As much of vitest's `TestModule` as the report reads. */
export interface ModuleView {
  readonly moduleId: string;
  errors(): readonly ErrorView[];
  readonly children: {
    allTests(): Iterable<{
      readonly fullName: string;
      result(): {
        readonly state: string;
        readonly errors?: readonly ErrorView[];
      };
    }>;
  };
}

/** How vitest begins a timed-out test's error. */
const TIMED_OUT = 'Test timed out in ';

const textOf = (errors: readonly ErrorView[]): string =>
  errors
    .flatMap((e) => [e.message, e.diff, e.actual, e.expected])
    .filter((part): part is string => part !== undefined && part !== '')
    .join('\n');

/** The report of a run's modules, file names relative to `root`. */
export function reportOf(
  modules: readonly ModuleView[],
  root: string,
): Written {
  let total = 0;
  const files: string[] = [];
  const failing: Record<string, string> = {};
  const timedOut: string[] = [];
  for (const m of modules) {
    const file = relative(root, m.moduleId).split(sep).join(posix.sep);
    if (file.startsWith('..') || file === '')
      throw new Error(`${m.moduleId} is outside ${root}`);
    files.push(file);
    for (const testCase of m.children.allTests()) {
      total += 1;
      const result = testCase.result();
      if (result.state !== 'failed') continue;
      const errors = result.errors ?? [];
      const name = `${file} › ${testCase.fullName}`;
      failing[name] = textOf(errors);
      if (errors.some((e) => e.message.startsWith(TIMED_OUT)))
        timedOut.push(name);
    }
    const loadErrors = m.errors();
    if (loadErrors.length > 0)
      failing[`${file} › (the file)`] = textOf(loadErrors);
  }
  return { total, files, failing, timedOut };
}

/** Writes the run's report to the file `MUTATE_REPORT` names. */
export default class MutateReporter implements Reporter {
  private root = '';

  onInit(vitest: Vitest): void {
    this.root = reportRoot(process.env, vitest.config.root);
  }

  onTestRunEnd(testModules: readonly TestModule[]): void {
    const path = process.env[REPORT_ENV];
    if (path === undefined || path === '')
      throw new Error(`${REPORT_ENV} names no file for the mutation report`);
    writeFileSync(path, JSON.stringify(reportOf(testModules, this.root)));
  }
}
