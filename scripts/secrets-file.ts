/**
 * Writes a Worker's secrets file for `wrangler deploy --secrets-file`, shared
 * by the dev site's deploy (scripts/dev-secrets.ts) and the front door's
 * (scripts/door-secrets.ts). Each Worker secret comes from one GitHub
 * environment secret, named in `sources`; a missing or empty one stops the
 * deploy, naming the GitHub secret to set, before anything is written. No
 * value is ever printed.
 *
 * JSON, not .env: a value may hold quotes, `#`, `=` or newlines (the App's
 * PEM key has several), which JSON carries exactly. The file is created
 * owner-only, never overwritten, and only inside a temp directory
 * (tempPath), so a wrong argument never writes secrets into the checkout.
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';

export function writeSecretsFileFrom<Secret extends string>(
  sources: Readonly<Record<Secret, string>>,
  path: string,
  values: Partial<Record<Secret, string>>,
): void {
  const secrets = Object.keys(sources) as Secret[];
  for (const secret of secrets) {
    const value = values[secret];
    if (value === undefined || value === '')
      throw new Error(`${sources[secret]} is not set`);
  }
  writeFileSync(
    tempPath(path, process.env),
    JSON.stringify(
      Object.fromEntries(secrets.map((secret) => [secret, values[secret]])),
    ),
    { mode: 0o600, flag: 'wx' },
  );
}

/**
 * `path`, resolved, when it lies inside the system's temp directory or the
 * runner's `RUNNER_TEMP`; anything else is refused, naming the path.
 */
export function tempPath(
  path: string,
  env: Readonly<Record<string, string | undefined>>,
): string {
  const target = resolve(path);
  const bases = [tmpdir(), env['RUNNER_TEMP']]
    .filter((base): base is string => base !== undefined && base !== '')
    .map((base) => resolve(base));
  if (!bases.some((base) => target.startsWith(base + sep)))
    throw new Error(
      `refusing to write a secrets file outside the temp directory: ${path}`,
    );
  return target;
}
