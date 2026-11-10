import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const scratch = () =>
  join(mkdtempSync(join(tmpdir(), 'door-secrets-')), 's.json');

describe('writeDoorSecretsFile', () => {
  it('writes the three values, exactly, in JSON', () => {
    const path = scratch();
    writeDoorSecretsFile(path, VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it('makes the file readable by its owner only', () => {
    const path = scratch();
    writeDoorSecretsFile(path, VALUES);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it.each(SOURCES)(
    'refuses a missing %s, naming %s, and writes nothing',
    (secret, source) => {
      const path = scratch();
      expect(() => {
        writeDoorSecretsFile(path, { ...VALUES, [secret]: undefined });
      }).toThrow(`${source} is not set`);
      expect(() => statSync(path)).toThrow('ENOENT');
    },
  );

  it.each(SOURCES)(
    'refuses an empty %s, naming %s, and writes nothing',
    (secret, source) => {
      const path = scratch();
      expect(() => {
        writeDoorSecretsFile(path, { ...VALUES, [secret]: '' });
      }).toThrow(`${source} is not set`);
      expect(() => statSync(path)).toThrow('ENOENT');
    },
  );

  it('refuses to overwrite a file already there', () => {
    const path = scratch();
    writeDoorSecretsFile(path, VALUES);
    expect(() => {
      writeDoorSecretsFile(path, { ...VALUES, DEV_DOOR_SECRET: 'other' });
    }).toThrow('EEXIST');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });
});

describe('writeDoorSecretsFromEnv: the command line', () => {
  it('writes the file named by its argument from the environment', () => {
    const path = scratch();
    writeDoorSecretsFromEnv([path], VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it('refuses no path, naming its usage', () => {
    expect(() => {
      writeDoorSecretsFromEnv([], VALUES);
    }).toThrow('usage: node scripts/door-secrets.ts <path>');
  });

  it('refuses an empty path, naming its usage', () => {
    expect(() => {
      writeDoorSecretsFromEnv([''], VALUES);
    }).toThrow('usage: node scripts/door-secrets.ts <path>');
  });
});
