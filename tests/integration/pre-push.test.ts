import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The pre-push hook (#123 AC2; Shyden chose the static gates on #123,
 * 2026-10-06): format, lint and typecheck, then nothing else (#547), and
 * `npm install` installs the hook.
 *
 * The hook is RUN with the real tools (#818; Shyden's ruling on #813: real
 * tools, CI only). Each case copies the repository, plants files that break
 * gates, and runs the real `.githooks/pre-push` in the copy. A case that
 * stops at one gate also plants the break every later gate would report, so
 * a later gate that ran would name its file in the output: the stop is seen,
 * not assumed. The copy shares this checkout's installed node_modules by
 * symlink, since installing in each copy would cost minutes.
 */

const HOOK = '.githooks/pre-push';
const ROOT = resolve('.');

/** One planted file for each gate, each breaking only that gate. */
const BREAKS = {
  format: {
    path: 'packages/progress/src/broken-format.ts',
    // A space before the semicolon: Prettier refuses it, ESLint and tsc do not.
    text: 'export const brokenFormat = 1 ;\n',
  },
  lint: {
    path: 'packages/progress/src/broken-lint.ts',
    // ESLint's no-debugger error, in a formatted, well-typed file.
    text: 'export function brokenLint(): void {\n  debugger;\n}\n',
  },
  type: {
    path: 'packages/progress/src/broken-type.ts',
    // tsc's TS2322 (a string assigned to a number), formatted and lint-clean.
    text: "export const brokenType: number = 'not a number';\n",
  },
} as const;

type Gate = keyof typeof BREAKS;
const GATES: readonly Gate[] = ['format', 'lint', 'type'];

interface Run {
  readonly status: number | null;
  readonly output: string;
}

/** The workspaces (apps/*, packages/*) that have node_modules of their own. */
function nestedNodeModules(): string[] {
  return ['apps', 'packages'].flatMap((parent) =>
    readdirSync(join(ROOT, parent))
      .map((name) => join(parent, name, 'node_modules'))
      .filter((path) => existsSync(join(ROOT, path))),
  );
}

/** Runs the real hook in a copy of the repository with `planted` written in. */
function runHook(planted: readonly Gate[]): Run {
  const dir = mkdtempSync(join(tmpdir(), 'pre-push-'));
  try {
    cpSync(ROOT, dir, {
      recursive: true,
      filter: (source) =>
        basename(source) !== 'node_modules' && basename(source) !== '.git',
    });
    for (const path of ['node_modules', ...nestedNodeModules()]) {
      symlinkSync(join(ROOT, path), join(dir, path), 'dir');
    }
    for (const gate of planted) {
      writeFileSync(join(dir, BREAKS[gate].path), BREAKS[gate].text);
    }
    const run = spawnSync(HOOK, [], { cwd: dir, encoding: 'utf8' });
    if (run.error) throw run.error;
    return { status: run.status, output: `${run.stdout}${run.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('the pre-push hook (#123 AC2, #818)', () => {
  it('is executable', () => {
    expect(statSync(HOOK).mode & 0o111).toBe(0o111);
  });

  it('passes a clean copy of the repository, run with the real tools', () => {
    const run = runHook([]);
    expect(run.status, run.output).toBe(0);
  });

  it.each(GATES.map((gate, index) => [gate, index] as const))(
    'stops at the %s gate, running no gate after it',
    (gate, index) => {
      const later = GATES.slice(index + 1);
      const run = runHook([gate, ...later]);
      expect(run.status, run.output).not.toBe(0);
      expect(run.output).toContain(basename(BREAKS[gate].path));
      // one scenario: each later gate's break must be absent from this run
      for (const after of later) {
        expect(run.output, `${after} ran after ${gate} failed`).not.toContain(
          basename(BREAKS[after].path),
        );
      }
    },
  );

  it('is installed by npm install, through the root prepare script', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.prepare).toBe('git config core.hooksPath .githooks');
  });

  it('is installed in this checkout: git reads hooks from .githooks', () => {
    const read = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
      encoding: 'utf8',
    });
    expect(read.stdout.trim()).toBe('.githooks');
  });
});
