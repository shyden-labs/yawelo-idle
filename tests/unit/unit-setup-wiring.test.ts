import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * The unit step's setup holds each test to its CPU limit, and the refusals
 * it shares with the coverage run hold no CPU check (#728). Read from the
 * parse tree, so a comment or a string naming a call cannot stand in for it.
 * A stand-in: the run that proves a CPU-heavy test fails is #740's.
 */
const parsed = (path: string): ts.SourceFile =>
  ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

/** Module-scope calls by the name they call, with the names their bodies call. */
const topLevelCalls = (
  sf: ts.SourceFile,
): { callee: string; calls: string[] }[] =>
  sf.statements.flatMap((statement) => {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression) ||
      !ts.isIdentifier(statement.expression.expression)
    )
      return [];
    const calls: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
        calls.push(node.expression.text);
      if (ts.isThrowStatement(node)) calls.push('throw');
      ts.forEachChild(node, visit);
    };
    statement.expression.arguments.forEach(visit);
    return [{ callee: statement.expression.expression.text, calls }];
  });

const imports = (sf: ts.SourceFile): string[] =>
  sf.statements
    .filter(ts.isImportDeclaration)
    .map((d) => (d.moduleSpecifier as ts.StringLiteral).text);

describe('the unit step holds each test to its CPU (#728)', () => {
  it('its setup loads every refusal', () => {
    expect(imports(parsed('tests/unit/setup.ts'))).toContain(
      './setup-refusals.ts',
    );
  });

  it('its setup fails a test over its CPU limit, after the test', () => {
    const after = topLevelCalls(parsed('tests/unit/setup.ts')).filter(
      ({ callee }) => callee === 'afterEach',
    );
    expect(after).toHaveLength(1);
    expect(after[0]?.calls).toEqual(
      expect.arrayContaining(['cpuProblem', 'throw']),
    );
  });

  it('the refusals the coverage run shares hold no CPU check', () => {
    const sf = parsed('tests/unit/setup-refusals.ts');
    const named = topLevelCalls(sf).flatMap(({ callee, calls }) => [
      callee,
      ...calls,
    ]);
    expect([named.includes('afterEach'), named.includes('cpuProblem')]).toEqual(
      [false, false],
    );
    // Liveness: the reader sees the refusals' own hooks.
    expect(named).toContain('beforeEach');
  });
});
