/**
 * Names the production Worker version tagged with a commit, for a rollback
 * (#621 AC6). deploy-prod.yml tags every deploy with its commit
 * (`wrangler deploy --tag <sha>`); `wrangler versions list --json` reports
 * that tag as `annotations["workers/tag"]` (wrangler 4.148's own source).
 *
 *     node scripts/prod-version.ts versions.json <sha>
 *
 * Prints the one matching version id. No match, two matches, or a listing it
 * cannot read stops the rollback with the reason: it never guesses.
 */
import { readFileSync } from 'node:fs';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function versionFor(listing: unknown, sha: string): string {
  if (!/^[0-9a-f]{40}$/.test(sha))
    throw new Error(`${sha} is not a full commit SHA`);
  if (!Array.isArray(listing))
    throw new Error('the listing is not a list of versions');
  const versions = listing.map((each: unknown) => {
    if (!isRecord(each) || typeof each['id'] !== 'string')
      throw new Error('a version has no id');
    const annotations = each['annotations'];
    const tag = isRecord(annotations) ? annotations['workers/tag'] : undefined;
    return { id: each['id'], tag: typeof tag === 'string' ? tag : undefined };
  });
  const matches = versions.filter(({ tag }) => tag === sha);
  const [only] = matches;
  if (only === undefined)
    throw new Error(
      `no version is tagged ${sha}; tags seen: ${versions.map(({ tag }) => tag ?? '(none)').join(', ')}`,
    );
  if (matches.length > 1)
    throw new Error(
      `${String(matches.length)} versions are tagged ${sha}: ${matches.map(({ id }) => id).join(', ')}`,
    );
  return only.id;
}

if (import.meta.main) {
  const [file, sha] = process.argv.slice(2);
  if (file === undefined || sha === undefined)
    throw new Error(
      'usage: node scripts/prod-version.ts <versions.json> <sha>',
    );
  console.log(
    versionFor(JSON.parse(readFileSync(file, 'utf8')) as unknown, sha),
  );
}
