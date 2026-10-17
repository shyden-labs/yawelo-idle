import { readFileSync } from 'node:fs';
import { parse } from 'jsonc-parser';
import { expect, it } from 'vitest';

/**
 * The roadmap tests run the site Worker from wrangler.roadmap-test.jsonc
 * (#341), whose `main` wraps the real Worker. Held here to the deployed
 * config but for its name and entry point, as #506 holds the sync Worker's,
 * so a binding, var, migration or cron the deploy has is one the tests have.
 */
const ROOT = new URL('../..', import.meta.url).pathname;
const config = (file: string): Record<string, unknown> =>
  parse(readFileSync(`${ROOT}${file}`, 'utf8')) as Record<string, unknown>;

it('is the deployed config but for its name and entry point', () => {
  const deployed = config('wrangler.jsonc');
  const tested = config('wrangler.roadmap-test.jsonc');
  expect(tested).toMatchObject({
    name: 'yawelo-idle-site-roadmap-test',
    main: 'test/roadmap-worker/test-worker.ts',
  });
  expect({ ...tested, name: deployed.name, main: deployed.main }).toEqual(
    deployed,
  );
});
