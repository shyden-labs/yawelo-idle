import { describe, it, expect } from 'vitest';
import { nodeIo } from '../../scripts/record-gate.ts';

/**
 * The gate's real io, run for real (#771): the unit suite stands it in,
 * since a unit test starts no process. The rehearsal runs act with
 * ACT_DISABLE_VERSION_CHECK through it.
 */
const PRINT = `process.stdout.write(JSON.stringify([process.env.ACT_DISABLE_VERSION_CHECK ?? null, typeof process.env.PATH]))`;

describe('the gate’s real io (#771)', () => {
  it('adds the environment it is given to the runner’s, for that command alone', () => {
    const run = nodeIo.run(process.execPath, ['-e', PRINT], {
      ACT_DISABLE_VERSION_CHECK: '1',
    });
    expect([
      run.status,
      run.stdout,
      process.env.ACT_DISABLE_VERSION_CHECK,
    ]).toEqual([0, '["1","string"]', undefined]);
  });

  it('passes the runner’s environment unchanged when given none', () => {
    const run = nodeIo.run(process.execPath, ['-e', PRINT]);
    expect([run.status, run.stdout]).toEqual([0, '[null,"string"]']);
  });
});
