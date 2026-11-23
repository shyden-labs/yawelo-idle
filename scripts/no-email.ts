/**
 * Fails when a built page shows an email address or a mailto: link (#1090;
 * Shyden, 2026-11-23, every project: support requests come only through the
 * support request form). It reads every built page whole, attributes
 * included, and fails when a page it expects is missing, so a page that
 * stopped building cannot pass unread. Pages are the `.html` files: an image
 * name such as `logo@2x.png` in a stylesheet would read as an address.
 *
 *     node scripts/no-email.ts
 */
import { fileURLToPath } from 'node:url';
import { byCodeUnit } from '../packages/core/src/order.ts';
import { readBuild } from './free-hosts.ts';

const HOLDING_PAGES = [
  '404.html',
  'id/404.html',
  'id/index.html',
  'index.html',
];

/**
 * Every built folder the check reads, with the pages each must hold, written
 * out rather than read from the folder (the global rule on test lists).
 */
export const BUILDS: Readonly<Record<string, readonly string[]>> = {
  'apps/site/dist': [
    '404.html',
    'api/docs.html',
    'api/private/docs.html',
    'id/404.html',
    'id/index.html',
    'id/privacy.html',
    'id/roadmap.html',
    'id/support.html',
    'id/support/ticket.html',
    'index.html',
    'privacy.html',
    'roadmap.html',
    'support.html',
    'support/ticket.html',
  ],
  'apps/site/dist-holding': HOLDING_PAGES,
  'apps/site/dist-holding-dev': HOLDING_PAGES,
  'apps/web/dist': ['play/index.html'],
};

/** The address pattern #1090 names, and the mailto: scheme. */
const SHOWN = /mailto:|[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/gi;

/**
 * One problem per distinct address in each page, and one per expected page
 * the build lacks, sorted by path.
 */
export function emailProblems(
  files: Readonly<Record<string, string>>,
  expected: readonly string[],
): string[] {
  const pages = Object.keys(files)
    .filter((path) => path.endsWith('.html'))
    .sort(byCodeUnit);
  if (pages.length === 0 && expected.length === 0)
    return ['no built pages to check'];
  const missing = expected
    .filter((path) => !(path in files))
    .map((path) => `${path}: missing from the build`);
  const shown = pages.flatMap((path) => {
    const found = new Set(
      [...(files[path] ?? '').matchAll(SHOWN)].map((m) => m[0]),
    );
    return [...found].map((address) => `${path}: shows ${address}`);
  });
  return [...missing, ...shown];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = Object.entries(BUILDS).flatMap(([folder, expected]) =>
    emailProblems(readBuild(folder), expected).map((p) => `${folder}/${p}`),
  );
  for (const p of problems) console.error(p);
  if (problems.length > 0) process.exit(1);
  console.log(
    `no-email: no address or mailto: in ${Object.keys(BUILDS).join(', ')}`,
  );
}
