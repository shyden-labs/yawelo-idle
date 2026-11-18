import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readBuild } from '../../scripts/free-hosts';

// #768 AC5: the free-host check reads every built file under each folder it
// is given. It walks a folder, so it is tested here, not in the unit suite.
describe('reading a built folder (#768)', () => {
  it('reads every file under it, keyed by its path from there', () => {
    const files = readBuild('apps/site/holding/public');
    expect(Object.keys(files).sort()).toEqual([
      '_headers',
      'holding-video.js',
      'robots.txt',
    ]);
    expect(files['robots.txt']).toBe(
      readFileSync('apps/site/holding/public/robots.txt', 'latin1'),
    );
  });

  it('keys a file in a subfolder by its whole path', () => {
    expect(Object.keys(readBuild('apps/site/holding'))).toContain(
      'public/robots.txt',
    );
  });
});
