import { describe, expect, it } from 'vitest';
import {
  checkLimit,
  networkKey,
  networkOf,
  windowOf,
} from '../../apps/sync-worker/src/limit';
import { memoryCounts } from './memory-counts';

/**
 * Request limits (#164 AC2; spec §12.9). A request with no device token is
 * counted by the network part of its address (an IPv4 /24, an IPv6 /64),
 * never the address itself (Shyden, 2026-11-19).
 */
describe('the network part of an address (#164 AC2)', () => {
  it.each([
    ['203.0.113.7', '203.0.113.0/24'],
    ['203.0.113.255', '203.0.113.0/24'],
    ['0.0.0.0', '0.0.0.0/24'],
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64'],
    ['2001:0DB8:0001:0002:abcd::1', '2001:db8:1:2::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['::ffff:203.0.113.7', '203.0.113.0/24'],
  ])('%s is in %s', (address, network) => {
    expect(networkOf(address)).toBe(network);
  });

  it.each([
    [''],
    ['not-an-address'],
    ['256.1.1.1'],
    ['1.2.3'],
    ['1.2.3.4.5'],
    ['01.2.3.4'],
    ['2001:db8::1::2'],
    ['2001:db8:1:2:3:4:5:6:7'],
    ['2001:db8:1:2:3:4:5'],
    ['1:2:3:4::5:6:7:8'],
    ['12345::1'],
    ['g::1'],
  ])('%j is no address, so it has no network', (address) => {
    expect(networkOf(address)).toBeUndefined();
  });
});

describe('the keyed one-way hash of a network (#164 AC2)', () => {
  it('is HMAC-SHA-256 of the network under the key, in hex', async () => {
    // RFC 4231-style check value: HMAC-SHA-256("key", the pangram).
    expect(
      await networkKey('The quick brown fox jumps over the lazy dog', 'key'),
    ).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  });

  it('refuses an empty key, naming RATE_KEY', async () => {
    await expect(networkKey('203.0.113.0/24', '')).rejects.toThrow('RATE_KEY');
  });
});

describe('the window a request falls in (#164 AC2)', () => {
  it.each([
    ['inside an hour', 18_001_234, 3600, { end: 21_600, retryAfter: 3599 }],
    [
      'at its first moment',
      18_000_000,
      3600,
      { end: 21_600, retryAfter: 3600 },
    ],
    [
      'at its last millisecond',
      21_599_999,
      3600,
      { end: 21_600, retryAfter: 1 },
    ],
    ['in a minute window', 61_500, 60, { end: 120, retryAfter: 59 }],
  ])('%s', (_case, nowMs, perSeconds, window) => {
    expect(windowOf(nowMs, perSeconds)).toEqual(window);
  });
});

describe('a limit at its exact boundary (#164 AC2)', () => {
  const limit = { requests: 3, perSeconds: 60 };
  const NOW = 61_500;

  it('accepts the Nth request and refuses the N+1th with its wait', async () => {
    const counts = memoryCounts();
    const answers = [];
    // one scenario: four requests in a row, the limit being three
    for (let request = 0; request < 4; request += 1)
      answers.push(await checkLimit(counts, '/r', 'k', limit, NOW));
    expect(answers).toEqual([undefined, undefined, undefined, 59]);
  });

  it('counts each key on its own', async () => {
    const counts = memoryCounts();
    // one scenario: one key reaches its limit, then another asks
    for (let request = 0; request < 3; request += 1)
      await checkLimit(counts, '/r', 'k', limit, NOW);
    expect(await checkLimit(counts, '/r', 'other', limit, NOW)).toBeUndefined();
  });

  it('counts each route on its own', async () => {
    const counts = memoryCounts();
    // one scenario: one route reaches its limit, then another is asked
    for (let request = 0; request < 3; request += 1)
      await checkLimit(counts, '/r', 'k', limit, NOW);
    expect(await checkLimit(counts, '/s', 'k', limit, NOW)).toBeUndefined();
  });

  it('starts again in the next window', async () => {
    const counts = memoryCounts();
    // one scenario: a key reaches its limit, then asks a window later
    for (let request = 0; request < 3; request += 1)
      await checkLimit(counts, '/r', 'k', limit, NOW);
    expect(
      await checkLimit(counts, '/r', 'k', limit, NOW + 60_000),
    ).toBeUndefined();
  });
});
