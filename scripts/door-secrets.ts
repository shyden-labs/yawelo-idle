/**
 * Writes the front door's secrets file (#784).
 *
 *     ORIGIN_DOMAIN=… DEV_DOOR_SECRET=… TEST_DOOR_SECRET=… \
 *       node scripts/door-secrets.ts <path>
 *
 * deploy-door.yml then runs `wrangler deploy --secrets-file <path>`, which
 * uploads them with the door itself (apps/door/worker/door.ts reads them).
 * Each is kept in one place, a `production` environment secret (SOURCES).
 */
import { writeSecretsFileFrom } from './secrets-file.ts';

/** Each door Worker secret, and the `production` environment secret it comes from. */
const SOURCES = {
  ORIGIN_DOMAIN: 'DOOR_ORIGIN_DOMAIN',
  DEV_DOOR_SECRET: 'DEV_DOOR_SECRET',
  TEST_DOOR_SECRET: 'TEST_DOOR_SECRET',
} as const;

export function writeDoorSecretsFile(
  path: string,
  values: Partial<Record<keyof typeof SOURCES, string>>,
): void {
  writeSecretsFileFrom(SOURCES, path, values);
}

if (import.meta.main) {
  const path = process.argv[2];
  if (path === undefined || path === '')
    throw new Error('usage: node scripts/door-secrets.ts <path>');
  writeDoorSecretsFile(path, {
    ORIGIN_DOMAIN: process.env['ORIGIN_DOMAIN'],
    DEV_DOOR_SECRET: process.env['DEV_DOOR_SECRET'],
    TEST_DOOR_SECRET: process.env['TEST_DOOR_SECRET'],
  });
  console.log(`✓ wrote the door's secrets to ${path}`);
}
