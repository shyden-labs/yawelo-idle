import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUPS, lintRuns } from '../../scripts/lint.ts';

/**
 * `npm run lint` runs ESLint in groups, one process after another (#1081):
 * one process for the whole repository holds up to 27 TypeScript programs
 * and peaked at 1.76 GB of live heap against Node's ~2.04 GB default, and
 * crashed the pre-push hook three times. The largest group peaks at 1.27 GB
 * (measurements on #1081).
 */
describe('the lint, run in groups (#1081)', () => {
  it('lints each group in its own run, in order, then everything else', () => {
    expect(lintRuns(GROUPS)).toEqual([
      ['--max-warnings', '0', 'apps/site'],
      ['--max-warnings', '0', 'tests', 'scripts'],
      ['--max-warnings', '0', 'packages/core'],
      ['--max-warnings', '0', 'apps/door', 'apps/sync-worker', 'apps/web'],
      [
        '--max-warnings',
        '0',
        '.',
        '--ignore-pattern',
        'apps/site/**',
        '--ignore-pattern',
        'tests/**',
        '--ignore-pattern',
        'scripts/**',
        '--ignore-pattern',
        'packages/core/**',
        '--ignore-pattern',
        'apps/door/**',
        '--ignore-pattern',
        'apps/sync-worker/**',
        '--ignore-pattern',
        'apps/web/**',
      ],
    ]);
  });

  it('ends with a run of everything, ignoring exactly what the earlier runs took', () => {
    expect(lintRuns([['a'], ['b', 'c']]).at(-1)).toEqual([
      '--max-warnings',
      '0',
      '.',
      '--ignore-pattern',
      'a/**',
      '--ignore-pattern',
      'b/**',
      '--ignore-pattern',
      'c/**',
    ]);
  });

  it('lets the last run lint what no group took, and skip what one did', () => {
    const run = lintRuns(GROUPS).at(-1) ?? [];
    const ignored = run.filter((_, i) => run[i - 1] === '--ignore-pattern');
    const skips = (file: string) => ignored.some((p) => matchesGlob(file, p));
    expect({
      site: skips('apps/site/worker/roadmap.ts'),
      core: skips('packages/core/src/index.ts'),
      ui: skips('packages/ui/src/index.ts'),
      root: skips('eslint.config.js'),
    }).toEqual({ site: true, core: true, ui: false, root: false });
  });

  it('is what `npm run lint` runs', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts.lint).toBe('node scripts/lint.ts');
  });
});
