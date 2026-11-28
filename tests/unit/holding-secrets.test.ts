import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSecretsFile } from '../../scripts/holding-secrets';

/**
 * The holding page's dev copy's secrets file (#1078 AC3): once it refuses a
 * request without its door secret, the deploy uploads that secret from the
 * `dev` environment with the Worker itself (`wrangler deploy
 * --secrets-file`), so no person types it into Cloudflare. A missing one
 * stops the deploy, naming the GitHub secret to set.
 */

const VALUES = { DOOR_SECRET: 'Zm9vYmFyYmF6cXV4+/= "quoted"\\' };
const holdingDirectories = () =>
  readdirSync(tmpdir()).filter((entry) => entry.startsWith('holding-secrets-'));

describe('the holding page’s dev copy’s writeSecretsFile (#1078 AC3)', () => {
  it('writes the door secret, exactly, in JSON, and returns where', () => {
    const path = writeSecretsFile(VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it('writes into a directory named for the holding page', () => {
    expect(basename(dirname(writeSecretsFile(VALUES)))).toMatch(
      /^holding-secrets-/,
    );
  });

  it('refuses a missing DOOR_SECRET, naming DEV_DOOR_SECRET, and writes nothing', () => {
    const before = holdingDirectories();
    expect(() => writeSecretsFile({ DOOR_SECRET: undefined })).toThrow(
      'DEV_DOOR_SECRET is not set',
    );
    expect(holdingDirectories()).toStrictEqual(before);
  });

  it('refuses an empty DOOR_SECRET, naming DEV_DOOR_SECRET, and writes nothing', () => {
    const before = holdingDirectories();
    expect(() => writeSecretsFile({ DOOR_SECRET: '' })).toThrow(
      'DEV_DOOR_SECRET is not set',
    );
    expect(holdingDirectories()).toStrictEqual(before);
  });
});
