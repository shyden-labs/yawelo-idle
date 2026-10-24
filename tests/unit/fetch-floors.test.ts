import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  artifactName,
  coverageArtifactName,
  deleteScratchRef,
  fetchedFloors,
  fetchRefusal,
  fetchTargets,
  ignoredRefusal,
  pushedHead,
  repoOfRunUrl,
  scratchRef,
  writeFetched,
  type RecordRun,
} from '../../scripts/fetch-floors';
import { RECORD_FILE } from '../../scripts/coverage';
import { floorsText } from '../../scripts/record-floors';
import { isIgnored } from './tracked-files';

/**
 * `npm run floors:fetch <run>` (#547, #718): the floors the record-floors
 * workflow recorded in CI at a commit pushed only to its scratch ref,
 * written here only when the run measured this branch's HEAD and that HEAD
 * is not yet on the remote, and only when no figure falls or vanishes.
 */

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const BRANCH = 'm1/542-golden-slices';
const UNPUSHED = false;

const RUN: RecordRun = {
  workflowName: 'record-floors',
  status: 'completed',
  conclusion: 'success',
  displayTitle: `record-floors ${BRANCH} at ${HEAD}`,
};

describe('fetchRefusal', () => {
  it('accepts a finished, successful record of this branch’s unpushed HEAD', () => {
    expect(fetchRefusal(RUN, HEAD, BRANCH, UNPUSHED)).toBeUndefined();
  });

  it('refuses another workflow’s run', () => {
    expect(
      fetchRefusal(
        { ...RUN, workflowName: 'build-and-test' },
        HEAD,
        BRANCH,
        UNPUSHED,
      ),
    ).toBe('run is build-and-test’s, not record-floors’');
  });

  it('refuses a run still going', () => {
    expect(
      fetchRefusal(
        { ...RUN, status: 'in_progress', conclusion: '' },
        HEAD,
        BRANCH,
        UNPUSHED,
      ),
    ).toBe('run is in_progress, not finished');
  });

  it('refuses a run that did not succeed', () => {
    expect(
      fetchRefusal({ ...RUN, conclusion: 'failure' }, HEAD, BRANCH, UNPUSHED),
    ).toBe('run ended failure: it recorded nothing');
  });

  it('refuses a record of another branch', () => {
    expect(fetchRefusal(RUN, HEAD, 'm1/547-ci-floors', UNPUSHED)).toBe(
      `run measured “record-floors ${BRANCH} at ${HEAD}”, not “record-floors m1/547-ci-floors at ${HEAD}”: push this commit to refs/floors/m1/547-ci-floors and dispatch record-floors on develop for it`,
    );
  });

  it('refuses a record of another commit', () => {
    expect(fetchRefusal(RUN, OTHER, BRANCH, UNPUSHED)).toBe(
      `run measured “record-floors ${BRANCH} at ${HEAD}”, not “record-floors ${BRANCH} at ${OTHER}”: push this commit to refs/floors/${BRANCH} and dispatch record-floors on develop for it`,
    );
  });

  it('refuses a HEAD already on the remote: the figures fold into a commit not yet pushed', () => {
    expect(fetchRefusal(RUN, HEAD, BRANCH, true)).toBe(
      `HEAD ${HEAD} is already on origin: figures fold into a commit not yet pushed, so measure the commit before its first push (#718)`,
    );
  });

  it('names the minimums workflow’s own scratch ref in its refusals', () => {
    expect(
      fetchRefusal(
        { ...RUN, workflowName: 'record-minimums' },
        OTHER,
        BRANCH,
        UNPUSHED,
        'record-minimums',
      ),
    ).toBe(
      `run measured “record-floors ${BRANCH} at ${HEAD}”, not “record-minimums ${BRANCH} at ${OTHER}”: push this commit to refs/minimums/${BRANCH} and dispatch record-minimums on develop for it`,
    );
  });
});

describe('the scratch ref', () => {
  it('is refs/floors/<branch> for floors and refs/minimums/<branch> for minimums', () => {
    expect(scratchRef('record-floors', BRANCH)).toBe(`refs/floors/${BRANCH}`);
    expect(scratchRef('record-minimums', BRANCH)).toBe(
      `refs/minimums/${BRANCH}`,
    );
  });

  it('is deleted, once the branch is pushed, by a normal push', () => {
    expect(deleteScratchRef('record-floors', BRANCH)).toBe(
      `git push origin --delete refs/floors/${BRANCH}`,
    );
  });
});

describe('pushedHead', () => {
  const PRUNING_FETCH = ['fetch', '--quiet', '--prune', 'origin'];
  const CONTAINS = ['branch', '--remotes', '--contains', 'HEAD'];

  it('fetches with --prune, then asks which remote branches hold HEAD', () => {
    const calls: [string, readonly string[]][] = [];
    pushedHead((command, args) => {
      calls.push([command, args]);
      return '';
    });
    expect(calls).toEqual([
      ['git', PRUNING_FETCH],
      ['git', CONTAINS],
    ]);
  });

  it('counts no stale ref of a branch deleted on GitHub (#723)', () => {
    let pruned = false;
    const pushed = pushedHead((_command, args) => {
      if (args[0] === 'fetch') pruned = args.includes('--prune');
      return pruned ? '' : '  origin/floors-bootstrap/718';
    });
    expect(pushed).toBe(false);
  });

  it('counts a remote branch that still holds HEAD after the prune', () => {
    const pushed = pushedHead((_command, args) =>
      args[0] === 'fetch' ? '' : '  origin/ci/723-prune',
    );
    expect(pushed).toBe(true);
  });
});

describe('fetchedFloors', () => {
  it('takes the run’s figures: raised, new and unmoved alike', () => {
    expect(
      fetchedFloors({ 'a/x': 3, 'a/y': 5 }, { 'a/x': 4, 'a/y': 5, 'b/z': 1 }),
    ).toEqual({ next: { 'a/x': 4, 'a/y': 5, 'b/z': 1 }, refusals: [] });
  });

  it('refuses a figure that falls', () => {
    expect(fetchedFloors({ 'a/x': 3 }, { 'a/x': 2 }).refusals).toEqual([
      'a/x would fall from 3 to 2: the recorder refuses a fall, so this run is not its record',
    ]);
  });

  it('refuses a floor the run does not hold', () => {
    expect(
      fetchedFloors({ 'a/x': 3, 'a/y': 1 }, { 'a/x': 3 }).refusals,
    ).toEqual(['a/y is recorded here but not in the run’s floors']);
  });
});

describe('artifactName', () => {
  it('names the record by the commit it ran on', () => {
    expect(artifactName(HEAD)).toBe(`floors-${HEAD}`);
  });
});

describe('coverageArtifactName (#728)', () => {
  it('names the coverage record by the commit it ran on, apart from the floors', () => {
    expect(coverageArtifactName(HEAD)).toBe(`coverage-${HEAD}`);
  });
});

describe('repoOfRunUrl (#728)', () => {
  it("reads the repository from a run's URL", () => {
    expect(
      repoOfRunUrl(
        'https://github.com/shyden-labs/yawelo-idle/actions/runs/39638724811',
      ),
    ).toBe('shyden-labs/yawelo-idle');
  });

  it('refuses a URL that is not a run of a repository', () => {
    expect(() => repoOfRunUrl('https://github.com/shyden-labs')).toThrow(
      'not a run URL: https://github.com/shyden-labs',
    );
  });
});

/** A fresh directory per test, removed after it. */
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
});
const tempDir = (files: Readonly<Record<string, string>> = {}): string => {
  const dir = mkdtempSync(join(tmpdir(), 'fetch-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files))
    writeFileSync(join(dir, name), text);
  return dir;
};

/** `floorsText({ 'a/x': 1 })`, spelled out: no workspace call at collection. */
const A1 = '{\n  "a/x": 1\n}\n';

/** A file each root holds, so a listing that sees nothing cannot pass. */
const KEPT = { 'kept.txt': 'x' };

/** A writer that fails at `failing`, after writing `partial` there if given. */
const failingAt =
  (failing: string, partial?: string) =>
  (file: string, text: string): void => {
    if (file !== failing) {
      writeFileSync(file, text);
      return;
    }
    if (partial !== undefined) writeFileSync(file, partial);
    throw new Error(`EIO: i/o error, write '${file}'`);
  };

describe('writeFetched (#747)', () => {
  it('writes only the moved floors when the run uploaded no coverage record', () => {
    const floors = tempDir({ 'a.json': A1 });
    expect(writeFetched(floors, { 'a/x': 2 }, undefined)).toEqual(['a.json']);
    expect(readFileSync(join(floors, 'a.json'), 'utf8')).toBe(
      floorsText({ 'a/x': 2 }),
    );
  });

  it('writes the first coverage record into a folder that does not exist yet', () => {
    const floors = tempDir({ 'a.json': A1 });
    const file = join(tempDir(), 'tests', 'coverage', 'record.json');
    expect(writeFetched(floors, { 'a/x': 1 }, { file, text: '{}\n' })).toEqual([
      file,
    ]);
    expect(readFileSync(file, 'utf8')).toBe('{}\n');
  });

  it('puts every floor back, and removes what it made, when the record cannot be written', () => {
    const floors = tempDir({ 'a.json': A1 });
    const root = tempDir(KEPT);
    const file = join(root, 'tests', 'coverage', 'record.json');
    expect(() =>
      writeFetched(
        floors,
        { 'a/x': 2, 'c/n': 5 },
        { file, text: '{}\n' },
        failingAt(file),
      ),
    ).toThrow(
      `nothing written, every file is as it was: EIO: i/o error, write '${file}'`,
    );
    expect(readdirSync(floors)).toEqual(['a.json']);
    expect(readFileSync(join(floors, 'a.json'), 'utf8')).toBe(A1);
    expect(readdirSync(root)).toEqual(['kept.txt']);
  });

  it('puts back a floor a failed write had begun to change', () => {
    const b3 = floorsText({ 'b/z': 3 });
    const floors = tempDir({ 'a.json': A1, 'b.json': b3 });
    const b = join(floors, 'b.json');
    expect(() =>
      writeFetched(
        floors,
        { 'a/x': 2, 'b/z': 4 },
        undefined,
        failingAt(b, '{'),
      ),
    ).toThrow(
      `nothing written, every file is as it was: EIO: i/o error, write '${b}'`,
    );
    expect(readFileSync(join(floors, 'a.json'), 'utf8')).toBe(A1);
    expect(readFileSync(b, 'utf8')).toBe(b3);
  });

  it('puts back a record a failed write had begun to change', () => {
    const floors = tempDir({ 'a.json': A1 });
    const root = tempDir({ 'record.json': '{"old":1}\n' });
    const file = join(root, 'record.json');
    expect(() =>
      writeFetched(
        floors,
        { 'a/x': 1 },
        { file, text: '{}\n' },
        failingAt(file, '{'),
      ),
    ).toThrow(
      `nothing written, every file is as it was: EIO: i/o error, write '${file}'`,
    );
    expect(readFileSync(file, 'utf8')).toBe('{"old":1}\n');
  });

  it('removes a new record a failed write had begun', () => {
    const floors = tempDir({ 'a.json': A1 });
    const root = tempDir(KEPT);
    const file = join(root, 'record.json');
    expect(() =>
      writeFetched(
        floors,
        { 'a/x': 1 },
        { file, text: '{}\n' },
        failingAt(file, '{'),
      ),
    ).toThrow(
      `nothing written, every file is as it was: EIO: i/o error, write '${file}'`,
    );
    expect(readdirSync(root)).toEqual(['kept.txt']);
  });

  it('removes the floors folder it made when a later write fails', () => {
    const root = tempDir(KEPT);
    const floors = join(root, 'floors');
    const file = join(root, 'record.json');
    expect(() =>
      writeFetched(
        floors,
        { 'a/x': 1 },
        { file, text: '{}\n' },
        failingAt(file),
      ),
    ).toThrow(
      `nothing written, every file is as it was: EIO: i/o error, write '${file}'`,
    );
    expect(readdirSync(root)).toEqual(['kept.txt']);
  });

  it("changes nothing when the floors' folder cannot be made", () => {
    const blocker = join(tempDir({ blocker: 'a file' }), 'blocker');
    const floors = join(blocker, 'floors');
    expect(() => writeFetched(floors, { 'a/x': 1 }, undefined)).toThrow(
      `nothing written, every file is as it was: ENOTDIR: not a directory, mkdir '${floors}'`,
    );
    expect(readFileSync(blocker, 'utf8')).toBe('a file');
  });

  it("changes nothing when the record's folder cannot be made", () => {
    const floors = tempDir({ 'a.json': A1 });
    const blocker = join(tempDir({ blocker: 'a file' }), 'blocker');
    const file = join(blocker, 'coverage', 'record.json');
    expect(() =>
      writeFetched(floors, { 'a/x': 2 }, { file, text: '{}\n' }),
    ).toThrow(
      `nothing written, every file is as it was: ENOTDIR: not a directory, mkdir '${join(blocker, 'coverage')}'`,
    );
    expect(readFileSync(join(floors, 'a.json'), 'utf8')).toBe(A1);
    expect(existsSync(blocker)).toBe(true);
    expect(readFileSync(blocker, 'utf8')).toBe('a file');
  });
});

/**
 * Nothing is written when git would leave a written file out of the commit
 * (#748): `coverage/` in .gitignore matched `tests/coverage/`, so the first
 * record was written and reported, and the amend would have dropped it.
 * The judge is tracked-files' `isIgnored`, held to git's own answers by the
 * integration suite; here it reads this repository's .gitignore in-process.
 */
describe('what git would leave out of the commit (#748)', () => {
  const RECORD = 'tests/coverage/record.json';

  it('names each floor file the fetch writes once, then the record', () => {
    expect(
      fetchTargets('tests/floors', { 'b/z': 1, 'a/x': 4, 'a/y': 5 }, RECORD),
    ).toEqual(['tests/floors/a.json', 'tests/floors/b.json', RECORD]);
  });

  it('names no record when the run carried none', () => {
    expect(fetchTargets('tests/floors', { 'a/x': 4 }, undefined)).toEqual([
      'tests/floors/a.json',
    ]);
  });

  it('refuses to write while a target is ignored, naming each, and lets through none ignored', () => {
    const targets = ['tests/floors/a.json', 'tests/floors/b.json', RECORD];
    expect([
      ignoredRefusal(targets, () => false),
      ignoredRefusal(targets, (path) => path !== 'tests/floors/b.json'),
    ]).toEqual([
      undefined,
      `nothing written, git would leave out of the commit what the fetch writes (a .gitignore pattern matches it): tests/floors/a.json, ${RECORD}. Un-ignore it in .gitignore, then fetch again`,
    ]);
  });

  it("keeps a new file in the coverage record's folder, while coverage tools' output stays ignored", () => {
    // An untracked path: git never reports a tracked file as ignored, so the
    // committed record itself would read as kept whatever .gitignore says.
    expect({
      recordFolder: isIgnored(
        join(dirname(RECORD_FILE), 'not-yet-written.json'),
      ),
      toolOutput: isIgnored('coverage/index.html'),
      workspaceToolOutput: isIgnored('apps/web/coverage/index.html'),
    }).toEqual({
      recordFolder: false,
      toolOutput: true,
      workspaceToolOutput: true,
    });
  });
});
