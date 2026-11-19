/**
 * The dev sync Worker's secrets file (#164 AC2): the deploy uploads each
 * secret from its `dev` environment secret with the Worker itself
 * (`wrangler deploy --secrets-file`), so no person types one into Cloudflare.
 * DOOR_SECRET lets the Worker believe the caller's address the door names;
 * RATE_KEY is the key request counts are hashed under. Prints the file's path.
 *
 *   node scripts/sync-secrets.ts
 */
import { writeSecretsFileFrom } from './secrets-file.ts';

/** Each Worker secret, and the `dev` environment secret it comes from. */
const SOURCES = {
  DOOR_SECRET: 'DEV_DOOR_SECRET',
  RATE_KEY: 'DEV_RATE_KEY',
} as const;

export function writeSecretsFile(
  values: Partial<Record<keyof typeof SOURCES, string>>,
): string {
  return writeSecretsFileFrom('sync-secrets', SOURCES, values);
}

if (import.meta.main) {
  console.log(
    writeSecretsFile({
      DOOR_SECRET: process.env['DEV_DOOR_SECRET'],
      RATE_KEY: process.env['DEV_RATE_KEY'],
    }),
  );
}
