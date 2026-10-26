import { posix } from 'node:path';
import ts from 'typescript';
import type { RelativeSpecifier } from './helper-modules.ts';

/**
 * Every relative specifier names its file (#762): Node's own loader, which
 * the coverage runs use, resolves a relative specifier to exactly the path it
 * spells, with no extension or `index` added, and a folder is no module. A
 * specifier is judged by that path, joined to the importing file's folder.
 * tests/guards/relative-imports.test.ts runs this over every tracked file.
 */

/** Each of `specifiers`, written in `file`, that names no file `has` knows, as `file:line: 'specifier' names no file`. */
export function unnamedFiles(
  file: string,
  specifiers: readonly RelativeSpecifier[],
  has: (path: string) => boolean,
): string[] {
  return specifiers
    .filter(
      ({ specifier }) =>
        // A folder's path keeps its slash, and `has` knows only files.
        !has(posix.normalize(posix.join(posix.dirname(file), specifier))),
    )
    .map(
      ({ specifier, line }) =>
        `${file}:${String(line)}: '${specifier}' names no file`,
    );
}

/** Each of `unread`, written in `file`, as `file:line: what`. */
export const unreadLines = (
  file: string,
  unread: readonly { line: number; what: string }[],
): string[] =>
  unread.map(({ line, what }) => `${file}:${String(line)}: ${what}`);

/**
 * Each file where TypeScript's own import reader, independent of this one,
 * meets more relative specifiers than the reader did, outside `vi` calls it
 * does not read: a file the reader is blind in.
 */
export const blindFiles = (
  read: readonly {
    file: string;
    source: string;
    specifiers: readonly Pick<RelativeSpecifier, 'form'>[];
  }[],
): string[] =>
  read.flatMap(({ file, source, specifiers }) => {
    const theirs = ts
      .preProcessFile(source, true, true)
      .importedFiles.filter(({ fileName }) => fileName.startsWith('.'));
    const ours = specifiers.filter(({ form }) => form !== 'vi');
    return theirs.length > ours.length ? [file] : [];
  });
