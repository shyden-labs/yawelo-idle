/**
 * The support pages (#860). Compile-only stub: the tests are committed red
 * first (global rule, 2026-11-22); the code follows in its own commit.
 */
import type { Locale } from '../src/i18n';

export const SHYDESK_SENTINEL = 'https://shydesk.invalid';

export function isSupportPath(_pathname: string): boolean {
  throw new Error('not written yet (#860)');
}

export function passesTheDoor(_pathname: string): boolean {
  throw new Error('not written yet (#860)');
}

export function supportPolicy(_host: string): string {
  throw new Error('not written yet (#860)');
}

export function preferredLocale(_header: string | null): Locale {
  throw new Error('not written yet (#860)');
}

export function ticketRedirect(_request: Request): Response | undefined {
  throw new Error('not written yet (#860)');
}

export function supportPage(
  _page: Response,
  _host: string | undefined,
): Promise<Response> {
  throw new Error('not written yet (#860)');
}
