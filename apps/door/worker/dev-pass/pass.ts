/**
 * The DEV pass (#1078), from shyden-labs/repo-template develop 4e8fcf7
 * (docs/dev-pass.md). Compile-only stub: the copied tests run red first.
 */
import type { webcrypto } from 'node:crypto';

export type PassKind = 'browser' | 'app' | 'machine' | 'embed';
/** A door's keys: `kid` → the Ed25519 public key's JWK `x`. Public, so plain vars, not secrets. */
export type PublicKeys = Readonly<Record<string, string>>;
export interface SigningKey {
  readonly kid: string;
  readonly privateKey: webcrypto.CryptoKey;
}
export interface PassClaims {
  /** The one door this pass opens, e.g. `dev.yaweloidle.com`. */
  readonly aud: string;
  /** A person's email or a service token's name. */
  readonly sub: string;
  readonly kind: PassKind;
}
export type PassFailure =
  | 'missing'
  | 'malformed'
  | 'unknown-kid'
  | 'bad-signature'
  | 'wrong-audience'
  | 'expired'
  | 'not-yet-valid'
  | 'bad-kind';
export type PassCheck =
  | {
      readonly ok: true;
      readonly sub: string;
      readonly kind: PassKind;
      readonly exp: number;
    }
  | { readonly ok: false; readonly reason: PassFailure };

/** An embed pass sits where page code can read it, so it lasts minutes (shyden-labs/repo-template#209). */
export const LIFETIME_SECONDS: Readonly<Record<PassKind, number>> = {
  browser: 12 * 3_600,
  app: 12 * 3_600,
  machine: 3_600,
  embed: 300,
};
/** Allowed on `iat` only; `exp` gets none. */
export const CLOCK_SKEW_SECONDS = 60;

const VERSION = 'v1';
export function toBase64url(_bytes: Uint8Array): string {
  throw new Error('not copied yet (#1078)');
}
export function fromBase64url(_value: string): Uint8Array<ArrayBuffer> {
  throw new Error('not copied yet (#1078)');
}
export function mintPass(
  _claims: PassClaims,
  _key: SigningKey,
  _now: number,
): Promise<string> {
  throw new Error('not copied yet (#1078)');
}
export function verifyPass(
  _pass: string | undefined,
  _options: { host: string; keys: PublicKeys; now: number },
): Promise<PassCheck> {
  throw new Error('not copied yet (#1078)');
}
export function safeBack(_value: string | null | undefined): string {
  throw new Error('not copied yet (#1078)');
}
