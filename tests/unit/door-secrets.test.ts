import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  writeDoorSecretsFile,
  writeDoorSecretsFromEnv,
} from '../../scripts/door-secrets';

/**
 * The front door's secrets file (#784): the door's deploy uploads its origin
 * domain and the two door secrets from `production` environment secrets with
 * the Worker itself (`wrangler deploy --secrets-file`), so nobody types one
 * into Cloudflare. A missing one stops the deploy, naming the GitHub secret.
 * Where the file goes is scripts/secrets-file.ts's rule.
 */

const VALUES = {
  ORIGIN_DOMAIN: 'yawelo-idle-nonprod.workers.dev',
  DEV_DOOR_SECRET: 'dev "quoted"\\ #not-a-comment\nline two',
  TEST_DOOR_SECRET: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
};
/** Each Worker secret, beside the production environment secret it comes from. */
const SOURCES = [
  ['ORIGIN_DOMAIN', 'DOOR_ORIGIN_DOMAIN'],
  ['DEV_DOOR_SECRET', 'DEV_DOOR_SECRET'],
  ['TEST_DOOR_SECRET', 'TEST_DOOR_SECRET'],
] as const;
const doorDirectories = () =>
  readdirSync(tmpdir()).filter((entry) => entry.startsWith('door-secrets-'));

describe('writeDoorSecretsFile', () => {
  it('writes the three values, exactly, in JSON, and returns where', () => {
    const path = writeDoorSecretsFile(VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it('writes into a directory named for the door', () => {
    expect(basename(dirname(writeDoorSecretsFile(VALUES)))).toMatch(
      /^door-secrets-/,
    );
  });

  it.each(SOURCES)(
    'refuses a missing %s, naming %s, and writes nothing',
    (secret, source) => {
      const before = doorDirectories();
      expect(() =>
        writeDoorSecretsFile({ ...VALUES, [secret]: undefined }),
      ).toThrow(`${source} is not set`);
      expect(doorDirectories()).toStrictEqual(before);
    },
  );

  it.each(SOURCES)(
    'refuses an empty %s, naming %s, and writes nothing',
    (secret, source) => {
      const before = doorDirectories();
      expect(() => writeDoorSecretsFile({ ...VALUES, [secret]: '' })).toThrow(
        `${source} is not set`,
      );
      expect(doorDirectories()).toStrictEqual(before);
    },
  );
});

describe('writeDoorSecretsFromEnv: the command line', () => {
  it('writes the file from the environment and returns where', () => {
    const path = writeDoorSecretsFromEnv(VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it('reads only the three secrets from the environment', () => {
    const path = writeDoorSecretsFromEnv({ ...VALUES, OTHER: 'not a secret' });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });
});
