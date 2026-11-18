/**
 * Request limits (#164 AC2, AC5; spec §12.9).
 *
 * A request with no device token is counted by the network part of its
 * address (an IPv4 /24, an IPv6 /64), never the address itself, through a
 * keyed one-way hash (Shyden, 2026-11-19).
 */

const IPV4_PART = /^(?:0|[1-9]\d{0,2})$/;
const IPV6_GROUP = /^[\da-f]{1,4}$/i;

/** An IPv4 address's four numbers, or undefined when it is not one. */
function ipv4Parts(address: string): number[] | undefined {
  const parts = address.split('.');
  if (parts.length !== 4 || !parts.every((part) => IPV4_PART.test(part)))
    return undefined;
  const numbers = parts.map(Number);
  return numbers.every((part) => part <= 255) ? numbers : undefined;
}

const v4Network = ([a, b, c]: number[]) => `${a}.${b}.${c}.0/24`;

/** An IPv6 address's eight groups, with `::` expanded, or undefined. */
function ipv6Groups(address: string): string[] | undefined {
  const halves = address.split('::');
  if (halves.length > 2) return undefined;
  const split = (half: string | undefined) =>
    half === undefined || half === '' ? [] : half.split(':');
  const head = split(halves[0]);
  const tail = split(halves[1]);
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return undefined;
  const groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  return groups.every((group) => IPV6_GROUP.test(group)) ? groups : undefined;
}

const MAPPED_V4 = /^::ffff:(.+)$/i;

/**
 * The network part of `address`: `a.b.c.0/24` for IPv4 (an IPv4-mapped IPv6
 * address counts as its IPv4 one), the first four groups and `::/64` for
 * IPv6, or undefined when `address` is neither.
 */
export function networkOf(address: string): string | undefined {
  const v4 = ipv4Parts(MAPPED_V4.exec(address)?.[1] ?? address);
  if (v4 !== undefined) return v4Network(v4);
  const groups = ipv6Groups(address);
  if (groups === undefined) return undefined;
  const prefix = groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group, 16).toString(16));
  return `${prefix.join(':')}::/64`;
}

const toHex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

/**
 * The keyed one-way hash a network is counted under: HMAC-SHA-256 of its
 * text under `secret` (the Worker's RATE_KEY), in hex. Without the key the
 * network cannot be recovered or tested against a guess. An empty key would
 * hash every network the same way anyone could, so it is refused.
 */
export async function networkKey(
  network: string,
  secret: string,
): Promise<string> {
  if (secret.length === 0) throw new Error('RATE_KEY is not set');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(network)));
}

/** A request's window: when it ends, and the whole seconds left until then. */
export interface Window {
  /** The window's end, in whole seconds since the epoch. */
  readonly end: number;
  /** Seconds until the end, rounded up: the Retry-After a refusal sends. */
  readonly retryAfter: number;
}

/**
 * The fixed window of `perSeconds` that `nowMs` falls in: windows start at
 * whole multiples of `perSeconds` since the epoch, so every isolate agrees.
 */
export function windowOf(nowMs: number, perSeconds: number): Window {
  const now = nowMs / 1000;
  const end = (Math.floor(now / perSeconds) + 1) * perSeconds;
  return { end, retryAfter: Math.ceil(end - now) };
}

/** Where counts are kept: D1 in the Worker (#164 AC5), memory in a unit test. */
export interface Counts {
  /**
   * Adds one to the count of `key` on `routePath` in the window ending at
   * `windowEnd`, and gives back the new count. Counts whose window ended by
   * `nowSeconds` may be deleted on the way (Shyden, 2026-11-19).
   */
  add(
    routePath: string,
    key: string,
    windowEnd: number,
    nowSeconds: number,
  ): Promise<number>;
}

/** A route's limit: at most `requests` every `perSeconds`. */
export interface Limit {
  readonly requests: number;
  readonly perSeconds: number;
}

/**
 * Counts one request of `key` on `routePath`: undefined while it is within
 * `limit` (the Nth is accepted), else the seconds until its window ends.
 */
export async function checkLimit(
  counts: Counts,
  routePath: string,
  key: string,
  limit: Limit,
  nowMs: number,
): Promise<number | undefined> {
  const window = windowOf(nowMs, limit.perSeconds);
  const count = await counts.add(
    routePath,
    key,
    window.end,
    Math.floor(nowMs / 1000),
  );
  return count > limit.requests ? window.retryAfter : undefined;
}
