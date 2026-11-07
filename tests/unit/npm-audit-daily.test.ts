import { describe, expect, it } from 'vitest';
import { auditIssueTitle, reportDaily } from '../../scripts/npm-audit';

/**
 * The daily audit of develop (#720 AC3, Shyden 2026-11-07: "Yes, daily"):
 * each problem the judge finds gets its own issue for Shyden, found again by
 * its title while open, so a new advisory opens a new issue and a known one
 * is commented on. `gh` is stood in; the workflow is pinned in
 * npm-audit-daily-workflow.test.ts.
 */

const REPO = 'shyden-labs/yawelo-idle';
const PROBLEM = 'GHSA-aaaa-bbbb-cccc (high, lodash) has no recorded exception';

/** A stand-in `gh`: answers the open-issue listing, records every call. */
function standIn(open: readonly { number: number; title: string }[]) {
  const calls: string[][] = [];
  const gh = (args: readonly string[]): string => {
    calls.push([...args]);
    if (args.includes('--slurp')) return JSON.stringify([open]);
    return '{}';
  };
  return { gh, calls };
}

const posts = (calls: string[][]) => calls.filter((c) => c.includes('POST'));

describe('the daily audit report (#720 AC3)', () => {
  it('names each issue after its problem', () => {
    expect(auditIssueTitle(PROBLEM)).toBe(`npm audit on develop: ${PROBLEM}`);
  });

  it('writes nothing when the judge found nothing', () => {
    const { gh, calls } = standIn([]);
    expect(reportDaily([], REPO, gh)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('opens an issue for Shyden for a new advisory', () => {
    const { gh, calls } = standIn([]);
    reportDaily([PROBLEM], REPO, gh);
    const [post] = posts(calls);
    expect(posts(calls)).toHaveLength(1);
    expect(post).toContain(`repos/${REPO}/issues`);
    expect(post).toContain(`title=${auditIssueTitle(PROBLEM)}`);
    expect(post).toContain('assignees[]=ShydenMcM');
  });

  it('comments on the open issue for an advisory already reported', () => {
    const { gh, calls } = standIn([
      { number: 41, title: auditIssueTitle(PROBLEM) },
    ]);
    reportDaily([PROBLEM], REPO, gh);
    expect(posts(calls)).toHaveLength(1);
    expect(posts(calls)[0]).toContain(`repos/${REPO}/issues/41/comments`);
  });

  it('opens one issue per advisory', () => {
    const second =
      'GHSA-dddd-eeee-ffff (low, minimist) has no recorded exception';
    const { gh, calls } = standIn([]);
    reportDaily([PROBLEM, second], REPO, gh);
    const titles = posts(calls).flatMap((c) =>
      c.filter((arg) => arg.startsWith('title=')),
    );
    expect(titles).toEqual([
      `title=${auditIssueTitle(PROBLEM)}`,
      `title=${auditIssueTitle(second)}`,
    ]);
  });

  it('says in the body how to act on the advisory', () => {
    const { gh, calls } = standIn([]);
    reportDaily([PROBLEM], REPO, gh);
    const body = posts(calls)[0]?.find((arg) => arg.startsWith('body='));
    expect(body).toContain(`- ${PROBLEM}`);
    expect(body).toContain('scripts/npm-audit.ts');
  });
});
