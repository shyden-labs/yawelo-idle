import { basename, extname } from 'node:path';
import { isMutationFile } from './mutation-file.ts';

/**
 * What kind of file each tracked path is, for the coverage record (#728).
 *
 * - `v8`: code `@vitest/coverage-v8` measures (every JavaScript and
 *   TypeScript file, tests and tool configs included: global ruling
 *   2026-10-22).
 * - `lines`: code no tool here measures yet. It enters the record at full
 *   size (every line of code untested) until its own story measures it:
 *   workflows (#737, #738), templates and pages (#734), shell (#736).
 * - `not-code`: settings, data, documents and media; and mutation files,
 *   test plans the mutation runner reads in its own CI job and no suite
 *   loads (Shyden, 2026-10-28: "Count them as not code", #771).
 *
 * A kind the table does not name is `undefined`, and the record refuses it:
 * a new kind of file is classified here before it is tracked.
 */
export type Kind = 'v8' | 'lines' | 'not-code';

const V8 = new Set(['.ts', '.js', '.mjs', '.cjs', '.mts', '.cts']);
const LINES = new Set(['.svelte', '.astro', '.html', '.sh']);
const NOT_CODE = new Set([
  '.yml',
  '.yaml',
  '.json',
  '.jsonc',
  '.jsonl',
  '.md',
  '.txt',
  // No executable lines, and no ruling names it (#728 design: my call).
  '.css',
  '.webm',
  '.mp4',
  '.jpg',
]);
const NOT_CODE_NAMES = new Set([
  '.gitignore',
  '.nvmrc',
  '.npmrc',
  '.prettierignore',
  '_headers',
  'NOTICE',
  'LICENSE',
  'CODEOWNERS',
]);

const isWorkflow = (path: string): boolean =>
  path.startsWith('.github/workflows/') && /\.ya?ml$/.test(path);

export function kindOf(path: string, firstLine: string): Kind | undefined {
  if (isMutationFile(path)) return 'not-code';
  const extension = extname(path);
  if (V8.has(extension)) return 'v8';
  if (LINES.has(extension) || isWorkflow(path)) return 'lines';
  if (extension === '' && firstLine.startsWith('#!')) return 'lines';
  if (NOT_CODE.has(extension) || NOT_CODE_NAMES.has(basename(path)))
    return 'not-code';
  return undefined;
}

/** A line wholly a comment in its kind's line-comment syntax. */
const isComment = (path: string, line: string): boolean =>
  ['.html', '.svelte', '.astro'].includes(extname(path))
    ? /^<!--.*-->$/.test(line)
    : line.startsWith('#') && !line.startsWith('#!');

/**
 * A `lines` file's size: every non-blank line that is not wholly a comment.
 * Its shebang counts, since it names the interpreter that runs the file.
 */
export function codeLines(path: string, text: string): number {
  const kind = kindOf(path, text.split('\n', 1)[0] ?? '');
  if (kind !== 'lines')
    throw new Error(
      `${path} is ${kind === 'v8' ? 'measured by v8' : (kind ?? 'of no listed kind')}, not counted by lines`,
    );
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !isComment(path, line)).length;
}
