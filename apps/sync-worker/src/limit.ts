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
