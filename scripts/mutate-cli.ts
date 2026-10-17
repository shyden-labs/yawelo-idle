/**
 * `npm run mutate -- tests/mutations/<file>.ts ...` (#527): loads each
 * mutation file and runs it with `scripts/mutate.ts`. The entry lives apart
 * because it imports each mutation file by a path known only at run time,
 * and the whole-repo guards follow every import of the files the suites
 * load, refusing one they cannot read; no test loads this file.
 */
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { asMutationFile } from './mutation-file.ts';
import { mutableSuites, realIo, runFile } from './mutate.ts';
import { FLOORS_DIR, SUITES } from './record-floors.ts';

async function main(): Promise<void> {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error(
      'name a mutation file: npm run mutate -- tests/mutations/<file>.ts',
    );
    process.exitCode = 2;
    return;
  }
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  });
  if (top.status !== 0) throw new Error('run it inside the repository');
  const root = realpathSync(top.stdout.trim());
  const io = realIo({
    root,
    ci: process.env.CI === 'true',
    suites: SUITES,
    floorsDir: FLOORS_DIR,
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      io.restoreAll();
      process.exit(130);
    });
  let matched = 0;
  let rows = 0;
  for (const path of paths) {
    const loaded = (await import(pathToFileURL(resolve(root, path)).href)) as {
      readonly default?: unknown;
    };
    const file = asMutationFile(loaded.default);
    const counts = await runFile(io, path, file, mutableSuites(SUITES));
    matched += counts.matched;
    rows += counts.rows;
  }
  console.log(`mutate: ${String(matched)} of ${String(rows)} matched`);
  process.exitCode = matched === rows ? 0 : 1;
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
