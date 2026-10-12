import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import root from '../../vitest.config';
import properties from '../../vitest.properties.config';
import { runOf } from './workflow-steps';

/**
 * The properties suite stays wired (#543). Every fast-check property runs
 * there at its full count, and the unit suite keeps only stand-ins of each
 * (global rule, 2026-10-12), so a CI step removed, or a glob that lets the
 * properties run nowhere, would let them pass by not running; this suite
 * fails instead. Its time limit is held in suite-limits.test.ts (#476). The
 * workflow is read as parsed YAML, so a comment naming a command cannot
 * stand in for a step.
 */

interface Step {
  name?: string;
  // YAML may type it otherwise: read it through runOf.
  run?: unknown;
  if?: string;
}

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
  jobs: Record<string, { steps: Step[] }>;
};
const steps = ci.jobs['build-and-test']?.steps ?? [];
const runs = (command: string): number[] =>
  steps.flatMap((s, i) => (runOf(s) === command ? [i] : []));

describe('the properties suite in CI (#543)', () => {
  it('runs as its own step, once, after the unit tests, skipped only on a docs-only change', () => {
    const unit = runs('npm run test:unit');
    const suite = runs('npm run test:properties');
    expect(unit, 'test:unit step').toHaveLength(1);
    expect(suite, 'test:properties step').toHaveLength(1);
    expect(suite[0]).toBeGreaterThan(unit[0] ?? Infinity);
    const step = steps[suite[0] ?? -1];
    expect(step?.name).toBe('Properties (every property at its full count)');
    expect(step?.if).toBe("${{ steps.classify.outputs.scope != 'docs-only' }}");
  });

  it('is what npm run test:properties runs: each package’s properties and nothing else, which the unit suite leaves out', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:properties']).toBe(
      'vitest run -c vitest.properties.config.ts',
    );
    expect(properties.test?.include).toEqual([
      'packages/*/properties/**/*.test.ts',
    ]);
    // The unit suite reads each package's test directory alone.
    expect(
      root.test?.include?.filter((glob) => glob.startsWith('packages/')),
    ).toEqual(['packages/*/test/**/*.test.ts']);
  });
});
