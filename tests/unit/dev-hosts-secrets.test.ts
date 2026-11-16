import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSecretsFile } from '../../scripts/dev-hosts-secrets';

/**
 * The dev hostname adapter's secrets file (#784): the deploy uploads the dev
 * door secret from its `dev` environment secret to the Pages project
 * (`wrangler pages secret bulk`), so no person types it into Cloudflare. A
 * missing one stops the deploy, naming the GitHub secret to set.
 */

const VALUES = { DEV_DOOR_SECRET: 'Zm9vYmFyYmF6cXV4+/=' };
const adapterDirectories = () =>
  readdirSync(tmpdir()).filter((entry) =>
    entry.startsWith('dev-hosts-secrets-'),
  );

describe('writeSecretsFile', () => {
  it('writes the dev door secret, exactly, in JSON, and returns where', () => {
    const path = writeSecretsFile(VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it('writes into a directory named for the adapter', () => {
    expect(basename(dirname(writeSecretsFile(VALUES)))).toMatch(
      /^dev-hosts-secrets-/,
    );
  });

  it('refuses a missing DEV_DOOR_SECRET, naming it, and writes nothing', () => {
    const before = adapterDirectories();
    expect(() => writeSecretsFile({})).toThrow('DEV_DOOR_SECRET is not set');
    expect(adapterDirectories()).toStrictEqual(before);
  });

  it('refuses an empty DEV_DOOR_SECRET, naming it, and writes nothing', () => {
    const before = adapterDirectories();
    expect(() => writeSecretsFile({ DEV_DOOR_SECRET: '' })).toThrow(
      'DEV_DOOR_SECRET is not set',
    );
    expect(adapterDirectories()).toStrictEqual(before);
  });
});
