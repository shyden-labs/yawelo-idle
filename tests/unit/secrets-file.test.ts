import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempPath } from '../../scripts/secrets-file';

/**
 * A secrets file lands only in a temp directory (#784): the path a deploy
 * passes is resolved and refused unless it sits inside the system's temp
 * directory or the runner's RUNNER_TEMP, so a wrong argument can never write
 * secrets into the checkout or anywhere else.
 */
describe('tempPath', () => {
  it("accepts a file in the system's temp directory, resolved", () => {
    const path = join(mkdtempSync(join(tmpdir(), 'secrets-')), 's.json');
    expect(tempPath(path, {})).toBe(resolve(path));
  });

  it("accepts a file in the runner's temp directory", () => {
    expect(
      tempPath('/runner/_temp/door-secrets.json', {
        RUNNER_TEMP: '/runner/_temp',
      }),
    ).toBe('/runner/_temp/door-secrets.json');
  });

  it('refuses a relative path in the checkout', () => {
    expect(() => tempPath('door-secrets.json', {})).toThrow(
      'refusing to write a secrets file outside the temp directory: door-secrets.json',
    );
  });

  it('refuses a path that climbs out of the temp directory', () => {
    const path = join(tmpdir(), '..', 'escaped.json');
    expect(() => tempPath(path, {})).toThrow(
      `refusing to write a secrets file outside the temp directory: ${path}`,
    );
  });

  it("refuses a sibling whose name only starts with the temp directory's", () => {
    expect(() =>
      tempPath('/runner/_temp-evil/s.json', { RUNNER_TEMP: '/runner/_temp' }),
    ).toThrow('outside the temp directory');
  });

  it('refuses the temp directory itself', () => {
    expect(() => tempPath(tmpdir(), {})).toThrow('outside the temp directory');
  });
});
