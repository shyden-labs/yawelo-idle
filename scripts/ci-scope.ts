/**
 * The docs-only fast path for build-and-test (#360).
 *
 * A pull request that changes only HANDOVER.md and Markdown under docs/
 * needs Format and the unit suite, and nothing else: no lint, typecheck,
 * pacing, worker, engine or build step reads those files. build-and-test
 * runs `node scripts/ci-scope.ts` early, and every other step is skipped
 * unless the scope it writes is something other than `docs-only`, so the
 * required check still runs and reports (a `paths-ignore` would leave it
 * pending and block the merge).
 *
 * The change judged is `HEAD^1..HEAD` of what the job checked out. On a
 * pull_request event that is GitHub's merge commit, whose first parent is
 * the base, so the diff is exactly what the pull request brings. Under
 * every-commit it is one commit against its parent. deploy-dev's call is a
 * push event and always runs in full, as does any event but pull_request.
 *
 * Every doubt is full: an empty diff, a change kind it does not judge, a
 * diff it cannot read or parse, a missing EVENT. A missing GITHUB_OUTPUT
 * fails the step, and the job with it. Nothing is retried. Imports are
 * Node's own, so the step runs before `npm ci`.
 *
 * The same diff gives the mutation verdict (#36): the mutation workflow runs
 * Stryker over packages/core only when the change touches something that
 * run reads, and otherwise reports a pass without it, so its required check
 * still reports. Every doubt there is `run`, for the same reasons.
 */
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export type Scope = 'full' | 'docs-only';

/** One line of `git diff --name-status -z`: two paths for a rename or copy. */
export interface Change {
  status: string;
  paths: string[];
}

export interface Classification {
  scope: Scope;
  reason: string;
  /** Every path the classification looked at, in diff order. */
  judged: string[];
}

export type Mutation = 'run' | 'skip';

export interface MutationVerdict {
  mutation: Mutation;
  reason: string;
}

/**
 * Whole files outside packages/core that the core mutation run reads: its
 * config and list of equivalent mutants, the unit config it drives, the
 * dependencies and Node it runs on, its workflow, and the three scripts that
 * workflow calls.
 */
const MUTATION_FILES = new Set([
  'stryker.config.json',
  'stryker.equivalents.json',
  'vitest.stryker.config.ts',
  'package.json',
  'package-lock.json',
  '.nvmrc',
  '.github/workflows/mutation.yml',
  'scripts/ci-scope.ts',
  'scripts/fail-on-warnings.sh',
  'scripts/mutation-survivors.ts',
]);

/** A path whose change can move the core mutation score (#36 AC2). */
export function mutationInput(path: string): boolean {
  return path.startsWith('packages/core/') || MUTATION_FILES.has(path);
}

/** HANDOVER.md, or Markdown under docs/: nothing but Format and the unit suite reads them. */
export function onAllowlist(path: string): boolean {
  return (
    path === 'HANDOVER.md' || (path.startsWith('docs/') && path.endsWith('.md'))
  );
}

/** The change kinds judged path by path: added, modified, deleted. */
const JUDGED_KINDS = new Set(['A', 'M', 'D']);

const STATUS = /^[A-Z][0-9]*$/;

/** Reads `git diff --name-status -z`; anything malformed throws by name. */
export function parseNameStatus(text: string): Change[] {
  if (text === '') return [];
  if (!text.endsWith('\0'))
    throw new Error('name-status output does not end in NUL');
  const fields = text.slice(0, -1).split('\0');
  const changes: Change[] = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i] ?? '';
    if (!STATUS.test(status))
      throw new Error(`name-status field is not a status: ${status}`);
    const count = /^[RC]/.test(status) ? 2 : 1;
    const paths = fields.slice(i + 1, i + 1 + count);
    if (paths.length < count || paths.includes(''))
      throw new Error(
        `name-status ${status} needs ${String(count)} path(s), got: ${JSON.stringify(paths)}`,
      );
    changes.push({ status, paths });
    i += 1 + count;
  }
  return changes;
}

/** Why a diff cannot be judged path by path, or null when it can. */
function doubtOf(changes: readonly Change[]): string | null {
  if (changes.length === 0)
    return 'the diff is empty, so there is nothing to judge';
  const unjudged = changes.filter(({ status }) => !JUDGED_KINDS.has(status));
  if (unjudged.length > 0)
    return `a change of a kind this classifier does not judge: ${unjudged
      .map(({ status, paths }) => `${status} ${paths.join(' -> ')}`)
      .join(', ')}`;
  return null;
}

export function classify(changes: readonly Change[]): Classification {
  const judged = changes.flatMap(({ paths }) => paths);
  const doubt = doubtOf(changes);
  if (doubt !== null) return { scope: 'full', reason: doubt, judged };
  const outside = judged.filter((path) => !onAllowlist(path));
  if (outside.length > 0)
    return {
      scope: 'full',
      reason: `outside the docs-only allowlist: ${outside.join(', ')}`,
      judged,
    };
  return {
    scope: 'docs-only',
    reason: 'every changed path is HANDOVER.md or Markdown under docs/',
    judged,
  };
}

/** Whether the core mutation run needs to run for a change (#36). */
export function classifyMutation(changes: readonly Change[]): MutationVerdict {
  const doubt = doubtOf(changes);
  if (doubt !== null) return { mutation: 'run', reason: doubt };
  const read = changes.flatMap(({ paths }) => paths).filter(mutationInput);
  if (read.length > 0)
    return {
      mutation: 'run',
      reason: `the change touches what the core mutation run reads: ${read.join(', ')}`,
    };
  return {
    mutation: 'skip',
    reason: 'the change touches nothing the core mutation run reads',
  };
}

/**
 * The changes a pull-request check judges, or why it judges none: another
 * event, or a diff it cannot read or parse.
 */
function changesFor(
  event: string,
  readDiff: () => string,
): readonly Change[] | { doubt: string } {
  if (event !== 'pull_request')
    return { doubt: `the ${JSON.stringify(event)} event always tests in full` };
  try {
    return parseNameStatus(readDiff());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      doubt: `the diff could not be read, so everything runs: ${message.trim()}`,
    };
  }
}

/** The fast path applies to pull-request checks only; any doubt is full. */
export function scopeFor(
  event: string,
  readDiff: () => string,
): Classification {
  const changes = changesFor(event, readDiff);
  return 'doubt' in changes
    ? { scope: 'full', reason: changes.doubt, judged: [] }
    : classify(changes);
}

/** The mutation run skips on pull-request checks only; any doubt runs it. */
export function mutationFor(
  event: string,
  readDiff: () => string,
): MutationVerdict {
  const changes = changesFor(event, readDiff);
  return 'doubt' in changes
    ? { mutation: 'run', reason: changes.doubt }
    : classifyMutation(changes);
}

/** What the checked-out commit changed against its first parent. */
export function readDiff(cwd: string): string {
  return execFileSync(
    'git',
    ['diff', '--no-renames', '--name-status', '-z', 'HEAD^1', 'HEAD'],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

/** The lines the step prints: the verdict, then each judged path and its side. */
export function report(result: Classification): string[] {
  return [
    `scope: ${result.scope} (${result.reason})`,
    `judged ${String(result.judged.length)} ${result.judged.length === 1 ? 'path' : 'paths'}:`,
    ...result.judged.map(
      (path) => `  ${onAllowlist(path) ? 'docs ' : 'other'}  ${path}`,
    ),
  ];
}

/** The line the step prints for the mutation verdict. */
export function mutationReport(verdict: MutationVerdict): string {
  return `mutation: ${verdict.mutation} (${verdict.reason})`;
}

if (import.meta.main) {
  const output = process.env['GITHUB_OUTPUT'];
  if (output === undefined || output === '') {
    console.error('✗ GITHUB_OUTPUT is not set');
    process.exit(1);
  }
  const event = process.env['EVENT'] ?? '';
  const result = scopeFor(event, () => readDiff('.'));
  const mutation = mutationFor(event, () => readDiff('.'));
  for (const line of report(result)) console.log(line);
  console.log(mutationReport(mutation));
  appendFileSync(
    output,
    `scope=${result.scope}\nmutation=${mutation.mutation}\n`,
  );
}
