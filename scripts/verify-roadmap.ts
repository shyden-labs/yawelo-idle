/**
 * Verifies the dev roadmap's health as the deployed site Worker reports it
 * (#708), from deploy-dev's verify-roadmap job.
 *
 * `DEPLOYED_AT` is the time the deploy job stamped as its last step, after
 * the site Worker's `wrangler deploy` and every step behind it had returned:
 * a check that began in between is waited past, so the margin costs time,
 * never a false pass. The site reads the board every 10 minutes
 * (`*\/10` in apps/site/wrangler.jsonc), so this waits for the first check at
 * or after that time, then judges it as verify-dev judged the roadmap before
 * (Shyden, 2026-10-20, on #708: wait for the next reading, no new endpoint).
 */
import { required, verifyRoadmap } from './verify-dev.ts';

/**
 * 25 looks 30 s apart: a 12-minute ceiling, one 10-minute interval plus the
 * cron's start-up delay (the check due at 01:20 began at 01:20:56 on
 * 2026-10-20, deploy-dev run 39353024750), under the job's 15 minutes.
 */
const WAIT = { polls: 25, pollMs: 30_000 };

if (import.meta.main) {
  const problems = await verifyRoadmap(
    {
      webUrl: required('DEV_WEB_URL'),
      password: required('DEV_BASIC_AUTH_PASSWORD'),
    },
    Date.parse(required('DEPLOYED_AT')),
    WAIT,
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    process.exit(1);
  }
  console.log(
    '✓ the dev roadmap, read by the code this deploy put live, has read the board, missed no webhook, reads without failing and checks on time',
  );
}
