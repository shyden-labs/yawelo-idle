import { readFileSync } from 'node:fs';
import { parse } from 'jsonc-parser';

/**
 * #784 AC1(a): no environment may be bound to another's D1, R2, KV or Worker.
 * A Worker Editor can deploy a binding with no permission on what it binds, so
 * the config is the only place to stop it. An environment is read from the name:
 * `-dev` (and the dev hostname adapter's `-dev-hosts`) is dev, `-test` is test,
 * anything else is production.
 */
export interface EnvironmentBindings {
  name: string;
  d1_databases?: unknown;
  r2_buckets?: unknown;
  kv_namespaces?: unknown;
  services?: unknown;
  durable_objects?: unknown;
}

function environmentOf(name: string): 'dev' | 'test' | 'production' {
  if (/-dev(-hosts)?$/.test(name)) return 'dev';
  if (name.endsWith('-test')) return 'test';
  return 'production';
}

/** Each entry of a binding list, refusing anything that is not a list of objects. */
function entries(
  worker: string,
  field: string,
  list: unknown,
): Record<string, unknown>[] {
  if (list === undefined) return [];
  if (!Array.isArray(list))
    throw new Error(`${worker}: ${field} is not a list`);
  return list as Record<string, unknown>[];
}

/** The string in `key`, or a throw naming the entry: a binding unread is unjudged. */
function required(
  worker: string,
  field: string,
  index: number,
  entry: Record<string, unknown>,
  key: string,
): string {
  const value = entry[key];
  if (typeof value !== 'string')
    throw new Error(`${worker}: ${field}[${String(index)}] has no ${key}`);
  return value;
}

/** Each binding that reaches outside the Worker's environment, as one sentence. */
export function crossEnvironmentBindings(
  config: EnvironmentBindings,
): string[] {
  const { name } = config;
  const own = environmentOf(name);
  const problems: string[] = [];
  const judge = (kind: string, target: string): void => {
    const theirs = environmentOf(target);
    if (theirs !== own)
      problems.push(`${name} (${own}): ${kind} ${target} belongs to ${theirs}`);
  };

  entries(name, 'd1_databases', config.d1_databases).forEach((entry, index) => {
    const database = required(
      name,
      'd1_databases',
      index,
      entry,
      'database_name',
    );
    judge('D1', database);
    for (const key of ['database_id', 'preview_database_id'])
      if (entry[key] !== undefined)
        problems.push(
          `${name} (${own}): D1 ${database} carries a tracked ${key}`,
        );
  });
  entries(name, 'r2_buckets', config.r2_buckets).forEach((entry, index) => {
    judge('R2', required(name, 'r2_buckets', index, entry, 'bucket_name'));
    if (typeof entry.preview_bucket_name === 'string')
      judge('R2', entry.preview_bucket_name);
  });
  for (const entry of entries(name, 'kv_namespaces', config.kv_namespaces))
    problems.push(
      `${name} (${own}): KV ${String(entry.binding)} is bound by id alone, so its environment cannot be read`,
    );
  entries(name, 'services', config.services).forEach((entry, index) => {
    judge('Worker', required(name, 'services', index, entry, 'service'));
  });
  const objects = config.durable_objects as { bindings?: unknown } | undefined;
  for (const entry of entries(
    name,
    'durable_objects.bindings',
    objects?.bindings,
  ))
    if (typeof entry.script_name === 'string')
      judge('Worker', entry.script_name);
  return problems;
}

/**
 * The named environments in a config's raw text. wrangler's reader drops them,
 * so their bindings would go unjudged, while `--env` would deploy them.
 */
export function namedEnvironments(path: string): string[] {
  const { env } = parse(readFileSync(path, 'utf8')) as {
    env?: Record<string, unknown>;
  };
  return Object.keys(env ?? {});
}

/**
 * Every top-level key a deploy config may hold: settings that bind nothing, and
 * the bindings judged above. Anything else (Queues, Hyperdrive, a kind Cloudflare
 * adds later) may reach another environment, so it fails here until it has a rule.
 */
const KNOWN_KEYS = new Set([
  '$schema',
  'assets',
  'compatibility_date',
  'd1_databases',
  'durable_objects',
  'env',
  'kv_namespaces',
  'main',
  'migrations',
  'name',
  'pages_build_output_dir',
  'preview_urls',
  'r2_buckets',
  'routes',
  'services',
  'triggers',
  'vars',
  'workers_dev',
]);

/** The config's top-level keys that this guard has no rule for. */
export function unjudgedKeys(path: string): string[] {
  const raw = parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  return Object.keys(raw).filter((key) => !KNOWN_KEYS.has(key));
}
