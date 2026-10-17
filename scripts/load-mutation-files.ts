/**
 * `node scripts/load-mutation-files.ts <file>...` (#619 AC1): loads each
 * mutation file and prints one JSON line per file: its targets, the files
 * its mutations plant in and how many mutations it holds, or why it did not
 * load. `tests/guards/mutation-files.test.ts` runs it over every file in
 * `tests/mutations/` and judges what it prints.
 *
 * It lives apart because it imports each file by a path known only at run
 * time, which the whole-repo guards refuse in any file the suites load
 * (tests/guards/collection-calls.test.ts); no test loads this file.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { asMutationFile } from './mutation-file.ts';

/** What the loader printed for one file. */
export type Reading =
  | {
      readonly path: string;
      readonly targets: readonly string[];
      readonly planted: readonly string[];
      readonly mutations: number;
    }
  | { readonly path: string; readonly error: string };

async function main(): Promise<void> {
  for (const path of process.argv.slice(2)) {
    let reading: Reading;
    try {
      const loaded = (await import(pathToFileURL(resolve(path)).href)) as {
        readonly default?: unknown;
      };
      const file = asMutationFile(loaded.default);
      reading = {
        path,
        targets: file.targets,
        planted: file.mutations.map((m) => m.file),
        mutations: file.mutations.length,
      };
    } catch (error) {
      reading = {
        path,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    console.log(JSON.stringify(reading));
  }
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
