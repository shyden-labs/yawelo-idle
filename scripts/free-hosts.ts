/**
 * Fails when a built page loads anything from a free shared domain (#768
 * AC5): Indonesian providers block every r2.dev name (Telkomsel and Biznet,
 * measured 2026-10-20 and 2026-10-26), and the other free names could be
 * blocked the same way, so every file our pages load comes from a
 * shyden.co.uk address. It reads every built file whole, so an address in any
 * attribute, stylesheet, script, CSP entry or header file is found.
 *
 *     node scripts/free-hosts.ts <built folder>...
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FREE_HOSTS: readonly string[] = [
  'r2.dev',
  'workers.dev',
  'pages.dev',
  'github.io',
  'netlify.app',
  'vercel.app',
  'web.app',
  'firebaseapp.com',
];

const escaped = FREE_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|');
// A host on a free domain, with or without a scheme, ending where a
// hostname ends: a longer domain such as x.r2.develop.example is left alone.
const ADDRESS = new RegExp(
  `(?:https?:)?(?://)?(?:[a-z0-9-]+\\.)+(?:${escaped})(?![a-z0-9.-])`,
  'gi',
);

/** One problem per distinct free-domain address in each file, by path. */
export function freeHostProblems(
  files: Readonly<Record<string, string>>,
): string[] {
  const paths = Object.keys(files).sort();
  if (paths.length === 0) return ['no built files to check'];
  return paths.flatMap((path) => {
    const found = new Set(
      [...(files[path] ?? '').matchAll(ADDRESS)].map((m) =>
        m[0].startsWith('//') ? `https:${m[0]}` : m[0],
      ),
    );
    return [...found].map((address) => `${path}: loads from ${address}`);
  });
}

/** Every file under `folder`, read as text, keyed by its path from there. */
export function readBuild(folder: string): Record<string, string> {
  const entries = readdirSync(folder, { recursive: true, withFileTypes: true });
  return Object.fromEntries(
    entries
      .filter((e) => e.isFile())
      .map((e) => {
        const path = join(e.parentPath, e.name);
        return [relative(folder, path), readFileSync(path, 'latin1')];
      }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folders = process.argv.slice(2);
  if (folders.length === 0) {
    console.error('free-hosts: name at least one built folder');
    process.exit(1);
  }
  const problems = folders.flatMap((folder) =>
    freeHostProblems(readBuild(folder)).map((p) => `${folder}/${p}`),
  );
  for (const p of problems) console.error(p);
  if (problems.length > 0) process.exit(1);
  console.log(`free-hosts: no free shared domain in ${folders.join(', ')}`);
}
