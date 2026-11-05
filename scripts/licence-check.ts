import { readFileSync } from 'node:fs';
import { shippedPackages, type Lockfile } from './third-party-notices.ts';

/**
 * Judges every package in package-lock.json against the licence rule (#464,
 * Shyden 2026-10-07): anything that ships to players must be permissive;
 * build and test tools may also be weak copyleft (their code is only run,
 * never handed on). Everything else is red: GPL, AGPL, SSPL, a missing
 * licence, or an expression this check cannot parse.
 *
 * The tier comes from npm itself: a lockfile entry without `dev: true` is in
 * the production closure of some workspace, so it ships.
 */

export const PERMISSIVE = [
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'Python-2.0',
  'Unlicense',
] as const;

export const WEAK_COPYLEFT = [
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MPL-2.0',
] as const;

export type Tier = 'shipped' | 'build';

type Expression =
  { kind: 'id'; id: string } | { kind: 'and' | 'or'; parts: Expression[] };

/**
 * Parses an SPDX licence expression of identifiers joined by AND and OR,
 * with parentheses; AND binds tighter than OR. Anything else (a WITH
 * exception, a slash, a lowercase operator, a dangling operator) throws.
 */
export function parseSpdx(text: string): Expression {
  const tokens = text.match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;

  const fail = (why: string): never => {
    throw new Error(`cannot parse licence "${text}": ${why}`);
  };

  const list = (kind: 'and' | 'or', item: () => Expression): Expression => {
    const first = item();
    const parts = [first];
    const word = kind.toUpperCase();
    while (tokens[at] === word) {
      at += 1;
      parts.push(item());
    }
    return parts.length === 1 ? first : { kind, parts };
  };

  const atom = (): Expression => {
    const token = tokens[at];
    if (token === undefined) return fail('it ends early');
    at += 1;
    if (token === '(') {
      const inner = either();
      if (tokens[at] !== ')') fail('a bracket is not closed');
      at += 1;
      return inner;
    }
    if (
      !/^[A-Za-z0-9.+-]+$/.test(token) ||
      ['AND', 'OR', 'WITH'].includes(token)
    )
      fail(`"${token}" is not a licence identifier`);
    return { kind: 'id', id: token };
  };

  const both = () => list('and', atom);
  const either = () => list('or', both);

  const parsed = either();
  const extra = tokens[at];
  if (extra !== undefined) fail(`"${extra}" is not expected here`);
  return parsed;
}

function passes(expression: Expression, allowed: ReadonlySet<string>): boolean {
  switch (expression.kind) {
    case 'id':
      return allowed.has(expression.id);
    case 'and':
      return expression.parts.every((part) => passes(part, allowed));
    case 'or':
      return expression.parts.some((part) => passes(part, allowed));
  }
}

const ALLOWED: Readonly<Record<Tier, ReadonlySet<string>>> = {
  shipped: new Set(PERMISSIVE),
  build: new Set([...PERMISSIVE, ...WEAK_COPYLEFT]),
};

export interface Finding {
  name: string;
  version: string;
  license: string;
  tier: Tier;
  reason: string;
}

/** The licence verdict on one package; undefined when it passes. */
export function judge(license: unknown, tier: Tier): string | undefined {
  if (typeof license !== 'string' || license.trim() === '')
    return 'it has no licence';
  let expression: Expression;
  try {
    expression = parseSpdx(license);
  } catch (error) {
    return (error as Error).message;
  }
  if (passes(expression, ALLOWED[tier])) return undefined;
  return tier === 'shipped'
    ? 'it ships to players, so it must be permissive'
    : 'not permissive or weak copyleft';
}

/** Every package in the lockfile, judged; the workspaces themselves are ours. */
export function checkLicences(lock: Lockfile): {
  judged: number;
  findings: Finding[];
} {
  const shipped = new Set(shippedPackages(lock).map((p) => p.path));
  const findings: Finding[] = [];
  let judged = 0;
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path.includes('node_modules/') || entry.link === true) continue;
    judged += 1;
    const tier: Tier = shipped.has(path) ? 'shipped' : 'build';
    const reason = judge(entry.license, tier);
    if (reason !== undefined)
      findings.push({
        name: path.slice(
          path.lastIndexOf('node_modules/') + 'node_modules/'.length,
        ),
        version: entry.version ?? '(no version)',
        license: entry.license ?? '(none)',
        tier,
        reason,
      });
  }
  return { judged, findings };
}

export function describeFindings(findings: readonly Finding[]): string {
  return findings
    .map((f) => `${f.name} ${f.version} (${f.license}, ${f.tier}): ${f.reason}`)
    .join('\n');
}

if (import.meta.main) {
  const lock = JSON.parse(
    readFileSync('package-lock.json', 'utf8'),
  ) as Lockfile;
  const { judged, findings } = checkLicences(lock);
  if (findings.length > 0) {
    console.error(describeFindings(findings));
    process.exitCode = 1;
  }
  console.log(
    `licences: ${String(judged)} packages judged, ${String(findings.length)} refused`,
  );
}
