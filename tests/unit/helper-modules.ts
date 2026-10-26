import ts from 'typescript';
import { posix } from 'node:path';
import { lineOf } from './line-of.ts';

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

/** A relative module specifier as one file writes it (#762). */
export interface RelativeSpecifier {
  readonly specifier: string;
  /** 1-based line of the specifier. */
  readonly line: number;
  /** Offsets of the specifier's text in the file, its quotes left out. */
  readonly start: number;
  readonly end: number;
  /**
   * How the file names it: an import, a re-export, `import()`, an import in a
   * type position, a `require` loader, or a `vi` call.
   */
  readonly form:
    'import' | 'export' | 'import()' | 'import-type' | 'require' | 'vi';
  /** An import or re-export that binds types alone. */
  readonly typeOnly: boolean;
}

/** The `vi` calls whose first argument names a module. */
const VI_PATH_CALLS = new Set([
  'mock',
  'doMock',
  'unmock',
  'doUnmock',
  'importActual',
  'importMock',
]);

/** Something a file writes that a reader cannot follow, at its offset. */
interface Unread {
  readonly at: number;
  readonly line: number;
  readonly what: string;
}

/** One file read once: what both views below are made from. */
interface FileRead {
  readonly specifiers: RelativeSpecifier[];
  readonly unread: Unread[];
  /** Each `require` loader call given a relative path, as its text. */
  readonly required: (Unread & { readonly specifier: string })[];
  /**
   * Each `import()` of a file URL made at run time: no relative specifier to
   * judge, but a module the follower cannot name.
   */
  readonly absolute: Unread[];
  readonly strings: string[][];
}

/** The packages whose `pathToFileURL` makes an absolute file URL. */
const URL_MODULES = new Set(['node:url', 'url']);

/**
 * Every name `sf` binds, to the nodes that bind it: declarations of every
 * kind, parameters and destructured names, imports and catch variables. A
 * name followed to its value must have exactly one.
 */
function bindingsOf(sf: ts.SourceFile): Map<string, ts.Node[]> {
  const bindings = new Map<string, ts.Node[]>();
  const bind = (name: ts.BindingName | undefined, at: ts.Node): void => {
    if (name === undefined) return;
    if (ts.isIdentifier(name)) {
      bindings.set(name.text, [...(bindings.get(name.text) ?? []), at]);
      return;
    }
    // A binding pattern; an array pattern's hole binds nothing.
    for (const element of name.elements)
      if (ts.isBindingElement(element)) bind(element.name, element);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isImportEqualsDeclaration(node) ||
      ts.isImportClause(node) ||
      ts.isNamespaceImport(node) ||
      ts.isImportSpecifier(node)
    )
      bind(node.name, node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return bindings;
}

/**
 * What a computed `import()` argument is, when the file pins it: the string
 * literal a `const` binds (the name bound nowhere else), or an absolute file
 * URL (`pathToFileURL(…).href`, imported from node:url and bound nowhere
 * else). Anything else is undefined: the caller refuses it.
 */
function pinnedPath(
  argument: ts.Expression,
  bindings: () => Map<string, ts.Node[]>,
): ts.StringLiteralLike | 'absolute' | undefined {
  const only = (name: string): ts.Node | undefined => {
    const all = bindings().get(name) ?? [];
    return all.length === 1 ? all[0] : undefined;
  };
  if (ts.isIdentifier(argument)) {
    const declaration = only(argument.text);
    return declaration !== undefined &&
      ts.isVariableDeclaration(declaration) &&
      ts.isVariableDeclarationList(declaration.parent) &&
      (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
      declaration.initializer !== undefined &&
      ts.isStringLiteralLike(declaration.initializer)
      ? declaration.initializer
      : undefined;
  }
  if (
    ts.isPropertyAccessExpression(argument) &&
    argument.name.text === 'href' &&
    ts.isCallExpression(argument.expression) &&
    ts.isIdentifier(argument.expression.expression)
  ) {
    const declaration = only(argument.expression.expression.text);
    if (declaration === undefined || !ts.isImportSpecifier(declaration))
      return undefined;
    const from = declaration.parent.parent.parent.moduleSpecifier;
    return (declaration.propertyName ?? declaration.name).text ===
      'pathToFileURL' &&
      ts.isStringLiteral(from) &&
      URL_MODULES.has(from.text)
      ? 'absolute'
      : undefined;
  }
  return undefined;
}

function readOf(file: string, source: string): FileRead {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const specifiers: RelativeSpecifier[] = [];
  const unread: Unread[] = [];
  const required: (Unread & { specifier: string })[] = [];
  const absolute: Unread[] = [];
  const strings: string[][] = [];
  const add = (
    literal: ts.StringLiteralLike,
    form: RelativeSpecifier['form'],
    typeOnly: boolean,
  ): void => {
    if (!isRelative(literal.text)) return;
    const start = literal.getStart(sf) + 1;
    specifiers.push({
      specifier: literal.text,
      line: lineOf(sf, literal),
      start,
      end: literal.end - 1,
      form,
      typeOnly,
    });
  };
  const refuse = (node: ts.Node, what: string): void => {
    const at = node.getStart(sf);
    unread.push({ at, line: lineOf(sf, node), what });
  };
  let bindings: Map<string, ts.Node[]> | undefined;
  const bound = (): Map<string, ts.Node[]> => (bindings ??= bindingsOf(sf));
  /** Names bound to a loader: `require`, and what `createRequire(…)` returns. */
  const loaders = new Set(['require']);
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) strings.push([node.text]);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      add(node.argument.literal, 'import-type', true);
    if (ts.isTemplateExpression(node))
      strings.push([
        node.head.text,
        ...node.templateSpans.map((span) => span.literal.text),
      ]);
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
    )
      add(node.moduleSpecifier, 'import', loadsNothing(node.importClause));
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      add(node.moduleSpecifier, 'export', node.isTypeOnly);
    if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const literal =
        first && ts.isStringLiteralLike(first) ? first : undefined;
      const text = (): string => node.getText(sf).replace(/\s+/g, ' ');
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const pinned =
          literal ??
          (first === undefined ? undefined : pinnedPath(first, bound));
        if (pinned === 'absolute') {
          const at = node.getStart(sf);
          absolute.push({
            at,
            line: lineOf(sf, node),
            what: `${text()} is not a literal path`,
          });
        } else if (pinned === undefined)
          refuse(node, `${text()} is not a literal path`);
        else add(pinned, 'import()', false);
      } else if (
        ts.isIdentifier(node.expression) &&
        loaders.has(node.expression.text) &&
        literal &&
        isRelative(literal.text)
      ) {
        add(literal, 'require', false);
        const at = node.getStart(sf);
        required.push({
          at,
          line: lineOf(sf, node),
          what: node.getText(sf),
          specifier: literal.text,
        });
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'vi' &&
        VI_PATH_CALLS.has(node.expression.name.text)
      ) {
        if (literal) add(literal, 'vi', false);
        else if (!(
          first &&
          ts.isCallExpression(first) &&
          first.expression.kind === ts.SyntaxKind.ImportKeyword
        ))
          refuse(node, `${text()} is not a literal path`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { specifiers, unread, required, absolute, strings };
}

/**
 * Every relative specifier `file` writes (#762), in each form that loads or
 * mocks a module, type-only ones included; and each such form it cannot
 * read (a computed path), by line. A package specifier is left out.
 */
export function relativeSpecifiers(
  file: string,
  source: string,
): {
  specifiers: RelativeSpecifier[];
  unread: { line: number; what: string }[];
} {
  const { specifiers, unread } = readOf(file, source);
  return {
    specifiers,
    unread: unread.map(({ line, what }) => ({ line, what })),
  };
}

/** The forms that load a module when the file runs. */
const LOADS: ReadonlySet<RelativeSpecifier['form']> = new Set([
  'import',
  'export',
  'import()',
]);

/**
 * What one file loads: relative specifiers, and what cannot be read; and
 * every string it writes, which may name a data file it reads (#659).
 */
function loadsOf(
  file: string,
  source: string,
): { specifiers: string[]; unread: string[]; strings: string[][] } {
  const read = readOf(file, source);
  const unread = [
    ...read.unread,
    ...read.absolute,
    ...read.required
      .filter(({ specifier }) => !specifier.endsWith('.json'))
      .map((call) => ({
        ...call,
        what: `${call.what} loads a module the follower does not read`,
      })),
  ].sort((a, b) => a.at - b.at);
  return {
    specifiers: read.specifiers
      .filter(({ form, typeOnly }) => LOADS.has(form) && !typeOnly)
      .map(({ specifier }) => specifier),
    unread: unread.map(({ what }) => what),
    strings: read.strings,
  };
}

/** One walk: what `helperModules` returns, and each file's helper loads. */
interface Walk {
  readonly helpers: Set<string>;
  readonly imports: string[];
  readonly unresolved: string[];
  /** Each file read, to the helpers it loads directly. */
  readonly loads: Map<string, string[]>;
  /**
   * Each file read, to the strings it writes, each as its literal parts: a
   * template's text between its substitutions, a plain string's one part.
   */
  readonly strings: Map<string, string[][]>;
}

function walk(
  entries: readonly string[],
  source: (path: string) => string | undefined,
): Walk {
  const helpers = new Set<string>();
  const imports: string[] = [];
  const loads = new Map<string, string[]>();
  const strings = new Map<string, string[][]>();
  const unresolved: string[] = [];
  const read = new Set<string>();
  const queue = [...entries];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (read.has(file)) continue;
    read.add(file);
    const text = source(file);
    if (text === undefined) continue;
    const { specifiers, unread, strings: written } = loadsOf(file, text);
    strings.set(file, written);
    const direct: string[] = [];
    loads.set(file, direct);
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
      direct.push(target);
      queue.push(target);
    }
  }
  return { helpers, imports, unresolved, loads, strings };
}

/** Each entry, to itself and every helper it reaches, sorted by entry. */
function reaches(
  entries: readonly string[],
  loads: ReadonlyMap<string, readonly string[]>,
): Map<string, Set<string>> {
  return new Map(
    [...entries].sort().map((entry) => {
      const reached = new Set<string>();
      const stack = [...(loads.get(entry) ?? [])];
      for (let file = stack.pop(); file !== undefined; file = stack.pop()) {
        if (reached.has(file)) continue;
        reached.add(file);
        stack.push(...(loads.get(file) ?? []));
      }
      return [entry, reached];
    }),
  );
}

export function helperModules(
  entries: readonly string[],
  source: (path: string) => string | undefined,
): HelperReach {
  const { helpers, imports, unresolved } = walk(entries, source);
  return { helpers: [...helpers].sort(), imports, unresolved };
}

export interface HelperLoaders extends HelperReach {
  /** Each helper reached, to the entries that load it, directly or through other helpers, sorted. */
  readonly loadedBy: ReadonlyMap<string, readonly string[]>;
}

/**
 * What `helperModules` finds, and which of `entries` loads each helper
 * (#659): the mutation judge asks it which non-unit tests a changed helper
 * can blind.
 */
export function helperLoaders(
  entries: readonly string[],
  source: (path: string) => string | undefined,
): HelperLoaders {
  const { helpers, imports, unresolved, loads } = walk(entries, source);
  const loadedBy = new Map<string, string[]>();
  for (const [entry, reached] of reaches(entries, loads)) {
    for (const helper of reached) {
      const by = loadedBy.get(helper) ?? [];
      by.push(entry);
      loadedBy.set(helper, by);
    }
  }
  return { helpers: [...helpers].sort(), imports, unresolved, loadedBy };
}

const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether `written`, a string in `file` as its literal parts, names the data
 * file `data`: as a path relative to `file` that resolves to it, as a path
 * it ends with, or as its bare file name, matched whole, segment by segment.
 * A template's substitution stands for any text, but only where its literal
 * text fixes the folder (all before the last `/`) and the file's extension:
 * a template like `${a}.json` or `${dir}/${name}` pins no file.
 */
function names(
  file: string,
  written: readonly string[],
  data: string,
): boolean {
  const [head = '', ...rest] = written;
  const last = written.at(-1) ?? '';
  if (
    rest.length > 0 &&
    (rest.some((part) => part.includes('/')) ||
      !head.includes('/') ||
      !last.endsWith(posix.extname(data)))
  )
    return false;
  const pattern = (first: string): string =>
    [first, ...rest].map(escaped).join('.*');
  if (head.startsWith('.')) {
    const resolved = posix.join(posix.dirname(file), head);
    if (new RegExp(`^${pattern(resolved)}$`).test(data)) return true;
  }
  const stripped = head.replace(/^(\.\/)+/, '');
  return [stripped, ...rest].some((part) => part.includes('/'))
    ? new RegExp(`^(.*/)?${pattern(stripped)}$`).test(data)
    : new RegExp(`^${pattern(stripped)}$`).test(posix.basename(data));
}

/**
 * Whether `file`'s strings name the data file `data` by its folder and its
 * extension, written apart: a folder constant such as `'tests/floors'` and
 * a name such as `${guard}.json` joined at run time.
 */
function namesFolder(
  file: string,
  strings: readonly (readonly string[])[],
  data: string,
): boolean {
  const extension = posix.extname(data);
  const folder = posix.dirname(data);
  const isFolder = ([text = '']: readonly string[]): boolean => {
    const path = text.replace(/\/+$/, '');
    return (
      path.replace(/^(\.\/)+/, '') === folder ||
      (path.startsWith('.') && posix.join(posix.dirname(file), path) === folder)
    );
  };
  return (
    strings.some(isFolder) &&
    strings.some((written) => (written.at(-1) ?? '').endsWith(extension))
  );
}

/**
 * Each of `data` that an entry, or a helper it reaches, names in a string,
 * to those entries, sorted (#659). A test reads a fixture from disk, not by
 * an import, so a string naming the file is the trace it leaves; a data
 * file no entry names is left out, and the caller decides what that means.
 */
export function dataReaders(
  entries: readonly string[],
  source: (path: string) => string | undefined,
  data: readonly string[],
): Map<string, string[]> {
  const { loads, strings } = walk(entries, source);
  const readBy = new Map<string, string[]>();
  for (const [entry, reached] of reaches(entries, loads))
    for (const target of data)
      if (
        [entry, ...reached].some((file) => {
          const written = strings.get(file) ?? [];
          return (
            written.some((parts) => names(file, parts, target)) ||
            namesFolder(file, written, target)
          );
        })
      )
        readBy.set(target, [...(readBy.get(target) ?? []), entry]);
  return readBy;
}
