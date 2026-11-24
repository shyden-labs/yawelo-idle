/**
 * Turns the counts the Worker suites saved (tests/support/covered-harness.ts)
 * into one lcov per config, `coverage/worker-<key>/lcov.info`, which
 * sonar-project.properties reads beside the Vitest suites' reports (#1093).
 * Each report holds one bundle's counts only, never joined with another
 * loader's map of the same files (#733).
 *
 *   node scripts/worker-coverage-report.ts   (WORKER_COVERAGE_DIR set)
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import { buildKey } from '../tests/support/covered-harness.ts';
import { WORKER_CONFIGS } from './worker-coverage-build.ts';
import { lcovFrom } from './worker-coverage.ts';

export type ReportDeps = {
  configs: readonly string[];
  /** The coverage folder, WORKER_COVERAGE_DIR. */
  dir: string;
  repo: string;
  /** Where the reports go: `<out>/worker-<key>/lcov.info`. */
  out: string;
};

export async function main({
  configs,
  dir,
  repo,
  out,
}: ReportDeps): Promise<void> {
  for (const config of configs) {
    const key = buildKey(join(repo, config), repo);
    const raw = join(dir, 'raw', key);
    const files = existsSync(raw) ? readdirSync(raw) : [];
    if (files.length === 0) {
      throw new Error(
        `no counts for ${config}: did its Worker suite run under coverage?`,
      );
    }
    const maps = files.map(
      (file) =>
        JSON.parse(readFileSync(join(raw, file), 'utf8')) as CoverageMapData,
    );
    const report = join(out, `worker-${key}`);
    mkdirSync(report, { recursive: true });
    writeFileSync(join(report, 'lcov.info'), await lcovFrom(maps, repo));
  }
}

if (import.meta.main) {
  const dir = process.env.WORKER_COVERAGE_DIR;
  if (dir === undefined) {
    throw new Error('set WORKER_COVERAGE_DIR to the coverage folder');
  }
  const repo = fileURLToPath(new URL('..', import.meta.url));
  await main({
    configs: WORKER_CONFIGS,
    dir: resolve(dir),
    repo,
    out: join(repo, 'coverage'),
  });
}
