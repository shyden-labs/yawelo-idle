import { readFileSync } from 'node:fs';
import { shippedPackages, type Lockfile } from './third-party-notices.ts';

/**
 * Judges every package in package-lock.json against the licence rule (#464,
 * Shyden 2026-10-07): what ships to players must be permissive; build and
 * test tools may also be weak copyleft, since their code is only run, never
 * handed on. GPL, AGPL, SSPL, a missing or an unreadable licence is red.
 * The tier comes from npm: a package it does not mark `dev` ships.
 */

/** Licences a package may carry when it ships to players. */
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

/** Further licences a build or test tool may carry: its code is only run. */
export const WEAK_COPYLEFT = [
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MPL-2.0',
] as const;

/** Whether a package ships to players or only builds and tests the game. */
export type Tier = 'shipped' | 'build';

const ALLOWED: Readonly<Record<Tier, ReadonlySet<string>>> = {
  shipped: new Set(PERMISSIVE),
  build: new Set([...PERMISSIVE, ...WEAK_COPYLEFT]),
};

const IDENTIFIER = /^[A-Za-z0-9.+-]+$/;
const OPERATORS = new Set(['AND', 'OR', 'WITH']);

/**
 * Whether an SPDX expression is satisfied by the allowed licences. It reads
 * identifiers joined by AND and OR, with brackets; AND binds tighter than OR.
 * An OR needs one allowed branch, an AND needs every part. Anything else (a
 * WITH exception, a slash, a lowercase operator, an unbalanced bracket)
 * throws, so it is refused as unreadable rather than guessed at.
 */
function satisfied(license: string, allowed: ReadonlySet<string>): boolean {
  const tokens = license.match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;
  const unreadable = (): never => {
    throw new Error('unreadable');
  };

  const atom = (): boolean => {
    const token = tokens[at];
    at += 1;
    if (token === '(') {
      const inner = either();
      if (tokens[at] !== ')') unreadable();
      at += 1;
      return inner;
    }
    if (token === undefined || !IDENTIFIER.test(token) || OPERATORS.has(token))
      return unreadable();
    return allowed.has(token);
  };

  // Every part is read, never cut short, so a malformed later part still
  // makes the whole expression unreadable.
  const join = (word: string, part: () => boolean, all: boolean) => {
    const results = [part()];
    while (tokens[at] === word) {
      at += 1;
      results.push(part());
    }
    return all ? results.every(Boolean) : results.some(Boolean);
  };
  const both = () => join('AND', atom, true);
  const either = (): boolean => join('OR', both, false);

  const result = either();
  if (at !== tokens.length) unreadable();
  return result;
}

/** Why a package's licence is refused, or undefined when it is allowed. */
export function judge(
  license: string | undefined,
  tier: Tier,
): string | undefined {
  if (license === undefined || license.trim() === '')
    return 'it has no licence';
  let passes: boolean;
  try {
    passes = satisfied(license, ALLOWED[tier]);
  } catch {
    return `cannot read licence "${license}"`;
  }
  if (passes) return undefined;
  return tier === 'shipped'
    ? 'it ships to players, so it must be permissive'
    : 'not permissive or weak copyleft';
}

/** A package whose licence is refused, and why. */
export interface Finding {
  name: string;
  version: string;
  license: string;
  tier: Tier;
  reason: string;
}

const NODE_MODULES = 'node_modules/';

/** Judges every third-party package in the lockfile; workspaces are ours. */
export function checkLicences(lock: Lockfile): {
  judged: number;
  findings: Finding[];
} {
  const shipped = new Set(shippedPackages(lock).map((p) => p.path));
  const findings: Finding[] = [];
  let judged = 0;
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path.includes(NODE_MODULES) || entry.link === true) continue;
    judged += 1;
    const tier: Tier = shipped.has(path) ? 'shipped' : 'build';
    const reason = judge(entry.license, tier);
    if (reason === undefined) continue;
    findings.push({
      name: path.slice(path.lastIndexOf(NODE_MODULES) + NODE_MODULES.length),
      version: entry.version ?? '(no version)',
      license: entry.license ?? '(none)',
      tier,
      reason,
    });
  }
  return { judged, findings };
}

/** One line per finding, for a test message or the terminal. */
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
