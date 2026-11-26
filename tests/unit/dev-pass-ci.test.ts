import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { runOf } from './workflow-steps';

/**
 * deploy-dev's two browser suites reach the site's dev door, which checks a
 * DEV pass (#1078 AC1; Shyden, 2026-11-27: "Real door later", no stand-in
 * for the door). Each job asks the shared sign-in for a machine pass with
 * Yawelo's own Cloudflare Access service token (`yawelo-idle-ci`, its
 * `yawelo-idle CI` Service Auth policy on dev-signin, 2026-11-27), masks it,
 * and hands it to the suite through the job's environment file. The pass
 * never reaches a log, a header to other hosts, or an artifact.
 */

interface Step {
  name?: string;
  run?: unknown;
  shell?: string;
  env?: Record<string, string>;
  'timeout-minutes'?: number;
}

const workflow = parse(
  readFileSync('.github/workflows/deploy-dev.yml', 'utf8'),
) as { jobs: Record<string, { steps?: Step[] }> };

const MINT = 'Get a DEV pass for the site’s dev door';

const SCRIPT = [
  'pass=$(node --input-type=module -e "',
  "  const answer = await fetch('https://dev-signin.shyden.co.uk/machine?for=dev.yaweloidle.com', {",
  "    method: 'POST',",
  '    headers: {',
  "      'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,",
  "      'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,",
  '    },',
  '    signal: AbortSignal.timeout(30000),',
  '  });',
  "  if (!answer.ok) throw new Error('the sign-in answered ' + answer.status + ' to the machine pass request');",
  '  process.stdout.write((await answer.json()).pass);',
  '")',
  'echo "::add-mask::$pass"',
  'echo "DEV_PASS=$pass" >> "$GITHUB_ENV"',
  '',
].join('\n');

describe.each([
  ['smoke', 'npm run test:web:dev'],
  ['site-smoke', 'npm run test:site:dev'],
])(
  'deploy-dev job %s gets a DEV pass before its suite (#1078 AC1)',
  (job, suite) => {
    const steps = workflow.jobs[job]?.steps ?? [];
    const mint = steps.find((s) => s.name === MINT);

    it('asks the sign-in for a machine pass to the site’s dev door with the service token, masks it, and passes it on in the job’s environment', () => {
      expect(mint?.shell).toBe('bash');
      expect(runOf(mint ?? {})).toBe(SCRIPT);
      expect(mint?.env).toEqual({
        CF_ACCESS_CLIENT_ID: '${{ secrets.CF_ACCESS_CLIENT_ID }}',
        CF_ACCESS_CLIENT_SECRET: '${{ secrets.CF_ACCESS_CLIENT_SECRET }}',
      });
      expect(mint?.['timeout-minutes']).toBe(1);
    });

    it('gets it before the suite runs', () => {
      const at = (match: (s: Step) => boolean) => steps.findIndex(match);
      expect(at((s) => s.name === MINT)).toBeGreaterThanOrEqual(0);
      expect(at((s) => s.name === MINT)).toBeLessThan(
        at((s) => runOf(s) === suite),
      );
    });
  },
);
