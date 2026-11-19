import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSecretsFile } from '../../scripts/sync-secrets';

/**
 * The dev sync Worker's secrets file (#164 AC2): the deploy uploads each
 * secret from its `dev` environment secret with the Worker itself
 * (`wrangler deploy --secrets-file`), so no person types one into
 * Cloudflare. A missing one stops the deploy, naming the GitHub secret to set.
 */

const VALUES = {
  DOOR_SECRET: 'Zm9vYmFyYmF6cXV4+/=',
  RATE_KEY: '0f1e2d3c4b5a69788796a5b4c3d2e1f0 "quoted"\\',
};
/** Each Worker secret, beside the dev environment secret it comes from. */
const SOURCES = [
  // The sync Worker believes the address the door names only with it.
  ['DOOR_SECRET', 'DEV_DOOR_SECRET'],
  // The key request counts are hashed under.
  ['RATE_KEY', 'DEV_RATE_KEY'],
] as const;
const syncDirectories = () =>
  readdirSync(tmpdir()).filter((entry) => entry.startsWith('sync-secrets-'));

describe('the sync Worker’s writeSecretsFile (#164 AC2)', () => {
  it('writes the two secrets, exactly, in JSON, and returns where', () => {
    const path = writeSecretsFile(VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it('writes into a directory named for the sync Worker', () => {
    expect(basename(dirname(writeSecretsFile(VALUES)))).toMatch(
      /^sync-secrets-/,
    );
  });

  it.each(SOURCES)(
    'refuses a missing %s, naming %s, and writes nothing',
    (secret, source) => {
      const before = syncDirectories();
      expect(() =>
        writeSecretsFile({ ...VALUES, [secret]: undefined }),
      ).toThrow(`${source} is not set`);
      expect(syncDirectories()).toStrictEqual(before);
    },
  );

  it.each(SOURCES)(
    'refuses an empty %s, naming %s, and writes nothing',
    (secret, source) => {
      const before = syncDirectories();
      expect(() => writeSecretsFile({ ...VALUES, [secret]: '' })).toThrow(
        `${source} is not set`,
      );
      expect(syncDirectories()).toStrictEqual(before);
    },
  );
});
