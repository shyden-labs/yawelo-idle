/**
 * Writes the dev hostname adapter's secrets file (#784) and prints its path.
 *
 *     DEV_DOOR_SECRET=… node scripts/dev-hosts-secrets.ts
 *
 * The deploy then runs `wrangler pages secret bulk <path>` in apps/dev-hosts,
 * before the Pages deploy that uses it. The secret is kept in one place, the
 * `dev` environment secret DEV_DOOR_SECRET; nobody types it into Cloudflare.
 * The file's rules are scripts/secrets-file.ts's.
 */
import { writeSecretsFileFrom } from './secrets-file.ts';

/** The Pages secret, and the `dev` environment secret it comes from. */
const SOURCES = { DEV_DOOR_SECRET: 'DEV_DOOR_SECRET' } as const;

export function writeSecretsFile(
  values: Partial<Record<keyof typeof SOURCES, string>>,
): string {
  return writeSecretsFileFrom('dev-hosts-secrets', SOURCES, values);
}

if (import.meta.main) {
  console.log(
    writeSecretsFile({ DEV_DOOR_SECRET: process.env['DEV_DOOR_SECRET'] }),
  );
}
