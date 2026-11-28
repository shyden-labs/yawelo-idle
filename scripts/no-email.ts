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

/**
 * What #1090 calls an address: a local part and a domain, each a run of
 * characters other than white space, `@`, `<`, `>`, `"` and `'`, the domain
 * ending in a label of two or more ASCII letters after a full stop; and the
 * `mailto:` scheme in any case. Scanned by hand, left to right, rather than by
 * a backtracking pattern, whose time grew with the square of a page's length
 * (#1106, Sonar S8786): each character is read a fixed number of times.
 */
const MAILTO = 'mailto:';
const STOP = /[\s@<>"']/;

const isStop = (c: string | undefined): boolean =>
  c === undefined || STOP.test(c);

const isAsciiLetter = (c: string | undefined): boolean =>
  c !== undefined && /^[a-z]$/i.test(c);

/**
 * The page being scanned, counting every character read (#1123): the test
 * judges the scan by this count, which is the same on every machine, where
 * its time is not.
 */
class Page {
  reads = 0;

  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  get length(): number {
    return this.text.length;
  }

  at(i: number): string | undefined {
    this.reads++;
    return this.text[i];
  }

  codePointAt(i: number): number | undefined {
    this.reads++;
    return this.text.codePointAt(i);
  }

  /** The last full stop at or before `from`, counting each character passed. */
  lastStop(from: number): number {
    const found = this.text.lastIndexOf('.', from);
    this.reads += from - found;
    return found;
  }
}

/** Whether `mailto:` starts at `i`, ASCII letters in either case. */
function mailtoAt(page: Page, i: number): boolean {
  for (let k = 0; k < MAILTO.length; k++) {
    const c = page.codePointAt(i + k);
    const want = MAILTO.codePointAt(k) ?? 0;
    const upper = want >= 97 && want <= 122 ? want - 32 : want;
    if (c !== want && c !== upper) return false;
  }
  return true;
}

/** The end of the run of address characters starting at `from`. */
function runEnd(page: Page, from: number): number {
  let i = from;
  while (i < page.length && !isStop(page.at(i))) i++;
  return i;
}

/**
 * Where a domain starting at `start` ends: after the letters of the last
 * full stop (past its first character) that two or more letters follow, or
 * -1 when there is none.
 */
function domainEnd(page: Page, start: number): number {
  if (isStop(page.at(start))) return -1;
  const end = runEnd(page, start + 1);
  let dot = page.lastStop(end - 1);
  while (dot > start) {
    let k = dot + 1;
    while (k < end && isAsciiLetter(page.at(k))) k++;
    if (k - dot > 2) return k;
    dot = page.lastStop(dot - 1);
  }
  return -1;
}

/**
 * From a run of address characters starting at `pos`: the address it starts
 * and where it ends, or, with none, where to look next. No address starts
 * later in the same run, as its domain would be the same; only a `mailto:`
 * inside it can still match.
 */
function scanRun(page: Page, pos: number): { address?: string; next: number } {
  const at = runEnd(page, pos);
  const end = page.at(at) === '@' ? domainEnd(page, at + 1) : -1;
  if (end !== -1) return { address: page.text.slice(pos, end), next: end };
  let next = pos + 1;
  while (next < at && !mailtoAt(page, next)) next++;
  return { next };
}

/** Every address and `mailto:` on `page`, in order, as written. */
function scan(page: Page): string[] {
  const found: string[] = [];
  let pos = 0;
  while (pos < page.length) {
    if (mailtoAt(page, pos)) {
      found.push(page.text.slice(pos, pos + MAILTO.length));
      pos += MAILTO.length;
    } else if (isStop(page.at(pos))) {
      pos++;
    } else {
      const { address, next } = scanRun(page, pos);
      if (address !== undefined) found.push(address);
      pos = next;
    }
  }
  return found;
}

/** Every address and `mailto:` in `text`, in order, as written. */
export function shownAddresses(text: string): string[] {
  return scan(new Page(text));
}

/** How many characters reading `text` takes: the scan's work, by count. */
export function readsToScan(text: string): number {
  const page = new Page(text);
  scan(page);
  return page.reads;
}

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
    const found = new Set(shownAddresses(files[path] ?? ''));
    return [...found].map((address) => `${path}: shows ${address}`);
  });
  return [...missing, ...shown];
}

/** Reads every build, prints each problem by folder, and fails if any. */
export function main(
  read: (folder: string) => Record<string, string> = readBuild,
): number {
  const problems = Object.entries(BUILDS).flatMap(([folder, expected]) =>
    emailProblems(read(folder), expected).map((p) => `${folder}/${p}`),
  );
  for (const p of problems) console.error(p);
  if (problems.length > 0) return 1;
  console.log(
    `no-email: no address or mailto: in ${Object.keys(BUILDS).join(', ')}`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = main();
