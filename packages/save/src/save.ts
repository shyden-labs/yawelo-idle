/**
 * Writing and reading a save (#158 AC1, AC2, AC5).
 */
import { stateHash, type GameState } from '@yawelo-idle/core';
import { CHAIN, checkChain, type Chain } from './migrations.ts';
import { saveSchema, type Save, type Settings } from './schema.ts';
import type { CorruptReason } from './blob.ts';

/** Why a save was not loaded. */
export type LoadRefusal =
  /** The stored bytes are damaged (#159): nothing of them is read. */
  | { readonly kind: 'corrupt'; readonly reason: CorruptReason }
  /** Written by a newer app: the player must update; the save is kept as it is. */
  | {
      readonly kind: 'updateTheApp';
      readonly saveVersion: number;
      readonly appSaveVersion: number;
    }
  /** Not a save this app can read: each issue names its path. */
  | { readonly kind: 'notASave'; readonly issues: readonly string[] }
  /** The log head does not match the state it was saved with. */
  | { readonly kind: 'headMismatch' };

export type LoadResult =
  | { readonly ok: true; readonly save: Save; readonly migratedFrom: number }
  | { readonly ok: false; readonly refusal: LoadRefusal };

/** Whether a stored save may be written over. */
export type ReplaceCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly refusal: Extract<LoadRefusal, { kind: 'updateTheApp' }>;
    };

/** The save of `state` with `settings`, played against content `contentVersion`. */
export function save(
  state: GameState,
  settings: Settings,
  contentVersion: string,
): Save {
  if (contentVersion.length === 0) {
    throw new RangeError('contentVersion must be a non-empty string');
  }
  return {
    saveVersion: CHAIN.current,
    contentVersion,
    state,
    settings,
    logHead: { seq: state.seq, stateHash: stateHash(state) },
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The version a stored save says it is, or why it says none. */
function versionOf(raw: unknown): number | LoadRefusal {
  if (!isRecord(raw)) {
    return { kind: 'notASave', issues: ['saveVersion: not a save object'] };
  }
  const version = raw.saveVersion;
  if (
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    return {
      kind: 'notASave',
      issues: [
        `saveVersion: must be an integer from 1, got ${String(version)}`,
      ],
    };
  }
  return version;
}

function updateTheApp(
  saveVersion: number,
  chain: Chain,
): Extract<LoadRefusal, { kind: 'updateTheApp' }> {
  return { kind: 'updateTheApp', saveVersion, appSaveVersion: chain.current };
}

/** Reads `raw` (parsed JSON), migrating an older save through `chain`. */
export function load(raw: unknown, chain: Chain = CHAIN): LoadResult {
  checkChain(chain);
  const version = versionOf(raw);
  if (typeof version !== 'number') return { ok: false, refusal: version };
  if (version > chain.current) {
    return { ok: false, refusal: updateTheApp(version, chain) };
  }
  const stored: Record<string, unknown> = {
    ...(raw as Readonly<Record<string, unknown>>),
  };
  delete stored.saveVersion;
  let body: Readonly<Record<string, unknown>> = stored;
  for (const migration of chain.migrations.slice(version - 1)) {
    body = migration.migrate(body);
  }
  const parsed = saveSchema.safeParse({ ...body, saveVersion: chain.current });
  if (!parsed.success) {
    return {
      ok: false,
      refusal: {
        kind: 'notASave',
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.map(String).join('.')}: ${issue.message}`,
        ),
      },
    };
  }
  const { logHead, state } = parsed.data;
  if (logHead.seq !== state.seq || logHead.stateHash !== stateHash(state)) {
    return { ok: false, refusal: { kind: 'headMismatch' } };
  }
  return { ok: true, save: parsed.data, migratedFrom: version };
}

/**
 * Refuses to write over a stored save from a newer app (#158 AC5), so an
 * older app opened after an update never destroys newer progress. Anything
 * else may be written over; telling a corrupt save apart is the backups'
 * work (#160).
 */
export function mayReplace(
  stored: unknown,
  chain: Chain = CHAIN,
): ReplaceCheck {
  const version = versionOf(stored);
  return typeof version === 'number' && version > chain.current
    ? { ok: false, refusal: updateTheApp(version, chain) }
    : { ok: true };
}
