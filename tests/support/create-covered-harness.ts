/**
 * The Worker suites' `createTestHarness`: wrangler's, counting each Worker
 * when WORKER_COVERAGE_DIR is set (#1093, tests/support/covered-harness.ts).
 * Kept apart from that module so its unit tests never load wrangler.
 */
import { createTestHarness as wranglerHarness } from 'wrangler';
import { coveredHarness } from './covered-harness';

export function createTestHarness(
  options?: Parameters<typeof wranglerHarness>[0],
): ReturnType<typeof wranglerHarness> {
  return coveredHarness(options, { create: wranglerHarness });
}
