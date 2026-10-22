import { describe, expect, it } from 'vitest';
import { changedHelpers, RECORDED_DIRS } from '../../scripts/mutations-changed';

/**
 * The folders the mutations judge lists apart as counts CI writes (Shyden,
 * 2026-10-18; the coverage record added 2026-10-22, #728): exactly these,
 * so a test helper can never hide in one.
 */
describe('the recorded-count folders the judge leaves out (#728)', () => {
  it('are the floors, the minimums and the coverage record, and no other', () => {
    expect(RECORDED_DIRS).toEqual([
      'tests/floors',
      'tests/minimums',
      'tests/coverage',
    ]);
  });

  it('list the coverage record apart, and still judge a helper named beside its folder', () => {
    expect(
      changedHelpers(
        [
          { status: 'M', path: 'tests/coverage/record.json' },
          { status: 'M', path: 'tests/coverage.ts' },
        ],
        new Set(),
        ['apps/*', 'packages/*'],
        RECORDED_DIRS,
      ),
    ).toEqual({
      helpers: ['tests/coverage.ts'],
      data: [],
      recorded: ['tests/coverage/record.json'],
      unreadable: [],
    });
  });
});
