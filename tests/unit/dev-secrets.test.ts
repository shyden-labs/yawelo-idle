import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSecretsFile } from '../../scripts/dev-secrets';

/**
 * The dev site Worker's secrets file (#357, #341): the deploy uploads each
 * secret from its `dev` environment secret with the Worker itself
 * (`wrangler deploy --secrets-file`), so no person types one into
 * Cloudflare. A missing one stops the deploy, naming the GitHub secret to set.
 */

const VALUES = {
  ROADMAP_WEBHOOK_SECRET: 'pä:ss "quoted"\\ #not-a-comment\nline two',
  ROADMAP_APP_KEY:
    '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\n-----END RSA PRIVATE KEY-----\n',
  DOOR_SECRET: 'Zm9vYmFyYmF6cXV4+/=',
};
/** Each Worker secret, beside the dev environment secret it comes from. */
const SOURCES = [
  ['ROADMAP_WEBHOOK_SECRET', 'ROADMAP_WEBHOOK_SECRET'],
  ['ROADMAP_APP_KEY', 'ROADMAP_APP_KEY'],
  // The site believes the door a request names only with it (#784, #1013).
  ['DOOR_SECRET', 'DEV_DOOR_SECRET'],
] as const;
const devDirectories = () =>
  readdirSync(tmpdir()).filter((entry) => entry.startsWith('dev-secrets-'));

describe('writeSecretsFile', () => {
  it('writes the three secrets, exactly, in JSON, and returns where', () => {
    const path = writeSecretsFile(VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it('writes no dev password, even when one is handed in: the door is the gate (#1078 AC3)', () => {
    const path = writeSecretsFile({
      ...VALUES,
      DEV_PASSWORD: 'leftover',
    } as Parameters<typeof writeSecretsFile>[0]);
    const written = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      string
    >;
    expect(Object.keys(written)).toEqual([
      'ROADMAP_WEBHOOK_SECRET',
      'ROADMAP_APP_KEY',
      'DOOR_SECRET',
    ]);
  });

  it('writes into a directory named for the dev site', () => {
    expect(basename(dirname(writeSecretsFile(VALUES)))).toMatch(
      /^dev-secrets-/,
    );
  });

  for (const [secret, source] of SOURCES) {
    it(`refuses a missing ${secret}, naming ${source}, and writes nothing`, () => {
      const before = devDirectories();
      expect(() =>
        writeSecretsFile({ ...VALUES, [secret]: undefined }),
      ).toThrow(`${source} is not set`);
      expect(devDirectories()).toStrictEqual(before);
    });

    it(`refuses an empty ${secret}, naming ${source}, and writes nothing`, () => {
      const before = devDirectories();
      expect(() => writeSecretsFile({ ...VALUES, [secret]: '' })).toThrow(
        `${source} is not set`,
      );
      expect(devDirectories()).toStrictEqual(before);
    });
  }
});
