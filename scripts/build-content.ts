/**
 * The content build (#106; spec §5.1, §6.1): one course file in, its bundle
 * and its `contentVersion` out, or every reason it may not ship.
 *
 *   npm run build:content <course.json> <out-dir>
 *
 * Writes `<out-dir>/<course id>.json` (the bundle) and
 * `<out-dir>/<course id>.version` (the 64-hex version), and prints the
 * version. A course that does not load, or that a gate refuses, writes
 * nothing and exits 1 naming each reason.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildCourse, loadCourse } from '@yawelo-idle/content';

/** Everything the build touches outside itself, so tests can stand it in. */
export interface BuildIo {
  readonly read: (path: string) => string;
  readonly write: (path: string, text: string) => void;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const USAGE = 'usage: build:content <course.json> <out-dir>';

export function main(argv: readonly string[], io: BuildIo): number {
  const [file, outDir] = argv;
  if (file === undefined || outDir === undefined || argv.length !== 2) {
    io.err(USAGE);
    return 2;
  }
  let json: unknown;
  try {
    json = JSON.parse(io.read(file));
  } catch (error) {
    io.err(
      `${file} is not JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  const loaded = loadCourse(json);
  if (!loaded.ok) {
    io.err(`${file} does not load:`);
    for (const { message } of loaded.errors) io.err(`  ${message}`);
    return 1;
  }
  const built = buildCourse(loaded.course);
  if (!built.ok) {
    io.err(`${file} may not ship:`);
    for (const { gate, error } of built.refusals)
      io.err(`  ${gate}: ${error.message}`);
    return 1;
  }
  const { id } = loaded.course;
  io.write(join(outDir, `${id}.json`), built.bundle);
  io.write(join(outDir, `${id}.version`), `${built.contentVersion}\n`);
  io.write(
    join(outDir, `${id}.attribution.json`),
    `${JSON.stringify(built.attribution, null, 2)}\n`,
  );
  for (const source of built.attribution.unused)
    io.out(
      `${id} attribution: source ${source} is registered but cited by no item`,
    );
  io.out(`${id} ${built.contentVersion}`);
  return 0;
}

if (import.meta.main)
  process.exitCode = main(process.argv.slice(2), {
    read: (path) => readFileSync(path, 'utf8'),
    write: (path, text) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    },
    out: (line) => {
      console.log(line);
    },
    err: (line) => {
      console.error(line);
    },
  });
