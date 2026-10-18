import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { SKIPPED_AUTHOR } from '../../scripts/board-orphans';
import { runOf } from './workflow-steps';

/**
 * The orphan check's workflow (#580 AC1, AC4): every pull request runs
 * scripts/board-orphans.ts in a job of its own, which branch protection
 * requires by its name. The board is read with the read-only roadmap App's
 * token, minted from the `board-read` environment's key; the branches and
 * pull requests with the run's own token (operator 2026-10-15). Dependabot's
 * runs get no environment secrets, so the key check and the mint skip there
 * and the script says it skipped (operator 2026-10-15).
 */

const FILE = '.github/workflows/board-orphans.yml';

interface Step {
  readonly name?: string;
  readonly id?: string;
  readonly if?: string;
  readonly uses?: string;
  readonly run?: unknown;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly with?: Readonly<Record<string, unknown>>;
}
interface Job {
  readonly 'runs-on'?: string;
  readonly 'timeout-minutes'?: number;
  readonly environment?: unknown;
  readonly container?: unknown;
  readonly steps?: readonly Step[];
}
interface Workflow {
  readonly on?: unknown;
  readonly permissions?: unknown;
  readonly jobs?: Readonly<Record<string, Job>>;
}

const workflow = (): Workflow => parse(readFileSync(FILE, 'utf8')) as Workflow;

/** The workflow's one job, refusing any other shape. */
function job(): Job {
  const jobs = workflow().jobs ?? {};
  if (Object.keys(jobs).join() !== 'board-orphans')
    throw new Error(`${FILE} holds jobs ${Object.keys(jobs).join(', ')}`);
  return jobs['board-orphans'] as Job;
}

/** The step called `name`, refusing a missing or doubled one. */
function step(name: string): Step {
  const found = (job().steps ?? []).filter((s) => s.name === name);
  if (found.length !== 1)
    throw new Error(
      `${FILE} holds ${String(found.length)} steps named "${name}"`,
    );
  return found[0] as Step;
}

const NOT_DEPENDABOT = `\${{ github.event.pull_request.user.login != '${SKIPPED_AUTHOR}' }}`;

describe('board-orphans.yml (#580)', () => {
  it('runs on every pull request, and again when its title or body is edited', () => {
    expect(workflow().on).toEqual({
      pull_request: { types: ['opened', 'synchronize', 'reopened', 'edited'] },
    });
  });

  it('reads the repository and its pull requests, and writes nothing', () => {
    expect(workflow().permissions).toEqual({
      contents: 'read',
      'pull-requests': 'read',
    });
  });

  it('is one job, board-orphans, the context branch protection requires', () => {
    expect(Object.keys(workflow().jobs ?? {})).toEqual(['board-orphans']);
  });

  it('runs in the board-read environment, on the runner, under a limit', () => {
    const j = job();
    expect([
      j.environment,
      j['runs-on'],
      j.container,
      j['timeout-minutes'],
    ]).toEqual(['board-read', 'ubuntu-24.04', undefined, 5]);
  });

  it('runs its steps in order: key check, mint, checkout, node, the check', () => {
    expect(
      (job().steps ?? []).map((s) => s.name ?? s.uses?.split('@')[0]),
    ).toEqual([
      'The board key is set',
      'Mint the board token (read-only roadmap App)',
      'actions/checkout',
      'actions/setup-node',
      'No ticket is In Progress without a branch or open pull request',
    ]);
  });

  it("fails by name when the key is missing, except on Dependabot's pull requests", () => {
    const s = step('The board key is set');
    expect(s.if).toBe(NOT_DEPENDABOT);
    expect(s.env).toEqual({ KEY: '${{ secrets.ROADMAP_APP_KEY }}' });
    expect(runOf(s)).toContain(
      '::error::ROADMAP_APP_KEY is not set in the board-read environment, so the board cannot be read (#580).',
    );
    expect(runOf(s)).toContain('exit 1');
  });

  it("mints a token for the roadmap App's org installation, reading issues and projects only", () => {
    const s = step('Mint the board token (read-only roadmap App)');
    expect([s.if, s.id, s.uses]).toEqual([
      NOT_DEPENDABOT,
      'board-token',
      'actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1',
    ]);
    expect(s.with).toEqual({
      'client-id': 'Iv23liVLjRN8twjcTmN0',
      'private-key': '${{ secrets.ROADMAP_APP_KEY }}',
      owner: 'shyden-labs',
      'permission-issues': 'read',
      'permission-organization-projects': 'read',
    });
  });

  it("runs the check on this board, with both tokens and the pull request's number and author", () => {
    const s = step(
      'No ticket is In Progress without a branch or open pull request',
    );
    expect(s.if).toBeUndefined();
    expect(runOf(s)).toBe(
      'node scripts/board-orphans.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories" "$GITHUB_REPOSITORY"',
    );
    expect(s.env).toEqual({
      PR_AUTHOR: '${{ github.event.pull_request.user.login }}',
      PR_NUMBER: '${{ github.event.pull_request.number }}',
      BOARD_TOKEN: '${{ steps.board-token.outputs.token }}',
      GH_TOKEN: '${{ github.token }}',
    });
  });

  it('checks out without leaving the token in the git config', () => {
    const checkout = (job().steps ?? []).find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with).toEqual({ 'persist-credentials': false });
  });
});
