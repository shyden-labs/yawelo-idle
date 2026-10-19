/**
 * The daily owner-review check (#687): develop must still ask Shyden to
 * review the twin list (#374, Shyden 2026-10-19: "GitHub asks you"):
 *
 *   node scripts/owner-review.ts <owner/repo>
 *
 * with ADMIN_TOKEN (the read-only roadmap App, Administration: read) and
 * GH_TOKEN (the run's own token, issues: write) in the environment.
 *
 * It reads develop's "Require review from Code Owners" and the rules in
 * .github/CODEOWNERS on develop. When either is wrong, or cannot be read, or
 * there is no token to read the setting with (fail closed: it never skips
 * and passes), it opens one issue assigned to ShydenMcM naming each problem,
 * or comments on the one already open. The run is red whenever it reports.
 */
import { execFileSync } from 'node:child_process';
import type { Gh } from './board-progress.ts';
import { entries, isRecord } from './gh-reads.ts';

/**
 * The rules develop's CODEOWNERS must hold, each as its words: Shyden owns
 * the twin list and the file itself (#374). One home, read by this check and
 * by tests/unit/codeowners.test.ts.
 */
export const OWNED: readonly (readonly [string, string])[] = [
  ['/tests/unit/floorless-searches.twins.ts', '@ShydenMcM'],
  ['/.github/CODEOWNERS', '@ShydenMcM'],
];

/** The issue this check opens, and finds again while it is open. */
export const ISSUE_TITLE =
  'develop no longer asks Shyden to review the twin list (daily check, #687)';

const ASSIGNEE = 'ShydenMcM';

const WHERE =
  'Settings > Branches > develop > "Require review from Code Owners"';

/** Each CODEOWNERS rule as its words: blank lines and `#` comments carry none. */
export const codeownersRules = (text: string): string[][] =>
  text
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter((line) => line !== '')
    .map((line) => line.split(/\s+/));

/** What is wrong in develop's review settings, as GitHub's API returned them. */
export function protectionProblems(out: string): string[] {
  let reply: unknown;
  try {
    reply = JSON.parse(out);
  } catch {
    return ["could not parse develop's review settings: the reply is not JSON"];
  }
  if (!isRecord(reply) || Array.isArray(reply))
    return [
      "could not parse develop's review settings: the reply is not an object",
    ];
  const value = reply.require_code_owner_reviews;
  if (value === true) return [];
  const shown = value === undefined ? 'missing' : JSON.stringify(value);
  return [
    `develop does not require review from code owners (require_code_owner_reviews is ${shown}): ${WHERE}`,
  ];
}

/** Each rule in `OWNED` that develop's CODEOWNERS text does not hold. */
export function codeownersProblems(text: string): string[] {
  const held = new Set(codeownersRules(text).map((words) => words.join(' ')));
  return OWNED.map((rule) => rule.join(' '))
    .filter((rule) => !held.has(rule))
    .map((rule) => `.github/CODEOWNERS on develop lacks the rule "${rule}"`);
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** `gh` with the run's token and with the settings token. */
export interface OwnerReviewReads {
  admin: Gh;
  repo: Gh;
}

/** Every problem the two reads find, a failed read included. */
function problemsIn(
  repo: string,
  adminToken: string,
  reads: OwnerReviewReads,
): string[] {
  const problems: string[] = [];
  if (adminToken === '') {
    problems.push(
      "no token could read develop's review settings: the roadmap App's token was not minted (is ROADMAP_APP_KEY set in the dev environment, and does the App hold Administration: read?)",
    );
  } else {
    try {
      problems.push(
        ...protectionProblems(
          reads.admin([
            'api',
            `repos/${repo}/branches/develop/protection/required_pull_request_reviews`,
          ]),
        ),
      );
    } catch (error) {
      problems.push(
        `could not read develop's review settings: ${message(error)}`,
      );
    }
  }
  try {
    problems.push(
      ...codeownersProblems(
        reads.repo([
          'api',
          '-H',
          'Accept: application/vnd.github.raw',
          `repos/${repo}/contents/.github/CODEOWNERS?ref=develop`,
        ]),
      ),
    );
  } catch (error) {
    problems.push(
      `could not read .github/CODEOWNERS on develop: ${message(error)}`,
    );
  }
  return problems;
}

/** The open issue (never a pull request) carrying this check's title. */
function openReport(repo: string, gh: Gh): number | undefined {
  const found = entries(
    gh([
      'api',
      '--paginate',
      '--slurp',
      `repos/${repo}/issues?state=open&per_page=100`,
    ]),
  ).find(
    (item) =>
      isRecord(item) &&
      item.title === ISSUE_TITLE &&
      item.pull_request === undefined,
  );
  return isRecord(found) && typeof found.number === 'number'
    ? found.number
    : undefined;
}

/**
 * Judges develop and reports what it finds: `ok` only when nothing is wrong.
 * A report reuses the issue already open, and opens one only when none is.
 */
export function ownerReview(
  repo: string,
  adminToken: string,
  reads: OwnerReviewReads,
): { ok: boolean; lines: string[] } {
  const problems = problemsIn(repo, adminToken, reads);
  if (problems.length === 0)
    return {
      ok: true,
      lines: [
        `develop requires review from code owners, and .github/CODEOWNERS holds all ${String(OWNED.length)} rules.`,
      ],
    };
  const notes: string[] = [];
  let open: number | undefined;
  try {
    open = openReport(repo, reads.repo);
  } catch (error) {
    notes.push(
      `could not search the open issues for an earlier report: ${message(error)}`,
    );
  }
  const body = [
    'The daily owner-review check (#687) found:',
    '',
    ...problems.map((p) => `- ${p}`),
    ...notes.map((n) => `- ${n}`),
    '',
    'Until this is fixed, a change to the twin list (`tests/unit/floorless-searches.twins.ts`) can merge without asking you (#374). The rules are pinned by `tests/unit/codeowners.test.ts`.',
  ].join('\n');
  if (open === undefined) {
    reads.repo([
      'api',
      '-X',
      'POST',
      `repos/${repo}/issues`,
      '-f',
      `title=${ISSUE_TITLE}`,
      '-f',
      `body=${body}`,
      '-f',
      `assignees[]=${ASSIGNEE}`,
    ]);
  } else {
    reads.repo([
      'api',
      '-X',
      'POST',
      `repos/${repo}/issues/${String(open)}/comments`,
      '-f',
      `body=${body}`,
    ]);
  }
  return {
    ok: false,
    lines: [
      open === undefined
        ? `Opened an issue for ${ASSIGNEE}:`
        : `Commented on #${String(open)}:`,
      ...problems,
      ...notes,
    ],
  };
}

if (import.meta.main) {
  /** `gh` with `token` as its credential. */
  const ghWith =
    (token: string): Gh =>
    (args) =>
      execFileSync('gh', args, {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: token },
        maxBuffer: 64 * 1024 * 1024,
      });
  try {
    const repo = process.argv[2];
    if (repo === undefined || !/^[\w.-]+\/[\w.-]+$/.test(repo))
      throw new Error('usage: node scripts/owner-review.ts <owner/repo>');
    const adminToken = process.env.ADMIN_TOKEN ?? '';
    const { ok, lines } = ownerReview(repo, adminToken, {
      admin: ghWith(adminToken),
      repo: ghWith(process.env.GH_TOKEN ?? ''),
    });
    for (const line of lines) process.stdout.write(`${line}\n`);
    if (!ok) {
      process.stdout.write(`::error::${lines[1] ?? 'owner review is off'}\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stdout.write(`::error::${message(error)}\n`);
    process.exitCode = 1;
  }
}
