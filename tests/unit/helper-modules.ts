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

/**
 * What one file loads: relative specifiers, and what cannot be read; and
 * every string it writes, which may name a data file it reads (#659).
 */
function loadsOf(
  file: string,
  source: string,
): { specifiers: string[]; unread: string[]; strings: string[][] } {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const unread: string[] = [];
  const strings: string[][] = [];
  /** Names bound to a loader: `require`, and what `createRequire(…)` returns. */
  const loaders = new Set(['require']);
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) strings.push([node.text]);
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
  return { specifiers: specifiers.filter(isRelative), unread, strings };
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
