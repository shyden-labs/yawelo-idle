import { describe, expect, it, vi } from 'vitest';
import type { Locator } from '@playwright/test';
import { press } from '../press';

/**
 * A control is pressed the way the target presses it (#883 AC5): a tap on
 * a touch screen, a click with a mouse. The same test runs on both.
 */

const control = () => {
  const tap = vi.fn(() => Promise.resolve());
  const click = vi.fn(() => Promise.resolve());
  return { locator: { tap, click } as unknown as Locator, tap, click };
};

describe('press', () => {
  it('taps on a touch screen, and never clicks', async () => {
    const { locator, tap, click } = control();
    await press(locator, true);
    expect(tap).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
  });

  it('clicks with a mouse, and never taps', async () => {
    const { locator, tap, click } = control();
    await press(locator, false);
    expect(click).toHaveBeenCalledOnce();
    expect(tap).not.toHaveBeenCalled();
  });
});
