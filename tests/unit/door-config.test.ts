import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOORS } from '../../apps/door/worker/door';
import { readDeployConfig, type DeployConfig } from './wrangler-configs';

/**
 * #784 AC1(c): the front door is pinned to forwarding only. It sits in the
 * production account, on PROD's zone, so it may hold no binding, variable,
 * storage, schedule or assets: nothing it could reach or keep beyond the
 * request in hand. Its origin domain and the two door secrets come from the
 * deploy, never from this config. Configs are read the way wrangler reads
 * them, so no comment can satisfy or trip a pin.
 */
const ROOT = new URL('../..', import.meta.url).pathname;
const CONFIG = join(ROOT, 'apps/door/wrangler.jsonc');

/** Every config field that would bind, store, schedule or serve something. */
const HOLDING_FIELDS = [
  'assets',
  'vars',
  'd1_databases',
  'r2_buckets',
  'kv_namespaces',
  'services',
  'durable_objects',
  'migrations',
  'triggers',
] as const satisfies readonly (keyof DeployConfig)[];

/** Whether a config value declares anything: a string, a number, or a container holding one. */
function holds(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.some(holds);
  if (typeof value === 'object') return Object.values(value).some(holds);
  return true;
}

describe('the front door Worker’s config (#784 AC1c)', () => {
  it('is the Worker yawelo-idle-door, running worker/index.ts', () => {
    const config = readDeployConfig(CONFIG);
    expect(config.name).toBe('yawelo-idle-door');
    expect(config.main).toBe(join(ROOT, 'apps/door/worker/index.ts'));
  });

  it('holds no binding, variable, storage, schedule or assets', () => {
    const config = readDeployConfig(CONFIG);
    expect(HOLDING_FIELDS.filter((field) => holds(config[field]))).toEqual([]);
  });

  it('finds what the dev site Worker declares in those fields, so the check is alive', () => {
    const site = readDeployConfig(join(ROOT, 'apps/site/wrangler.jsonc'));
    expect(HOLDING_FIELDS.filter((field) => holds(site[field]))).toEqual([
      'assets',
      'vars',
      'services',
      'durable_objects',
      'migrations',
      'triggers',
    ]);
  });

  it('is reached only at its doors, each a Custom Domain, with no workers.dev or preview address', () => {
    const config = readDeployConfig(CONFIG);
    expect(config.routes).toEqual(
      [...DOORS.keys()].map((pattern) => ({ pattern, custom_domain: true })),
    );
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
  });
});
