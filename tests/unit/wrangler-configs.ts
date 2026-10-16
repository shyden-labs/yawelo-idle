import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { unstable_readConfig } from 'wrangler';

/**
 * The dev deploy configs: four Workers (one the holding page's dev copy,
 * #621) and the Pages hostname adapter.
 * dev-config.test.ts reads these four by name; that they are every wrangler
 * config in the repo is a walk of the tree, held by the guards suite
 * (tests/guards/wrangler-configs.test.ts, #530).
 */
export const WRANGLER_CONFIGS = [
  'apps/dev-hosts/wrangler.jsonc',
  'apps/site/holding-dev/wrangler.jsonc',
  'apps/site/wrangler.jsonc',
  'apps/sync-worker/wrangler.jsonc',
  'apps/web/wrangler.jsonc',
] as const;

/**
 * The production deploy configs: today the holding page alone (#621), an
 * assets-only Worker in the production account. prod-config.test.ts reads
 * these by name; the guards suite's walk counts them with the dev four.
 */
export const PROD_WRANGLER_CONFIGS = [
  'apps/site/holding/wrangler.jsonc',
] as const;

/** Every wrangler config under `dir`, found on disk rather than listed. */
export function wranglerConfigsOnDisk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return wranglerConfigsOnDisk(path);
    return /^wrangler\.(jsonc?|toml)$/.test(entry.name) ? [path] : [];
  });
}

/**
 * The fields these guards read, declared here rather than imported: wrangler's
 * own `Config` type comes from `@cloudflare/workers-utils`, which it bundles
 * without shipping its declarations, so it does not resolve.
 */
export interface DeployConfig {
  name: string;
  main: string | undefined;
  workers_dev: unknown;
  preview_urls: unknown;
  routes: unknown;
  assets: Record<string, unknown> | undefined;
  vars: Record<string, unknown>;
  d1_databases: unknown;
  services: unknown;
  durable_objects: unknown;
  migrations: unknown;
  triggers: unknown;
  /** Pages only (#429); wrangler resolves it to an absolute path. */
  pages_build_output_dir: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function readDeployConfig(path: string): DeployConfig {
  const raw: unknown = unstable_readConfig({ config: path });
  if (!isRecord(raw)) throw new Error(`${path}: not a config object`);
  const {
    name,
    main,
    workers_dev,
    preview_urls,
    routes,
    assets,
    vars,
    d1_databases,
    services,
    durable_objects,
    migrations,
    triggers,
    pages_build_output_dir,
  } = raw;
  if (typeof name !== 'string') throw new Error(`${path}: no name`);
  if (main !== undefined && typeof main !== 'string')
    throw new Error(`${path}: main is not a path`);
  if (assets !== undefined && !isRecord(assets))
    throw new Error(`${path}: assets is not an object`);
  if (!isRecord(vars)) throw new Error(`${path}: vars is not an object`);
  return {
    name,
    main,
    workers_dev,
    preview_urls,
    routes,
    assets,
    vars,
    d1_databases,
    services,
    durable_objects,
    migrations,
    triggers,
    pages_build_output_dir,
  };
}
