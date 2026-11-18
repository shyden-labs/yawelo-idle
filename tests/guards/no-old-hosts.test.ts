import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { walkTree } from '../unit/old-name';

/**
 * #1013 AC3: every environment moved to yaweloidle.com, and the old
 * shyden.co.uk hosts only redirect (shyden-labs/shyden.co.uk#1191). No code,
 * config, workflow or test may name an old host: a check aimed at one reads a
 * redirect, not the environment (deploy-dev's verify read 301 on develop
 * 1d34640). Docs keep their history and are not read. It reads the whole
 * repository, so it runs in the guards suite (#515, #530).
 */

/** Built in two pieces so this file does not name the host it refuses. */
const OLD_HOST = ['yawelo-idle', 'shyden.co.uk'].join('.');

const isDoc = (path: string): boolean =>
  path.startsWith('docs/') || path.endsWith('.md');

describe('the old shyden.co.uk hosts (#1013 AC3)', () => {
  it('are named by no code, config, workflow or test', () => {
    const naming = walkTree()
      .filter((path) => !isDoc(path))
      .filter((path) => readFileSync(path, 'utf8').includes(OLD_HOST));
    expect(naming).toEqual([]);
  });
});
