import { readdirSync, readFileSync } from 'node:fs';
import { parse as parseJsonc } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

/**
 * Every server table comes from a migration, and the dev deploy applies every
 * migration, in order, before the Worker that reads them (#162 AC5). wrangler
 * applies the files of `migrations_dir` in name order, so the order is the
 * file names' four-digit numbers.
 */
const WORKER = 'apps/sync-worker';
const MIGRATIONS = `${WORKER}/migrations`;
const NAME = /^(\d{4})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;
const CREATE_TABLE = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi;

const sqlFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();

const tablesIn = (text: string): string[] =>
  [...text.matchAll(CREATE_TABLE)].map((m) => m[1] ?? '');

/** Every source file under the sync Worker but its migrations. */
const workerSources = (): string[] =>
  readdirSync(WORKER, { recursive: true, encoding: 'utf8' })
    .filter((p) => /\.(ts|js|mjs|sql)$/.test(p))
    .filter((p) => !p.startsWith('migrations/'))
    .filter((p) => !p.includes('node_modules'));

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly 'working-directory'?: string;
}

const deploySteps = (): Step[] => {
  const workflow = parseYaml(
    readFileSync('.github/workflows/deploy-dev.yml', 'utf8'),
  ) as { jobs: Record<string, { steps?: Step[] }> };
  const jobs = Object.values(workflow.jobs).filter((job) =>
    (job.steps ?? []).some((s) => s.run?.includes('d1 migrations apply')),
  );
  expect(jobs, 'one deploy job applies the migrations').toHaveLength(1);
  return jobs[0]?.steps ?? [];
};

describe('the sync Worker migrations (#162 AC5)', () => {
  it('are numbered from 0001 with no gap or repeat, each named NNNN_what_it_does.sql', () => {
    const files = sqlFiles();
    expect(files.length, 'at least one migration').toBeGreaterThan(0);
    expect(
      files.filter((f) => !NAME.test(f)),
      'badly named',
    ).toEqual([]);
    expect(files.map((f) => Number(NAME.exec(f)?.[1]))).toEqual(
      files.map((_, i) => i + 1),
    );
  });

  it('create each table once', () => {
    const tables = sqlFiles().flatMap((f) =>
      tablesIn(readFileSync(`${MIGRATIONS}/${f}`, 'utf8')),
    );
    expect(tables.length, 'tables created').toBeGreaterThan(0);
    expect(tables.filter((t, i) => tables.indexOf(t) !== i)).toEqual([]);
  });

  it('are the only place under the sync Worker a table is created', () => {
    expect(
      workerSources().filter(
        (p) => tablesIn(readFileSync(`${WORKER}/${p}`, 'utf8')).length > 0,
      ),
    ).toEqual([]);
  });

  it('are read from the migrations folder by the deployed config', () => {
    const config = parseJsonc(
      readFileSync(`${WORKER}/wrangler.jsonc`, 'utf8'),
    ) as { d1_databases: { binding: string; migrations_dir?: string }[] };
    expect(config.d1_databases).toEqual([
      expect.objectContaining({ binding: 'DB', migrations_dir: 'migrations' }),
    ]);
  });

  it('are applied by the dev deploy, remotely, before the sync Worker is deployed', () => {
    const steps = deploySteps();
    const apply = steps.findIndex((s) =>
      s.run?.includes('wrangler d1 migrations apply yawelo-idle-dev --remote'),
    );
    const deploy = steps.findIndex(
      (s) =>
        s['working-directory'] === WORKER &&
        /\bwrangler deploy\b/.test(s.run ?? ''),
    );
    expect
      .soft(steps[apply]?.['working-directory'], 'apply runs in')
      .toBe(WORKER);
    expect.soft(apply, 'apply step').toBeGreaterThanOrEqual(0);
    expect.soft(deploy, 'deploy step').toBeGreaterThan(apply);
  });
});
