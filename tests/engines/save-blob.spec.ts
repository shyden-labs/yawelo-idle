import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { blobHex, readsBack } from '../../packages/save/test/blob-digest';

/**
 * A save's stored bytes are the same in every engine (#159 AC5): the blob of
 * one played game is written in each browser, bundled exactly as a shipped
 * build would bundle @yawelo-idle/save, and compared byte for byte with the
 * one Node writes, and each engine reads its own back.
 */

interface BlobGlobal {
  yaweloIdleBlob: { blobHex(): string; readsBack(): boolean };
}

let bundle = '';

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: "export { blobHex, readsBack } from './blob-digest';",
      resolveDir: 'packages/save/test',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'yaweloIdleBlob',
    platform: 'browser',
    mainFields: ['module', 'main'],
    logLevel: 'error',
  });
  bundle = result.outputFiles[0]?.text ?? '';
  // Liveness: esbuild produced the global the page will call.
  expect(bundle).toContain('yaweloIdleBlob');
});

test('a save blob is the bytes Node writes, and reads back', async ({
  page,
  browserName,
}) => {
  await page.setContent('<!doctype html><title>save blob</title>');
  await page.addScriptTag({ content: bundle });
  const engine = await page.evaluate(() => {
    const blob = (globalThis as unknown as BlobGlobal).yaweloIdleBlob;
    return { hex: blob.blobHex(), readsBack: blob.readsBack() };
  });
  const node = blobHex();
  expect.soft(node.length, 'Node wrote a blob').toBeGreaterThan(80);
  expect.soft(engine.hex, `${browserName}: the blob`).toBe(node);
  expect.soft(engine.readsBack, `${browserName}: reads back`).toBe(true);
  expect.soft(readsBack(), 'Node reads back').toBe(true);
});
