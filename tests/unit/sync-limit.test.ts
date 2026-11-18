import { describe, expect, it } from 'vitest';
import { networkOf } from '../../apps/sync-worker/src/limit';

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
