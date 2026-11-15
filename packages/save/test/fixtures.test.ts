import { readdirSync, readFileSync } from 'node:fs';
import { stateHash } from '@yawelo-idle/core';
import { describe, expect, it } from 'vitest';
import { load, MIGRATIONS, save, SAVE_VERSION } from '../src/index.ts';
import { CONTENT_VERSION, played } from './states.ts';

/**
 * Golden saves (#158 AC4): one fixture per save version, written by the app
 * of that version and never edited. Each migration loads the fixture of the
 * version it migrates from; the current version's fixture must load as it
 * is, so a change to the state's shape without a new version and its
 * migration fails here. The fixture set is derived from the chain: a version
 * with no fixture fails, and so does a fixture with no version.
 */

const FIXTURES = new URL('../fixtures/', import.meta.url);

function fixture(version: number): unknown {
  return JSON.parse(
    readFileSync(new URL(`save-v${String(version)}.json`, FIXTURES), 'utf8'),
  ) as unknown;
}

/** `played()`'s state hash when `save-v1.json` was written (2026-11-15). */
const V1_STATE_HASH = '';

describe('the golden fixtures', () => {
  it('are one per save version, from 1 to the current one', () => {
    const versions = Array.from({ length: SAVE_VERSION }, (_, index) => index + 1);
    expect(readdirSync(FIXTURES).sort()).toEqual(
      versions.map((version) => `save-v${String(version)}.json`).sort(),
    );
    expect(MIGRATIONS.map((migration) => migration.from)).toEqual(versions.slice(0, -1));
  });

  it(`loads the current version's fixture (v${String(SAVE_VERSION)}) as it is`, () => {
    const result = load(fixture(SAVE_VERSION));
    expect(result.ok && result.save.saveVersion).toBe(SAVE_VERSION);
    expect(result.ok && result.save.contentVersion).toBe(CONTENT_VERSION);
  });

  it('holds the played state in the v1 fixture', () => {
    const result = load(fixture(1));
    expect(result.ok && stateHash(result.save.state)).toBe(V1_STATE_HASH);
    expect(stateHash(played())).toBe(V1_STATE_HASH);
    expect(result.ok && result.save).toEqual(save(played(), {}, CONTENT_VERSION));
  });
});

// One test per migration, generated from the chain at collection time.
for (const migration of MIGRATIONS) {
  describe(`the migration from v${String(migration.from)}`, () => {
    it(`loads the v${String(migration.from)} fixture to the current version`, () => {
      const result = load(fixture(migration.from));
      expect(result.ok && result.migratedFrom).toBe(migration.from);
      expect(result.ok && result.save.saveVersion).toBe(SAVE_VERSION);
    });
  });
}
