import { describe, expect, it } from 'vitest';
import {
  developSquashOnly,
  type Get,
  type Reply,
} from '../../scripts/develop-squash-only.ts';

/**
 * scripts/develop-squash-only.ts (#679): a pull request into `develop` can be
 * merged only by squash, so fetched floors go in as a normal second commit
 * and no branch needs a force-push (Shyden 2026-10-18). The check reads the
 * rules GitHub applies to `develop`, fails unless every pull-request rule
 * together allows squash alone, and fails closed when it cannot read them.
 * In-process with the request stood in: a unit test reaches no network.
 */

const REPO = 'shyden-labs/yawelo-idle';
const ENV = { GH_TOKEN: 'run-token' };

/** The request the check makes for a branch's rules. */
const rulesUrl = (branch: string) =>
  `https://api.github.com/repos/${REPO}/rules/branches/${branch}?per_page=100`;

/** A rule as GitHub lists it for a branch, from ruleset `id`. */
function rule(
  type: string,
  id: number,
  parameters?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type,
    ruleset_source_type: 'Repository',
    ruleset_source: REPO,
    ruleset_id: id,
    ...(parameters === undefined ? {} : { parameters }),
  };
}

/** A pull-request rule from ruleset `id` allowing these merge methods. */
const pullRule = (id: number, methods: unknown) =>
  rule('pull_request', id, {
    required_approving_review_count: 0,
    allowed_merge_methods: methods,
  });

/** A 200 reply holding `body`, as JSON unless it is already text. */
const ok = (body: unknown): Reply => ({
  status: 200,
  link: null,
  text: typeof body === 'string' ? body : JSON.stringify(body),
});

/**
 * A request answering each branch's rules URL with that branch's reply; any
 * other URL, or a request without the run's token, throws, so a check that
 * asks for the wrong thing reads nothing.
 */
function getFor(byBranch: Readonly<Record<string, Reply>>): Get {
  return (url, token) => {
    if (token !== ENV.GH_TOKEN)
      return Promise.reject(new Error(`sent token ${JSON.stringify(token)}`));
    for (const [branch, reply] of Object.entries(byBranch)) {
      if (url === rulesUrl(branch)) return Promise.resolve(reply);
    }
    return Promise.reject(new Error(`unexpected request: ${url}`));
  };
}

const develop = (body: unknown) => getFor({ develop: ok(body) });

const check = (get: Get) => developSquashOnly([REPO], ENV, get);

describe('develop allows squash merges only (#679)', () => {
  it('passes when its one pull-request rule allows squash alone', async () => {
    const result = await check(
      develop([rule('deletion', 7), pullRule(7, ['squash'])]),
    );
    expect(result).toEqual({
      ok: true,
      lines: [
        'develop merges by squash only: 1 pull-request rule (ruleset 7) allows squash alone. Read 2 rules on develop.',
      ],
    });
  });

  it('passes when two rules together allow squash alone', async () => {
    const result = await check(
      develop([
        pullRule(7, ['squash']),
        pullRule(8, ['merge', 'squash', 'rebase']),
      ]),
    );
    expect(result).toEqual({
      ok: true,
      lines: [
        'develop merges by squash only: 2 pull-request rules (rulesets 7, 8) allow squash alone. Read 2 rules on develop.',
      ],
    });
  });

  it('fails when no pull-request rule applies to develop', async () => {
    const result = await check(develop([rule('deletion', 7)]));
    expect(result).toEqual({
      ok: false,
      lines: [
        'No pull-request rule applies to develop, so every merge method the repository allows can merge into it. Add a ruleset on develop whose pull-request rule allows squash alone (#679). Read 1 rule on develop.',
      ],
    });
  });

  it('fails when develop has no rules at all', async () => {
    const result = await check(develop([]));
    expect(result).toEqual({
      ok: false,
      lines: [
        'No pull-request rule applies to develop, so every merge method the repository allows can merge into it. Add a ruleset on develop whose pull-request rule allows squash alone (#679). Read 0 rules on develop.',
      ],
    });
  });

  it('fails, naming the extra method, when the rule also allows merge commits', async () => {
    const result = await check(develop([pullRule(7, ['merge', 'squash'])]));
    expect(result).toEqual({
      ok: false,
      lines: [
        'develop allows merge, squash: 1 pull-request rule (ruleset 7) must allow squash alone (#679). Read 1 rule on develop.',
      ],
    });
  });

  it('fails, naming the extra method, when the rule also allows rebase', async () => {
    const result = await check(develop([pullRule(7, ['squash', 'rebase'])]));
    expect(result).toEqual({
      ok: false,
      lines: [
        'develop allows squash, rebase: 1 pull-request rule (ruleset 7) must allow squash alone (#679). Read 1 rule on develop.',
      ],
    });
  });

  it('fails when the rules together allow no merge method', async () => {
    const result = await check(
      develop([pullRule(7, ['squash']), pullRule(8, ['rebase'])]),
    );
    expect(result).toEqual({
      ok: false,
      lines: [
        'develop allows no merge method: 2 pull-request rules (rulesets 7, 8) must allow squash alone (#679). Read 2 rules on develop.',
      ],
    });
  });

  it('reads the rules on develop, not on another branch', async () => {
    const result = await check(
      getFor({ develop: ok([]), main: ok([pullRule(9, ['squash'])]) }),
    );
    expect(result.ok).toBe(false);
    expect(result.lines[0]).toMatch(/^No pull-request rule applies to develop/);
  });

  it('refuses without the repository', async () => {
    await expect(developSquashOnly([], ENV, develop([]))).rejects.toThrow(
      'usage: node scripts/develop-squash-only.ts <owner/repo>',
    );
  });

  it('refuses without a token, reading nothing', async () => {
    await expect(developSquashOnly([REPO], {}, develop([]))).rejects.toThrow(
      'GH_TOKEN is not set, so the rules on develop cannot be read',
    );
  });

  it('fails closed, naming the read, when the request fails', async () => {
    await expect(check(getFor({}))).rejects.toThrow(
      /^could not read the rules on develop: unexpected request: https:\/\/api\.github\.com\//,
    );
  });

  it('fails closed, naming the status, when GitHub answers other than 200', async () => {
    await expect(
      check(getFor({ develop: { status: 403, link: null, text: '{}' } })),
    ).rejects.toThrow(
      'could not read the rules on develop: GitHub answered 403',
    );
  });

  it('fails closed when the rules run past one page', async () => {
    await expect(
      check(
        getFor({
          develop: {
            status: 200,
            link: `<${rulesUrl('develop')}&page=2>; rel="next"`,
            text: '[]',
          },
        }),
      ),
    ).rejects.toThrow(
      'could not read the rules on develop: they run past one page of 100',
    );
  });

  it('reads a reply whose links name no next page', async () => {
    const result = await check(
      getFor({
        develop: {
          status: 200,
          link: `<${rulesUrl('develop')}&page=1>; rel="first"`,
          text: JSON.stringify([pullRule(7, ['squash'])]),
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('fails closed when the reply is not JSON', async () => {
    await expect(check(develop('not json'))).rejects.toThrow(
      /^could not read the rules on develop: .*"not json" is not valid JSON$/,
    );
  });

  it('fails closed when the reply is not a list of rules', async () => {
    await expect(check(develop({ rules: [] }))).rejects.toThrow(
      'could not read the rules on develop: the reply is not a list of rules',
    );
  });

  it('fails closed when a rule has no type', async () => {
    await expect(check(develop([{ ruleset_id: 7 }]))).rejects.toThrow(
      'could not read the rules on develop: a rule has no type',
    );
  });

  it('fails closed when a pull-request rule has no ruleset id', async () => {
    await expect(
      check(develop([{ type: 'pull_request', parameters: {} }])),
    ).rejects.toThrow(
      'could not read the rules on develop: a pull-request rule has no ruleset id',
    );
  });

  it('fails closed when a pull-request rule names no merge methods', async () => {
    await expect(check(develop([rule('pull_request', 7, {})]))).rejects.toThrow(
      'could not read the rules on develop: ruleset 7’s pull-request rule names no merge methods',
    );
  });

  it('fails closed when a pull-request rule has no parameters', async () => {
    await expect(check(develop([rule('pull_request', 7)]))).rejects.toThrow(
      'could not read the rules on develop: ruleset 7’s pull-request rule names no merge methods',
    );
  });

  it('fails closed when the merge methods are not a list', async () => {
    await expect(check(develop([pullRule(7, 'squash')]))).rejects.toThrow(
      'could not read the rules on develop: ruleset 7’s pull-request rule names no merge methods',
    );
  });

  it('fails closed on a merge method it does not know', async () => {
    await expect(
      check(develop([pullRule(7, ['squash', 'ff'])])),
    ).rejects.toThrow(
      'could not read the rules on develop: ruleset 7’s pull-request rule names an unknown merge method "ff"',
    );
  });
});
