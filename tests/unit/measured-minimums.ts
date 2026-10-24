import ts from 'typescript';
import { lineOf } from './line-of.ts';

/**
 * What the measured-minimums guard reads (#84, spec §5.8), from the parse
 * tree.
 *
 * A measured minimum is an exemption from exact floors that Shyden granted
 * for ten properties alone (2026-10-12: "Fresh cases, safe minimums";
 * 2026-10-16: "Yes, all 10"), so the checks may be called only in those
 * files, each holding exactly its pinned number of calls ("Exemption
 * binding": a file-wide key names its count). And because those properties
 * draw fresh cases on every run (2026-10-12: "don't repeat."), the
 * properties suite sets a fast-check seed in its one seeding home alone.
 *
 * Every reference is judged by its name, whatever its source, and the forms
 * that would hide a call are refused, never skipped (the guard catalogue's
 * "Traced origin" and "Call shape" rows): an aliased or namespace import, an
 * element access, a re-export, and the check passed by reference.
 */

/** The checks a measured minimum is read through, by name. */
export const CHECKS: ReadonlySet<string> = new Set([
  'minimumBreach',
  'minimumsBreach',
]);

/** Where the checks are declared, which the reader leaves to its own tests. */
export const CHECK_HOME = 'tests/minimums.ts';

/**
 * Every file that may call the checks, with how many calls it holds, checked
 * for equality: the eight files of the ten exempted properties (sim and log
 * each hold several), and the checker's own unit tests.
 */
export const EXEMPT: Readonly<Record<string, number>> = {
  // Shyden, 2026-10-12, #543: "Fresh cases, safe minimums".
  'packages/core/properties/automation.test.ts': 2,
  'packages/core/properties/pemandu-tick.test.ts': 1,
  'packages/core/properties/sim.test.ts': 3,
  'packages/core/properties/unfold.test.ts': 3,
  'packages/core/properties/words.test.ts': 1,
  // Shyden, 2026-10-16, #84: "Yes, all 10".
  'packages/core/properties/review.test.ts': 1,
  'packages/core/properties/rng.test.ts': 1,
  // Shyden, 2026-10-12, #543, moved to the logs suite on 2026-10-16 (spec
  // §5.12): "separate test suite for logging and auditing".
  'packages/core/logs/log.test.ts': 3,
  // The checker's own tests.
  'tests/unit/minimums.test.ts': 14,
};

/** The properties suite's one seeding home (spec §5.11). */
export const SEED_HOME = 'tests/properties-setup.ts';

/** fast-check's runners, whose second argument holds the run's options. */
const RUNNERS: ReadonlySet<string> = new Set([
  'assert',
  'check',
  'sample',
  'statistics',
]);

const CONFIGURE = 'configureGlobal';
const FLOOR = 'floorBreach';
// The properties suite's files, and the logs suite's, whose properties draw
// fresh cases from the same seeding home (spec §5.12).
const PROPERTIES_FILE = /^packages\/[^/]+\/(properties|logs)\/.+\.test\.ts$/;

export interface CheckReading {
  /** Calls of a check, by name. */
  readonly calls: number;
  /** Every reference that is not a plain call, by line and why. */
  readonly refusals: readonly string[];
}

const where = (file: string, sf: ts.SourceFile, node: ts.Node): string =>
  `${file}:${String(lineOf(sf, node))}`;

/** A module specifier naming the check's home, in any spelling a file can write. */
const namesCheckHome = (specifier: string): boolean =>
  /(^|\/)minimums(\.ts)?$/.test(specifier) && specifier.startsWith('.');

/** Every reference to a check in `sf`: plain calls counted, the rest refused. */
export function checkReadingOf(file: string, sf: ts.SourceFile): CheckReading {
  if (file === CHECK_HOME) return { calls: 0, refusals: [] };
  let calls = 0;
  const refusals: string[] = [];
  const refuse = (node: ts.Node, why: string) =>
    refusals.push(`${where(file, sf, node)}: ${why}`);
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      namesCheckHome(node.moduleSpecifier.text) &&
      node.importClause?.namedBindings !== undefined &&
      ts.isNamespaceImport(node.importClause.namedBindings)
    )
      refuse(
        node,
        'imports the minimum checks as a namespace: import each by name',
      );
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      CHECKS.has(node.argumentExpression.text)
    )
      refuse(node, `reaches ${node.argumentExpression.text} by element access`);
    if (ts.isIdentifier(node) && CHECKS.has(node.text)) {
      const parent = node.parent;
      if (ts.isImportSpecifier(parent)) {
        if (parent.propertyName !== undefined)
          refuse(node, `imports ${node.text} under another name`);
      } else if (ts.isExportSpecifier(parent))
        refuse(node, `re-exports ${node.text}`);
      else if (ts.isPropertyAccessExpression(parent) && parent.name === node)
        refuse(node, `reaches ${node.text} through a namespace`);
      else if (ts.isCallExpression(parent) && parent.expression === node)
        calls += 1;
      else refuse(node, `uses ${node.text} other than by calling it`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { calls, refusals };
}

export interface SeedReading {
  /** fast-check runner calls whose options were judged. */
  readonly runners: number;
  /** `configureGlobal` calls (only the seeding home may hold one). */
  readonly configures: number;
  readonly refusals: readonly string[];
}

const keyName = (name: ts.PropertyName): string | undefined =>
  ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)
      ? name.expression.text
      : ts.isComputedPropertyName(name)
        ? '(computed)'
        : undefined;

/**
 * fast-check's runners and global configuration in `sf`: each runner's
 * options must be written out, with no seed and no spread; a global
 * configuration is refused but in the seeding home; and an exact floor is
 * refused in a properties file, where fresh cases would fail it at random.
 */
export function seedReadingOf(file: string, sf: ts.SourceFile): SeedReading {
  const fc = new Set<string>();
  let runners = 0;
  let configures = 0;
  const refusals: string[] = [];
  const refuse = (node: ts.Node, why: string) =>
    refusals.push(`${where(file, sf, node)}: ${why}`);
  for (const statement of sf.statements) {
    // A re-export would carry a runner past this reader into the file that
    // imports it: fast-check is imported where it is used.
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'fast-check'
    )
      refuse(statement, 're-exports fast-check: import it where it is used');
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== 'fast-check'
    )
      continue;
    const clause = statement.importClause;
    if (clause?.name !== undefined) fc.add(clause.name.text);
    const bindings = clause?.namedBindings;
    if (bindings !== undefined && ts.isNamespaceImport(bindings))
      fc.add(bindings.name.text);
    if (bindings !== undefined && ts.isNamedImports(bindings))
      for (const spec of bindings.elements) {
        const imported = (spec.propertyName ?? spec.name).text;
        if (RUNNERS.has(imported) || imported === CONFIGURE)
          refuse(
            spec,
            `imports fast-check's ${imported} by name: call it through the default import`,
          );
      }
  }
  const judgeOptions = (call: ts.CallExpression, runner: string) => {
    const options = call.arguments[1];
    if (options === undefined) return;
    if (!ts.isObjectLiteralExpression(options)) {
      refuse(
        call,
        `passes ${runner} options the guard cannot read: write them out`,
      );
      return;
    }
    for (const property of options.properties) {
      if (ts.isSpreadAssignment(property)) {
        refuse(property, `spreads options into ${runner}: write them out`);
        continue;
      }
      const name = keyName(property.name);
      if (name === 'seed')
        refuse(
          property,
          `sets a seed for ${runner}: properties draw fresh cases (#84)`,
        );
      else if (name === '(computed)')
        refuse(property, `sets a computed option for ${runner}: write it out`);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && fc.has(node.text)) {
      const parent = node.parent;
      const declared =
        ts.isImportClause(parent) || ts.isNamespaceImport(parent);
      const member =
        (ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
        (ts.isQualifiedName(parent) && parent.left === node);
      if (ts.isElementAccessExpression(parent) && parent.expression === node)
        refuse(node, `reaches ${node.text} by element access`);
      else if (!declared && !member)
        refuse(node, `uses ${node.text} other than through its members`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      fc.has(node.expression.expression.text)
    ) {
      const name = node.expression.name.text;
      if (RUNNERS.has(name)) {
        runners += 1;
        judgeOptions(node, name);
      } else if (name === CONFIGURE) {
        configures += 1;
        if (file !== SEED_HOME)
          refuse(node, `configures fast-check globally outside ${SEED_HOME}`);
      }
    }
    if (
      ts.isIdentifier(node) &&
      node.text === FLOOR &&
      PROPERTIES_FILE.test(file)
    )
      refuse(
        node,
        'names floorBreach in a properties file: fresh cases fail an exact floor at random; use minimumBreach (#84)',
      );
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { runners, configures, refusals };
}

/** Whether `file` is one of the properties or logs suites' test files. */
export const isPropertiesFile = (file: string): boolean =>
  PROPERTIES_FILE.test(file);
