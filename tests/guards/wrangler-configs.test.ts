import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PROD_WRANGLER_CONFIGS,
  WRANGLER_CONFIGS,
  wranglerConfigsOnDisk,
} from '../unit/wrangler-configs';

/**
 * The four deploy configs dev-config.test.ts reads by name, and the production
 * ones prod-config.test.ts reads (#621), are every wrangler config in the repo. Finding them walks the tree, so this runs here (#530;
 * the walk moved out of the unit suite with its real run kept).
 */

describe('the deploy configs (#530, #621)', () => {
  it('finds the three dev Workers, the hostname adapter and the production holding page on disk, and no other', () => {
    expect(
      wranglerConfigsOnDisk('.')
        .map((path) => relative('.', path))
        .sort(),
    ).toEqual([...WRANGLER_CONFIGS, ...PROD_WRANGLER_CONFIGS].sort());
  });
});
