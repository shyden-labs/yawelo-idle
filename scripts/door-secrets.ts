/**
 * Writes the front door's secrets file (#784) and prints its path.
 *
 *     ORIGIN_DOMAIN=… DEV_DOOR_SECRET=… TEST_DOOR_SECRET=… DEV_PASS_KEYS=… \
 *       node scripts/door-secrets.ts
 *
 * deploy-door.yml then runs `wrangler deploy --secrets-file <path>`, which
 * uploads them with the door itself (apps/door/worker/door.ts reads them).
 * Each is kept in one place, a `production` environment secret (SOURCES),
 * except DEV_PASS_KEYS (#1078): the sign-in's public keys, a `production`
 * environment variable, uploaded here because the door holds no variable.
 * Where the file goes is scripts/secrets-file.ts's rule.
 */
import { writeSecretsFileFrom } from './secrets-file.ts';

/** Each door Worker secret, and the `production` environment value it comes from. */
const SOURCES = {
  ORIGIN_DOMAIN: 'DOOR_ORIGIN_DOMAIN',
  DEV_DOOR_SECRET: 'DEV_DOOR_SECRET',
  TEST_DOOR_SECRET: 'TEST_DOOR_SECRET',
  DEV_PASS_KEYS: 'DEV_PASS_KEYS',
} as const;

export function writeDoorSecretsFile(
  values: Partial<Record<keyof typeof SOURCES, string>>,
): string {
  return writeSecretsFileFrom('door-secrets', SOURCES, values);
}

/** The command line: the file, from the environment; returns its path. */
export function writeDoorSecretsFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): string {
  return writeDoorSecretsFile({
    ORIGIN_DOMAIN: env['ORIGIN_DOMAIN'],
    DEV_DOOR_SECRET: env['DEV_DOOR_SECRET'],
    TEST_DOOR_SECRET: env['TEST_DOOR_SECRET'],
    DEV_PASS_KEYS: env['DEV_PASS_KEYS'],
  });
}

if (import.meta.main) {
  console.log(writeDoorSecretsFromEnv(process.env));
}
