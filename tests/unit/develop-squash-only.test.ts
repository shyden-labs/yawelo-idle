import { describe, expect, it } from 'vitest';
import { developSquashOnly } from '../../scripts/develop-squash-only';
import type { Gh } from '../../scripts/board-progress';

/**
 * scripts/develop-squash-only.ts (#679): a pull request into `develop` can be
 * merged only by squash, so fetched floors go in as a normal second commit
 * and no branch needs a force-push (Shyden 2026-10-18). The check reads the
 * rules GitHub applies to `develop`, fails unless every pull-request rule
 * together allows squash alone, and fails closed when it cannot read them.
 * In-process with `gh` stood in: a unit test starts no process.
 */

const REPO = 'shyden-labs/yawelo-idle';

/** The call the check makes for a branch's rules. */
const rulesCall = (branch: string) => [
  'api',
  '--paginate',
  '--slurp',
  `repos/${REPO}/rules/branches/${branch}?per_page=100`,
];

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

/**
 * `gh` answering each branch's rules call with that branch's rules, as one
 * slurped page; any other call throws, so a check that asks for the wrong
 * thing reads nothing.
 */
function ghFor(byBranch: Readonly<Record<string, unknown>>): Gh {
  return (args) => {
    for (const [branch, rules] of Object.entries(byBranch)) {
      if (JSON.stringify(args) === JSON.stringify(rulesCall(branch)))
        return typeof rules === 'string' ? rules : JSON.stringify([rules]);
    }
    throw new Error(`unexpected call: gh ${args.join(' ')}`);
  };
}

const develop = (rules: unknown) => ghFor({ develop: rules });

describe('develop allows squash merges only (#679)', () => {
  it('passes when its one pull-request rule allows squash alone', () => {
    const result = developSquashOnly(
      [REPO],
      develop([rule('deletion', 7), pullRule(7, ['squash'])]),
    );
    expect(result).toEqual({
      ok: true,
      lines: [
        'develop merges by squash only: 1 pull-request rule (ruleset 7) allows squash alone. Read 2 rules on develop.',
      ],
    });
  });

  it('passes when two rules together allow squash alone', () => {
    const result = developSquashOnly(
      [REPO],
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

  it('fails when no pull-request rule applies to develop', () => {
    const result = developSquashOnly([REPO], develop([rule('deletion', 7)]));
    expect(result).toEqual({
      ok: false,
      lines: [
        'No pull-request rule applies to develop, so every merge method the repository allows can merge into it. Add a ruleset on develop whose pull-request rule allows squash alone (#679). Read 1 rule on develop.',
      ],
    });
  });

  it('fails when develop has no rules at all', () => {
    const result = developSquashOnly([REPO], develop([]));
    expect(result).toEqual({
      ok: false,
      lines: [
        'No pull-request rule applies to develop, so every merge method the repository allows can merge into it. Add a ruleset on develop whose pull-request rule allows squash alone (#679). Read 0 rules on develop.',
      ],
    });
  });

  it('fails, naming the extra method, when the rule also allows merge commits', () => {
    const result = developSquashOnly(
      [REPO],
      develop([pullRule(7, ['merge', 'squash'])]),
    );
    expect(result).toEqual({
      ok: false,
      lines: [
        'develop allows merge, squash: 1 pull-request rule (ruleset 7) must allow squash alone (#679). Read 1 rule on develop.',
      ],
    });
  });

  it('fails, naming the extra method, when the rule also allows rebase', () => {
    const result = developSquashOnly(
      [REPO],
      develop([pullRule(7, ['squash', 'rebase'])]),
    );
    expect(result).toEqual({
      ok: false,
      lines: [
        'develop allows squash, rebase: 1 pull-request rule (ruleset 7) must allow squash alone (#679). Read 1 rule on develop.',
      ],
    });
  });

  it('fails when the rules together allow no merge method', () => {
    const result = developSquashOnly(
      [REPO],
      develop([pullRule(7, ['squash']), pullRule(8, ['rebase'])]),
    );
    expect(result).toEqual({
      ok: false,
      lines: [
        'develop allows no merge method: 2 pull-request rules (rulesets 7, 8) must allow squash alone (#679). Read 2 rules on develop.',
      ],
    });
  });

  it('reads the rules on develop, not on another branch', () => {
    const result = developSquashOnly(
      [REPO],
      ghFor({ develop: [], main: [pullRule(9, ['squash'])] }),
    );
    expect(result.ok).toBe(false);
    expect(result.lines[0]).toMatch(/^No pull-request rule applies to develop/);
  });

  it('refuses without the repository', () => {
    expect(() => developSquashOnly([], develop([]))).toThrow(
      'usage: node scripts/develop-squash-only.ts <owner/repo>',
    );
  });

  it('fails closed, naming the read, when gh fails', () => {
    expect(() => developSquashOnly([REPO], ghFor({}))).toThrow(
      /^could not read the rules on develop: unexpected call: gh api/,
    );
  });

  it('fails closed when the reply is not JSON', () => {
    expect(() => developSquashOnly([REPO], develop('not json'))).toThrow(
      /^could not read the rules on develop: .*"not json" is not valid JSON$/,
    );
  });

  it('fails closed when the reply is not a list of pages', () => {
    expect(() => developSquashOnly([REPO], develop('{"rules":[]}'))).toThrow(
      'could not read the rules on develop: the reply is not a list of pages',
    );
  });

  it('fails closed when a rule has no type', () => {
    expect(() =>
      developSquashOnly([REPO], develop([{ ruleset_id: 7 }])),
    ).toThrow('could not read the rules on develop: a rule has no type');
  });

  it('fails closed when a pull-request rule has no ruleset id', () => {
    expect(() =>
      developSquashOnly(
        [REPO],
        develop([{ type: 'pull_request', parameters: {} }]),
      ),
    ).toThrow(
      'could not read the rules on develop: a pull-request rule has no ruleset id',
    );
  });

  it('fails closed when a pull-request rule names no merge methods', () => {
    expect(() =>
      developSquashOnly([REPO], develop([rule('pull_request', 7, {})])),
    ).toThrow(
      'could not read the rules on develop: ruleset 7’s pull-request rule names no merge methods',
    );
  });

  it('fails closed when a pull-request rule has no parameters', () => {
    expect(() =>
      developSquashOnly([REPO], develop([rule('pull_request', 7)])),
    ).toThrow(
      'could not read the rules on develop: ruleset 7’s pull-request rule names no merge methods',
    );
  });

  it('fails closed when the merge methods are not a list', () => {
    expect(() =>
      developSquashOnly([REPO], develop([pullRule(7, 'squash')])),
    ).toThrow(
      'could not read the rules on develop: ruleset 7’s pull-request rule names no merge methods',
    );
  });

  it('fails closed on a merge method it does not know', () => {
    expect(() =>
      developSquashOnly([REPO], develop([pullRule(7, ['squash', 'ff'])])),
    ).toThrow(
      'could not read the rules on develop: ruleset 7’s pull-request rule names an unknown merge method "ff"',
    );
  });
});
