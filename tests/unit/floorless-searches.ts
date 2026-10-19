import ts from 'typescript';
import { lineOf } from './line-of';
import { listFindings } from './burn-down';
import { chainRoot } from './one-test-per-case';
import { EXEMPT, isPropertiesFile } from './measured-minimums';
import {
  expectationOf,
  isFunction,
  placeOf,
  testBodiesIn,
} from './test-scopes';

/**
 * Every absence search, where it sits, and whether a floor is checked on its
 * population in the same scope (#361).
 *
 * An absence search asserts that a population holds nothing it hunts. Refusing
 * an EMPTY population (`searched`) catches a reader blind to everything; a
 * reader blind to PART of its population still passes while one unit is read.
 * Only a floor recorded in `tests/floors/` and checked for equality sees
 * that, so a scope that searches a population also checks a floor on THAT
 * population: `floorBreach(id, <of>.length)` (or `.size`, or `<of>` itself
 * for a count), `<of>` spelled as the search's `of:` spells it. A floor on
 * anything else in the same test is a token, not a check of this search.
 *
 * Two kinds of site:
 *
 * - a `searched(findings, { of, what })` call. Floored when its scope checks
 *   a floor on its `of:`.
 * - an `againstControl(run, { input, control })` call, for an input the test
 *   leaves empty on purpose (operator decision, 2026-10-05: empty input
 *   only). Proved when `input:` is an empty literal written in place and
 *   `run` is a function name, or a function of one parameter that uses it;
 *   the call itself proves the control finds something when it runs.
 * - a bare absence matcher, which names no population, so no floor can be
 *   bound to it and it is never floored: `toEqual([])`, `toStrictEqual([])`,
 *   `toEqual({})`, `toStrictEqual({})`, `toHaveLength(0)`, `.length` or
 *   `.size` to be 0, `.some(…)` to be false, `.every(…)` to be true, and a
 *   negated `toContain`, `toContainEqual` or `toMatch`. One whose subject is
 *   a `searched` or `againstControl` call, or a property of one, is that
 *   call's site, not a second one.
 *
 * Measured over the repository on 2026-10-05; a scalar `toBe(0)` or a bare
 * `toBeUndefined()` is not read, since the parse tree cannot tell an exit
 * status from a count without guessing from names.
 *
 * A `searched` call that is the whole body of a function handed to
 * `expect(…).toThrow(…)` searches nothing: it proves `searched` refuses a
 * population. It is counted as a refusal check, decided by that shape and
 * never by a label.
 *
 * There is no exemption. A site's scope is the innermost test body around it
 * (every form `kindOf` reads as a test), else the innermost named function.
 * Anywhere else (a hook, module level, an anonymous callback outside a test)
 * is refused by line, as is `searched` or `expect` imported under another
 * name, or `searched` read as a value: each is a site this reader would
 * otherwise not see.
 */
export type Form =
  'searched' | 'control' | 'twin' | 'empty' | 'no-match' | 'not-contained';

export interface SearchSite {
  /** 1-based line of the wrapper call, or of a bare form's `expect(`. */
  readonly line: number;
  readonly form: Form;
  readonly scope: 'test' | 'function';
  /** The test's title as written, or the function's name. */
  readonly label: string;
  /**
   * Proved live: a `searched` call whose scope checks `floorBreach` on the
   * population its `of:` names, or an `againstControl` call of the bound
   * shape. A bare form never is.
   */
  readonly proved: boolean;
}

export interface SearchReading {
  readonly sites: readonly SearchSite[];
  /** Every test body read, by title as written. */
  readonly tests: readonly string[];
  /** `searched` calls that only prove it throws. */
  readonly refusalChecks: number;
  /** Sites that sit in no test and no named function: refused. */
  readonly unplaced: number;
  /** Everything the reader could not classify, by line and why. */
  readonly refused: readonly string[];
}

const SEARCHED = 'searched';
const CONTROLLED = 'againstControl';
const TWINNED = 'againstTwin';
const WRAPPERS = [SEARCHED, CONTROLLED, TWINNED];
const EXPECT = 'expect';
const FLOOR = 'floorBreach';
const MINIMUM = 'minimumBreach';

/**
 * The floor checks a search in `file` may prove itself by: an exact floor
 * anywhere, and a measured minimum only in the properties Shyden exempted
 * from exact floors (2026-10-12: "Fresh cases, safe minimums"; 2026-10-16:
 * "Yes, all 10"; #84), whose fresh cases move every count from run to run.
 * Anywhere else a measured minimum proves nothing.
 */
const floorsIn = (file: string): ReadonlySet<string> =>
  isPropertiesFile(file) && EXEMPT[file] !== undefined
    ? new Set([FLOOR, MINIMUM])
    : new Set([FLOOR]);

/** Matchers whose argument says "empty": `[]`, `{}`, or an object of empties (#558). */
const EQUALITY = new Set(['toEqual', 'toStrictEqual']);
/** Matchers that, negated, say "no such member". */
const MEMBERSHIP = new Set(['toContain', 'toContainEqual', 'toMatch']);

/** The population a search names in `of:`, as written, or undefined. */
function populationOf(call: ts.CallExpression): ts.Expression | undefined {
  const population = call.arguments[1];
  if (!population || !ts.isObjectLiteralExpression(population))
    return undefined;
  const of = population.properties.find(
    (member) =>
      member.name !== undefined &&
      ts.isIdentifier(member.name) &&
      member.name.text === 'of',
  );
  if (of === undefined) return undefined;
  if (ts.isPropertyAssignment(of)) return of.initializer;
  if (ts.isShorthandPropertyAssignment(of)) return of.name;
  return undefined;
}

/** Source text with every space dropped: `a .b` and `a.b` are one name. */
const spelled = (sf: ts.SourceFile, node: ts.Node): string =>
  node.getText(sf).replace(/\s+/g, '');

/**
 * True where `scope` checks a floor on the very population `call` searches:
 * `floorBreach(id, <of>.length)`, `<of>.size`, or `<of>` itself for a count,
 * `<of>` spelled as the search spells it.
 */
function floorsPopulation(
  sf: ts.SourceFile,
  scope: ts.Node,
  call: ts.CallExpression,
): boolean {
  const population = populationOf(call);
  if (population === undefined) return false;
  const of = spelled(sf, population);
  const counts = new Set([of, `${of}.length`, `${of}.size`]);
  const floors = floorsIn(sf.fileName);
  let found = false;
  const visit = (child: ts.Node): void => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      floors.has(child.expression.text) &&
      child.arguments[1] !== undefined &&
      counts.has(spelled(sf, child.arguments[1]))
    )
      found = true;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(scope);
  return found;
}

/** `''`, `[]`, `{}`, `new Map()` or `new Set()`, written in place. */
const isEmptyInput = (node: ts.Expression): boolean =>
  ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    node.text === '') ||
  isEmptyLiteral(node) ||
  isEmptyCollection(node);

/** The initializer of `name:` in an object literal, or undefined. */
function propertyOf(
  literal: ts.Expression | undefined,
  name: string,
): ts.Expression | undefined {
  if (!literal || !ts.isObjectLiteralExpression(literal)) return undefined;
  const member = literal.properties.find(
    (each) =>
      ts.isPropertyAssignment(each) &&
      ts.isIdentifier(each.name) &&
      each.name.text === name,
  );
  return member && ts.isPropertyAssignment(member)
    ? member.initializer
    : undefined;
}

/** Whether `fn`'s body reads the identifier `name`. */
function reads(fn: ts.Node, name: string): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (ts.isIdentifier(child) && child.text === name) found = true;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(fn);
  return found;
}

/**
 * An `againstControl` call of the shape the operator decided: an empty
 * literal for `input:`, a `control:`, and a `run` that is a function's name
 * or a function of one parameter its body reads.
 */
function isBoundControl(call: ts.CallExpression): boolean {
  const [run, options] = call.arguments;
  const input = propertyOf(options, 'input');
  if (!run || !input || !propertyOf(options, 'control')) return false;
  return isEmptyInput(input) && readsItsArgument(run);
}

/** A function's name, or a function of one parameter its body reads. */
function readsItsArgument(run: ts.Expression): boolean {
  if (ts.isIdentifier(run) || ts.isPropertyAccessExpression(run)) return true;
  if (!isFunction(run) || run.parameters.length !== 1) return false;
  const [parameter] = run.parameters as unknown as [ts.ParameterDeclaration];
  return (
    ts.isIdentifier(parameter.name) && reads(run.body, parameter.name.text)
  );
}

/**
 * An `againstTwin` call of the shape the operator decided (2026-10-19):
 * one sample, a `twin:`, and a `run` that is a function's name or a
 * function of one parameter its body reads. The sample is text written in
 * place, or a name no binding in the file fills from a call: a sample read
 * from a file is a population, which checks a recorded floor. A name the
 * file only takes as a parameter cannot be followed further, so every use
 * is also listed (`floorless-searches.twins.ts`) for review.
 */
function isBoundTwin(sf: ts.SourceFile, call: ts.CallExpression): boolean {
  const [run, options] = call.arguments;
  const input = propertyOf(options, 'input');
  if (!run || !input || !propertyOf(options, 'twin')) return false;
  const text =
    ts.isStringLiteral(input) ||
    ts.isNoSubstitutionTemplateLiteral(input) ||
    (ts.isIdentifier(input) && !filledByCall(sf, input.text, new Set()));
  return text && readsItsArgument(run);
}

/** A call, an `await`, a `new` or a tagged template anywhere in `node`. */
function holdsCall(node: ts.Node): boolean {
  if (
    ts.isCallExpression(node) ||
    ts.isAwaitExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isTaggedTemplateExpression(node)
  )
    return true;
  return ts.forEachChild(node, holdsCall) === true;
}

/** Whether a binding name, or any name in a destructuring pattern, is `name`. */
function bindsName(binding: ts.BindingName, name: string): boolean {
  if (ts.isIdentifier(binding)) return binding.text === name;
  return binding.elements.some(
    (element) =>
      !ts.isOmittedExpression(element) && bindsName(element.name, name),
  );
}

/**
 * Whether any binding of `name` in the file can hold what a call returned,
 * by name and so failing closed on a second binding of the same name: an
 * import, a declaration with no initializer, a later assignment, or a
 * declaration (a loop's included) whose source holds a call or a name that
 * does, followed to a fixed point. A parameter is not followed.
 */
function filledByCall(
  sf: ts.SourceFile,
  name: string,
  seen: Set<string>,
): boolean {
  if (seen.has(name)) return false;
  seen.add(name);
  let filled = false;
  const sourceOf = (
    declaration: ts.VariableDeclaration,
  ): ts.Expression | undefined => {
    const list = declaration.parent;
    const loop = ts.isVariableDeclarationList(list) ? list.parent : undefined;
    if (loop && (ts.isForOfStatement(loop) || ts.isForInStatement(loop)))
      return loop.expression;
    return declaration.initializer;
  };
  const followed = (source: ts.Expression): boolean => {
    if (holdsCall(source)) return true;
    let found = false;
    const visit = (child: ts.Node): void => {
      if (
        ts.isIdentifier(child) &&
        !(
          ts.isPropertyAccessExpression(child.parent) &&
          child.parent.name === child
        ) &&
        !(
          ts.isPropertyAssignment(child.parent) && child.parent.name === child
        ) &&
        filledByCall(sf, child.text, seen)
      )
        found = true;
      if (!found) ts.forEachChild(child, visit);
    };
    visit(source);
    return found;
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportSpecifier(node) ||
        ts.isNamespaceImport(node) ||
        ts.isImportClause(node)) &&
      node.name?.text === name
    )
      filled = true;
    else if (ts.isVariableDeclaration(node) && bindsName(node.name, name)) {
      const source = sourceOf(node);
      if (source === undefined || followed(source)) filled = true;
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      node.left.text === name
    )
      filled = true;
    if (!filled) ts.forEachChild(node, visit);
  };
  visit(sf);
  return filled;
}

/**
 * Whether `subject`, through an `await` and any property reads and calls on
 * it, starts from a wrapper call: `againstControl(…).size`,
 * `await againstTwin(…)`.
 */
function startsFromWrapper(subject: ts.Expression): boolean {
  let at: ts.Expression = subject;
  for (;;) {
    if (ts.isAwaitExpression(at)) at = at.expression;
    else if (ts.isCallExpression(at)) {
      if (
        ts.isIdentifier(at.expression) &&
        WRAPPERS.includes(at.expression.text)
      )
        return true;
      at = at.expression;
    } else if (ts.isPropertyAccessExpression(at)) at = at.expression;
    else return false;
  }
}

/** `name(…)` called directly by that name. */
const isCallTo = (node: ts.Node, name: string): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === name;

/** `xs.method(…)` for one of `methods`. */
const isMethodCall = (node: ts.Node, methods: readonly string[]): boolean =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  methods.includes(node.expression.name.text);

const isEmptyLiteral = (node: ts.Node | undefined): boolean =>
  node !== undefined &&
  ((ts.isArrayLiteralExpression(node) && node.elements.length === 0) ||
    (ts.isObjectLiteralExpression(node) && node.properties.length === 0));

const isZero = (node: ts.Node | undefined): boolean =>
  node !== undefined && ts.isNumericLiteral(node) && node.text === '0';

/** `new Set()` or `new Map()` with nothing in it. */
const isEmptyCollection = (node: ts.Node): boolean =>
  ts.isNewExpression(node) &&
  ts.isIdentifier(node.expression) &&
  ['Map', 'Set'].includes(node.expression.text) &&
  (node.arguments ?? []).length === 0;

/**
 * An object literal whose every value says "empty": `[]`, `{}`, an empty
 * `Set` or `Map`, `0`, or such an object nested (#558). It asserts the same
 * as `toEqual([])`, nothing found, with no population beside it. A spread
 * or a shorthand value is not read as empty.
 */
const isEmptyRecord = (node: ts.Node | undefined): boolean =>
  node !== undefined &&
  ts.isObjectLiteralExpression(node) &&
  node.properties.length > 0 &&
  node.properties.every(
    (member) =>
      ts.isPropertyAssignment(member) &&
      (isEmptyLiteral(member.initializer) ||
        isEmptyCollection(member.initializer) ||
        isZero(member.initializer) ||
        isEmptyRecord(member.initializer)),
  );

/**
 * The absence form a matcher call asserts, or undefined: the bare forms only.
 * `subject` is what `expect` was handed.
 */
function bareForm(
  name: string,
  argument: ts.Expression | undefined,
  subject: ts.Expression,
  negated: boolean,
): Form | undefined {
  if (negated) return MEMBERSHIP.has(name) ? 'not-contained' : undefined;
  if (
    EQUALITY.has(name) &&
    (isEmptyLiteral(argument) || isEmptyRecord(argument))
  )
    return 'empty';
  if (name === 'toHaveLength' && isZero(argument)) return 'empty';
  if (
    (name === 'toBe' || EQUALITY.has(name)) &&
    isZero(argument) &&
    ts.isPropertyAccessExpression(subject) &&
    (subject.name.text === 'length' || subject.name.text === 'size')
  )
    return 'empty';
  if (name !== 'toBe' || argument === undefined) return undefined;
  if (
    argument.kind === ts.SyntaxKind.FalseKeyword &&
    isMethodCall(subject, ['some'])
  )
    return 'no-match';
  if (
    argument.kind === ts.SyntaxKind.TrueKeyword &&
    isMethodCall(subject, ['every'])
  )
    return 'no-match';
  return undefined;
}

/**
 * True where `call` is the whole body of a function handed to
 * `expect(…).toThrow(…)` or `.toThrowError(…)`, not negated.
 */
function onlyProvesItThrows(call: ts.CallExpression): boolean {
  if (onlyProvesItRejects(call)) return true;
  let body: ts.Node = call;
  if (ts.isExpressionStatement(call.parent)) {
    const statement = call.parent;
    const block = statement.parent;
    if (!ts.isBlock(block) || block.statements.length !== 1) return false;
    body = block;
  }
  const fn = body.parent;
  if (!isFunction(fn) || fn.body !== body) return false;
  const expectation = fn.parent;
  if (
    !isCallTo(expectation, EXPECT) ||
    expectation.arguments[0] !== fn ||
    !ts.isPropertyAccessExpression(expectation.parent)
  )
    return false;
  const matcher = expectation.parent;
  return (
    (matcher.name.text === 'toThrow' || matcher.name.text === 'toThrowError') &&
    ts.isCallExpression(matcher.parent) &&
    matcher.parent.expression === matcher
  );
}

/** `expect(<call>).rejects.toThrow(…)` or `.toThrowError(…)`, not negated (#374). */
function onlyProvesItRejects(call: ts.CallExpression): boolean {
  const expectation = call.parent;
  if (!isCallTo(expectation, EXPECT) || expectation.arguments[0] !== call)
    return false;
  const rejects = expectation.parent;
  if (
    !ts.isPropertyAccessExpression(rejects) ||
    rejects.name.text !== 'rejects'
  )
    return false;
  const matcher = rejects.parent;
  return (
    ts.isPropertyAccessExpression(matcher) &&
    (matcher.name.text === 'toThrow' || matcher.name.text === 'toThrowError') &&
    ts.isCallExpression(matcher.parent) &&
    matcher.parent.expression === matcher
  );
}

export function searchSitesIn(sf: ts.SourceFile): SearchReading {
  const bodies = testBodiesIn(sf);
  const sites: SearchSite[] = [];
  const refused: string[] = [];
  let refusalChecks = 0;
  let unplaced = 0;
  const refuse = (node: ts.Node, why: string): void => {
    refused.push(`${sf.fileName}:${String(lineOf(sf, node))}: ${why}`);
  };

  const site = (at: ts.Node, form: Form, call?: ts.CallExpression): void => {
    const place = placeOf(at, bodies);
    if (place === undefined) {
      unplaced += 1;
      refuse(at, 'a search in no test and no named function');
      return;
    }
    sites.push({
      line: lineOf(sf, at),
      form,
      scope: place.scope,
      label: place.label,
      proved:
        call !== undefined &&
        (form === 'control'
          ? isBoundControl(call)
          : form === 'twin'
            ? isBoundTwin(sf, call)
            : floorsPopulation(sf, place.node, call)),
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportSpecifier(node) &&
      (node.propertyName ?? node.name).text !== node.name.text &&
      [...WRAPPERS, EXPECT].includes((node.propertyName ?? node.name).text)
    )
      refuse(
        node,
        `${(node.propertyName ?? node.name).text} imported under another name, ${node.name.text}`,
      );
    if (ts.isIdentifier(node) && WRAPPERS.includes(node.text)) {
      const parent = node.parent;
      const form: Form =
        node.text === SEARCHED
          ? 'searched'
          : node.text === CONTROLLED
            ? 'control'
            : 'twin';
      if (ts.isCallExpression(parent) && parent.expression === node) {
        if (onlyProvesItThrows(parent)) refusalChecks += 1;
        else site(parent, form, parent);
      } else if (
        !ts.isImportSpecifier(parent) &&
        !ts.isExportSpecifier(parent) &&
        !(ts.isFunctionDeclaration(parent) && parent.name === node)
      )
        refuse(node, `${node.text} read as a value, not called`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      chainRoot(node) === EXPECT
    ) {
      const read = expectationOf(node.expression);
      const subject = read?.expectation.arguments[0];
      if (read && subject && !startsFromWrapper(subject)) {
        const form = bareForm(
          node.expression.name.text,
          node.arguments[0],
          subject,
          read.negated,
        );
        if (form !== undefined) site(read.expectation, form);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return {
    sites,
    tests: [...bodies.values()],
    refusalChecks,
    unplaced,
    refused,
  };
}

/** The zero assertions in one file (#367). */
export interface ZeroReading {
  /**
   * `toBe(0)`, `toEqual(0)` or `toStrictEqual(0)` on an expect chain, negated
   * or not, read as a site or not: what the text count checks.
   */
  readonly zeroAssertions: number;
  /**
   * The non-negated ones `searchSitesIn` does not read as a site, by line: a
   * count the parse tree cannot tell from an exit status or a game value
   * without guessing from names, so a recorded floor ratchets them instead.
   */
  readonly scalarZeros: readonly string[];
}

export function scalarZerosIn(sf: ts.SourceFile): ZeroReading {
  let zeroAssertions = 0;
  const scalarZeros: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      chainRoot(node) === EXPECT
    ) {
      const name = node.expression.name.text;
      const read = expectationOf(node.expression);
      const subject = read?.expectation.arguments[0];
      if (
        read &&
        subject &&
        (name === 'toBe' || EQUALITY.has(name)) &&
        isZero(node.arguments[0])
      ) {
        zeroAssertions += 1;
        const isSite =
          !startsFromWrapper(subject) &&
          bareForm(name, node.arguments[0], subject, read.negated) !==
            undefined;
        if (!read.negated && !isSite)
          scalarZeros.push(
            `line ${String(lineOf(sf, node))}: ${node.getText(sf).replace(/\s+/g, ' ')}`,
          );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { zeroAssertions, scalarZeros };
}

/** A site with the file it was read in. */
export interface FiledSite {
  readonly file: string;
  readonly label: string;
  readonly proved: boolean;
}

/**
 * Every scope whose unproved sites differ from the burn-down list, both
 * ways: see `listFindings`.
 */
export const burnDownFindings = (
  sites: readonly FiledSite[],
  listed: Readonly<Record<string, number>>,
): string[] =>
  listFindings(
    sites.filter(({ proved }) => !proved),
    listed,
    {
      noun: 'unproved',
      fix:
        "Check a recorded floor on each search's population in the same " +
        'test (searched + floorBreach), or use againstControl for an input ' +
        'left empty on purpose.',
      list: 'tests/unit/floorless-searches.burn-down.ts',
    },
  );

/**
 * Every scope whose `againstTwin` uses differ from the twin list, both ways
 * (#374). A twin proves the run was working, not that it read the whole
 * sample, so Shyden chose (2026-10-19, "Visible list") that every use is
 * listed, and a new one shows in the change that adds it. A use counts
 * whether or not its shape is proved: an unproved one is on the burn-down
 * list as well.
 */
export const twinListFindings = (
  sites: readonly (FiledSite & { form: Form })[],
  listed: Readonly<Record<string, number>>,
): string[] =>
  listFindings(
    sites.filter(({ form }) => form === 'twin'),
    listed,
    {
      noun: 'proved by a twin',
      fix:
        'A twin proves the run was working, not that it read the whole ' +
        'sample, so each use is reviewed (operator, 2026-10-19). Prefer a ' +
        `recorded floor; where a twin is right, list it in ${TWIN_LIST}.`,
      list: TWIN_LIST,
      stale: `Lower or remove the entry in ${TWIN_LIST}: it names the twins in use.`,
    },
  );

const TWIN_LIST = 'tests/unit/floorless-searches.twins.ts';
