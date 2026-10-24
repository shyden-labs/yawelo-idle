import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { codeWithoutLiterals } from './source-text.ts';

/**
 * `eslint.config.js` uses no deprecated API (#624). `includeIgnoreFile` from
 * `@eslint/compat` and `tseslint.config(...)` are both marked `@deprecated` in
 * their installed type declarations, which name ESLint core's own
 * `includeIgnoreFile()` and `defineConfig()` (`eslint/config`) instead.
 *
 * Every check is an exact list, so a deprecated call coming back adds an entry
 * and fails it. The imports are read from the parse tree, because a module
 * name is a literal and the stripped text blanks it; the calls are read from
 * the stripped text, so a comment naming one cannot satisfy or hide it.
 */
/** The config's parse tree, read inside each test (none at collection). */
const parse = (): ts.SourceFile =>
  ts.createSourceFile(
    'eslint.config.js',
    readFileSync('eslint.config.js', 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

/** `module: name, name` for every import declaration, in file order. */
const importsOf = (sf: ts.SourceFile): string[] =>
  sf.statements.filter(ts.isImportDeclaration).map((node) => {
    const from = (node.moduleSpecifier as ts.StringLiteral).text;
    const clause = node.importClause;
    const names: string[] = [];
    if (clause?.name) names.push(clause.name.text);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      names.push(...bindings.elements.map((element) => element.name.text));
    return `${from}: ${names.join(', ')}`;
  });

describe('eslint.config.js uses no deprecated API', () => {
  it('imports defineConfig and includeIgnoreFile from eslint/config, and nothing from @eslint/compat', () => {
    expect(importsOf(parse())).toEqual([
      'node:url: fileURLToPath',
      'eslint/config: defineConfig, includeIgnoreFile',
      '@eslint/js: js',
      'typescript-eslint: tseslint',
      'eslint-plugin-svelte: svelte',
      'eslint-plugin-astro: astro',
      'globals: globals',
      './apps/web/svelte.config.js: svelteConfig',
      './eslint.core-determinism.ts: coreDeterminismBlock',
    ]);
  });

  it('exports the config through defineConfig()', () => {
    expect(
      [
        ...codeWithoutLiterals(parse()).matchAll(
          /export\s+default\s+([\w.]+)\s*\(/g,
        ),
      ].map((m) => m[1]),
    ).toEqual(['defineConfig']);
  });

  it('reads only configs and parser from typescript-eslint, and calls none of it', () => {
    // A call shows as `name()`, so `tseslint.config(` would add `config()`.
    expect(
      [
        ...codeWithoutLiterals(parse()).matchAll(
          /\btseslint\s*\.\s*(\w+)\s*(\()?/g,
        ),
      ].map((m) => (m[1] ?? '') + (m[2] ? '()' : '')),
    ).toEqual(['configs', 'parser', 'parser', 'configs']);
  });
});
