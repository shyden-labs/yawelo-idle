import { describe, expect, it, vi } from 'vitest';
import {
  eventInputs,
  gate,
  inputRefusal,
  nodeIo,
  REFUSED_BRANCHES,
  tipRefusal,
  toRun,
  type GateIo,
  type Run,
} from '../../scripts/record-gate.ts';

/**
 * The scratch-ref gate (#718, moved out of record-floors.yml's shell in
 * #771): before any job checks out the SHA it was given, the gate refuses
 * develop and main, a malformed branch or SHA, and a SHA that is not the tip
 * of `refs/floors/<branch>` as the public repository reads it. It runs from
 * develop's checkout, so the commit it judges never runs its own gate.
 */

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const BRANCH = 'tooling/771-record-rehearse-job';
const REF = `refs/floors/${BRANCH}`;

const ran = (stdout: string, status: number | null = 0, stderr = ''): Run => ({
  status,
  stdout,
  stderr,
});

describe('the inputs are a ticket branch and a full SHA (#547, #718)', () => {
  it('refuses develop and main, and only them', () => {
    expect(REFUSED_BRANCHES).toEqual(['develop', 'main']);
  });

  it.each([
    [
      'develop',
      'develop',
      SHA,
      'record-floors records ticket branches, not develop (#547).',
    ],
    [
      'main',
      'main',
      SHA,
      'record-floors records ticket branches, not main (#547).',
    ],
    ['an empty branch', '', SHA, 'branch must be a branch name (#718).'],
    [
      'a branch with a space',
      'a b',
      SHA,
      'branch must be a branch name (#718).',
    ],
    [
      'a branch with a semicolon',
      'a;b',
      SHA,
      'branch must be a branch name (#718).',
    ],
    // The shell's `grep -Eqx` judged each line alone, so this passed it.
    [
      'a branch over two lines',
      'tooling/x\nmain',
      SHA,
      'branch must be a branch name (#718).',
    ],
    [
      'a 39-character SHA',
      BRANCH,
      SHA.slice(1),
      'sha must be 40 lowercase hex characters (#718).',
    ],
    [
      'a 41-character SHA',
      BRANCH,
      `${SHA}a`,
      'sha must be 40 lowercase hex characters (#718).',
    ],
    [
      'an upper-case SHA',
      BRANCH,
      SHA.toUpperCase(),
      'sha must be 40 lowercase hex characters (#718).',
    ],
    [
      'a SHA over two lines',
      BRANCH,
      `${SHA}\n${OTHER}`,
      'sha must be 40 lowercase hex characters (#718).',
    ],
  ])('refuses %s', (_case, branch, sha, refusal) => {
    expect(inputRefusal(branch, sha)).toBe(refusal);
  });

  it('passes a ticket branch and a full lowercase SHA', () => {
    expect(inputRefusal(BRANCH, SHA)).toBeUndefined();
  });
});

describe('the SHA is the scratch ref’s tip, read from the repository (#718)', () => {
  it.each([
    [
      'a failed read',
      ran('', 128, 'fatal: unable to access\n'),
      `git ls-remote could not read ${REF}: fatal: unable to access (#718).`,
    ],
    [
      'a read that never started',
      ran('', null, 'spawnSync git ENOENT'),
      `git ls-remote could not read ${REF}: spawnSync git ENOENT (#718).`,
    ],
    ['no such ref', ran(''), `${REF} is at '', not ${SHA} (#718).`],
    [
      'another commit at the ref',
      ran(`${OTHER}\t${REF}\n`),
      `${REF} is at '${OTHER}', not ${SHA} (#718).`,
    ],
    // ls-remote matches a pattern by its tail, so a longer ref answers too.
    [
      'the ref beside one it only ends',
      ran(`${SHA}\t${REF}\n${OTHER}\trefs/floors/a/${REF}\n`),
      `git ls-remote listed ${REF}, refs/floors/a/${REF} for ${REF}, not exactly it (#718).`,
    ],
    [
      'only a ref it ends',
      ran(`${SHA}\trefs/floors/a/${REF}\n`),
      `git ls-remote listed refs/floors/a/${REF} for ${REF}, not exactly it (#718).`,
    ],
    [
      'a line it cannot read',
      ran(`${SHA} ${REF}\n`),
      `git ls-remote printed a line the gate cannot read: ${SHA} ${REF} (#718).`,
    ],
  ])('refuses %s', (_case, lsRemote, refusal) => {
    expect(tipRefusal(BRANCH, SHA, lsRemote)).toBe(refusal);
  });

  it('passes the one exact ref at the SHA', () => {
    expect(tipRefusal(BRANCH, SHA, ran(`${SHA}\t${REF}\n`))).toBeUndefined();
  });
});

describe('the inputs come from the dispatch event (#771)', () => {
  it.each([
    [
      'text that is not JSON',
      'not json',
      'the event payload is not JSON (#771).',
    ],
    [
      'a payload without inputs',
      '{}',
      'the event payload holds no inputs (#771).',
    ],
    [
      'inputs that are not an object',
      '{"inputs":"x"}',
      'the event payload holds no inputs (#771).',
    ],
    [
      'a branch that is not a string',
      `{"inputs":{"branch":1,"sha":"${SHA}"}}`,
      'inputs.branch is not a string (#771).',
    ],
    [
      'a SHA that is not a string',
      `{"inputs":{"branch":"${BRANCH}"}}`,
      'inputs.sha is not a string (#771).',
    ],
  ])('refuses %s', (_case, text, refusal) => {
    expect(eventInputs(text)).toBe(refusal);
  });

  it('reads the branch and the SHA', () => {
    expect(
      eventInputs(JSON.stringify({ inputs: { branch: BRANCH, sha: SHA } })),
    ).toEqual({ branch: BRANCH, sha: SHA });
  });
});

const ENV = {
  GITHUB_EVENT_PATH: '/runner/event.json',
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_REPOSITORY: 'shyden-labs/yawelo-idle',
};

interface Stub {
  io: GateIo;
  errors: string[];
  runs: { command: string; args: readonly string[] }[];
}

const stub = (
  env: Record<string, string>,
  event: string,
  lsRemote: Run = ran(`${SHA}\t${REF}\n`),
): Stub => {
  const errors: string[] = [];
  const runs: Stub['runs'] = [];
  return {
    errors,
    runs,
    io: {
      env,
      readFile: (path) => {
        if (path !== ENV.GITHUB_EVENT_PATH) throw new Error(`ENOENT: ${path}`);
        return event;
      },
      run: (command, args) => {
        runs.push({ command, args });
        return lsRemote;
      },
      error: (message) => errors.push(message),
    },
  };
};

const EVENT = JSON.stringify({ inputs: { branch: BRANCH, sha: SHA } });

describe('the gate step (#771)', () => {
  it('passes the scratch ref’s tip, asking git once and through no shell', () => {
    const { io, errors, runs } = stub(ENV, EVENT);
    expect([gate(io), errors, runs]).toEqual([
      0,
      [],
      [
        {
          command: 'git',
          args: [
            'ls-remote',
            'https://github.com/shyden-labs/yawelo-idle',
            REF,
          ],
        },
      ],
    ]);
  });

  it.each([
    ['GITHUB_EVENT_PATH'],
    ['GITHUB_SERVER_URL'],
    ['GITHUB_REPOSITORY'],
  ])('refuses a run without %s, asking git nothing', (name) => {
    const env = Object.fromEntries(
      Object.entries(ENV).filter(([key]) => key !== name),
    );
    const { io, errors, runs } = stub(env, EVENT);
    expect([gate(io), errors, runs]).toEqual([
      1,
      [`::error::${name} is not set (#771).`],
      [],
    ]);
  });

  it('refuses an event file it cannot read, naming it', () => {
    const { io, errors } = stub(
      { ...ENV, GITHUB_EVENT_PATH: '/elsewhere.json' },
      EVENT,
    );
    expect([gate(io), errors]).toEqual([
      1,
      [
        '::error::could not read the event payload at /elsewhere.json: ENOENT: /elsewhere.json (#771).',
      ],
    ]);
  });

  it('refuses a malformed event, asking git nothing', () => {
    const { io, errors, runs } = stub(ENV, '{}');
    expect([gate(io), errors, runs]).toEqual([
      1,
      ['::error::the event payload holds no inputs (#771).'],
      [],
    ]);
  });

  it('refuses develop before asking git', () => {
    const { io, errors, runs } = stub(
      ENV,
      JSON.stringify({ inputs: { branch: 'develop', sha: SHA } }),
    );
    expect([gate(io), errors, runs]).toEqual([
      1,
      ['::error::record-floors records ticket branches, not develop (#547).'],
      [],
    ]);
  });

  it('refuses a SHA that is not the tip', () => {
    const { io, errors } = stub(ENV, EVENT, ran(`${OTHER}\t${REF}\n`));
    expect([gate(io), errors]).toEqual([
      1,
      [`::error::${REF} is at '${OTHER}', not ${SHA} (#718).`],
    ]);
  });
});

describe('a process’s result as the gate reads it (#771)', () => {
  it('keeps the status and both streams', () => {
    expect(
      toRun({ status: 2, stdout: 'o', stderr: 'e', error: undefined }),
    ).toEqual(ran('o', 2, 'e'));
  });

  it('names why a process never started, in place of its empty stderr', () => {
    expect(
      toRun({
        status: null,
        stdout: '',
        stderr: '',
        error: new Error('spawnSync git ENOENT'),
      }),
    ).toEqual(ran('', null, 'spawnSync git ENOENT'));
  });
});

describe('the real io (#771)', () => {
  it('runs a command through spawnSync, which a unit test refuses', () => {
    expect(() => nodeIo.run('git', ['--version'])).toThrow(
      'child_process.spawnSync starts a process',
    );
  });

  it('reads a file as text', () => {
    expect(
      JSON.parse(nodeIo.readFile('tests/unit/fixtures/record-gate-event.json')),
    ).toEqual({ inputs: { branch: BRANCH, sha: SHA } });
  });

  it('writes an error line to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      nodeIo.error('::error::x');
      expect(spy.mock.calls).toEqual([['::error::x']]);
    } finally {
      spy.mockRestore();
    }
  });

  it('reads the process environment', () => {
    expect(nodeIo.env).toBe(process.env);
  });
});
