import { describe, expect, it } from 'vitest';
import type { Gh } from '../../scripts/board-progress';
import {
  ISSUE_TITLE,
  OWNED,
  codeownersProblems,
  ownerReview,
  protectionProblems,
} from '../../scripts/owner-review';

/**
 * The daily check that develop still asks Shyden to review the twin list
 * (#687). Every read and write goes through a stand-in `gh`, so these tests
 * reach no network (AC4).
 */

const REPO = 'shyden-labs/yawelo-idle';

/** Develop's CODEOWNERS as #374 wrote it, comments included. */
const CODEOWNERS = `# Who must approve a change before it merges (#374).

# A bad twin proves the run was working.
/tests/unit/floorless-searches.twins.ts @ShydenMcM

# This file, so no change can drop the line above unasked.
/.github/CODEOWNERS @ShydenMcM
`;

const ON = JSON.stringify({
  require_code_owner_reviews: true,
  required_approving_review_count: 0,
});
const OFF = JSON.stringify({
  require_code_owner_reviews: false,
  required_approving_review_count: 0,
});

describe('protectionProblems', () => {
  it('finds nothing when develop requires code-owner review', () => {
    expect(protectionProblems(ON)).toEqual([]);
  });

  it('names the setting and where it is set when it is off', () => {
    expect(protectionProblems(OFF)).toEqual([
      'develop does not require review from code owners (require_code_owner_reviews is false): Settings > Branches > develop > "Require review from Code Owners"',
    ]);
  });

  it('reads a missing setting as off, never as on', () => {
    expect(protectionProblems('{"required_approving_review_count":0}')).toEqual(
      [
        'develop does not require review from code owners (require_code_owner_reviews is missing): Settings > Branches > develop > "Require review from Code Owners"',
      ],
    );
  });

  it('reads a truthy value that is not true as off', () => {
    expect(protectionProblems('{"require_code_owner_reviews":"true"}')).toEqual(
      [
        'develop does not require review from code owners (require_code_owner_reviews is "true"): Settings > Branches > develop > "Require review from Code Owners"',
      ],
    );
  });

  it('fails closed on a reply that is not JSON', () => {
    expect(protectionProblems('<html>')).toEqual([
      "could not parse develop's review settings: the reply is not JSON",
    ]);
  });

  it('fails closed on JSON that is not an object', () => {
    expect(protectionProblems('[true]')).toEqual([
      "could not parse develop's review settings: the reply is not an object",
    ]);
  });
});

describe('codeownersProblems', () => {
  it("finds nothing in develop's file", () => {
    expect(codeownersProblems(CODEOWNERS)).toEqual([]);
  });

  it('names the twin-list rule when its line is gone', () => {
    expect(
      codeownersProblems(
        CODEOWNERS.replace(
          '/tests/unit/floorless-searches.twins.ts @ShydenMcM\n',
          '',
        ),
      ),
    ).toEqual([
      '.github/CODEOWNERS on develop lacks the rule "/tests/unit/floorless-searches.twins.ts @ShydenMcM"',
    ]);
  });

  it('names the rule when its owner changed', () => {
    expect(
      codeownersProblems(
        CODEOWNERS.replace(
          '/.github/CODEOWNERS @ShydenMcM',
          '/.github/CODEOWNERS @someone',
        ),
      ),
    ).toEqual([
      '.github/CODEOWNERS on develop lacks the rule "/.github/CODEOWNERS @ShydenMcM"',
    ]);
  });

  it('reads a commented-out rule as gone', () => {
    expect(
      codeownersProblems(
        CODEOWNERS.replace(
          '/tests/unit/floorless-searches.twins.ts',
          '# /tests/unit/floorless-searches.twins.ts',
        ),
      ),
    ).toEqual([
      '.github/CODEOWNERS on develop lacks the rule "/tests/unit/floorless-searches.twins.ts @ShydenMcM"',
    ]);
  });

  it('names every rule when the file is empty', () => {
    expect(codeownersProblems('')).toEqual([
      '.github/CODEOWNERS on develop lacks the rule "/tests/unit/floorless-searches.twins.ts @ShydenMcM"',
      '.github/CODEOWNERS on develop lacks the rule "/.github/CODEOWNERS @ShydenMcM"',
    ]);
  });

  it('pins the rules develop must hold, the same two codeowners.test.ts reads', () => {
    expect(OWNED).toEqual([
      ['/tests/unit/floorless-searches.twins.ts', '@ShydenMcM'],
      ['/.github/CODEOWNERS', '@ShydenMcM'],
    ]);
  });
});

/** What the stand-in `gh` answers, and every call it was given. */
interface Stand {
  protection?: string | Error;
  codeowners?: string | Error;
  openIssues?: string | Error;
  adminToken?: string;
}

const run = (stand: Stand) => {
  const calls: { as: 'admin' | 'repo'; args: readonly string[] }[] = [];
  const answer = (value: string | Error | undefined, fallback: string) => {
    if (value instanceof Error) throw value;
    return value ?? fallback;
  };
  const admin: Gh = (args) => {
    calls.push({ as: 'admin', args });
    return answer(stand.protection, ON);
  };
  const repo: Gh = (args) => {
    calls.push({ as: 'repo', args });
    const path = args.find((a) => a.startsWith(`repos/${REPO}/`)) ?? '';
    if (path.includes('/contents/'))
      return answer(stand.codeowners, CODEOWNERS);
    if (args.includes('POST')) return '{"number":900}';
    return answer(stand.openIssues, '[[]]');
  };
  const result = ownerReview(REPO, stand.adminToken ?? 'admin-token', {
    admin,
    repo,
  });
  const writes = calls.filter((c) => c.args.includes('POST'));
  return { result, calls, writes };
};

describe('ownerReview', () => {
  it('opens nothing when the setting is on and every rule is there', () => {
    const { result, writes } = run({});
    expect([result.ok, writes]).toEqual([true, []]);
  });

  it('reads the setting with the admin token and the file on develop with the run token', () => {
    const { calls } = run({});
    expect(calls).toEqual([
      {
        as: 'admin',
        args: [
          'api',
          `repos/${REPO}/branches/develop/protection/required_pull_request_reviews`,
        ],
      },
      {
        as: 'repo',
        args: [
          'api',
          '-H',
          'Accept: application/vnd.github.raw',
          `repos/${REPO}/contents/.github/CODEOWNERS?ref=develop`,
        ],
      },
    ]);
  });

  it('opens one issue assigned to Shyden when the setting is off and none is open', () => {
    const { result, writes } = run({ protection: OFF });
    expect(result.ok).toBe(false);
    expect(writes.map((w) => w.args.slice(0, 4))).toEqual([
      ['api', '-X', 'POST', `repos/${REPO}/issues`],
    ]);
    expect(writes[0]?.args).toContain(`title=${ISSUE_TITLE}`);
    expect(writes[0]?.args).toContain('assignees[]=ShydenMcM');
  });

  it('names every problem in the issue it opens', () => {
    const { writes } = run({ protection: OFF, codeowners: '' });
    const body = writes[0]?.args.find((a) => a.startsWith('body=')) ?? '';
    expect([
      body.includes('require_code_owner_reviews is false'),
      body.includes(
        'lacks the rule "/tests/unit/floorless-searches.twins.ts @ShydenMcM"',
      ),
      body.includes('lacks the rule "/.github/CODEOWNERS @ShydenMcM"'),
    ]).toEqual([true, true, true]);
  });

  it('comments on the issue already open rather than opening another', () => {
    const { writes } = run({
      protection: OFF,
      openIssues: JSON.stringify([
        [
          { number: 12, title: 'something else' },
          { number: 34, title: ISSUE_TITLE },
        ],
      ]),
    });
    expect(writes.map((w) => w.args.slice(0, 4))).toEqual([
      ['api', '-X', 'POST', `repos/${REPO}/issues/34/comments`],
    ]);
  });

  it('never reuses a pull request that carries the title', () => {
    const { writes } = run({
      protection: OFF,
      openIssues: JSON.stringify([
        [{ number: 56, title: ISSUE_TITLE, pull_request: {} }],
      ]),
    });
    expect(writes.map((w) => w.args.slice(0, 4))).toEqual([
      ['api', '-X', 'POST', `repos/${REPO}/issues`],
    ]);
  });

  it('opens the issue when the setting cannot be read (AC3)', () => {
    const { result, writes } = run({
      protection: new Error(
        'HTTP 404: Required pull request reviews not enabled',
      ),
    });
    const body = writes[0]?.args.find((a) => a.startsWith('body=')) ?? '';
    expect([result.ok, writes.length]).toEqual([false, 1]);
    expect(body).toContain(
      "could not read develop's review settings: HTTP 404: Required pull request reviews not enabled",
    );
  });

  it('opens the issue when the file cannot be read (AC3)', () => {
    const { result, writes } = run({ codeowners: new Error('HTTP 404') });
    const body = writes[0]?.args.find((a) => a.startsWith('body=')) ?? '';
    expect([
      result.ok,
      body.includes('could not read .github/CODEOWNERS on develop: HTTP 404'),
    ]).toEqual([false, true]);
  });

  it('opens the issue, reading nothing as admin, when there is no admin token (AC3)', () => {
    const { result, calls, writes } = run({ adminToken: '' });
    const body = writes[0]?.args.find((a) => a.startsWith('body=')) ?? '';
    expect([
      result.ok,
      calls.some((c) => c.as === 'admin'),
      body.includes("no token could read develop's review settings"),
    ]).toEqual([false, false, true]);
  });

  it('still opens an issue when the open issues cannot be searched, saying so', () => {
    const { result, writes } = run({
      protection: OFF,
      openIssues: new Error('HTTP 502'),
    });
    const body = writes[0]?.args.find((a) => a.startsWith('body=')) ?? '';
    expect([result.ok, writes[0]?.args.slice(0, 4)]).toEqual([
      false,
      ['api', '-X', 'POST', `repos/${REPO}/issues`],
    ]);
    expect(body).toContain(
      'could not search the open issues for an earlier report: HTTP 502',
    );
  });
});
