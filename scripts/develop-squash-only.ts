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
 * method it enables).
 *
 * build-and-test runs in a container with no `gh` (run 39172896739: `spawnSync
 * gh ENOENT`), so it asks GitHub's REST API with Node's own `fetch` and the
 * run's token; it needs no install. Anything it cannot read or does not know
 * fails it by name: no token, a status other than 200, a second page, a reply
 * that is not a list of rules, a pull-request rule naming no merge methods or
 * a method it has never seen.
 */
import { isRecord, readLater } from './gh-reads.ts';

/** The parts of GitHub's reply the check reads. */
export interface Reply {
  status: number;
  /** The `Link` header, or null when there is none. */
  link: string | null;
  text: string;
}

/** A GET of `url` sent with `token`, stood in by the unit tests. */
export type Get = (url: string, token: string) => Promise<Reply>;

const USAGE = 'usage: node scripts/develop-squash-only.ts <owner/repo>';

const BRANCH = 'develop';

/** The most rules one page holds; a branch never comes near it. */
const PAGE = 100;

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

/** The rules' count, and each pull-request rule's ruleset and methods. */
function parseRules(text: string): { count: number; pulls: PullRule[] } {
  const rules = JSON.parse(text) as unknown;
  if (!Array.isArray(rules))
    throw new Error('the reply is not a list of rules');
  const pulls: PullRule[] = [];
  for (const r of rules as unknown[]) {
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
 * Whether the gate passes, and the lines it prints. Rejects, naming what it
 * could not read, when it cannot look.
 */
export async function developSquashOnly(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  get: Get,
): Promise<{ ok: boolean; lines: string[] }> {
  const [repo] = args;
  if (repo === undefined) throw new Error(USAGE);
  const token = env.GH_TOKEN;
  if (token === undefined || token === '')
    throw new Error(
      `GH_TOKEN is not set, so the rules on ${BRANCH} cannot be read`,
    );
  const { count, pulls } = await readLater(
    `the rules on ${BRANCH}`,
    async () => {
      const reply = await get(
        `https://api.github.com/repos/${repo}/rules/branches/${BRANCH}?per_page=${String(PAGE)}`,
        token,
      );
      if (reply.status !== 200)
        throw new Error(`GitHub answered ${String(reply.status)}`);
      if (reply.link?.includes('rel="next"'))
        throw new Error(`they run past one page of ${String(PAGE)}`);
      return parseRules(reply.text);
    },
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
  /** One GET with the run's token, given up after 30 seconds. */
  const get: Get = async (url, token) => {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30_000),
    });
    return {
      status: response.status,
      link: response.headers.get('link'),
      text: await response.text(),
    };
  };
  try {
    const { ok, lines } = await developSquashOnly(
      process.argv.slice(2),
      process.env,
      get,
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
