/**
 * Makes the holding page's dev copy (#621 AC8; Shyden, 2026-10-16: "A dev
 * copy"): the production build in apps/site/dist-holding, copied to
 * apps/site/dist-holding-dev with dev's blocking robots file and noindex on
 * every response, so Shyden can check it on his phones before a release and
 * no search engine lists it. deploy-dev.yml runs it after the holding build.
 *
 *     node scripts/holding-dev.ts
 */
import {
  cpSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { BLOCKING_ROBOTS_TXT, NO_INDEX } from '@yawelo-idle/lockdown';
import { DEV_MEDIA, MEDIA_ORIGIN, PROMO } from '../apps/site/src/media.ts';
import { headerRules } from './headers-file.ts';

/**
 * `text` with every address on the media host `from` moved to `to` (#713):
 * the dev copy is on workers.dev, another site, where production's
 * same-site media policy blocks the video, so it takes the media from the
 * dev-only bucket. An origin counts only where it ends (a path, `;`, a quote,
 * a space or the end), so a longer host is left alone. Throws unless exactly
 * `expected` addresses moved, so a copy never ships still loading production's.
 */
export function devMedia(
  text: string,
  expected: number,
  label: string,
  from: string,
  to: string,
): string {
  let moved = 0;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result = text.replace(
    new RegExp(`${escaped}(?=[/;"'\\s]|$)`, 'g'),
    () => {
      moved += 1;
      return to;
    },
  );
  if (moved !== expected)
    throw new Error(
      `${label}: moved ${String(moved)} media address${moved === 1 ? '' : 'es'}, expected ${String(expected)}`,
    );
  return result;
}

/**
 * How many media addresses each file of the holding build holds: the poster
 * and both sources on each home page, and `img-src` and `media-src` in the
 * CSP. Every other file the dev copy rewrites must hold none.
 */
export const MEDIA_ADDRESSES: Readonly<Record<string, number>> = {
  'index.html': PROMO.length,
  'id/index.html': PROMO.length,
  _headers: 2,
};

/** Whether a build file is text that could name the media host: a page, script, style or `_headers`. */
export const rewritten = (path: string): boolean =>
  path === '_headers' || /\.(?:html|js|css)$/.test(path);

/**
 * Every file of `files` (path to text) with its media addresses moved from
 * `from` to `to`, each file's count checked against MEDIA_ADDRESSES. Throws
 * when a file it lists is missing, so a renamed page is never skipped.
 */
export function devMediaFiles(
  files: ReadonlyMap<string, string>,
  from: string,
  to: string,
): Map<string, string> {
  for (const path of Object.keys(MEDIA_ADDRESSES))
    if (!files.has(path))
      throw new Error(`the build has no ${path} to move media addresses in`);
  return new Map(
    [...files].map(([path, text]) => [
      path,
      devMedia(text, MEDIA_ADDRESSES[path] ?? 0, path, from, to),
    ]),
  );
}

/** Dev's robots file, from its one home (packages/lockdown). */
export const DEV_ROBOTS = BLOCKING_ROBOTS_TXT;

/** The production `_headers` with `X-Robots-Tag: noindex…` added to its every-path rule. */
export function devHeaders(text: string): string {
  const every = headerRules(text).get('/*');
  if (every === undefined)
    throw new Error('_headers has no /* rule to mark noindex');
  if (every.has('x-robots-tag'))
    throw new Error('_headers already sets X-Robots-Tag');
  const lines = text.split('\n');
  let at = lines.indexOf('/*') + 1;
  while (at < lines.length && /^\s+\S/.test(lines[at] ?? '')) at += 1;
  lines.splice(at, 0, `  X-Robots-Tag: ${NO_INDEX}`);
  return lines.join('\n');
}

if (import.meta.main) {
  const site = new URL('../apps/site/', import.meta.url);
  const from = new URL('dist-holding/', site);
  const to = new URL('dist-holding-dev/', site);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  writeFileSync(new URL('robots.txt', to), DEV_ROBOTS);
  writeFileSync(
    new URL('_headers', to),
    devHeaders(readFileSync(new URL('_headers', from), 'utf8')),
  );
  const texts = new Map(
    readdirSync(to, { recursive: true, encoding: 'utf8' })
      .filter(rewritten)
      .map((path) => [path, readFileSync(new URL(path, to), 'utf8')]),
  );
  for (const [path, text] of devMediaFiles(
    texts,
    MEDIA_ORIGIN,
    DEV_MEDIA.origin,
  ))
    writeFileSync(new URL(path, to), text);
  console.log(
    `✓ apps/site/dist-holding-dev: crawlers blocked, every response noindex, media from ${DEV_MEDIA.origin}`,
  );
}
