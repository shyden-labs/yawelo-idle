import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Reading } from '../../scripts/load-mutation-files';
import { floorBreach } from '../floors';
import { searched } from '../searched';
import { committableFiles } from '../unit/tracked-files';

/**
 * Every tracked mutation file loads, and names only files git has (#619
 * AC1). The `mutations` check runs only the files a pull request changes,
 * so a file broken by a later change to what it names (a target renamed, a
 * planted file moved) would otherwise sit unread until the next story that
 * touches it. Loading every file reads the tree, so it runs here.
 *
 * `scripts/load-mutation-files.ts` loads them in its own process: it imports
 * each by a computed path, which no file the suites load may do
 * (collection-calls.test.ts). A file it prints nothing for is a finding.
 */

const isText = (value: unknown): value is string => typeof value === 'string';
const isTextList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(isText);

/** One line the loader printed, or a throw naming it. */
function readingOf(line: string): Reading {
  const value = JSON.parse(line) as Record<string, unknown>;
  if (
    isText(value.path) &&
    (isText(value.error) ||
      (isTextList(value.targets) &&
        isTextList(value.planted) &&
        typeof value.mutations === 'number'))
  )
    return value as Reading;
  throw new Error(`the loader printed a line it cannot read: ${line}`);
}

describe('the mutation files (#619 AC1)', () => {
  it('loads every file in tests/mutations/, each naming only files git has', () => {
    const known = new Set(committableFiles());
    const files = committableFiles(['tests/mutations/*.ts']);
    // Independently: the folder as the file system has it.
    expect(files).toEqual(
      readdirSync('tests/mutations')
        .filter((name) => name.endsWith('.ts'))
        .map((name) => `tests/mutations/${name}`)
        .sort(),
    );
    const loader = spawnSync(
      process.execPath,
      ['scripts/load-mutation-files.ts', ...files],
      { encoding: 'utf8' },
    );
    expect(loader.stderr).toBe('');
    expect(loader.status).toBe(0);
    const readings = new Map(
      loader.stdout
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => {
          const reading = readingOf(line);
          return [reading.path, reading] as const;
        }),
    );
    const findings = files.flatMap((path) => {
      const reading = readings.get(path);
      if (reading === undefined)
        return [`${path}: the loader printed nothing for it`];
      if ('error' in reading) return [`${path}: ${reading.error}`];
      return [
        ...reading.targets
          .filter((target) => !known.has(target))
          .map(
            (target) => `${path}: targets ${target}, which git does not have`,
          ),
        ...reading.planted
          .filter((planted) => !known.has(planted))
          .map(
            (planted) =>
              `${path}: plants in ${planted}, which git does not have`,
          ),
      ];
    });
    expect(
      searched(findings, {
        of: files,
        what: 'mutation files in tests/mutations/',
      }),
    ).toEqual([]);
    expect(floorBreach('mutation-files/files', files.length)).toBeUndefined();
    // Liveness: a loader that read no mutation would count none.
    const mutations = [...readings.values()].reduce(
      (sum, reading) => sum + ('error' in reading ? 0 : reading.mutations),
      0,
    );
    expect(floorBreach('mutation-files/mutations', mutations)).toBeUndefined();
  });
});
