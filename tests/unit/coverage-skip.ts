import ts from 'typescript';
import { commentsOf } from './source-text.ts';

/**
 * A comment telling a coverage tool to skip lines: the tool's name (v8, c8
 * or istanbul) followed by the word for skipping, in any case and spacing
 * (#728; the forms are in coverage-skip.test.ts). The ruling counts the
 * lines such a comment covers as unrun, so the guards refuse the comment.
 * This comment names the tools apart from that word, or the guard would
 * refuse its own helper.
 */
const SKIP = /\b(?:v8|c8|istanbul)\s+ignore\b/i;

/** Each skip comment in a JavaScript or TypeScript file, named with it. */
export function skipCommentsIn(path: string, text: string): string[] {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  return commentsOf(sf)
    .filter((comment) => SKIP.test(comment))
    .map((comment) => `${path}: ${comment}`);
}
