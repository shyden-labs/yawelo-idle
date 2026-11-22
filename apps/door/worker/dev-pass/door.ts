/**
 * The DEV pass door (#1078), from shyden-labs/repo-template develop 4e8fcf7.
 * Compile-only stub: the copied tests run red first.
 */
import type { PublicKeys } from './pass';

export const SIGNIN_ORIGIN = 'https://dev-signin.shyden.co.uk';
export const PASS_COOKIE = '__Host-devpass';
/** Apps and machines send the pass here; it wins over the cookie. */
export const PASS_HEADER = 'X-Dev-Pass';
/** Who the pass belongs to, for the origin's logs. */
export const SUB_HEADER = 'X-Dev-Pass-Sub';

export interface DoorEnv {
  /** This door's own host name, which every pass it opens must name as `aud`. */
  readonly host: string;
  readonly keys: PublicKeys;
  /** The origin's door secret, added to every forwarded request. */
  readonly secretHeader: string;
  readonly secret: string;
  /** Seconds since the epoch. */
  readonly now: number;
  /**
   * A door whose pages run another product's embed (shyden-labs/repo-template#209): calls the
   * sign-in Worker through its door, to swap a visitor's pass for an embed pass.
   */
  readonly signin?: (request: Request) => Promise<Response>;
  /** An embed's API door: the page origins whose embeds may call it with an embed pass. */
  readonly embedOrigins?: readonly string[];
}

export function handleDevDoor(
  _request: Request,
  _env: DoorEnv,
  _forward: (request: Request) => Promise<Response>,
): Promise<Response> {
  throw new Error('not copied yet (#1078)');
}
