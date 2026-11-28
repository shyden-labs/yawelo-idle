/**
 * The holding page's dev copy's secrets file (#1078 AC3): the deploy uploads
 * its door secret from the `dev` environment secret with the Worker itself
 * (`wrangler deploy --secrets-file`), so no person types it into Cloudflare.
 * With it the Worker refuses any request its door did not send. Prints the
 * file's path.
 *
 *   node scripts/holding-secrets.ts
 */
import { writeSecretsFileFrom } from './secrets-file.ts';

/** The Worker secret, and the `dev` environment secret it comes from. */
const SOURCES = { DOOR_SECRET: 'DEV_DOOR_SECRET' } as const;

export function writeSecretsFile(
  values: Partial<Record<keyof typeof SOURCES, string>>,
): string {
  return writeSecretsFileFrom('holding-secrets', SOURCES, values);
}

if (import.meta.main) {
  console.log(
    writeSecretsFile({ DOOR_SECRET: process.env['DEV_DOOR_SECRET'] }),
  );
}
