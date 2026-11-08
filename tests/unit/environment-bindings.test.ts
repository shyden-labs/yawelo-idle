import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  crossEnvironmentBindings,
  namedEnvironments,
  unjudgedKeys,
  type EnvironmentBindings,
} from './environment-bindings';
import {
  PROD_WRANGLER_CONFIGS,
  readDeployConfig,
  WRANGLER_CONFIGS,
} from './wrangler-configs';

/**
 * #784 AC1(a): DEV and TEST will share one Cloudflare account, and a Worker
 * Editor can deploy a binding without any permission on what it binds, so no
 * environment may name another's D1, R2, KV or Worker. TEST holds testers' real
 * data, so DEV bound to TEST counts the same as DEV bound to PROD.
 */
const ROOT = new URL('../..', import.meta.url).pathname;
const FIXTURE = join(ROOT, 'tests/unit/fixtures/crossed-bindings.jsonc');

const worker = (
  name: string,
  bindings: Partial<EnvironmentBindings> = {},
): EnvironmentBindings => ({
  name,
  d1_databases: [],
  r2_buckets: [],
  kv_namespaces: [],
  services: [],
  ...bindings,
});
const d1 = (database_name: string) => ({
  d1_databases: [{ binding: 'DB', database_name }],
});
const r2 = (bucket_name: string) => ({
  r2_buckets: [{ binding: 'MEDIA', bucket_name }],
});
const service = (name: string) => ({
  services: [{ binding: 'OTHER', service: name }],
});

describe('a Worker bound to its own environment (#784 AC1a)', () => {
  it('passes a dev Worker on a dev database', () => {
    expect(crossEnvironmentBindings(worker('a-dev', d1('b-dev')))).toEqual([]);
  });
  it('passes a test Worker on a test database', () => {
    expect(crossEnvironmentBindings(worker('a-test', d1('b-test')))).toEqual(
      [],
    );
  });
  it('passes a production Worker on a production database', () => {
    expect(crossEnvironmentBindings(worker('a', d1('b')))).toEqual([]);
  });
  it('passes a dev Worker on a dev bucket', () => {
    expect(crossEnvironmentBindings(worker('a-dev', r2('b-dev')))).toEqual([]);
  });
  it('passes a dev Worker calling a dev Worker', () => {
    expect(crossEnvironmentBindings(worker('a-dev', service('b-dev')))).toEqual(
      [],
    );
  });
  it('reads the dev hostname adapter as dev', () => {
    expect(
      crossEnvironmentBindings(worker('a-dev-hosts', service('b-dev'))),
    ).toEqual([]);
  });
});

describe('a Worker bound to another environment (#784 AC1a)', () => {
  it('refuses dev on a test database, naming both', () => {
    expect(crossEnvironmentBindings(worker('a-dev', d1('b-test')))).toEqual([
      'a-dev (dev): D1 b-test belongs to test',
    ]);
  });
  it('refuses dev on a production database', () => {
    expect(crossEnvironmentBindings(worker('a-dev', d1('b')))).toEqual([
      'a-dev (dev): D1 b belongs to production',
    ]);
  });
  it('refuses test on a dev database', () => {
    expect(crossEnvironmentBindings(worker('a-test', d1('b-dev')))).toEqual([
      'a-test (test): D1 b-dev belongs to dev',
    ]);
  });
  it('refuses test on a production database', () => {
    expect(crossEnvironmentBindings(worker('a-test', d1('b')))).toEqual([
      'a-test (test): D1 b belongs to production',
    ]);
  });
  it('refuses production on a dev database', () => {
    expect(crossEnvironmentBindings(worker('a', d1('b-dev')))).toEqual([
      'a (production): D1 b-dev belongs to dev',
    ]);
  });
  it('refuses production on a test database', () => {
    expect(crossEnvironmentBindings(worker('a', d1('b-test')))).toEqual([
      'a (production): D1 b-test belongs to test',
    ]);
  });
  it('reads a name with -dev in its middle as production', () => {
    expect(crossEnvironmentBindings(worker('a-dev', d1('b-dev-copy')))).toEqual(
      ['a-dev (dev): D1 b-dev-copy belongs to production'],
    );
  });
  it('refuses dev on a test bucket', () => {
    expect(crossEnvironmentBindings(worker('a-dev', r2('b-test')))).toEqual([
      'a-dev (dev): R2 b-test belongs to test',
    ]);
  });
  it('refuses a preview bucket from another environment', () => {
    expect(
      crossEnvironmentBindings(
        worker('a-dev', {
          r2_buckets: [
            {
              binding: 'MEDIA',
              bucket_name: 'b-dev',
              preview_bucket_name: 'b',
            },
          ],
        }),
      ),
    ).toEqual(['a-dev (dev): R2 b belongs to production']);
  });
  it('refuses dev calling a production Worker', () => {
    expect(crossEnvironmentBindings(worker('a-dev', service('b')))).toEqual([
      'a-dev (dev): Worker b belongs to production',
    ]);
  });
  it('refuses the dev hostname adapter calling a test Worker', () => {
    expect(
      crossEnvironmentBindings(worker('a-dev-hosts', service('b-test'))),
    ).toEqual(['a-dev-hosts (dev): Worker b-test belongs to test']);
  });
  it('reports every crossed binding, not only the first', () => {
    expect(
      crossEnvironmentBindings(
        worker('a-dev', { ...d1('b-test'), ...r2('c') }),
      ),
    ).toEqual([
      'a-dev (dev): D1 b-test belongs to test',
      'a-dev (dev): R2 c belongs to production',
    ]);
  });
});

describe('a Durable Object hosted by another Worker (#784 AC1a)', () => {
  const object = (script_name?: string) => ({
    durable_objects: {
      bindings: [{ name: 'ROOM', class_name: 'Room', script_name }],
    },
  });
  it('passes one hosted in its own environment', () => {
    expect(crossEnvironmentBindings(worker('a-dev', object('b-dev')))).toEqual(
      [],
    );
  });
  it('passes one hosted by the Worker itself', () => {
    expect(crossEnvironmentBindings(worker('a-dev', object()))).toEqual([]);
  });
  it('refuses one hosted in another environment', () => {
    expect(crossEnvironmentBindings(worker('a-dev', object('b')))).toEqual([
      'a-dev (dev): Worker b belongs to production',
    ]);
  });
  it('throws on a Durable Object list that is not a list', () => {
    expect(() =>
      crossEnvironmentBindings(
        worker('a-dev', { durable_objects: { bindings: {} } }),
      ),
    ).toThrow('a-dev: durable_objects.bindings is not a list');
  });
});

describe('what the name cannot prove (#784 AC1a)', () => {
  it('refuses a tracked database id, which could be any environment’s', () => {
    expect(
      crossEnvironmentBindings(
        worker('a-dev', {
          d1_databases: [
            { binding: 'DB', database_name: 'b-dev', database_id: '1' },
          ],
        }),
      ),
    ).toEqual(['a-dev (dev): D1 b-dev carries a tracked database_id']);
  });
  it('refuses a tracked preview database id', () => {
    expect(
      crossEnvironmentBindings(
        worker('a-dev', {
          d1_databases: [
            { binding: 'DB', database_name: 'b-dev', preview_database_id: '1' },
          ],
        }),
      ),
    ).toEqual(['a-dev (dev): D1 b-dev carries a tracked preview_database_id']);
  });
  it('refuses any KV namespace, since its config holds only an id', () => {
    expect(
      crossEnvironmentBindings(
        worker('a-dev', { kv_namespaces: [{ binding: 'CACHE', id: '1' }] }),
      ),
    ).toEqual([
      'a-dev (dev): KV CACHE is bound by id alone, so its environment cannot be read',
    ]);
  });
  it('throws on a D1 entry with no name', () => {
    expect(() =>
      crossEnvironmentBindings(
        worker('a-dev', { d1_databases: [{ binding: 'DB' }] }),
      ),
    ).toThrow('a-dev: d1_databases[0] has no database_name');
  });
  it('throws on an R2 entry with no name', () => {
    expect(() =>
      crossEnvironmentBindings(
        worker('a-dev', { r2_buckets: [{ binding: 'MEDIA' }] }),
      ),
    ).toThrow('a-dev: r2_buckets[0] has no bucket_name');
  });
  it('throws on a service entry with no Worker name', () => {
    expect(() =>
      crossEnvironmentBindings(
        worker('a-dev', { services: [{ binding: 'OTHER' }] }),
      ),
    ).toThrow('a-dev: services[0] has no service');
  });
  it('throws on a binding list that is not a list', () => {
    expect(() =>
      crossEnvironmentBindings(worker('a-dev', { r2_buckets: {} })),
    ).toThrow('a-dev: r2_buckets is not a list');
  });
  it('reads no binding list as empty, as wrangler reads it', () => {
    expect(
      crossEnvironmentBindings(worker('a-dev', { services: undefined })),
    ).toEqual([]);
  });
});

describe('the configs as wrangler reads them (#784 AC1a)', () => {
  it('judges D1, R2 and KV through the real reader', () => {
    expect(crossEnvironmentBindings(readDeployConfig(FIXTURE))).toEqual([
      'yawelo-idle-fixture-dev (dev): D1 yawelo-idle-test belongs to test',
      'yawelo-idle-fixture-dev (dev): R2 yawelo-idle-media belongs to production',
      'yawelo-idle-fixture-dev (dev): KV CACHE is bound by id alone, so its environment cannot be read',
    ]);
  });
  it('names a config key the guard has no rule for', () => {
    expect(unjudgedKeys(FIXTURE)).toEqual(['hyperdrive']);
  });
  it('finds a named environment, which the reader drops', () => {
    expect(namedEnvironments(FIXTURE)).toEqual(['production']);
  });
});

describe('every deploy config in the repo (#784 AC1a)', () => {
  for (const file of [...WRANGLER_CONFIGS, ...PROD_WRANGLER_CONFIGS]) {
    it(`${file} crosses no environment`, () => {
      expect(
        crossEnvironmentBindings(readDeployConfig(join(ROOT, file))),
      ).toEqual([]);
    });
    it(`${file} has only config keys the guard has a rule for`, () => {
      expect(unjudgedKeys(join(ROOT, file))).toEqual([]);
    });
    it(`${file} has no named environment, whose bindings would go unjudged`, () => {
      expect(namedEnvironments(join(ROOT, file))).toEqual([]);
    });
  }
});
