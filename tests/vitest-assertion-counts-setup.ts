import { afterEach, expect } from 'vitest';
import { recordAssertions } from './vitest-assertion-counts';

// After each integration test, Vitest's own count of the assertions it made
// goes on the test's meta, where the counts reporter reads it (#933 AC6).
afterEach(({ task }) => {
  recordAssertions(
    task.meta as Record<string, unknown>,
    expect.getState().assertionCalls,
  );
});
