import ts from 'typescript';
import { posix } from 'node:path';

/**
 * The helper modules test files load (#554): every module they reach by a
 * relative import, transitively, that is neither core source (under a `src/`
 * directory) nor another test file. A helper's top level runs while Vitest
 * collects the test that imports it, so the collection-calls guard judges it
 * as it judges the test's own module scope (#97).
 *
 * Every form that loads a module at run time is followed: a named, default,
 * namespace or effects-only import, a re-export, and a dynamic `import()` of
 * a literal path. A type-only import or re-export loads nothing and is left
 * out, as is a package. What the follower cannot read is refused by name,
 * never skipped: a path naming no file, a dynamic import of a computed path,
 * and a `require` (or a `createRequire` loader) given a relative path to
 * anything but a JSON file, which runs no code.
 */

export interface HelperReach {
  /** The helper modules reached, repository-relative, sorted. */
  readonly helpers: readonly string[];
  /** Every relative specifier met, as `file: specifier`: the population read. */
  readonly imports: readonly string[];
  /** What the follower cannot follow, as `file: what`. */
  readonly unresolved: readonly string[];
}

const TEST_FILE = /\.(test|spec)\.[cm]?ts$/;
const CORE_SOURCE = /(^|\/)src\//;
const CODE_FILE = /\.[cm]?ts$/;

/** The candidates a relative specifier can name, in TypeScript's order. */
function candidates(from: string, specifier: string): string[] {
  const base = posix.normalize(posix.join(posix.dirname(from), specifier));
  const stem = base.replace(/\.([cm]?js|[cm]?ts)$/, '');
  return [base, `${stem}.ts`, `${stem}.mts`, `${stem}.cts`, `${base}/index.ts`];
}

/** Whether every name an import clause binds is a type. */
function loadsNothing(clause: ts.ImportClause | undefined): boolean {
  if (clause === undefined) return false;
  if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return true;
  if (clause.name) return false;
  const named = clause.namedBindings;
  if (named === undefined || ts.isNamespaceImport(named)) return false;
  return (
    named.elements.length > 0 &&
    named.elements.every((element) => element.isTypeOnly)
  );
}

const isRelative = (specifier: string): boolean => specifier.startsWith('.');

/** What one file loads: relative specifiers, and what cannot be read. */
function loadsOf(
  file: string,
  source: string,
): { specifiers: string[]; unread: string[] } {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const unread: string[] = [];
  /** Names bound to a loader: `require`, and what `createRequire(…)` returns. */
  const loaders = new Set(['require']);
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'createRequire'
    )
      loaders.add(node.name.text);
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !loadsNothing(node.importClause)
    )
      specifiers.push(node.moduleSpecifier.text);
    if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (first && ts.isStringLiteralLike(first)) specifiers.push(first.text);
        else
          unread.push(
            `${node.getText(sf).replace(/\s+/g, ' ')} is not a literal path`,
          );
      } else if (
        ts.isIdentifier(node.expression) &&
        loaders.has(node.expression.text) &&
        first &&
        ts.isStringLiteralLike(first) &&
        isRelative(first.text) &&
        !first.text.endsWith('.json')
      )
        unread.push(
          `${node.getText(sf)} loads a module the follower does not read`,
        );
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { specifiers: specifiers.filter(isRelative), unread };
}

export function helperModules(
  entries: readonly string[],
  source: (path: string) => string | undefined,
): HelperReach {
  const helpers = new Set<string>();
  const imports: string[] = [];
  const unresolved: string[] = [];
  const read = new Set<string>();
  const queue = [...entries];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (read.has(file)) continue;
    read.add(file);
    const text = source(file);
    if (text === undefined) continue;
    const { specifiers, unread } = loadsOf(file, text);
    for (const what of unread) unresolved.push(`${file}: ${what}`);
    for (const specifier of specifiers) {
      imports.push(`${file}: ${specifier}`);
      const target = candidates(file, specifier).find(
        (path) => source(path) !== undefined,
      );
      if (target === undefined) {
        unresolved.push(`${file}: ${specifier} names no file`);
        continue;
      }
      if (
        !CODE_FILE.test(target) ||
        CORE_SOURCE.test(target) ||
        TEST_FILE.test(target)
      )
        continue;
      helpers.add(target);
      queue.push(target);
    }
  }
  return { helpers: [...helpers].sort(), imports, unresolved };
}
