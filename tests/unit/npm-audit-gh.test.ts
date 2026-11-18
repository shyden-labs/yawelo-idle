import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { GH_BUFFER, runGh } from '../../scripts/npm-audit';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => '[]'),
  spawnSync: vi.fn(),
}));

/**
 * The daily audit's `gh` (#720 AC3). The planted run 42318914120 found every
 * advisory but could not search the open issues: the paginated listing
 * outgrew execFileSync's 1 MiB default (`spawnSync gh ENOBUFS`), so each
 * day would open a fresh issue instead of commenting on the open one.
 */
describe('the daily audit’s gh', () => {
  it('holds a listing far past the 1 MiB default', () => {
    expect(GH_BUFFER).toBe(64 * 1024 * 1024);
  });

  it('runs gh with that buffer and answers what gh printed', () => {
    expect(runGh(['api', 'repos/o/r/issues'])).toBe('[]');
    expect(execFileSync).toHaveBeenCalledWith(
      'gh',
      ['api', 'repos/o/r/issues'],
      { encoding: 'utf8', maxBuffer: GH_BUFFER },
    );
  });
});
