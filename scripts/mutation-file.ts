/**
 * A tracked mutation file (#527, spec `docs/superpowers/specs/
 * 2026-10-17-mutation-runner-design.md` §3): the mutations that prove the
 * tests in `targets` can fail, each with its prediction written before it
 * runs. One module per set, in `tests/mutations/`, default-exporting
 * `mutationFile({...})`, which checks the shape as the module loads.
 *
 * `scripts/mutate.ts` runs them. The `mutations` check (#619) matches a pull
 * request's changed non-unit tests against `targets`.
 */

/** Between a test's file and its describe-and-title path. */
export const FILE_SEPARATOR = ' › ';

/**
 * Whether `path` is where a mutation file lives: TypeScript in
 * `tests/mutations/`. The one spelling of the rule, read by the mutations
 * judge (`mutationFilesIn`, and `changedHelpers`, which leaves these out,
 * #670) and by the coverage kinds, which count them as not code (Shyden,
 * 2026-10-28: "Count them as not code", #771).
 */
export const isMutationFile = (path: string): boolean =>
  path.startsWith('tests/mutations/') && path.endsWith('.ts');

export interface Mutation {
  /** Unique in its file; names the run's log files. */
  readonly name: string;
  /** The tracked file the anchor is replaced in, repository-relative. */
  readonly file: string;
  /** Text that must occur exactly once in `file`. */
  readonly anchor: string;
  readonly replacement: string;
  /**
   * Each test predicted to fail, written `<file> › <describe> > … > <title>`
   * as vitest reports it, to text its failure must contain (a floor id, or
   * the finding). The text is matched against the whole error the runner's
   * reporter saw: message, diff, actual and expected. A function expected to
   * throw that throws nothing fails with vitest's bare "to throw an error".
   * Empty: the mutation is predicted to stay green.
   */
  readonly red: Readonly<Record<string, string>>;
}

export interface MutationFile {
  /** The test files this set proves, all in one suite. */
  readonly targets: readonly string[];
  readonly mutations: readonly Mutation[];
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Each reason the runner could not judge `file`, in reading order. */
export function mutationFileProblems(file: MutationFile): string[] {
  const problems: string[] = [];
  if (file.targets.length === 0) problems.push('names no targets');
  const targets = new Set<string>();
  for (const target of file.targets) {
    if (target === '') problems.push('has an empty target');
    else if (targets.has(target))
      problems.push(`names ${target} twice in targets`);
    targets.add(target);
  }
  if (file.mutations.length === 0) problems.push('holds no mutations');
  const names = new Set<string>();
  for (const m of file.mutations) {
    if (names.has(m.name)) {
      problems.push(`names ${m.name} twice`);
      continue;
    }
    names.add(m.name);
    if (!NAME.test(m.name))
      problems.push(
        `${m.name}: a name is letters, digits, dots, dashes and underscores, starting with a letter or digit`,
      );
    if (m.file === '') problems.push(`${m.name}: names no file`);
    if (m.anchor === '') problems.push(`${m.name}: has an empty anchor`);
    else if (m.replacement === m.anchor)
      problems.push(`${m.name}: its replacement is its anchor`);
    for (const [test, text] of Object.entries(m.red)) {
      if (!test.includes(FILE_SEPARATOR))
        problems.push(
          `${m.name}: red test "${test}" is not written <file>${FILE_SEPARATOR}<describe> > … > <title>`,
        );
      else if (text === '')
        problems.push(
          `${m.name}: red test "${test}" names no text its failure must show`,
        );
    }
  }
  return problems;
}

/** `file`, unchanged, or a throw naming every problem it has. */
export function mutationFile(file: MutationFile): MutationFile {
  const problems = mutationFileProblems(file);
  if (problems.length > 0)
    throw new Error(`mutation file refused:\n  ${problems.join('\n  ')}`);
  return file;
}

const isText = (x: unknown): x is string => typeof x === 'string';

const isTextList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every(isText);

function isMutation(x: unknown): x is Mutation {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const m = x as Record<string, unknown>;
  const red = m.red;
  return (
    isText(m.name) &&
    isText(m.file) &&
    isText(m.anchor) &&
    isText(m.replacement) &&
    typeof red === 'object' &&
    red !== null &&
    !Array.isArray(red) &&
    Object.values(red).every(isText)
  );
}

/**
 * A loaded module's default export, typed, or a throw: the runner imports
 * mutation files by path, so it checks what it got before judging it.
 */
export function asMutationFile(value: unknown): MutationFile {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    isTextList((value as Record<string, unknown>).targets) &&
    Array.isArray((value as Record<string, unknown>).mutations) &&
    ((value as Record<string, unknown>).mutations as unknown[]).every(
      isMutation,
    )
  )
    return value as MutationFile;
  throw new Error(
    'does not default-export mutationFile({ targets, mutations })',
  );
}
