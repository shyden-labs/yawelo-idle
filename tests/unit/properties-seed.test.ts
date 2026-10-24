import { describe, expect, it } from 'vitest';
import {
  chooseSeed,
  currentSeed,
  rememberSeed,
  SEED_ENV,
} from '../properties-seed.ts';

/**
 * The properties suite's seed (#84, spec §5.11): fresh unless a person
 * replays one, and remembered for a breach to name.
 */

const never = (): number => {
  throw new Error('drew a fresh seed');
};

describe('chooseSeed', () => {
  it('draws a fresh seed when no replay is set', () => {
    expect(chooseSeed(undefined, () => 17)).toBe(17);
  });

  it('replays the seed a person sets, drawing none', () => {
    expect(chooseSeed('-1234567', never)).toBe(-1234567);
  });

  it('replays both ends of the 32-bit range', () => {
    expect(chooseSeed('-2147483648', never)).toBe(-2147483648);
    expect(chooseSeed('2147483647', never)).toBe(2147483647);
  });

  it('refuses one past each end', () => {
    expect(() => chooseSeed('2147483648', never)).toThrow(
      `${SEED_ENV}=2147483648 is not a 32-bit integer seed`,
    );
    expect(() => chooseSeed('-2147483649', never)).toThrow(
      `${SEED_ENV}=-2147483649 is not a 32-bit integer seed`,
    );
  });

  it('refuses an empty replay, a fraction and a word, never reading them as fresh', () => {
    expect(() => chooseSeed('', never)).toThrow(
      `${SEED_ENV}= is not a 32-bit integer seed`,
    );
    expect(() => chooseSeed('1.5', never)).toThrow(
      `${SEED_ENV}=1.5 is not a 32-bit integer seed`,
    );
    expect(() => chooseSeed('seed', never)).toThrow(
      `${SEED_ENV}=seed is not a 32-bit integer seed`,
    );
  });
});

describe('the remembered seed', () => {
  it('is the last one remembered', () => {
    rememberSeed(5);
    rememberSeed(-9);
    expect(currentSeed()).toBe(-9);
  });
});
