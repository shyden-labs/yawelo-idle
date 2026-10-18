/**
 * The pull-request gate's merge-method check (#679): a pull request into
 * `develop` can be merged only by squash (Shyden 2026-10-18), so recorded
 * floors go in as a normal second commit, no branch needs a force-push, and
 * the commit that lands is the tree build-and-test judged:
 *
 *   node scripts/develop-squash-only.ts <owner/repo>
 *
 * with GH_TOKEN in the environment.
 *
 * It reads the rules GitHub applies to `develop` (`rules/branches/develop`),
 * so GitHub, not this script, decides which rulesets target the branch. Every
 * active ruleset is enforced at once, so a merge method is allowed only when
 * every pull-request rule allows it: the check passes when that intersection
 * is squash alone, and fails when it holds anything else or when no
 * pull-request rule applies (the repository's own settings then allow every
 * method it enables). The rules are public, so the run's own token reads them,
 * Dependabot's runs included. Anything it cannot read or does not know, such
 * as a pull-request rule naming no merge methods or a method it has never
 * seen, fails it by name.
 */
import { execFileSync } from 'node:child_process';
import type { Gh } from './board-progress.ts';
import { entries, isRecord, read } from './gh-reads.ts';

const USAGE = 'usage: node scripts/develop-squash-only.ts <owner/repo>';

const BRANCH = 'develop';

/** The merge methods a pull-request rule can allow, in GitHub's order. */
const METHODS = ['merge', 'squash', 'rebase'] as const;
type Method = (typeof METHODS)[number];

const isMethod = (x: unknown): x is Method =>
  (METHODS as readonly unknown[]).includes(x);

interface PullRule {
  ruleset: number;
  methods: Method[];
}

const plural = (n: number, one: string, many: string) =>
  `${String(n)} ${n === 1 ? one : many}`;

/** The rules' types, and each pull-request rule's ruleset and methods. */
function parseRules(out: string): { count: number; pulls: PullRule[] } {
  const rules = entries(out);
  const pulls: PullRule[] = [];
  for (const r of rules) {
    if (!isRecord(r) || typeof r.type !== 'string')
      throw new Error('a rule has no type');
    if (r.type !== 'pull_request') continue;
    if (!Number.isInteger(r.ruleset_id))
      throw new Error('a pull-request rule has no ruleset id');
    const ruleset = r.ruleset_id as number;
    const methods = isRecord(r.parameters)
      ? r.parameters.allowed_merge_methods
      : undefined;
    if (!Array.isArray(methods))
      throw new Error(
        `ruleset ${String(ruleset)}’s pull-request rule names no merge methods`,
      );
    const unknown = (methods as unknown[]).find((m) => !isMethod(m));
    if (unknown !== undefined)
      throw new Error(
        `ruleset ${String(ruleset)}’s pull-request rule names an unknown merge method ${JSON.stringify(unknown)}`,
      );
    pulls.push({ ruleset, methods: methods as Method[] });
  }
  return { count: rules.length, pulls };
}

/**
 * Whether the gate passes, and the lines it prints. Throws, naming what it
 * could not read, when it cannot look.
 */
export function developSquashOnly(
  args: readonly string[],
  gh: Gh,
): { ok: boolean; lines: string[] } {
  const [repo] = args;
  if (repo === undefined) throw new Error(USAGE);
  const { count, pulls } = read(`the rules on ${BRANCH}`, () =>
    parseRules(
      gh([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repo}/rules/branches/${BRANCH}?per_page=100`,
      ]),
    ),
  );
  const sizes = `Read ${plural(count, 'rule', 'rules')} on ${BRANCH}.`;
  if (pulls.length === 0) {
    return {
      ok: false,
      lines: [
        `No pull-request rule applies to ${BRANCH}, so every merge method the repository allows can merge into it. Add a ruleset on ${BRANCH} whose pull-request rule allows squash alone (#679). ${sizes}`,
      ],
    };
  }
  const allowed = METHODS.filter((m) =>
    pulls.every((p) => p.methods.includes(m)),
  );
  const rules = `${plural(pulls.length, 'pull-request rule', 'pull-request rules')} (${pulls.length === 1 ? 'ruleset' : 'rulesets'} ${pulls.map((p) => String(p.ruleset)).join(', ')})`;
  if (allowed.length === 1 && allowed[0] === 'squash') {
    return {
      ok: true,
      lines: [
        `${BRANCH} merges by squash only: ${rules} ${pulls.length === 1 ? 'allows' : 'allow'} squash alone. ${sizes}`,
      ],
    };
  }
  const what = allowed.length === 0 ? 'no merge method' : allowed.join(', ');
  return {
    ok: false,
    lines: [
      `${BRANCH} allows ${what}: ${rules} must allow squash alone (#679). ${sizes}`,
    ],
  };
}

if (import.meta.main) {
  try {
    const { ok, lines } = developSquashOnly(process.argv.slice(2), (args) =>
      execFileSync('gh', args, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
    for (const line of lines) process.stdout.write(`${line}\n`);
    if (!ok) {
      process.stdout.write(
        `::error::${lines[0] ?? 'develop allows more than squash'}\n`,
      );
      process.exitCode = 1;
    }
  } catch (error) {
    process.stdout.write(
      `::error::${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
