/**
 * The rehearsal the coverage record measures with (#771 AC4). The record's
 * rehearse job (rehearse.ts) leaves `rehearsal/manifest.json`, and its
 * coverage job lays it over the tree and runs `coverage.ts measure
 * rehearsal/`. Given that folder, Measure refuses a manifest that is
 * missing, unreadable, from another commit or another act, or whose
 * population disagrees with its list or falls below the floor. A pull
 * request's coverage job names no folder and is asked nothing.
 */
import { posix } from 'node:path';
import { ACT, floorProblem, MANIFEST_NAME } from './rehearse.ts';

/** Why the rehearsal in `dir` cannot be measured with at `head`, or nothing. */
export function rehearsalRefusal(
  dir: string | undefined,
  read: (path: string) => string | undefined,
  head: string,
): string | undefined {
  if (dir === undefined) return undefined;
  const path = posix.join(dir, MANIFEST_NAME);
  const text = read(path);
  if (text === undefined)
    return `no rehearsal manifest at ${path}: the record’s rehearse job writes it (#771).`;
  // As JSON may hold it: any field missing, null or of another type.
  let manifest: {
    commit?: unknown;
    act?: unknown;
    population?: { of?: unknown } | null;
    workflows?: unknown;
  } | null;
  try {
    manifest = JSON.parse(text) as typeof manifest;
  } catch {
    manifest = null;
  }
  if (
    typeof manifest?.commit !== 'string' ||
    typeof manifest.act !== 'string' ||
    typeof manifest.population?.of !== 'number' ||
    typeof manifest.workflows !== 'object' ||
    manifest.workflows === null
  )
    return `${path} is not a rehearsal manifest (#771).`;
  if (manifest.commit !== head)
    return `the rehearsal ran at ${manifest.commit}, not ${head} (#771).`;
  if (manifest.act !== ACT.version)
    return `the rehearsal ran act ${manifest.act}, not ${ACT.version} (#771).`;
  const listed = Object.keys(manifest.workflows).length;
  if (manifest.population.of !== listed)
    return `the rehearsal counted ${String(manifest.population.of)} workflow files but lists ${String(listed)} (#771).`;
  return floorProblem(manifest.population.of);
}

/**
 * Measure's one call: `stop` (the CLI's own exit) with the refusal, or
 * nothing. So the CLI gains no branch of its own to leave untested.
 */
export function checkRehearsal(
  dir: string | undefined,
  read: (path: string) => string | undefined,
  head: string,
  stop: (message: string) => never,
): void {
  const refused = rehearsalRefusal(dir, read, head);
  if (refused !== undefined) stop(refused);
}
