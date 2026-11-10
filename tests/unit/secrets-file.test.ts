import { readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSecretsFileFrom } from '../../scripts/secrets-file';

/**
 * A secrets file lands only in a new directory of its own inside the system's
 * temp directory (#784). The caller names no path: the path is made here and
 * returned, so no command-line argument ever decides where secrets are
 * written (SonarCloud tssecurity:S8707 on #943), and no deploy meets another
 * one's file.
 */
const NAME = 'secrets-file-test';
const SOURCES = { ONE: 'GITHUB_ONE', TWO: 'GITHUB_TWO' } as const;
const VALUES = { ONE: 'first "quoted"\nline two', TWO: 'second' };
const ownDirectories = () =>
  readdirSync(tmpdir()).filter((entry) => entry.startsWith(`${NAME}-`));

describe('writeSecretsFileFrom', () => {
  it('writes the values, exactly, in JSON, and returns where', () => {
    const path = writeSecretsFileFrom(NAME, SOURCES, VALUES);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual(VALUES);
  });

  it("names the file secrets.json, in a new directory named for it inside the system's temp directory", () => {
    const path = writeSecretsFileFrom(NAME, SOURCES, VALUES);
    expect(basename(path)).toBe('secrets.json');
    expect(dirname(dirname(path))).toBe(tmpdir());
    expect(basename(dirname(path))).toMatch(/^secrets-file-test-.+$/);
  });

  it('gives each call a directory of its own', () => {
    const first = writeSecretsFileFrom(NAME, SOURCES, VALUES);
    expect(writeSecretsFileFrom(NAME, SOURCES, VALUES)).not.toBe(first);
  });

  it('makes the file readable by its owner only', () => {
    const path = writeSecretsFileFrom(NAME, SOURCES, VALUES);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('refuses a missing value, naming its GitHub secret, and makes no directory', () => {
    const before = ownDirectories();
    expect(() => writeSecretsFileFrom(NAME, SOURCES, { ONE: 'first' })).toThrow(
      'GITHUB_TWO is not set',
    );
    expect(ownDirectories()).toStrictEqual(before);
  });

  it('refuses an empty value, naming its GitHub secret, and makes no directory', () => {
    const before = ownDirectories();
    expect(() =>
      writeSecretsFileFrom(NAME, SOURCES, { ...VALUES, ONE: '' }),
    ).toThrow('GITHUB_ONE is not set');
    expect(ownDirectories()).toStrictEqual(before);
  });
});
