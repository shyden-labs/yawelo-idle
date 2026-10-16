/**
 * Run by wrangler-steps.test.ts under `npm exec`, from a workflow step's own
 * directory (#627). Prints, as one line of JSON, the config wrangler's own
 * reader finds where npm put it, given the step's config arguments
 * (`WRANGLER_STEP_ARGS`, a JSON list).
 *
 * `--env` is refused rather than passed on: no workflow uses it, and the
 * reader's argument type does not resolve from wrangler's shipped
 * declarations, so this probe could not show it reads one correctly.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { unstable_readConfig } from 'wrangler';
import { assetsIn } from '../unit/wrangler-steps.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const args: unknown = JSON.parse(process.env.WRANGLER_STEP_ARGS ?? 'null');
if (
  !Array.isArray(args) ||
  !args.every((arg): arg is string => typeof arg === 'string')
)
  throw new Error('WRANGLER_STEP_ARGS is not a JSON list of strings');

const queue = [...args];
let config: string | undefined;
for (let arg = queue.shift(); arg !== undefined; arg = queue.shift()) {
  if (arg === '--config' || arg === '-c') config = queue.shift();
  else if (arg.startsWith('--config=')) config = arg.slice('--config='.length);
  else throw new Error(`a config argument this probe cannot pass: ${arg}`);
}

const cwd = process.cwd();
if (config !== undefined && !existsSync(resolve(cwd, config))) {
  // wrangler resolves a named config against its working directory.
  console.log(JSON.stringify({ cwd, missing: resolve(cwd, config) }));
} else {
  const read: unknown = unstable_readConfig(
    config === undefined ? {} : { config },
  );
  if (!isRecord(read) || typeof read.configPath !== 'string')
    throw new Error(`${cwd}: the reader found no config`);
  // The reader returns a named config as typed, relative to its directory.
  const configPath = resolve(cwd, read.configPath);
  const { name } = read;
  console.log(
    JSON.stringify({
      cwd,
      configPath,
      name,
      assets: assetsIn(configPath, read),
    }),
  );
}
