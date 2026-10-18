/**
 * Makes the holding page's dev copy (#621 AC8; Shyden, 2026-10-16: "A dev
 * copy"): the production build in apps/site/dist-holding, copied to
 * apps/site/dist-holding-dev with dev's blocking robots file and noindex on
 * every response, so Shyden can check it on his phones before a release and
 * no search engine lists it. deploy-dev.yml runs it after the holding build.
 *
 *     node scripts/holding-dev.ts
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { BLOCKING_ROBOTS_TXT, NO_INDEX } from '@yawelo-idle/lockdown';
import { headerRules } from './headers-file.ts';

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
  console.log(
    '✓ apps/site/dist-holding-dev: crawlers blocked, every response noindex',
  );
}
