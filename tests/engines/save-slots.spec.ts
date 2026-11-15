import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

/**
 * The save slots over each engine's real IndexedDB (#160 AC6), through the
 * web platform's storage. The page is served at its own https origin (a
 * routed one) so the engine gives it a database, and it is reloaded between
 * steps so what is read back is what the database kept.
 */

interface SlotsGlobal {
  yaweloIdleSlots: {
    writeBuilds(from: number, to: number): Promise<Report>;
    readSlots(): Promise<Omit<Report, 'written'>>;
    spoilLatest(): Promise<string>;
  };
}

interface Report {
  written: boolean[];
  keys: string[];
  read: { kind: string; build?: string; back?: number };
}

const ORIGIN = 'https://save-slots.test/';
let bundle = '';

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents:
        "export { writeBuilds, readSlots, spoilLatest } from './save-slots-page';",
      resolveDir: 'tests/engines',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'yaweloIdleSlots',
    platform: 'browser',
    mainFields: ['module', 'main'],
    logLevel: 'error',
  });
  bundle = result.outputFiles[0]?.text ?? '';
  // Liveness: esbuild produced the global the page will call.
  expect(bundle).toContain('yaweloIdleSlots');
});

test('the latest save and 5 backups are kept, survive a reload, and a damaged latest falls back', async ({
  page,
  browserName,
}) => {
  await page.route(ORIGIN, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>save slots</title>',
    }),
  );
  const open = async () => {
    await page.goto(ORIGIN);
    await page.addScriptTag({ content: bundle });
  };
  await open();
  const written = await page.evaluate(() =>
    (globalThis as unknown as SlotsGlobal).yaweloIdleSlots.writeBuilds(1, 7),
  );
  expect
    .soft(written.written, `${browserName}: each write`)
    .toEqual(Array<boolean>(7).fill(true));
  expect.soft(written.keys, `${browserName}: slots kept`).toHaveLength(6);
  expect
    .soft(written.read)
    .toEqual({ kind: 'loaded', build: 'build-7', back: 0 });

  await open();
  const kept = await page.evaluate(() =>
    (globalThis as unknown as SlotsGlobal).yaweloIdleSlots.readSlots(),
  );
  expect
    .soft(kept.keys, `${browserName}: after a reload`)
    .toEqual(written.keys);
  expect.soft(kept.read).toEqual({ kind: 'loaded', build: 'build-7', back: 0 });

  await page.evaluate(() =>
    (globalThis as unknown as SlotsGlobal).yaweloIdleSlots.spoilLatest(),
  );
  await open();
  const fallen = await page.evaluate(() =>
    (globalThis as unknown as SlotsGlobal).yaweloIdleSlots.readSlots(),
  );
  expect.soft(fallen.read, `${browserName}: a damaged latest`).toEqual({
    kind: 'loaded',
    build: 'build-6',
    back: 1,
  });
});
