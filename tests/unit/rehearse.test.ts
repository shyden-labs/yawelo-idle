import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { floorBreach } from '../floors';
import { againstControl, searched } from '../searched';
import type { Run } from '../../scripts/record-gate.ts';
import {
  ACT,
  bytesOf,
  credentialProblem,
  DUPLICATE_NOTE,
  floorProblem,
  listedWorkflows,
  MANIFEST,
  MANIFEST_NAME,
  manifestProblems,
  nodeRehearseIo,
  OUTPUT_DIR,
  rehearse,
  sha256,
  TOOL_LICENCES,
  WORKFLOW_FLOOR,
  WORKFLOWS_DIR,
  type Manifest,
  type RehearseIo,
  type Tool,
} from '../../scripts/rehearse.ts';
import { workflowFiles } from './workflow-file';

/**
 * The rehearsal (#771): on the runner host, the measured commit installs act
 * pinned by its release asset's SHA-256, checks its version, and writes a
 * manifest of every workflow act reads, judged against the workflow folder,
 * for the coverage record's Measure step. Running and tracing the workflows
 * is #762's (#737, #738).
 */

const LISTING = readFileSync('tests/unit/fixtures/act-list-0.2.89.txt', 'utf8');
const FILES = [
  'board-orphans.yml',
  'ci.yml',
  'deploy-dev.yml',
  'deploy-prod.yml',
  'logs.yml',
  'mutations.yml',
  'owner-review.yml',
  'record-floors.yml',
  'record-minimums.yml',
  'rollback-prod.yml',
  'schedule-watch.yml',
];

const ran = (stdout: string, status: number | null = 0, stderr = ''): Run => ({
  status,
  stdout,
  stderr,
});

/** A table as act 0.2.89 prints one (cmd/list.go): each column its widest cell plus two, by bytes. */
const table = (rows: string[][]): string => {
  const header = [
    'Stage',
    'Job ID',
    'Job name',
    'Workflow name',
    'Workflow file',
    'Events',
  ];
  const widths = header.map(
    (_label, i) =>
      Math.max(
        ...[header, ...rows].map((r) => Buffer.byteLength(r[i] as string)),
      ) + (i < header.length - 1 ? 2 : 0),
  );
  const line = (cells: string[]): string =>
    cells
      .map(
        (cell, i) =>
          cell + ' '.repeat((widths[i] as number) - Buffer.byteLength(cell)),
      )
      .join('');
  return [header, ...rows].map(line).join('\n') + '\n';
};

describe('act is pinned and its licence allowed (#771 AC5)', () => {
  it('names one release asset by version, URL and SHA-256', () => {
    expect(ACT).toEqual({
      version: '0.2.89',
      asset: 'act_Linux_x86_64.tar.gz',
      url: 'https://github.com/nektos/act/releases/download/v0.2.89/act_Linux_x86_64.tar.gz',
      sha256:
        '0191d6f1f3b716b5c55820032605d05fc3c1cdbf581ebeff655019e5dd1524c0',
      licence: 'MIT',
    });
  });

  it('allows build and test tools permissive or weak-copyleft licences only', () => {
    expect(TOOL_LICENCES).toEqual([
      'MIT',
      'Apache-2.0',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'ISC',
      'LGPL-2.1',
      'LGPL-3.0',
      'MPL-2.0',
    ]);
    expect(TOOL_LICENCES).toContain(ACT.licence);
  });

  it('hashes bytes as SHA-256 hex', () => {
    expect(sha256(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('writes its manifest in a folder of its own', () => {
    expect([OUTPUT_DIR, MANIFEST_NAME, MANIFEST, WORKFLOWS_DIR]).toEqual([
      'rehearsal',
      'manifest.json',
      'rehearsal/manifest.json',
      '.github/workflows',
    ]);
  });
});

describe('act’s listing, read as act prints it (#771)', () => {
  it('reads every workflow file and its jobs from the real 0.2.89 listing', () => {
    const listed = listedWorkflows(LISTING);
    expect([
      Object.keys(listed),
      listed['ci.yml'],
      listed['record-floors.yml'],
      listed['deploy-dev.yml'],
    ]).toEqual([
      FILES,
      ['build-and-test', 'coverage'],
      ['record-floors', 'record-coverage'],
      [
        'test',
        'deploy',
        'verify-holding',
        'verify',
        'verify-roadmap',
        'smoke',
        'dev-verified',
      ],
    ]);
  });

  it('ends at the table when act names no duplicate job', () => {
    expect(
      listedWorkflows(table([['0', 'a', 'A b c', 'w', 'w.yml', 'push']])),
    ).toEqual({ 'w.yml': ['a'] });
  });

  // act's update notice adds this blank line to stdout (record run
  // 40723820849, 2026-10-28); the rehearsal turns the notice off rather
  // than read past it.
  it('refuses the blank line act’s update notice adds after its note', () => {
    expect(() =>
      listedWorkflows(
        `${table([['0', 'a', 'a', 'w', 'w.yml', 'push']])}\n${DUPLICATE_NOTE}\n\n`,
      ),
    ).toThrow(`text after its table, "\\n${DUPLICATE_NOTE}\\n\\n"`);
  });

  it('reads a job name holding spaces and a cell holding multi-byte text by act’s byte columns', () => {
    expect(
      listedWorkflows(
        table([
          ['0', 'a', 'Déployer le jeu', 'Déploiement', 'd.yml', 'push'],
          ['1', 'b', 'b', 'w', 'w.yaml', 'pull_request,push'],
        ]),
      ),
    ).toEqual({ 'd.yml': ['a'], 'w.yaml': ['b'] });
  });

  it('sorts the files act lists in stage order, not by name', () => {
    expect(
      Object.keys(
        listedWorkflows(
          table([
            ['0', 'a', 'a', 'w', 'w.yml', 'push'],
            ['0', 'b', 'b', 'c', 'c.yml', 'push'],
            ['1', 'c', 'c', 'w', 'w.yml', 'push'],
          ]),
        ),
      ),
    ).toEqual(['c.yml', 'w.yml']);
  });

  it('reads a listing of no jobs as no workflows', () => {
    expect(
      againstControl((rows: string[][]) => listedWorkflows(table(rows)), {
        input: [],
        control: [['0', 'a', 'a', 'w', 'w.yml', 'push']],
      }),
    ).toEqual({});
  });

  it.each([
    ['an empty listing', ''],
    ['a header without the workflow file column', 'Stage  Job ID  Events\n'],
    [
      'a row ending before the workflow file column',
      `${table([['0', 'a', 'a', 'w', 'w.yml', 'push']])}0      b\n`,
    ],
    [
      'a table with no end',
      'Stage  Job ID  Job name  Workflow name  Workflow file  Events',
    ],
    [
      'a row whose job id cell is empty',
      table([['0', '', 'a', 'w', 'w.yml', 'push']]),
    ],
    [
      'a row whose workflow file cell is empty',
      table([['0', 'a', 'a', 'w', '', 'push']]),
    ],
    [
      'text after the table that act does not print',
      `${table([['0', 'a', 'a', 'w', 'w.yml', 'push']])}\nsomething else\n`,
    ],
    [
      'a second note after the duplicate notice',
      `${table([['0', 'a', 'a', 'w', 'w.yml', 'push']])}\n${DUPLICATE_NOTE}\nmore\n`,
    ],
  ])('refuses %s', (_case, text) => {
    expect(() => listedWorkflows(text)).toThrow(
      /^act --list printed .* the rehearsal cannot read/,
    );
  });
});

describe('the listing matches the workflow folder (#771)', () => {
  const listed = Object.fromEntries(FILES.map((f) => [f, ['job']]));

  it('passes when act lists exactly the files on disk', () => {
    expect(
      searched(manifestProblems(listed, FILES), {
        of: FILES,
        what: 'workflow files on disk',
      }),
    ).toEqual([]);
    expect(floorBreach('rehearse/listed-files', FILES.length)).toBeUndefined();
  });

  it.each([
    [
      'a file on disk act does not list',
      FILES.slice(1),
      [...FILES],
      ['act --list does not list .github/workflows/board-orphans.yml (#771).'],
    ],
    [
      'a file act lists that is not on disk',
      FILES,
      FILES.slice(1),
      [
        'act --list names board-orphans.yml, which is not in .github/workflows (#771).',
      ],
    ],
    [
      'two files on disk sharing a name, which act lists by name only',
      FILES,
      [...FILES, 'nested/ci.yml'],
      [
        'two workflow files share the name ci.yml: ci.yml, nested/ci.yml (#771).',
      ],
    ],
  ])('refuses %s', (_case, listedFiles, onDisk, problems) => {
    expect(
      manifestProblems(
        Object.fromEntries(listedFiles.map((f) => [f, ['job']])),
        onDisk,
      ),
    ).toEqual(problems);
  });
});

describe('the floor of workflow files (#771)', () => {
  it('is the number of workflow files the repository holds', () => {
    expect(WORKFLOW_FLOOR).toBe(workflowFiles().length);
  });

  it.each([
    [
      0,
      `the rehearsal found 0 workflow files, below its floor of ${String(WORKFLOW_FLOOR)} (#771).`,
    ],
    [
      WORKFLOW_FLOOR - 1,
      `the rehearsal found ${String(WORKFLOW_FLOOR - 1)} workflow files, below its floor of ${String(WORKFLOW_FLOOR)} (#771).`,
    ],
  ])('refuses %i files', (of, problem) => {
    expect(floorProblem(of)).toBe(problem);
  });

  it('passes the floor itself', () => {
    expect(floorProblem(WORKFLOW_FLOOR)).toBeUndefined();
  });
});

describe('no credential is left in the checkout (#771 AC6)', () => {
  it('passes when git config holds no extraheader', () => {
    expect(credentialProblem(ran('', 1))).toBeUndefined();
  });

  it('refuses a held extraheader, naming the key and never its value', () => {
    expect(
      credentialProblem(
        ran(
          'http.https://github.com/.extraheader AUTHORIZATION: basic c2VjcmV0\n',
        ),
      ),
    ).toBe(
      'the checkout left a credential in git config: http.https://github.com/.extraheader (#771).',
    );
  });

  it('refuses a config it could not read', () => {
    expect(credentialProblem(ran('', 3, 'fatal: bad config\n'))).toBe(
      'git config could not be read: fatal: bad config (#771).',
    );
  });
});

describe('a download, read as bytes (#771)', () => {
  it('keeps the body of a good answer', async () => {
    await expect(
      bytesOf({
        ok: true,
        status: 200,
        url: 'u',
        arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2]).buffer),
      }),
    ).resolves.toEqual(new Uint8Array([1, 2]));
  });

  it('refuses any other answer, naming the status and the address, before reading the body', async () => {
    const arrayBuffer = vi.fn<() => Promise<ArrayBuffer>>();
    await expect(
      bytesOf({
        ok: false,
        status: 404,
        url: 'https://example.invalid/a',
        arrayBuffer,
      }),
    ).rejects.toThrow('https://example.invalid/a answered 404');
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});

const ASSET = new TextEncoder().encode('the pinned asset');
const HEAD = 'c'.repeat(40);
const ACT_PATH = '/runner/temp/act/act';

interface Fake {
  io: RehearseIo;
  errors: string[];
  logs: string[];
  written: Record<string, string | Uint8Array>;
  commands: string[];
  /** The environment each command was given, by command. */
  envs: Record<string, Readonly<Record<string, string>> | undefined>;
  fetched: string[];
}

const fake = (
  over: Partial<Record<string, Run>> = {},
  options: {
    asset?: Uint8Array;
    download?: Error;
    env?: Record<string, string>;
    onDisk?: string[];
  } = {},
): Fake => {
  const errors: string[] = [];
  const logs: string[] = [];
  const written: Fake['written'] = {};
  const commands: string[] = [];
  const envs: Fake['envs'] = {};
  const fetched: string[] = [];
  const runs: Record<string, Run> = {
    'git config --includes --get-regexp ^http\\..*\\.extraheader$': ran('', 1),
    'tar -xzf /runner/temp/act/act_Linux_x86_64.tar.gz -C /runner/temp/act act':
      ran(''),
    [`${ACT_PATH} --version`]: ran('act version 0.2.89\n'),
    [`${ACT_PATH} --list`]: ran(LISTING),
    'git rev-parse HEAD': ran(`${HEAD}\n`),
    ...over,
  };
  return {
    errors,
    logs,
    written,
    commands,
    envs,
    fetched,
    io: {
      env: options.env ?? { RUNNER_TEMP: '/runner/temp' },
      // The rehearsal reads no file through its io.
      readFile: vi.fn<(path: string) => string>(),
      // A command the fake does not know answers undefined, which the
      // rehearsal cannot read: the test fails, never passes, on one.
      run: (command, args, env) => {
        const key = [command, ...args].join(' ');
        commands.push(key);
        envs[key] = env;
        return runs[key] as Run;
      },
      error: (message) => errors.push(message),
      log: (message) => logs.push(message),
      fetch: (url) => {
        fetched.push(url);
        return options.download === undefined
          ? Promise.resolve(options.asset ?? ASSET)
          : Promise.reject(options.download);
      },
      writeFile: (path, data) => {
        written[path] = data;
      },
      mkdir: () => undefined,
      list: () => options.onDisk ?? FILES,
    },
  };
};

describe('the rehearse step (#771)', () => {
  // A pin for the fake asset, made inside each test, never at collection.
  const pin = (): Tool => ({ ...ACT, sha256: sha256(ASSET) });

  it('installs act, checks it and writes the manifest', async () => {
    const { io, errors, logs, written, fetched } = fake();
    const code = await rehearse(io, pin());
    expect(fetched).toEqual([ACT.url]);
    const manifest = JSON.parse(String(written[MANIFEST])) as Manifest;
    expect([code, errors, Object.keys(written)]).toEqual([
      0,
      [],
      ['/runner/temp/act/act_Linux_x86_64.tar.gz', MANIFEST],
    ]);
    expect([
      manifest.commit,
      manifest.act,
      manifest.population,
      Object.keys(manifest.workflows),
      manifest.workflows['ci.yml'],
    ]).toEqual([
      HEAD,
      '0.2.89',
      { of: 11, what: 'workflow files act reads in .github/workflows' },
      FILES,
      ['build-and-test', 'coverage'],
    ]);
    expect(written['/runner/temp/act/act_Linux_x86_64.tar.gz']).toBe(ASSET);
    expect(logs).toEqual([
      `rehearse: act 0.2.89 lists 11 workflow files (24 jobs) at ${HEAD}`,
    ]);
  });

  // With the check on, act's update notice adds a blank line to its
  // listing, which the rehearsal refuses (record run 40723820849).
  it('runs every act command with its version check off', async () => {
    const { io, commands, envs } = fake();
    await rehearse(io, pin());
    expect(
      commands
        .filter((command) => command.startsWith(`${ACT_PATH} `))
        .map((command) => [command, envs[command]]),
    ).toEqual([
      [`${ACT_PATH} --version`, { ACT_DISABLE_VERSION_CHECK: '1' }],
      [`${ACT_PATH} --list`, { ACT_DISABLE_VERSION_CHECK: '1' }],
    ]);
  });

  it.each([
    [
      'a credential left by the checkout',
      {
        'git config --includes --get-regexp ^http\\..*\\.extraheader$': ran(
          'http.https://github.com/.extraheader x\n',
        ),
      },
      'the checkout left a credential in git config: http.https://github.com/.extraheader (#771).',
    ],
    [
      'act refusing to unpack',
      {
        'tar -xzf /runner/temp/act/act_Linux_x86_64.tar.gz -C /runner/temp/act act':
          ran('', 2, 'tar: act: Not found in archive\n'),
      },
      'tar could not unpack act_Linux_x86_64.tar.gz: tar: act: Not found in archive (#771).',
    ],
    [
      'another act version',
      { [`${ACT_PATH} --version`]: ran('act version 0.2.90\n') },
      `${ACT_PATH} --version printed 'act version 0.2.90', not 'act version 0.2.89' (#771).`,
    ],
    [
      'an act that does not run',
      { [`${ACT_PATH} --version`]: ran('', 126, 'cannot execute\n') },
      `${ACT_PATH} --version printed '', not 'act version 0.2.89' (#771).`,
    ],
    [
      'a failed listing',
      { [`${ACT_PATH} --list`]: ran('', 1, 'workflow is not valid\n') },
      'act --list failed: workflow is not valid (#771).',
    ],
    [
      'a HEAD it cannot read',
      { 'git rev-parse HEAD': ran('', 128, 'fatal: not a git repository\n') },
      'git rev-parse HEAD failed: fatal: not a git repository (#771).',
    ],
  ])('refuses %s, writing no manifest', async (_case, over, problem) => {
    const { io, errors, written } = fake(over);
    expect([await rehearse(io, pin()), errors, written[MANIFEST]]).toEqual([
      1,
      [`::error::${problem}`],
      undefined,
    ]);
  });

  it('refuses a listing it cannot read, writing no manifest', async () => {
    const { io, errors, written } = fake({
      [`${ACT_PATH} --list`]: ran('Stage\n'),
    });
    expect([await rehearse(io, pin()), written[MANIFEST]]).toEqual([
      1,
      undefined,
    ]);
    expect(errors).toEqual([
      expect.stringMatching(
        /^::error::act --list printed .* the rehearsal cannot read/,
      ),
    ]);
  });

  it('refuses a run without RUNNER_TEMP, downloading nothing', async () => {
    const { io, errors, commands } = fake({}, { env: {} });
    expect([await rehearse(io, pin()), errors, commands]).toEqual([
      1,
      ['::error::RUNNER_TEMP is not set (#771).'],
      ['git config --includes --get-regexp ^http\\..*\\.extraheader$'],
    ]);
  });

  it('refuses a download that fails', async () => {
    const { io, errors } = fake({}, { download: new Error('ENOTFOUND') });
    expect([await rehearse(io, pin()), errors]).toEqual([
      1,
      [`::error::could not download ${ACT.url}: ENOTFOUND (#771).`],
    ]);
  });

  it('refuses an asset that is not the pinned one, before unpacking it', async () => {
    const other = new TextEncoder().encode('another asset');
    const { io, errors, commands } = fake({}, { asset: other });
    expect([await rehearse(io, pin()), errors, commands]).toEqual([
      1,
      [
        `::error::act_Linux_x86_64.tar.gz has SHA-256 ${sha256(other)}, not the pinned ${pin().sha256} (#771).`,
      ],
      ['git config --includes --get-regexp ^http\\..*\\.extraheader$'],
    ]);
  });

  it('refuses a listing that differs from the folder, naming every difference', async () => {
    const { io, errors } = fake({}, { onDisk: [...FILES, 'extra.yml'] });
    expect([await rehearse(io, pin()), errors]).toEqual([
      1,
      ['::error::act --list does not list .github/workflows/extra.yml (#771).'],
    ]);
  });

  it('refuses an empty folder through the floor', async () => {
    const { io, errors } = fake(
      { [`${ACT_PATH} --list`]: ran(table([])) },
      { onDisk: [] },
    );
    expect([await rehearse(io, pin()), errors]).toEqual([
      1,
      [
        `::error::the rehearsal found 0 workflow files, below its floor of ${String(WORKFLOW_FLOOR)} (#771).`,
      ],
    ]);
  });

  it('judges the real asset against ACT when given no pin', async () => {
    const { io, errors } = fake();
    expect([await rehearse(io), errors]).toEqual([
      1,
      [
        `::error::act_Linux_x86_64.tar.gz has SHA-256 ${sha256(ASSET)}, not the pinned ${ACT.sha256} (#771).`,
      ],
    ]);
  });
});

describe('the real io (#771)', () => {
  it('shares the gate’s environment, files, processes and errors', () => {
    expect(() => nodeRehearseIo.run('git', ['--version'])).toThrow(
      'child_process.spawnSync starts a process',
    );
    expect(nodeRehearseIo.env).toBe(process.env);
  });

  it('downloads through fetch, reading the body as bytes', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([7])));
    try {
      await expect(nodeRehearseIo.fetch(ACT.url)).resolves.toEqual(
        new Uint8Array([7]),
      );
      expect(spy.mock.calls).toEqual([[ACT.url]]);
    } finally {
      spy.mockRestore();
    }
  });

  it('makes folders, writes files and lists workflow files under a folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rehearse-'));
    try {
      nodeRehearseIo.mkdir(join(dir, 'a', 'b'));
      nodeRehearseIo.writeFile(join(dir, 'a', 'b', 'w.yaml'), 'x');
      nodeRehearseIo.writeFile(join(dir, 'c.yml'), new Uint8Array([1]));
      writeFileSync(join(dir, 'notes.md'), 'not a workflow');
      expect(nodeRehearseIo.list(dir)).toEqual(['a/b/w.yaml', 'c.yml']);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('logs to stdout', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      nodeRehearseIo.log('m');
      expect(spy.mock.calls).toEqual([['m']]);
    } finally {
      spy.mockRestore();
    }
  });
});
