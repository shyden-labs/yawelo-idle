import type { Locator } from '@playwright/test';

/**
 * Presses a control the way the target does (#883 AC5): a tap on a touch
 * screen, a click with a mouse. A spec passes Playwright's `hasTouch`
 * fixture, so one test drives every target with its own real input.
 */
export function press(control: Locator, hasTouch: boolean): Promise<void> {
  return hasTouch ? control.tap() : control.click();
}
