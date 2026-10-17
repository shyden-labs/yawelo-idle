import { defineConfig } from 'astro/config';
import { SITE } from './src/i18n.ts';
import { commitStamp } from './commit-stamp.ts';

/**
 * The production holding page (#621): four prerendered pages (home and 404,
 * in English at `/…` and Indonesian at `/id/…`) built from holding/ into
 * dist-holding/, which holding/wrangler.jsonc serves as assets only.
 *
 * `inlineStylesheets: 'never'` and `assetsInlineLimit: 0` keep every style and
 * file external, so the Content-Security-Policy in holding/public/_headers
 * needs no inline allowance and no `data:` source. `format: 'preserve'` writes
 * `id/404.astro` as `id/404.html`, which Cloudflare finds (see
 * astro.config.ts).
 */
export default defineConfig({
  site: SITE,
  output: 'static',
  srcDir: './holding',
  publicDir: './holding/public',
  outDir: './dist-holding',
  build: { format: 'preserve', inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [commitStamp(process.env['YAWELO_IDLE_COMMIT'])],
  i18n: {
    locales: ['en', 'id'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
});
