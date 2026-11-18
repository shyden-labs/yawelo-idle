import { describe, expect, it } from 'vitest';
import { COPY } from './copy';

/**
 * The development banner says the released game "could be completely
 * different" in every language that has its own line (Shyden, 2026-11-12,
 * #957): the Indonesian once read back as "may be very different".
 */
describe('the development banner (#957)', () => {
  it('keeps the approved English line', () => {
    expect(COPY.en.devStrip).toBe(
      'In development: what you see may change, and the released game could be completely different.',
    );
  });

  it('says the Indonesian release could be completely different', () => {
    expect(COPY.id.devStrip).toBe(
      'Dalam pengembangan: yang Anda lihat bisa berubah, dan game yang dirilis bisa sama sekali berbeda.',
    );
  });
});
