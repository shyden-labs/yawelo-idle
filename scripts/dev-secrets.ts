/**
 * Writes the dev site Worker's secrets file (#357, #341) and prints its path.
 *
 *     ROADMAP_WEBHOOK_SECRET=… ROADMAP_APP_KEY=… DEV_DOOR_SECRET=… \
 *       node scripts/dev-secrets.ts
 *
 * The deploy then runs `wrangler deploy --secrets-file <path>`, which uploads
 * them with the Worker version itself. Each is kept in one place, a `dev`
 * environment secret (SOURCES); nobody types one into Cloudflare, and a
 * Worker created under a new name gets them on its first deploy. The file's
 * rules are scripts/secrets-file.ts's.
 */
import { writeSecretsFileFrom } from './secrets-file.ts';

/** Each Worker secret, and the `dev` environment secret it comes from. */
const SOURCES = {
  ROADMAP_WEBHOOK_SECRET: 'ROADMAP_WEBHOOK_SECRET',
  ROADMAP_APP_KEY: 'ROADMAP_APP_KEY',
  // The site refuses a request its door did not send without it (#784, #1078).
  DOOR_SECRET: 'DEV_DOOR_SECRET',
} as const;

export function writeSecretsFile(
  values: Partial<Record<keyof typeof SOURCES, string>>,
): string {
  return writeSecretsFileFrom('dev-secrets', SOURCES, values);
}

if (import.meta.main) {
  console.log(
    writeSecretsFile({
      ROADMAP_WEBHOOK_SECRET: process.env['ROADMAP_WEBHOOK_SECRET'],
      ROADMAP_APP_KEY: process.env['ROADMAP_APP_KEY'],
      DOOR_SECRET: process.env['DEV_DOOR_SECRET'],
    }),
  );
}
