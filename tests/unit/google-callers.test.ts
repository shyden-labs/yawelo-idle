import { describe, expect, it } from 'vitest';
import { googleCallsIn } from './google-callers';

/**
 * #638 AC1: scripts/google-read-back.ts is the repo's one Google Cloud
 * Translation caller. This judges a file's text; the guards suite walks the
 * tracked tree with it (tests/guards/google-callers.test.ts). Needles are
 * built from parts, so this file names none whole.
 */
const HOST = ['translation', 'googleapis', 'com'].join('.');
const PACKAGE = ['@google-cloud', 'translate'].join('/');

describe('a Google Translation caller (#638 AC1)', () => {
  it('is a file naming the API’s host', () => {
    expect(
      googleCallsIn(`fetch('https://${HOST}/language/translate/v2')`),
    ).toBe(true);
  });

  it('is a file naming the host in any case', () => {
    expect(googleCallsIn(`https://${HOST.toUpperCase()}/`)).toBe(true);
  });

  it('is a file importing Google’s client library', () => {
    expect(googleCallsIn(`import { Translate } from '${PACKAGE}';`)).toBe(true);
  });

  it('is not a file that only mentions Google', () => {
    expect(googleCallsIn('Read back by Google Cloud Translation.')).toBe(false);
  });
});
