import { afterEach, expect } from 'vitest';
import { recordAssertions } from './vitest-assertion-counts';

// After each integration test, record Vitest's count of its `expect` calls
// on the test's meta, for the assertion counts reporter (#933 AC6).
afterEach(({ task }) => {
  recordAssertions(
    task as unknown as { meta: Record<string, unknown> },
    expect.getState().assertionCalls,
  );
});
