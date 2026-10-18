/**
 * Every `npx wrangler` call in the workflows, and the config each one means
 * (#627).
 *
 * deploy-dev run 38889757344 (2026-10-16) published the dev site where the
 * holding page's dev copy belonged. Its step ran `npx wrangler deploy` with
 * `working-directory: apps/site/holding-dev`, beside its own config. npm runs
 * an `npx` command at the root of the package it is in, keeping the step's
 * folder only in `INIT_CWD`, so wrangler started in `apps/site` and read the
 * dev site's `apps/site/wrangler.jsonc` (measured: `npm exec -c pwd` from
 * `apps/site/holding-dev` prints `apps/site`). Every unit pin read each config
 * by explicit path, so none saw it.
 *
 * The unit suite holds the parse and the rule on where a call may start from;
 * the integration suite (tests/integration/wrangler-steps.test.ts) runs each
 * call's config lookup under npm from the step's own directory.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse } from 'yaml';
import { runOf } from './workflow-steps.ts';
import { readDeployConfig } from './wrangler-configs.ts';

/** One `npx wrangler` call in a workflow step. */
export interface WranglerCall {
  /** `<workflow file> / <job> / <step name>`. */
  step: string;
  /** One of WRANGLER_COMMANDS. */
  command: string;
  /** The step's working directory from the repository root; `.` for none. */
  from: string;
  /** The arguments that choose a config, as written: `--config`, `-c`, `--env`, `-e`. */
  configArgs: string[];
}

/** The config a call is meant to read, from the repository root. */
export interface MeantConfig {
  config: string;
  /** A config CI writes before the call (#391): the tracked one it is written from. */
  writtenFrom?: string;
}

/** What wrangler's own config reader found, run where the step runs it. */
export interface ConfigRead {
  /** The directory npm ran the command in. */
  cwd: string;
  /** The config file read, absolute. */
  configPath?: string;
  /** A config named on the command line that is not on disk, absolute. */
  missing?: string;
  name?: string;
  /** The assets (or Pages output) directory, absolute; null for none. */
  assets?: string | null;
}

/** The wrangler commands the workflows run, longest first. */
export const WRANGLER_COMMANDS = [
  'd1 migrations apply',
  'versions list',
  'pages deploy',
  'deploy',
  'rollback',
] as const;

/**
 * The config every call means, in workflow order. The guard's specification:
 * the parse finds the calls, and this table must name exactly those.
 */
export const WRANGLER_STEPS: readonly (MeantConfig & { step: string })[] = [
  {
    step: 'deploy-dev.yml / deploy / Apply D1 migrations (before the Worker, so new code never meets an old schema)',
    config: 'apps/sync-worker/wrangler.deploy.jsonc',
    writtenFrom: 'apps/sync-worker/wrangler.jsonc',
  },
  {
    step: 'deploy-dev.yml / deploy / Deploy the sync Worker, stamped with this commit',
    config: 'apps/sync-worker/wrangler.deploy.jsonc',
    writtenFrom: 'apps/sync-worker/wrangler.jsonc',
  },
  {
    step: 'deploy-dev.yml / deploy / Deploy the game Worker',
    config: 'apps/web/wrangler.jsonc',
  },
  {
    step: "deploy-dev.yml / deploy / Deploy the holding page's dev copy",
    config: 'apps/site/holding-dev/wrangler.jsonc',
  },
  {
    step: 'deploy-dev.yml / deploy / Deploy the site Worker with its secrets',
    config: 'apps/site/wrangler.jsonc',
  },
  {
    step: 'deploy-dev.yml / deploy / Deploy the hostname adapter to production on Pages',
    config: 'apps/dev-hosts/wrangler.jsonc',
  },
  {
    step: 'deploy-prod.yml / deploy / Deploy the holding page, tagged with this commit',
    config: 'apps/site/holding/wrangler.jsonc',
  },
  {
    step: 'rollback-prod.yml / rollback / Find the version tagged with that commit',
    config: 'apps/site/holding/wrangler.jsonc',
  },
  {
    step: 'rollback-prod.yml / rollback / Roll production back to it',
    config: 'apps/site/holding/wrangler.jsonc',
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A default `working-directory` moves every step's start, unseen by the step. */
const hasDefaultDirectory = (holder: Record<string, unknown>): boolean => {
  const { defaults } = holder;
  return (
    isRecord(defaults) &&
    isRecord(defaults.run) &&
    defaults.run['working-directory'] !== undefined
  );
};

/** A shell line's words, quotes removed. Enough for the lines a step writes. */
const wordsOf = (line: string): string[] =>
  (line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []).map((word) =>
    word.replace(/"([^"]*)"|'([^']*)'/g, '$1$2'),
  );

/** `wrangler` as a command word, bare or by path; a config path is not one. */
const isWranglerWord = (word: string): boolean =>
  word === 'wrangler' || word.endsWith('/wrangler');

const CONFIG_FLAGS = ['--config', '-c', '--env', '-e'];

/** One `npx wrangler …` line's call, refusing what the guard cannot follow. */
function callOf(step: string, from: string, line: string): WranglerCall {
  if (line.endsWith('\\'))
    throw new Error(
      `${step}: a wrangler call continued on the next line: ${line}`,
    );
  const words = wordsOf(line);
  if (words[0] !== 'npx' || words[1] !== 'wrangler')
    throw new Error(
      `${step}: wrangler is called in a form this guard cannot follow: ${line}`,
    );
  const rest = words.slice(2);
  const command = WRANGLER_COMMANDS.find(
    (each) => rest.slice(0, each.split(' ').length).join(' ') === each,
  );
  if (command === undefined)
    throw new Error(
      `${step}: a wrangler command this guard does not know: ${line}`,
    );
  const configArgs: string[] = [];
  const args = rest.slice(command.split(' ').length);
  args.forEach((word, index) => {
    if (CONFIG_FLAGS.includes(word))
      configArgs.push(word, args[index + 1] ?? '');
    else if (word.startsWith('--config=') || word.startsWith('--env='))
      configArgs.push(word);
  });
  return { step, command, from, configArgs };
}

/** A step's working directory from the root: `.` for none, `./a/b/` read as `a/b`. */
function fromOf(step: string, directory: unknown): string {
  if (directory === undefined) return '.';
  if (typeof directory !== 'string')
    throw new Error(`${step}: working-directory is not a string`);
  if (directory.includes('${{'))
    throw new Error(
      `${step}: working-directory is an expression: ${directory}`,
    );
  const trimmed = directory.replace(/^\.\//, '').replace(/\/+$/, '');
  return trimmed === '' ? '.' : trimmed;
}

/** Every wrangler call in one workflow's text; refuses, naming the step, any form it cannot follow. */
export function wranglerCallsIn(file: string, text: string): WranglerCall[] {
  const workflow: unknown = parse(text);
  if (!isRecord(workflow) || !isRecord(workflow.jobs))
    throw new Error(`${file}: no jobs`);
  if (hasDefaultDirectory(workflow))
    throw new Error(
      `${file}: a default working-directory, which this guard cannot follow`,
    );
  return Object.entries(workflow.jobs).flatMap(([jobName, job]) => {
    if (!isRecord(job)) throw new Error(`${file} / ${jobName}: not a job`);
    if (hasDefaultDirectory(job))
      throw new Error(
        `${file} / ${jobName}: a default working-directory, which this guard cannot follow`,
      );
    const steps = job.steps ?? [];
    if (!Array.isArray(steps))
      throw new Error(`${file} / ${jobName}: steps is not a list`);
    return steps.flatMap((raw: unknown) => {
      if (!isRecord(raw)) throw new Error(`${file} / ${jobName}: not a step`);
      const name = typeof raw.name === 'string' ? raw.name : undefined;
      const uses = typeof raw.uses === 'string' ? raw.uses : undefined;
      const run = runOf({ name, uses, run: raw.run });
      const lines = run
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => !line.startsWith('#'))
        .filter((line) => wordsOf(line).some(isWranglerWord));
      const callsWrangler = lines.length > 0 || /wrangler/.test(uses ?? '');
      if (!callsWrangler) return [];
      if (name === undefined)
        throw new Error(`${file} / ${jobName}: an unnamed step calls wrangler`);
      const step = `${file} / ${jobName} / ${name}`;
      if (uses !== undefined)
        throw new Error(
          `${step}: uses ${uses}, which this guard cannot follow`,
        );
      const from = fromOf(step, raw['working-directory']);
      return lines.map((line) => callOf(step, from, line));
    });
  });
}

/** Every wrangler call in every workflow under `root`, found on disk. */
export function wranglerCalls(root: string): WranglerCall[] {
  const directory = join(root, '.github', 'workflows');
  return readdirSync(directory)
    .filter((file) => /\.ya?ml$/.test(file))
    .sort()
    .flatMap((file) =>
      wranglerCallsIn(file, readFileSync(join(directory, file), 'utf8')),
    );
}

/** Every workspace package's root under `root`, from package.json's `workspaces`. */
export function packageRoots(root: string): string[] {
  const manifest: unknown = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8'),
  );
  if (!isRecord(manifest) || !Array.isArray(manifest.workspaces))
    throw new Error('package.json: no workspaces list');
  return manifest.workspaces
    .flatMap((pattern: unknown) => {
      if (typeof pattern !== 'string' || !/^[\w-]+\/\*$/.test(pattern))
        throw new Error(
          `package.json: a workspace pattern this guard cannot follow: ${String(pattern)}`,
        );
      const parent = pattern.slice(0, -2);
      return readdirSync(join(root, parent), { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() &&
            existsSync(join(root, parent, entry.name, 'package.json')),
        )
        .map((entry) => `${parent}/${entry.name}`);
    })
    .sort();
}

/**
 * Where npm starts a call: the repository root or a package root. Refuses by
 * step a directory below a package root, or outside every package.
 */
export function startingPoint(
  call: Pick<WranglerCall, 'step' | 'from'>,
  roots: readonly string[],
): string {
  const { step, from } = call;
  if (from === '.') return 'the repository root';
  if (roots.includes(from)) return `the package root ${from}`;
  const owner = roots.find((root) => from.startsWith(`${root}/`));
  if (owner !== undefined)
    throw new Error(
      `${step}: ${from} is a subfolder of the package ${owner}: npm runs npx at the package root, so wrangler reads ${owner}'s config, not ${from}'s (deploy-dev run 38889757344)`,
    );
  throw new Error(
    `${step}: ${from} is neither the repository root nor a package root: npm runs npx at the nearest folder holding a package.json`,
  );
}

/** A read, as one line from the repository root, for an exact comparison. */
export function describeRead(root: string, read: ConfigRead): string {
  const base = resolve(root);
  const from = (path: string): string => relative(base, path);
  if (read.missing !== undefined) return `${from(read.missing)} (not on disk)`;
  if (read.configPath === undefined || read.name === undefined)
    throw new Error(`a read in ${read.cwd} names no config or no Worker`);
  const assets = read.assets == null ? 'none' : from(read.assets);
  return `${from(read.configPath)}: ${read.name}, assets ${assets}`;
}

/** The read a call means, in describeRead's words. */
export function describeMeant(root: string, meant: MeantConfig): string {
  const configPath = resolve(root, meant.config);
  if (meant.writtenFrom !== undefined)
    return describeRead(root, { cwd: root, missing: configPath });
  return describeRead(root, {
    cwd: root,
    configPath,
    name: readDeployConfig(configPath).name,
    assets: assetsOf(root, meant),
  });
}

/**
 * The assets (or Pages output) directory a tracked config means, absolute;
 * null for none. wrangler reads `assets.directory` from the config's folder.
 */
export function assetsOf(root: string, meant: MeantConfig): string | null {
  const configPath = resolve(root, meant.config);
  return assetsIn(configPath, readDeployConfig(configPath));
}

/**
 * The assets (or Pages output) directory of a config wrangler read from
 * `configPath`, absolute; null for none. One home for the meant side and the
 * integration probe's read side.
 */
export function assetsIn(
  configPath: string,
  config: { assets?: unknown; pages_build_output_dir?: unknown },
): string | null {
  const directory = isRecord(config.assets)
    ? config.assets.directory
    : undefined;
  if (typeof directory === 'string')
    return resolve(dirname(configPath), directory);
  return typeof config.pages_build_output_dir === 'string'
    ? config.pages_build_output_dir
    : null;
}

/** Colour codes, built from the escape character so no source holds one. */
const COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** The assets directory a `wrangler deploy --dry-run` reports, read or missing. */
export function assetsReported(output: string): string | undefined {
  const plain = output.replace(COLOUR, '');
  return (
    /Read \d+ files? from the assets directory (\S+)/.exec(plain)?.[1] ??
    /"assets\.directory" field in your configuration file does not exist:\s*\n\s*(\S+)/.exec(
      plain,
    )?.[1]
  );
}
