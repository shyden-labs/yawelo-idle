/**
 * The rehearsal (#771): record-floors.yml's `rehearse` job runs this on the
 * runner host, with the measured commit checked out, after the scratch-ref
 * gate (record-gate.ts) has passed it. It installs act pinned by its release
 * asset's SHA-256, checks act's version, and writes `rehearsal/manifest.json`:
 * every workflow file act reads with its jobs, judged against the workflow
 * folder file by file and against a floor. The coverage record's Measure step
 * refuses a missing or stale manifest (rehearsal.ts). Running and tracing the
 * workflows is #762's (#737, #738).
 *
 * It imports node built-ins only, since the job runs no `npm ci`.
 *
 * record-floors.yml starts it with one inline line (`node --input-type=module
 * -e …`), not a start file (Shyden, 2026-10-28: "Start line in the workflow").
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { nodeIo, type GateIo, type Run } from './record-gate.ts';

/** A tool CI downloads as a binary, pinned by its release asset. */
export interface Tool {
  readonly version: string;
  readonly asset: string;
  readonly url: string;
  readonly sha256: string;
  readonly licence: string;
}

/**
 * act (nektos/act, MIT), for the runner host (x86_64). The SHA-256 is the
 * release's `checksums.txt` line for the asset, read 2026-10-28.
 */
export const ACT: Tool = {
  version: '0.2.89',
  asset: 'act_Linux_x86_64.tar.gz',
  url: 'https://github.com/nektos/act/releases/download/v0.2.89/act_Linux_x86_64.tar.gz',
  sha256: '0191d6f1f3b716b5c55820032605d05fc3c1cdbf581ebeff655019e5dd1524c0',
  licence: 'MIT',
};

/**
 * Licences a build or test tool may carry (global rule: shipped packages
 * permissive only; build and test tools may also be LGPL or MPL). Until the
 * dependency licence check (#464) reads binaries, this list is the check.
 */
export const TOOL_LICENCES: readonly string[] = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'LGPL-2.1',
  'LGPL-3.0',
  'MPL-2.0',
];

export const OUTPUT_DIR = 'rehearsal';
export const MANIFEST_NAME = 'manifest.json';
export const MANIFEST = `${OUTPUT_DIR}/${MANIFEST_NAME}`;
export const WORKFLOWS_DIR = '.github/workflows';

/**
 * The workflow files the repository holds (measured at develop 04aefda: 11).
 * Both sides of the listing check come from the run, so an empty folder (a
 * wrong working directory) would match an empty listing: the floor refuses
 * it. A unit test holds it equal to the folder's count.
 */
export const WORKFLOW_FLOOR = 11;

/** What the rehearsal leaves for the coverage record's Measure step. */
export interface Manifest {
  commit: string;
  act: string;
  population: { of: number; what: string };
  workflows: Record<string, string[]>;
}

/** The one note act 0.2.89 prints after its table (cmd/list.go). */
export const DUPLICATE_NOTE =
  'Detected multiple jobs with the same job name, use `-W` to specify the path to the specific workflow.';

const COLUMNS = [
  'Stage',
  'Job ID',
  'Job name',
  'Workflow name',
  'Workflow file',
  'Events',
] as const;

/** act reads `.yml` and `.yaml` files (pkg/model/planner.go). */
const WORKFLOW_FILE = /\.ya?ml$/;

const unreadable = (what: string): Error =>
  new Error(
    `act --list printed ${what}, which the rehearsal cannot read (#771).`,
  );

/** Where each of act's columns starts, from its header line. */
function columnStarts(header: string): number[] {
  if (header.trimEnd().split(/ {2,}/).join('|') !== COLUMNS.join('|'))
    throw unreadable(`the header ${JSON.stringify(header)}`);
  let from = 0;
  return COLUMNS.map((label) => {
    from = header.indexOf(label, from);
    return from;
  });
}

/**
 * Each workflow file `act --list` names, with its job ids, sorted by file.
 * act pads every column to its widest cell plus two, counting bytes
 * (`%*s`, cmd/list.go), so cells are cut by byte offsets; a job name may
 * hold spaces. After the table act prints nothing, or its one note.
 */
export function listedWorkflows(actList: string): Record<string, string[]> {
  const lines = actList.split('\n');
  const [, jobAt, nameAt, , fileAt, eventsAt] = columnStarts(
    lines[0] as string,
  ) as [number, number, number, number, number, number];
  const end = lines.indexOf('', 1);
  if (end === -1) throw unreadable('a table with no end');
  const after = lines.slice(end).join('\n');
  if (after !== '' && after !== `\n${DUPLICATE_NOTE}\n`)
    throw unreadable(`text after its table, ${JSON.stringify(after)}`);
  const listed = new Map<string, string[]>();
  for (const row of lines.slice(1, end)) {
    const bytes = Buffer.from(row);
    const job = bytes.subarray(jobAt, nameAt).toString().trim();
    const file = bytes.subarray(fileAt, eventsAt).toString().trim();
    if (bytes.length < eventsAt || job === '' || file === '')
      throw unreadable(`the row ${JSON.stringify(row)}`);
    listed.set(file, [...(listed.get(file) ?? []), job]);
  }
  return Object.fromEntries([...listed].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * Every way act's listing differs from the workflow folder, file by file.
 * act names a file by its base name only, so two files sharing one are
 * refused rather than guessed between.
 */
export function manifestProblems(
  listed: Readonly<Record<string, readonly string[]>>,
  onDisk: readonly string[],
): string[] {
  const byName = new Map<string, string[]>();
  for (const path of onDisk) {
    const name = posix.basename(path);
    byName.set(name, [...(byName.get(name) ?? []), path]);
  }
  const shared = [...byName]
    .filter(([, paths]) => paths.length > 1)
    .map(
      ([name, paths]) =>
        `two workflow files share the name ${name}: ${paths.join(', ')} (#771).`,
    );
  const unlisted = [...byName]
    .filter(([name]) => !(name in listed))
    .map(
      ([, paths]) =>
        `act --list does not list ${paths.map((path) => `${WORKFLOWS_DIR}/${path}`).join(', ')} (#771).`,
    );
  const unknown = Object.keys(listed)
    .filter((name) => !byName.has(name))
    .map(
      (name) =>
        `act --list names ${name}, which is not in ${WORKFLOWS_DIR} (#771).`,
    );
  return [...shared, ...unlisted, ...unknown];
}

/** Why `of` workflow files are too few to trust the listing, or nothing. */
export const floorProblem = (of: number): string | undefined =>
  of < WORKFLOW_FLOOR
    ? `the rehearsal found ${String(of)} workflow files, below its floor of ${String(WORKFLOW_FLOOR)} (#771).`
    : undefined;

/** The git config keys a persisted checkout credential is written under. */
const EXTRAHEADER = '^http\\..*\\.extraheader$';

/**
 * Why `git config --includes --get-regexp <EXTRAHEADER>` shows a credential
 * left in the checkout, naming the keys and never the values, or nothing
 * (git exits 1 when no key matches).
 */
export function credentialProblem(extraheaders: Run): string | undefined {
  if (extraheaders.status === 1 && extraheaders.stdout.trim() === '')
    return undefined;
  if (extraheaders.status !== 0)
    return `git config could not be read: ${extraheaders.stderr.trim()} (#771).`;
  const keys = extraheaders.stdout
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split(' ', 1).join(''));
  return `the checkout left a credential in git config: ${keys.join(', ')} (#771).`;
}

/** A download's body as bytes, refusing any answer but a success. */
export async function bytesOf(response: {
  ok: boolean;
  status: number;
  url: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<Uint8Array> {
  if (!response.ok)
    throw new Error(`${response.url} answered ${String(response.status)}`);
  return new Uint8Array(await response.arrayBuffer());
}

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

/** What the rehearsal reaches outside itself, stood in by the unit tests. */
export interface RehearseIo extends GateIo {
  log(message: string): void;
  fetch(url: string): Promise<Uint8Array>;
  writeFile(path: string, data: string | Uint8Array): void;
  mkdir(path: string): void;
  /** Every workflow file under `dir`, at any depth, relative to it, sorted. */
  list(dir: string): string[];
}

/** Why the rehearsal fails, or nothing once the manifest is written. */
async function refusal(io: RehearseIo, act: Tool): Promise<string | undefined> {
  const credential = credentialProblem(
    io.run('git', ['config', '--includes', '--get-regexp', EXTRAHEADER]),
  );
  if (credential !== undefined) return credential;
  const temp = io.env.RUNNER_TEMP;
  if (temp === undefined) return 'RUNNER_TEMP is not set (#771).';
  let bytes: Uint8Array;
  try {
    bytes = await io.fetch(act.url);
  } catch (error) {
    return `could not download ${act.url}: ${(error as Error).message} (#771).`;
  }
  const hash = sha256(bytes);
  if (hash !== act.sha256)
    return `${act.asset} has SHA-256 ${hash}, not the pinned ${act.sha256} (#771).`;
  const dir = `${temp}/act`;
  const asset = `${dir}/${act.asset}`;
  io.mkdir(dir);
  io.writeFile(asset, bytes);
  const unpacked = io.run('tar', ['-xzf', asset, '-C', dir, 'act']);
  if (unpacked.status !== 0)
    return `tar could not unpack ${act.asset}: ${unpacked.stderr.trim()} (#771).`;
  const binary = `${dir}/act`;
  const version = io.run(binary, ['--version']).stdout.trim();
  const wanted = `act version ${act.version}`;
  if (version !== wanted)
    return `${binary} --version printed '${version}', not '${wanted}' (#771).`;
  const listing = io.run(binary, ['--list']);
  if (listing.status !== 0)
    return `act --list failed: ${listing.stderr.trim()} (#771).`;
  let listed: Record<string, string[]>;
  try {
    listed = listedWorkflows(listing.stdout);
  } catch (error) {
    return (error as Error).message;
  }
  const onDisk = io.list(WORKFLOWS_DIR);
  const problems = manifestProblems(listed, onDisk);
  const floor = floorProblem(onDisk.length);
  if (floor !== undefined) problems.push(floor);
  if (problems.length > 0) return problems.join('\n::error::');
  const head = io.run('git', ['rev-parse', 'HEAD']);
  if (head.status !== 0)
    return `git rev-parse HEAD failed: ${head.stderr.trim()} (#771).`;
  const manifest: Manifest = {
    commit: head.stdout.trim(),
    act: act.version,
    population: {
      of: onDisk.length,
      what: `workflow files act reads in ${WORKFLOWS_DIR}`,
    },
    workflows: listed,
  };
  io.mkdir(OUTPUT_DIR);
  io.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  io.log(
    `rehearse: act ${act.version} lists ${String(onDisk.length)} workflow files (${String(Object.values(listed).flat().length)} jobs) at ${manifest.commit}`,
  );
  return undefined;
}

/**
 * The step's exit code: 0 once the manifest is written, 1 after naming why
 * not. `act` is the pin, a parameter only so a test can pin a fake asset.
 */
export async function rehearse(
  io: RehearseIo,
  act: Tool = ACT,
): Promise<number> {
  const refused = await refusal(io, act);
  if (refused === undefined) return 0;
  io.error(`::error::${refused}`);
  return 1;
}

/** The real io: the gate's, plus downloads, files and stdout. */
export const nodeRehearseIo: RehearseIo = {
  ...nodeIo,
  log: (message) => {
    console.log(message);
  },
  fetch: (url) => fetch(url).then(bytesOf),
  writeFile: (path, data) => {
    writeFileSync(path, data);
  },
  mkdir: (path) => {
    mkdirSync(path, { recursive: true });
  },
  list: (dir) =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((path) => WORKFLOW_FILE.test(path))
      .sort(),
};
