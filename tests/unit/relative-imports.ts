import { posix } from 'node:path';
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
