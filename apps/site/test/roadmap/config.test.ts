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

/**
 * The private docs page (#589) is a prerendered file in ./dist, kept off the
 * public host by the Worker alone. A site config that let the asset router
 * answer ./dist without running the Worker first would serve it to anyone,
 * so each config serving ./dist runs the Worker first on every path.
 */
it('runs the deployed Worker before any asset, so private pages stay private', () => {
  expect(config('wrangler.jsonc').assets).toMatchObject({
    directory: './dist',
    run_worker_first: true,
  });
});

it('runs the tested Worker before any asset, as the deployed one does', () => {
  expect(config('wrangler.roadmap-test.jsonc').assets).toMatchObject({
    directory: './dist',
    run_worker_first: true,
  });
});

/**
 * The roadmap reads on visit, not on a timer (Shyden, 2026-11-22, #1074): no
 * schedule costs anything while nobody visits. The tested config is held
 * equal to this one above, so it has none either.
 */
it('runs nothing on a schedule (#1074)', () => {
  expect(config('wrangler.jsonc')).not.toHaveProperty('triggers');
});
