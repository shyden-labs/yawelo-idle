// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

/**
 * The unit setup's refusals hold in a jsdom test too (#806): a component
 * test that clicks still starts no process and reaches no service.
 */
describe('a jsdom unit test', () => {
  it('starts no process', () => {
    expect(() => spawnSync('/nonexistent/yawelo-idle-unit-probe')).toThrow(
      /starts a process/,
    );
  });

  it('reaches no outside service', async () => {
    // TEST-NET-1 (RFC 5737), never routed; port 80, as fetch refuses port 9.
    const failure = await fetch('http://192.0.2.1:80/').catch(
      (error: unknown) => error,
    );
    expect(String((failure as { cause?: unknown }).cause)).toContain(
      'a socket to 192.0.2.1:80 leaves the test process',
    );
  });
});
