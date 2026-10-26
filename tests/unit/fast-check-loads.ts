import ts from 'typescript';
import { lineOf } from './line-of.ts';

/**
 * Every way a file loads fast-check at run time (#551): an import of any
 * shape, a re-export, a dynamic `import()`, a `require`, and a loader made
 * by `createRequire`, of `fast-check`, a subpath of it, or an
 * `@fast-check/` package. The unit suite keeps stand-ins on chosen cases
 * with no random draw, and every property runs in the properties suite
 * (#543, global rule 2026-10-12), so a file the unit suite loads loads none.
 * A type-only import or re-export loads nothing and is allowed. A dynamic
 * import or loader given a computed path is refused by name: it may be
 * fast-check.
 */

export interface FastCheckLoads {
  /** Each load, as `line N: what`. */
  readonly loads: readonly string[];
  /** Every module specifier met, quoted, runtime or type-only: the population read. */
  readonly specifiers: readonly string[];
}

const FAST_CHECK = /^(fast-check(\/|$)|@fast-check\/)/;

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

export function fastCheckLoads(source: string, file: string): FastCheckLoads {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const loads: string[] = [];
  const specifiers: string[] = [];
  const at = (node: ts.Node): string => `line ${String(lineOf(sf, node))}`;
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
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const name = node.moduleSpecifier.text;
      specifiers.push(`'${name}'`);
      if (FAST_CHECK.test(name) && !loadsNothing(node.importClause))
        loads.push(`${at(node)}: import from '${name}'`);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const name = node.moduleSpecifier.text;
      specifiers.push(`'${name}'`);
      if (FAST_CHECK.test(name) && !node.isTypeOnly)
        loads.push(`${at(node)}: re-export from '${name}'`);
    }
    if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const loader =
        ts.isIdentifier(node.expression) && loaders.has(node.expression.text);
      if (dynamic || loader) {
        const call = node.getText(sf).replace(/\s+/g, ' ');
        if (first && ts.isStringLiteralLike(first)) {
          specifiers.push(`'${first.text}'`);
          if (FAST_CHECK.test(first.text)) loads.push(`${at(node)}: ${call}`);
        } else if (dynamic || first !== undefined)
          loads.push(`${at(node)}: ${call} is not a literal path`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { loads, specifiers };
}
