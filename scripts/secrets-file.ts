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
 * owner-only and never overwritten.
 */
import { writeFileSync } from 'node:fs';

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
    path,
    JSON.stringify(
      Object.fromEntries(secrets.map((secret) => [secret, values[secret]])),
    ),
    { mode: 0o600, flag: 'wx' },
  );
}
