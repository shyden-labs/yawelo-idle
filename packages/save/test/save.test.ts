import { stateHash } from '@yawelo-idle/core';
import { describe, expect, it } from 'vitest';
import { load, mayReplace, save, SAVE_VERSION } from '../src/index.ts';
import { CONTENT_VERSION, newGame, played, throughJson } from './states.ts';

/**
 * Writing and reading a save (#158 AC1, AC3, AC5). The round trip is a
 * property over generated states in properties/save.test.ts; these are its
 * chosen cases, plus each refusal.
 */

/** A saved played game, through JSON, as a mutable object to spoil. */
function stored(): Record<string, unknown> {
  return throughJson(save(played(), {}, CONTENT_VERSION)) as Record<string, unknown>;
}

function storedState(): Record<string, unknown> {
  return stored().state as Record<string, unknown>;
}

describe('save', () => {
  it('stamps the current version, the content build, the settings and the log head', () => {
    const state = played();
    expect(save(state, {}, CONTENT_VERSION)).toEqual({
      saveVersion: SAVE_VERSION,
      contentVersion: CONTENT_VERSION,
      state,
      settings: {},
      logHead: { seq: state.seq, stateHash: stateHash(state) },
    });
  });

  it('refuses an empty content version', () => {
    expect(() => save(newGame(), {}, '')).toThrow(
      'contentVersion must be a non-empty string',
    );
  });
});

describe('load', () => {
  it('reads back a new game unchanged, with the same state hash', () => {
    const state = newGame();
    const result = load(throughJson(save(state, {}, CONTENT_VERSION)));
    expect(result).toEqual({
      ok: true,
      save: save(state, {}, CONTENT_VERSION),
      migratedFrom: SAVE_VERSION,
    });
    expect(result.ok && stateHash(result.save.state)).toBe(stateHash(state));
  });

  it('reads back a played game unchanged, with the same state hash', () => {
    const state = played();
    const result = load(throughJson(save(state, {}, CONTENT_VERSION)));
    expect(result).toEqual({
      ok: true,
      save: save(state, {}, CONTENT_VERSION),
      migratedFrom: SAVE_VERSION,
    });
    expect(result.ok && stateHash(result.save.state)).toBe(stateHash(state));
  });

  it('refuses a save from a newer app with a typed reason', () => {
    expect(load({ ...stored(), saveVersion: SAVE_VERSION + 1 })).toEqual({
      ok: false,
      refusal: {
        kind: 'updateTheApp',
        saveVersion: SAVE_VERSION + 1,
        appSaveVersion: SAVE_VERSION,
      },
    });
  });

  it('refuses something that is not an object', () => {
    expect(load('a save')).toEqual({
      ok: false,
      refusal: { kind: 'notASave', issues: ['saveVersion: not a save object'] },
    });
  });

  it('refuses a save with no version', () => {
    const { saveVersion: _dropped, ...rest } = stored();
    expect(load(rest)).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['saveVersion: must be an integer from 1, got undefined'],
      },
    });
  });

  it('refuses a version below 1', () => {
    expect(load({ ...stored(), saveVersion: 0 })).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['saveVersion: must be an integer from 1, got 0'],
      },
    });
  });

  it('refuses a version that is not an integer', () => {
    expect(load({ ...stored(), saveVersion: 1.5 })).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['saveVersion: must be an integer from 1, got 1.5'],
      },
    });
  });

  it('refuses a state field of the wrong type, naming its path', () => {
    expect(load({ ...stored(), state: { ...storedState(), stamps: '3' } })).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['state.stamps: Invalid input: expected number, received string'],
      },
    });
  });

  it('refuses a state field the schema does not know', () => {
    expect(load({ ...stored(), state: { ...storedState(), gold: 1 } })).toEqual({
      ok: false,
      refusal: { kind: 'notASave', issues: ['state: Unrecognized key: "gold"'] },
    });
  });

  it('refuses a state missing a field', () => {
    const { cards: _dropped, ...rest } = storedState();
    expect(load({ ...stored(), state: rest })).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['state.cards: Invalid input: expected array, received undefined'],
      },
    });
  });

  it('refuses a number that is not in canonical form', () => {
    expect(load({ ...stored(), state: { ...storedState(), insight: [12, 0] } })).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['state.insight: Num.fromTuple: not canonical: [12, 0]'],
      },
    });
  });

  it('refuses a clock that is not a time', () => {
    expect(load({ ...stored(), state: { ...storedState(), sim: -1 } })).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['state.sim: SimMs must be a safe non-negative integer, got -1'],
      },
    });
  });

  it('refuses a setting it does not know', () => {
    expect(load({ ...stored(), settings: { theme: 'dark' } })).toEqual({
      ok: false,
      refusal: { kind: 'notASave', issues: ['settings: Unrecognized key: "theme"'] },
    });
  });

  it('refuses an empty content version', () => {
    expect(load({ ...stored(), contentVersion: '' })).toEqual({
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: ['contentVersion: Too small: expected string to have >=1 characters'],
      },
    });
  });

  it('refuses a log head whose hash is not the state hash', () => {
    const spoiled = { ...stored(), state: { ...storedState(), stamps: 999 } };
    expect(load(spoiled)).toEqual({ ok: false, refusal: { kind: 'headMismatch' } });
  });

  it('refuses a log head whose seq is not the state seq', () => {
    const save = stored();
    const head = save.logHead as Record<string, unknown>;
    expect(load({ ...save, logHead: { ...head, seq: 0 } })).toEqual({
      ok: false,
      refusal: { kind: 'headMismatch' },
    });
  });
});

describe('mayReplace', () => {
  it('lets a save be written where none is stored', () => {
    expect(mayReplace(undefined)).toEqual({ ok: true });
  });

  it('lets a save be written over one of the same version', () => {
    expect(mayReplace(stored())).toEqual({ ok: true });
  });

  it('refuses to write over a save from a newer app', () => {
    expect(mayReplace({ ...stored(), saveVersion: SAVE_VERSION + 1 })).toEqual({
      ok: false,
      refusal: {
        kind: 'updateTheApp',
        saveVersion: SAVE_VERSION + 1,
        appSaveVersion: SAVE_VERSION,
      },
    });
  });
});
