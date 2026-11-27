import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { runOf } from './workflow-steps';

/**
 * deploy-dev's two browser jobs install Edge with the named stall the
 * browsers job uses (#1092, #1115), but restore nothing from a cache: each
 * holds the dev password, and a cache key is only a name any job in the
 * scope can write, so a restored file could run beside the secret
 * (repo-template#224's security review, 2026-11-26; global rule "CI caches
 * every download": a job holding a secret or write permission restores
 * nothing). Downloaded fresh, its time follows Microsoft's download speed:
 * 16 passing installs in deploy-dev's 8 successful develop runs to
 * 2026-11-27 took 16–123 s (run 45779937070's site-smoke fetched 221 MB at
 * 2.2 MB/s), so 3 times the slowest is 369 s: 370 s inside a 7-minute step
 * (#476, #1115 AC3).
 */

interface Step {
  name?: string;
  uses?: string;
  run?: unknown;
  shell?: string;
  'timeout-minutes'?: number;
}

const workflow = parse(
  readFileSync('.github/workflows/deploy-dev.yml', 'utf8'),
) as { jobs: Record<string, { steps?: Step[] }> };

const INSTALL = "Install Edge (Playwright's image lacks it)";

describe.each(['smoke', 'site-smoke'])(
  'the Edge install in deploy-dev job %s (#1115)',
  (job) => {
    const steps = workflow.jobs[job]?.steps ?? [];
    const install = steps.find((s) => s.name === INSTALL) ?? {};

    it('restores nothing from any cache, since the job holds the dev password', () => {
      expect(steps.filter((s) => s.uses?.startsWith('actions/cache'))).toEqual(
        [],
      );
    });

    it('pins the install command and its limits: 370 s inside, 7 minutes for the step', () => {
      expect(install['timeout-minutes']).toBe(7);
      expect(install.shell).toBe('bash');
      const run = runOf(install);
      expect(run).toContain('set -o pipefail');
      expect(run).toContain(
        'timeout --kill-after=5 370 npx --no playwright install --with-deps msedge 2>&1 | tee "$RUNNER_TEMP/edge-install.log"',
      );
    });

    it('names the download and its host when the install stalls', () => {
      const run = runOf(install);
      expect(run).toContain('if [ "$status" = 124 ]; then');
      expect(run).toContain(
        'echo "::error::Edge install stalled at 370 s; its last download was: $(grep -E \'^Get:\' "$RUNNER_TEMP/edge-install.log" | tail -n 1)"',
      );
      expect(run).toContain('exit "$status"');
    });
  },
);
