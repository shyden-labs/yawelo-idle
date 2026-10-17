# Mutation runner: harness and Playwright suites (#649) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The runner (`npm run mutate`) runs all twelve suites in `SUITES`, building first where a suite's script does, reading Playwright's report as well as vitest's, and a `mutations` workflow runs every mutation file a pull request adds or changes.

**Architecture:** `Suite.mutate` becomes a tagged `SuiteMutate` (vitest or Playwright, a config, an optional build), pinned to each suite's package script by a unit test. `runFile` lists only the unit suite on the laptop, reads a run by its kind, and treats a failed build as a miss. `realIo.run` builds then runs under one 600 s deadline from the suite's folder, with `MUTATE_ROOT` so names stay repository-relative. `scripts/mutations-changed.ts` feeds `.github/workflows/mutations.yml`.

**Tech Stack:** TypeScript run by Node 26's type stripping, vitest 5.0.3, Playwright 1.63.0 (JSON reporter), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-18-mutation-runner-harness-playwright-design.md` (reviewed to zero, self-approved).

**Generated from executed stage commits** (tag `evidence/649-stage-commits`): every code block below is `git show` of the stage commit named in its task, and every "Expected" line is what that stage's run printed.

## Global Constraints

- Node 26 runs scripts directly: a script's own imports carry `.ts`; tests import without the extension.
- Unit tests start no process and open no socket; each stays under 1 s and 0.1 s of its own thread CPU. One test per case. They may read named files (fixtures, `package.json`), never the tree.
- The laptop runs the unit suite, typecheck, lint and Prettier only. Harness and Playwright runs, and their mutation files, run in CI.
- Every new test is run red first, each failure for its own stated reason (a throwing stub where the module is new).
- Floors are recorded in CI only: squash to one commit, label the pull request `record-floors`, `npm run floors:fetch <run-id>`, fold into that commit.
- No retries, no raised limits, `Refs #649` (never a closing keyword).

## Review Focus

- A Playwright test runs once per project: three names, never one (Task 3 recorded-run tests; Task 6 `project-dropped`).
- Playwright writes colour codes into its JSON even with `FORCE_COLOR=0` (measured: 180 in the web failure): removed by the reader (Task 3; Task 6 `colour-kept`).
- A spec that does not parse leaves zero tests and one top-level error: named `<file> › (the file)`, and the total check also catches it (Task 3; Task 6 `location-ignored`).
- A mutation that breaks the build: the row misses with the exit status, and a red build refuses the baseline (Task 4; Task 6 `build-exit-ignored`).
- Mutation file names come from a pull request and reach a shell: refused unless `tests/mutations/<[A-Za-z0-9._-]>.ts`, and passed through the environment (Task 5; Task 6 `file-name-loose`).

---

### Task 0: Record Playwright's reports in CI (done before Task 3)

The laptop runs no Playwright, and the reader's tests must exist before the reader, so the reports were recorded first by a push-triggered workflow on the throwaway branch `scratch/649-record-playwright-reports` (commit `bc0bceb`, never merged), run 39053867584: every step green by name; engines clean 15 s, web smoke clean 11 s, timed out 3 s, web failure 13 s, engines failure (colour forced) 34 s, load error 0 s (a parse error stops Playwright before any test). Measured from the artifact: clean engines 27 tests, clean web 12, web failure 3 unexpected, engines failure 24 unexpected, timed out 6 timed out and 21 skipped, load error 0 tests and 1 top-level error.

```diff
diff --git a/.github/scripts-scratch/plant.py b/.github/scripts-scratch/plant.py
new file mode 100644
index 0000000..9e7b5a4
--- /dev/null
+++ b/.github/scripts-scratch/plant.py
@@ -0,0 +1,11 @@
+"""Throwaway (#649): plants one change, asserting its anchor matches once."""
+
+import sys
+
+path, anchor, replacement = sys.argv[1:4]
+text = open(path, encoding="utf-8").read()
+count = text.count(anchor)
+if count != 1:
+    sys.exit(f"{path}: {count} matches of {anchor!r}")
+open(path, "w", encoding="utf-8").write(text.replace(anchor, replacement))
+print(f"planted in {path}")
diff --git a/.github/workflows/record-playwright-reports.yml b/.github/workflows/record-playwright-reports.yml
new file mode 100644
index 0000000..75e2dcc
--- /dev/null
+++ b/.github/workflows/record-playwright-reports.yml
@@ -0,0 +1,82 @@
+# Throwaway (#649): records Playwright JSON reports for the runner's reader
+# tests. Never merged; the branch is deleted once the reports are fetched.
+name: record-playwright-reports
+
+on:
+  push:
+    branches: [scratch/649-record-playwright-reports]
+
+permissions:
+  contents: read
+
+jobs:
+  record:
+    runs-on: ubuntu-latest
+    timeout-minutes: 15
+    container:
+      image: mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
+      options: --user 1001
+    env:
+      CI: 'true'
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
+        with:
+          node-version-file: '.nvmrc'
+          cache: 'npm'
+      - run: npm ci
+      - run: npm run build --workspace @yawelo-idle/web
+      - name: engines, clean
+        env:
+          {
+            PLAYWRIGHT_JSON_OUTPUT_FILE: reports/engines-clean.json,
+            FORCE_COLOR: '0',
+          }
+        run: npx playwright test -c playwright.engines.config.ts --reporter=list,json || echo "exit $?"
+      - name: web smoke, clean
+        env:
+          {
+            PLAYWRIGHT_JSON_OUTPUT_FILE: reports/web-clean.json,
+            FORCE_COLOR: '0',
+          }
+        run: npx playwright test -c playwright.web.config.ts --reporter=list,json || echo "exit $?"
+      - name: engines, timed out
+        env:
+          {
+            PLAYWRIGHT_JSON_OUTPUT_FILE: reports/engines-timed-out.json,
+            FORCE_COLOR: '0',
+          }
+        run: npx playwright test -c playwright.engines.config.ts --timeout=1 --reporter=list,json || echo "exit $?"
+      - name: web smoke, a failed expectation
+        env:
+          {
+            PLAYWRIGHT_JSON_OUTPUT_FILE: reports/web-failed.json,
+            FORCE_COLOR: '0',
+          }
+        run: |
+          python3 .github/scripts-scratch/plant.py tests/web/shell.spec.ts "expect(response?.headers()['content-security-policy']).toContain(" "expect(response?.headers()['content-security-policy']).not.toContain("
+          npx playwright test -c playwright.web.config.ts --reporter=list,json || echo "exit $?"
+      - name: engines, a failed expectation, colour forced
+        env:
+          {
+            PLAYWRIGHT_JSON_OUTPUT_FILE: reports/engines-failed-colour.json,
+            FORCE_COLOR: '1',
+          }
+        run: |
+          python3 .github/scripts-scratch/plant.py tests/engines/golden-vectors.spec.ts ".toBe(digest(fn));" ".toBe(digest(fn) + 'x');"
+          npx playwright test -c playwright.engines.config.ts --reporter=list,json || echo "exit $?"
+      - name: engines, a spec that fails to load
+        env:
+          {
+            PLAYWRIGHT_JSON_OUTPUT_FILE: reports/engines-load-error.json,
+            FORCE_COLOR: '0',
+          }
+        run: |
+          git checkout -- tests/engines/golden-vectors.spec.ts
+          echo 'const broken = (;' >> tests/engines/golden-log.spec.ts
+          npx playwright test -c playwright.engines.config.ts --reporter=list,json || echo "exit $?"
+      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
+        if: ${{ !cancelled() }}
+        with:
+          name: playwright-reports
+          path: reports/
```

### Task 1: The reporter names files from `MUTATE_ROOT`

**Stage commit:** `680958a`

**Files:**

- `scripts/mutate-reporter.ts`
- `tests/unit/mutate-reporter.test.ts`

**Interfaces:** Produces: `ROOT_ENV = 'MUTATE_ROOT'`; `reportRoot(env, vitestRoot): string` in `scripts/mutate-reporter.ts`; the reporter's `onInit` uses it.

- [ ] **Step 1: Write the failing tests**

```diff
diff --git a/tests/unit/mutate-reporter.test.ts b/tests/unit/mutate-reporter.test.ts
index 0dbab80..2c4e250 100644
--- a/tests/unit/mutate-reporter.test.ts
+++ b/tests/unit/mutate-reporter.test.ts
@@ -1,6 +1,8 @@
 import { describe, expect, it } from 'vitest';
 import {
   reportOf,
+  reportRoot,
+  ROOT_ENV,
   type ErrorView,
   type ModuleView,
   type Written,
@@ -131,3 +133,39 @@ describe('reportOf', () => {
     ).toThrow('/elsewhere/a.test.ts is outside /repo');
   });
 });
+
+/**
+ * The root a report names files from (#649, spec §4): a harness suite runs
+ * from its app's folder, so vitest's root would name its files relative to
+ * that folder, while targets and predictions are repository-relative.
+ */
+describe('reportRoot', () => {
+  it('is the repository root the runner names, when it names one', () => {
+    expect(reportRoot({ [ROOT_ENV]: '/repo' }, '/repo/apps/web')).toBe('/repo');
+  });
+
+  it('is vitest’s root when the runner names none', () => {
+    expect(reportRoot({}, '/repo/apps/web')).toBe('/repo/apps/web');
+  });
+
+  it('refuses an empty root', () => {
+    expect(() => reportRoot({ [ROOT_ENV]: '' }, '/repo')).toThrow(
+      'MUTATE_ROOT is set but empty',
+    );
+  });
+
+  it('refuses a relative root', () => {
+    expect(() => reportRoot({ [ROOT_ENV]: 'repo' }, '/repo')).toThrow(
+      'MUTATE_ROOT must be an absolute path, not repo',
+    );
+  });
+
+  it('names a harness file from the repository root', () => {
+    expect(
+      reportOf(
+        [module([], [], '/repo/apps/web/test/game.test.ts')],
+        reportRoot({ [ROOT_ENV]: '/repo' }, '/repo/apps/web'),
+      ).files,
+    ).toEqual(['apps/web/test/game.test.ts']);
+  });
+});
```

- [ ] **Step 2: Run them red**

Run: `npx vitest run tests/unit/mutate-reporter.test.ts`
Expected: 5 FAIL, each `TypeError: reportRoot is not a function` (observed).

- [ ] **Step 3: Implement**

```diff
diff --git a/scripts/mutate-reporter.ts b/scripts/mutate-reporter.ts
index f88abf8..9285845 100644
--- a/scripts/mutate-reporter.ts
+++ b/scripts/mutate-reporter.ts
@@ -10,12 +10,31 @@
  * `MUTATE_REPORT=<path>`; at the end of the run this writes `Written` there.
  */
 import { writeFileSync } from 'node:fs';
-import { posix, relative, sep } from 'node:path';
+import { isAbsolute, posix, relative, sep } from 'node:path';
 import type { Reporter, TestModule, Vitest } from 'vitest/node';

 /** The environment variable naming the file the report is written to. */
 export const REPORT_ENV = 'MUTATE_REPORT';

+/**
+ * The environment variable naming the repository root, when a suite runs from
+ * its own folder (#649): files are named from it, not from vitest's root.
+ */
+export const ROOT_ENV = 'MUTATE_ROOT';
+
+/** The root a report names files from: `MUTATE_ROOT` when set, else vitest's. */
+export function reportRoot(
+  env: Readonly<Record<string, string | undefined>>,
+  vitestRoot: string,
+): string {
+  const named = env[ROOT_ENV];
+  if (named === undefined) return vitestRoot;
+  if (named === '') throw new Error(`${ROOT_ENV} is set but empty`);
+  if (!isAbsolute(named))
+    throw new Error(`${ROOT_ENV} must be an absolute path, not ${named}`);
+  return named;
+}
+
 /** What the reporter writes: the run as the runner judges it. */
 export interface Written {
   /** Every test the run collected, skipped ones too. */
@@ -96,7 +115,7 @@ export default class MutateReporter implements Reporter {
   private root = '';

   onInit(vitest: Vitest): void {
-    this.root = vitest.config.root;
+    this.root = reportRoot(process.env, vitest.config.root);
   }

   onTestRunEnd(testModules: readonly TestModule[]): void {
```

- [ ] **Step 4: Run them green**

Expected: 12 passed (observed).

- [ ] **Step 5: Commit** (`feat(mutate): the reporter names files from MUTATE_ROOT (Refs #649)`)

### Task 2: Every suite mutable, run from its folder, its build pinned to its script

**Stage commit:** `73754ea`

**Files:**

- `apps/site/package.json`
- `scripts/mutate.ts`
- `scripts/record-floors.ts`
- `tests/integration/mutate.test.ts`
- `tests/unit/mutate-builds.test.ts`
- `tests/unit/mutate-run.test.ts`
- `tests/unit/mutate-suites.test.ts`

**Interfaces:** Consumes: Task 1's `ROOT_ENV`. Produces: `SuiteMutate` (record-floors), `MutableSuite { name, cwd, kind, config, build }`, `mutableSuites`, `mutateScript(mutate): string`, `runEnv` adding `MUTATE_ROOT`; `realIo.list` repository-relative through `suiteFiles`; the site's `build:harness` script.

- [ ] **Step 1: Write the failing tests**

```diff
diff --git a/tests/integration/mutate.test.ts b/tests/integration/mutate.test.ts
index 835181b..0e01352 100644
--- a/tests/integration/mutate.test.ts
+++ b/tests/integration/mutate.test.ts
@@ -166,7 +166,7 @@ const SUITES: readonly Suite[] = [
     ],
     files: vitestListed,
     run: { unrecordable: 'a fixture' },
-    mutate: { config: 'vitest.guards.config.ts' },
+    mutate: { kind: 'vitest', config: 'vitest.guards.config.ts' },
   },
 ];

diff --git a/tests/unit/mutate-builds.test.ts b/tests/unit/mutate-builds.test.ts
new file mode 100644
index 0000000..1891f25
--- /dev/null
+++ b/tests/unit/mutate-builds.test.ts
@@ -0,0 +1,74 @@
+import { readFileSync } from 'node:fs';
+import { describe, expect, it } from 'vitest';
+import { mutableSuites, mutateScript } from '../../scripts/mutate';
+import { SUITES } from '../../scripts/record-floors';
+
+/**
+ * The mutation runner builds and runs each suite exactly as the suite's own
+ * package script does (#649, spec §3): a build changed in one place and not
+ * the other would let a mutation run against a stale build.
+ */
+
+/** Each suite the runner can run, and the package script that runs it. */
+const SCRIPTS: readonly (readonly [string, string, string])[] = [
+  ['unit suite', 'package.json', 'test:unit'],
+  ['guards suite', 'package.json', 'test:guards'],
+  ['integration suite', 'package.json', 'test:integration'],
+  ['properties suite', 'package.json', 'test:properties'],
+  ['logs suite', 'package.json', 'test:logs'],
+  ['pacing suite', 'package.json', 'test:pacing'],
+  ['game harness', 'apps/web/package.json', 'test'],
+  ['site harness', 'apps/site/package.json', 'test'],
+  ['dev hosts harness', 'apps/dev-hosts/package.json', 'test'],
+  ['sync Worker harness', 'apps/sync-worker/package.json', 'test'],
+  ['engines suite', 'package.json', 'test:engines'],
+  ['web smoke suite', 'package.json', 'test:web'],
+];
+
+const scriptOf = (path: string, name: string): unknown =>
+  (
+    JSON.parse(readFileSync(path, 'utf8')) as {
+      readonly scripts: Readonly<Record<string, string>>;
+    }
+  ).scripts[name];
+
+describe('mutateScript', () => {
+  it('names a vitest suite under vitest’s default config', () => {
+    expect(mutateScript({ kind: 'vitest' })).toBe('vitest run');
+  });
+
+  it('drops npx from a build, as a package script runs local binaries itself', () => {
+    expect(
+      mutateScript({
+        kind: 'vitest',
+        config: 'vitest.harness.config.ts',
+        build: ['npx', 'vite', 'build'],
+      }),
+    ).toBe('vite build && vitest run -c vitest.harness.config.ts');
+  });
+
+  it('keeps an npm build whole', () => {
+    expect(
+      mutateScript({
+        kind: 'playwright',
+        config: 'playwright.web.config.ts',
+        build: ['npm', 'run', 'build'],
+      }),
+    ).toBe('npm run build && playwright test -c playwright.web.config.ts');
+  });
+});
+
+describe('each suite runs as its package script does', () => {
+  it('pairs every suite the runner can run with its script', () => {
+    expect(SCRIPTS.map(([name]) => name)).toEqual(
+      mutableSuites(SUITES).map((s) => s.name),
+    );
+  });
+
+  it.each(SCRIPTS)('%s: %s "%s"', (name, path, script) => {
+    const mutate = SUITES.find((s) => s.name === name)?.mutate;
+    expect(mutate, `${name} has a mutate value`).toBeDefined();
+    if (mutate === undefined) return;
+    expect(scriptOf(path, script)).toBe(mutateScript(mutate));
+  });
+});
diff --git a/tests/unit/mutate-run.test.ts b/tests/unit/mutate-run.test.ts
index dd36248..9026904 100644
--- a/tests/unit/mutate-run.test.ts
+++ b/tests/unit/mutate-run.test.ts
@@ -17,8 +17,15 @@ import type { Observation } from '../../scripts/record-floors';
  * integration suite runs the real thing.
  */

-const UNIT: MutableSuite = { name: 'unit suite', config: undefined };
+const UNIT: MutableSuite = {
+  name: 'unit suite',
+  cwd: '.',
+  kind: 'vitest',
+  config: undefined,
+  build: undefined,
+};
 const GUARDS: MutableSuite = {
+  ...UNIT,
   name: 'guards suite',
   config: 'vitest.guards.config.ts',
 };
diff --git a/tests/unit/mutate-suites.test.ts b/tests/unit/mutate-suites.test.ts
index fc8da67..ac4487b 100644
--- a/tests/unit/mutate-suites.test.ts
+++ b/tests/unit/mutate-suites.test.ts
@@ -8,13 +8,13 @@ import {
   type RunRequest,
 } from '../../scripts/mutate';
 import { RECORD_ENV, SUITES, type Suite } from '../../scripts/record-floors';
-import { REPORT_ENV } from '../../scripts/mutate-reporter';
+import { REPORT_ENV, ROOT_ENV } from '../../scripts/mutate-reporter';

 /**
  * The suites the mutation runner can run (#527, spec §5), and how it runs
- * them: the six vitest suites run from the root, each under its own config,
- * with both reporters, recording floors only when asked. The harness and
- * Playwright suites wait on #649.
+ * them: each from its own folder, under its own config, after its build
+ * (#649), vitest suites with both reporters naming files from the
+ * repository root, recording floors only when asked.
  */

 const SUITE: Suite = {
@@ -29,46 +29,199 @@ describe('mutableSuites', () => {
   it('keeps a suite with a mutate config, under its name', () => {
     expect(
       mutableSuites([
-        { ...SUITE, mutate: { config: 'vitest.guards.config.ts' } },
+        {
+          ...SUITE,
+          mutate: { kind: 'vitest', config: 'vitest.guards.config.ts' },
+        },
       ]),
-    ).toEqual([{ name: 'guards suite', config: 'vitest.guards.config.ts' }]);
+    ).toEqual<MutableSuite[]>([
+      {
+        name: 'guards suite',
+        cwd: '.',
+        kind: 'vitest',
+        config: 'vitest.guards.config.ts',
+        build: undefined,
+      },
+    ]);
   });

   it('keeps a suite run under vitest’s default config', () => {
     expect(
-      mutableSuites([{ ...SUITE, name: 'unit suite', mutate: {} }]),
-    ).toEqual([{ name: 'unit suite', config: undefined }]);
+      mutableSuites([
+        { ...SUITE, name: 'unit suite', mutate: { kind: 'vitest' } },
+      ]),
+    ).toEqual<MutableSuite[]>([
+      {
+        name: 'unit suite',
+        cwd: '.',
+        kind: 'vitest',
+        config: undefined,
+        build: undefined,
+      },
+    ]);
   });

   it('leaves out a suite with no mutate command', () => {
     expect(
-      mutableSuites([SUITE, { ...SUITE, name: 'unit suite', mutate: {} }]),
-    ).toEqual([{ name: 'unit suite', config: undefined }]);
+      mutableSuites([
+        SUITE,
+        { ...SUITE, name: 'unit suite', mutate: { kind: 'vitest' } },
+      ]).map((s) => s.name),
+    ).toEqual(['unit suite']);
   });

-  it('refuses a mutable suite that does not run from the root', () => {
-    expect(() =>
-      mutableSuites([{ ...SUITE, cwd: 'apps/web', mutate: {} }]),
-    ).toThrow(
-      'guards suite runs from apps/web: the runner runs suites from the root only (#649)',
-    );
+  it('keeps a suite that runs from its own folder, with its build', () => {
+    expect(
+      mutableSuites([
+        {
+          ...SUITE,
+          name: 'game harness',
+          cwd: 'apps/web',
+          mutate: {
+            kind: 'vitest',
+            config: 'vitest.harness.config.ts',
+            build: ['npx', 'vite', 'build'],
+          },
+        },
+      ]),
+    ).toEqual<MutableSuite[]>([
+      {
+        name: 'game harness',
+        cwd: 'apps/web',
+        kind: 'vitest',
+        config: 'vitest.harness.config.ts',
+        build: ['npx', 'vite', 'build'],
+      },
+    ]);
   });

-  it('can run exactly the six root vitest suites, under their own configs', () => {
-    expect(mutableSuites(SUITES)).toEqual([
-      { name: 'unit suite', config: undefined },
-      { name: 'guards suite', config: 'vitest.guards.config.ts' },
-      { name: 'integration suite', config: 'vitest.integration.config.ts' },
-      { name: 'properties suite', config: 'vitest.properties.config.ts' },
-      { name: 'logs suite', config: 'vitest.logs.config.ts' },
-      { name: 'pacing suite', config: 'vitest.pacing.config.ts' },
+  it('keeps a Playwright suite as a Playwright suite', () => {
+    expect(
+      mutableSuites([
+        {
+          ...SUITE,
+          name: 'engines suite',
+          mutate: {
+            kind: 'playwright',
+            config: 'playwright.engines.config.ts',
+          },
+        },
+      ]),
+    ).toEqual<MutableSuite[]>([
+      {
+        name: 'engines suite',
+        cwd: '.',
+        kind: 'playwright',
+        config: 'playwright.engines.config.ts',
+        build: undefined,
+      },
+    ]);
+  });
+
+  it('can run every suite package.json runs, each from its folder, under its config, after its build', () => {
+    expect(mutableSuites(SUITES)).toEqual<MutableSuite[]>([
+      {
+        name: 'unit suite',
+        cwd: '.',
+        kind: 'vitest',
+        config: undefined,
+        build: undefined,
+      },
+      {
+        name: 'guards suite',
+        cwd: '.',
+        kind: 'vitest',
+        config: 'vitest.guards.config.ts',
+        build: undefined,
+      },
+      {
+        name: 'integration suite',
+        cwd: '.',
+        kind: 'vitest',
+        config: 'vitest.integration.config.ts',
+        build: undefined,
+      },
+      {
+        name: 'properties suite',
+        cwd: '.',
+        kind: 'vitest',
+        config: 'vitest.properties.config.ts',
+        build: undefined,
+      },
+      {
+        name: 'logs suite',
+        cwd: '.',
+        kind: 'vitest',
+        config: 'vitest.logs.config.ts',
+        build: undefined,
+      },
+      {
+        name: 'pacing suite',
+        cwd: '.',
+        kind: 'vitest',
+        config: 'vitest.pacing.config.ts',
+        build: undefined,
+      },
+      {
+        name: 'game harness',
+        cwd: 'apps/web',
+        kind: 'vitest',
+        config: 'vitest.harness.config.ts',
+        build: ['npx', 'vite', 'build'],
+      },
+      {
+        name: 'site harness',
+        cwd: 'apps/site',
+        kind: 'vitest',
+        config: 'vitest.harness.config.ts',
+        build: ['npm', 'run', 'build:harness'],
+      },
+      {
+        name: 'dev hosts harness',
+        cwd: 'apps/dev-hosts',
+        kind: 'vitest',
+        config: 'vitest.harness.config.ts',
+        build: [
+          'npx',
+          'wrangler',
+          'pages',
+          'functions',
+          'build',
+          '--outdir',
+          '.build',
+        ],
+      },
+      {
+        name: 'sync Worker harness',
+        cwd: 'apps/sync-worker',
+        kind: 'vitest',
+        config: 'vitest.harness.config.ts',
+        build: undefined,
+      },
+      {
+        name: 'engines suite',
+        cwd: '.',
+        kind: 'playwright',
+        config: 'playwright.engines.config.ts',
+        build: undefined,
+      },
+      {
+        name: 'web smoke suite',
+        cwd: '.',
+        kind: 'playwright',
+        config: 'playwright.web.config.ts',
+        build: ['npm', 'run', 'build', '--workspace', '@yawelo-idle/web'],
+      },
     ]);
   });
 });

 const GUARDS: MutableSuite = {
   name: 'guards suite',
+  cwd: '.',
+  kind: 'vitest',
   config: 'vitest.guards.config.ts',
+  build: undefined,
 };
 const RUN: RunRequest = {
   suite: GUARDS,
@@ -93,7 +246,7 @@ describe('vitestArgs', () => {
   it('names no config for a suite under vitest’s default', () => {
     expect(
       vitestArgs(
-        { ...RUN, suite: { name: 'unit suite', config: undefined } },
+        { ...RUN, suite: { ...GUARDS, name: 'unit suite', config: undefined } },
         REPORTER,
       ),
     ).toEqual([
@@ -116,6 +269,7 @@ describe('runEnv', () => {
     expect(runEnv({ PATH: '/bin' }, RUN, '/repo')).toEqual({
       PATH: '/bin',
       [REPORT_ENV]: '/repo/.mutations/x/blind.json',
+      [ROOT_ENV]: '/repo',
     });
   });

@@ -129,6 +283,7 @@ describe('runEnv', () => {
     ).toEqual({
       PATH: '/bin',
       [REPORT_ENV]: '/repo/.mutations/x/blind.json',
+      [ROOT_ENV]: '/repo',
       [RECORD_ENV]: '/repo/.mutations/x/o.jsonl',
     });
   });
@@ -136,7 +291,11 @@ describe('runEnv', () => {
   it('drops a recording the caller inherited, so a judged run fails on floors', () => {
     expect(
       runEnv({ PATH: '/bin', [RECORD_ENV]: '/tmp/x' }, RUN, '/repo'),
-    ).toEqual({ PATH: '/bin', [REPORT_ENV]: '/repo/.mutations/x/blind.json' });
+    ).toEqual({
+      PATH: '/bin',
+      [REPORT_ENV]: '/repo/.mutations/x/blind.json',
+      [ROOT_ENV]: '/repo',
+    });
   });
 });
```

- [ ] **Step 2: Run them red**

Run: `npx vitest run tests/unit/mutate-suites.test.ts` then `tests/unit/mutate-builds.test.ts`
Expected: 8 FAIL (diffs show the missing `cwd`, `kind`, `build` and `MUTATE_ROOT`); then 15 FAIL `TypeError: mutateScript is not a function` (observed). `npm run typecheck` then names `tests/integration/mutate.test.ts:169`, the fixture suite's untagged `mutate`, fixed in this commit.

- [ ] **Step 3: Implement**

```diff
diff --git a/apps/site/package.json b/apps/site/package.json
index 89f9881..39cf551 100644
--- a/apps/site/package.json
+++ b/apps/site/package.json
@@ -7,7 +7,8 @@
     "build": "astro build",
     "build:holding": "astro build --config astro.holding.config.ts",
     "typecheck": "astro check --minimumSeverity hint && tsc --noEmit -p worker && tsc --noEmit -p test/roadmap-worker",
-    "test": "astro build && astro build --config astro.holding.config.ts && vitest run -c vitest.harness.config.ts",
+    "build:harness": "astro build && astro build --config astro.holding.config.ts",
+    "test": "npm run build:harness && vitest run -c vitest.harness.config.ts",
     "types": "wrangler types worker/worker-configuration.d.ts --strict-vars=false"
   },
   "dependencies": {
diff --git a/scripts/mutate.ts b/scripts/mutate.ts
index cfb7ea8..f267d35 100644
--- a/scripts/mutate.ts
+++ b/scripts/mutate.ts
@@ -29,10 +29,12 @@ import {
 import {
   readFloorsDir,
   RECORD_ENV,
+  suiteFiles,
   type Observation,
   type Suite,
+  type SuiteMutate,
 } from './record-floors.ts';
-import { REPORT_ENV } from './mutate-reporter.ts';
+import { REPORT_ENV, ROOT_ENV } from './mutate-reporter.ts';

 /** The runner's reporter, by absolute path: a fixture repository runs it too. */
 const REPORTER = fileURLToPath(
@@ -250,10 +252,17 @@ export function judge(
   return problems;
 }

-/** A suite the runner can run: its name in `SUITES`, and its vitest config (none: the default). */
+/**
+ * A suite the runner can run: its name in `SUITES`, the folder it runs from,
+ * its runner and config (a vitest suite with none: vitest's default), and the
+ * build it needs first, if any.
+ */
 export interface MutableSuite {
   readonly name: string;
+  readonly cwd: string;
+  readonly kind: 'vitest' | 'playwright';
   readonly config: string | undefined;
+  readonly build: readonly string[] | undefined;
 }

 /** One vitest run of a whole suite. Paths are repository-relative. */
@@ -464,16 +473,40 @@ export async function runFile(
   return { matched, rows: file.mutations.length };
 }

-/** The suites in `suites` the runner can run: those with a `mutate` config, all run from the root. */
+/**
+ * The command line a package script would hold for `mutate`: the build (a
+ * script runs local binaries without npx), then the suite. Each suite's own
+ * script must read exactly this, so the runner builds as the suite does.
+ */
+export function mutateScript(mutate: SuiteMutate): string {
+  const config = mutate.config === undefined ? [] : ['-c', mutate.config];
+  const run =
+    mutate.kind === 'vitest'
+      ? ['vitest', 'run', ...config]
+      : ['playwright', 'test', ...config];
+  const build =
+    mutate.build?.[0] === 'npx' ? mutate.build.slice(1) : mutate.build;
+  return [
+    ...(build === undefined ? [] : [build.join(' ')]),
+    run.join(' '),
+  ].join(' && ');
+}
+
+/** The suites in `suites` the runner can run: those with a `mutate` value. */
 export function mutableSuites(suites: readonly Suite[]): MutableSuite[] {
-  return suites.flatMap((suite) => {
-    if (suite.mutate === undefined) return [];
-    if (suite.cwd !== '.')
-      throw new Error(
-        `${suite.name} runs from ${suite.cwd}: the runner runs suites from the root only (#649)`,
-      );
-    return [{ name: suite.name, config: suite.mutate.config }];
-  });
+  return suites.flatMap(({ name, cwd, mutate }) =>
+    mutate === undefined
+      ? []
+      : [
+          {
+            name,
+            cwd,
+            kind: mutate.kind,
+            config: mutate.config,
+            build: mutate.build,
+          },
+        ],
+  );
 }

 /** A test-name pattern no test matches: `related` then lists files and runs nothing. */
@@ -492,7 +525,10 @@ export function vitestArgs(request: RunRequest, reporter: string): string[] {
   ];
 }

-/** The environment a run gets: the caller's, the report file named, floors recorded only when asked. */
+/**
+ * The environment a run gets: the caller's, the report file and the
+ * repository root named, floors recorded only when asked.
+ */
 export function runEnv(
   base: Readonly<Record<string, string | undefined>>,
   request: RunRequest,
@@ -502,6 +538,7 @@ export function runEnv(
     Object.entries(base).filter(([key]) => key !== RECORD_ENV),
   );
   env[REPORT_ENV] = join(root, request.json);
+  env[ROOT_ENV] = root;
   if (request.recordTo !== undefined)
     env[RECORD_ENV] = join(root, request.recordTo);
   return env;
@@ -593,9 +630,13 @@ export function realIo(options: {
         throw new Error(
           `${entry.list.join(' ')} failed: ${listed.stderr.trim()}`,
         );
-      return entry.files(listed.stdout);
+      return suiteFiles(entry, listed.stdout);
     },
     run: async (request) => {
+      if (request.suite.kind !== 'vitest' || request.suite.build !== undefined)
+        throw new Error(
+          `${request.suite.name}: the runner cannot build or run Playwright yet`,
+        );
       mkdirSync(dirname(at(request.json)), { recursive: true });
       rmSync(at(request.json), { force: true });
       if (request.recordTo !== undefined)
@@ -604,7 +645,7 @@ export function realIo(options: {
         'npx',
         vitestArgs(request, REPORTER),
         {
-          cwd: root,
+          cwd: at(request.suite.cwd),
           env: runEnv(process.env, request, root),
         },
       );
diff --git a/scripts/record-floors.ts b/scripts/record-floors.ts
index 6efd4fc..766ac3f 100644
--- a/scripts/record-floors.ts
+++ b/scripts/record-floors.ts
@@ -175,13 +175,28 @@ export interface Suite {
   /** The command that runs the suite, or why it cannot record. */
   readonly run: readonly string[] | { readonly unrecordable: string };
   /**
-   * How the mutation runner (`scripts/mutate.ts`, #527) runs the whole suite
-   * with vitest: under `config`, or vitest's default when it names none.
-   * Absent: the runner cannot run this suite yet (#649).
+   * How the mutation runner (`scripts/mutate.ts`, #527, #649) runs the whole
+   * suite from `cwd`: with vitest or Playwright, under `config` (vitest's
+   * default when a vitest suite names none), after `build` when the suite
+   * needs one. Absent: the runner cannot run this suite.
    */
-  readonly mutate?: { readonly config?: string };
+  readonly mutate?: SuiteMutate;
 }

+/** How the mutation runner runs a suite (`Suite.mutate`). */
+export type SuiteMutate =
+  | {
+      readonly kind: 'vitest';
+      readonly config?: string;
+      /** Run in `cwd` before the suite, with the mutation planted. */
+      readonly build?: readonly string[];
+    }
+  | {
+      readonly kind: 'playwright';
+      readonly config: string;
+      readonly build?: readonly string[];
+    };
+
 /** `vitest list --filesOnly`: one path per line, relative to its root. */
 export const vitestListed = (stdout: string): string[] =>
   stdout
@@ -217,7 +232,7 @@ export const SUITES: readonly Suite[] = [
     list: VITEST_LIST,
     files: vitestListed,
     run: ['npx', 'vitest', 'run'],
-    mutate: {},
+    mutate: { kind: 'vitest' },
   },
   {
     name: 'guards suite',
@@ -225,7 +240,7 @@ export const SUITES: readonly Suite[] = [
     list: [...VITEST_LIST, '-c', 'vitest.guards.config.ts'],
     files: vitestListed,
     run: ['npm', 'run', 'test:guards'],
-    mutate: { config: 'vitest.guards.config.ts' },
+    mutate: { kind: 'vitest', config: 'vitest.guards.config.ts' },
   },
   {
     name: 'integration suite',
@@ -233,7 +248,7 @@ export const SUITES: readonly Suite[] = [
     list: [...VITEST_LIST, '-c', 'vitest.integration.config.ts'],
     files: vitestListed,
     run: ['npm', 'run', 'test:integration'],
-    mutate: { config: 'vitest.integration.config.ts' },
+    mutate: { kind: 'vitest', config: 'vitest.integration.config.ts' },
   },
   {
     name: 'properties suite',
@@ -241,7 +256,7 @@ export const SUITES: readonly Suite[] = [
     list: [...VITEST_LIST, '-c', 'vitest.properties.config.ts'],
     files: vitestListed,
     run: ['npm', 'run', 'test:properties'],
-    mutate: { config: 'vitest.properties.config.ts' },
+    mutate: { kind: 'vitest', config: 'vitest.properties.config.ts' },
   },
   {
     name: 'logs suite',
@@ -252,7 +267,7 @@ export const SUITES: readonly Suite[] = [
       unrecordable:
         'its counts are measured minimums, recorded by record-minimums (#84, #609), never exact floors',
     },
-    mutate: { config: 'vitest.logs.config.ts' },
+    mutate: { kind: 'vitest', config: 'vitest.logs.config.ts' },
   },
   {
     name: 'pacing suite',
@@ -260,7 +275,7 @@ export const SUITES: readonly Suite[] = [
     list: [...VITEST_LIST, '-c', 'vitest.pacing.config.ts'],
     files: vitestListed,
     run: ['npm', 'run', 'test:pacing'],
-    mutate: { config: 'vitest.pacing.config.ts' },
+    mutate: { kind: 'vitest', config: 'vitest.pacing.config.ts' },
   },
   {
     name: 'game harness',
@@ -269,6 +284,11 @@ export const SUITES: readonly Suite[] = [
     files: vitestListed,
     // Its `test` script builds first: the Worker serves the built ./dist.
     run: ['npm', 'run', 'test'],
+    mutate: {
+      kind: 'vitest',
+      config: 'vitest.harness.config.ts',
+      build: ['npx', 'vite', 'build'],
+    },
   },
   {
     name: 'site harness',
@@ -277,6 +297,11 @@ export const SUITES: readonly Suite[] = [
     files: vitestListed,
     // Its `test` script builds first: the Worker serves the built ./dist.
     run: ['npm', 'run', 'test'],
+    mutate: {
+      kind: 'vitest',
+      config: 'vitest.harness.config.ts',
+      build: ['npm', 'run', 'build:harness'],
+    },
   },
   {
     name: 'dev hosts harness',
@@ -285,6 +310,19 @@ export const SUITES: readonly Suite[] = [
     files: vitestListed,
     // Its `test` script compiles the Function first, into ./.build.
     run: ['npm', 'run', 'test'],
+    mutate: {
+      kind: 'vitest',
+      config: 'vitest.harness.config.ts',
+      build: [
+        'npx',
+        'wrangler',
+        'pages',
+        'functions',
+        'build',
+        '--outdir',
+        '.build',
+      ],
+    },
   },
   {
     name: 'sync Worker harness',
@@ -292,6 +330,7 @@ export const SUITES: readonly Suite[] = [
     list: [...VITEST_LIST, '-c', 'vitest.harness.config.ts'],
     files: vitestListed,
     run: ['npm', 'run', 'test'],
+    mutate: { kind: 'vitest', config: 'vitest.harness.config.ts' },
   },
   {
     name: 'engines suite',
@@ -307,6 +346,7 @@ export const SUITES: readonly Suite[] = [
     ],
     files: (stdout) => playwrightListed(process.cwd())(stdout),
     run: ['npm', 'run', 'test:engines'],
+    mutate: { kind: 'playwright', config: 'playwright.engines.config.ts' },
   },
   {
     name: 'web smoke suite',
@@ -323,6 +363,11 @@ export const SUITES: readonly Suite[] = [
     files: (stdout) => playwrightListed(process.cwd())(stdout),
     // Its script builds the game first: the local Worker serves ./dist.
     run: ['npm', 'run', 'test:web'],
+    mutate: {
+      kind: 'playwright',
+      config: 'playwright.web.config.ts',
+      build: ['npm', 'run', 'build', '--workspace', '@yawelo-idle/web'],
+    },
   },
 ];
```

- [ ] **Step 4: Run them green**

Expected: 116 passed over the four runner test files; 16 passed in `mutate-builds.test.ts`; typecheck 0 errors (observed).

- [ ] **Step 5: Commit** (`feat(mutate): every suite in SUITES is mutable, run from its folder, its build pinned to its script (Refs #649)`)

### Task 3: Read Playwright's JSON report, on runs recorded in CI

**Stage commit:** `6e8f0cc`

**Files:**

- `scripts/mutate.ts`
- `tests/unit/fixtures/mutate/playwright-engines-clean.json`
- `tests/unit/fixtures/mutate/playwright-engines-failed-colour.json`
- `tests/unit/fixtures/mutate/playwright-engines-load-error.json`
- `tests/unit/fixtures/mutate/playwright-engines-timed-out.json`
- `tests/unit/fixtures/mutate/playwright-web-clean.json`
- `tests/unit/fixtures/mutate/playwright-web-failed.json`
- `tests/unit/mutate-playwright.test.ts`

**Interfaces:** Produces: `readPlaywrightReport(json, root, config): Report`. Consumes: Task 0's six recorded reports, formatted by Prettier with their values proven unchanged (`JSON.stringify` of each, recorded vs committed: same values, all six).

- [ ] **Step 1: Write the failing tests**

The fixtures are Task 0's six reports, copied from run 39053867584's artifact and formatted by Prettier (values unchanged); not repeated here.

```diff
diff --git a/tests/unit/mutate-playwright.test.ts b/tests/unit/mutate-playwright.test.ts
new file mode 100644
index 0000000..2b45161
--- /dev/null
+++ b/tests/unit/mutate-playwright.test.ts
@@ -0,0 +1,204 @@
+import { readFileSync } from 'node:fs';
+import { describe, expect, it } from 'vitest';
+import { readPlaywrightReport, type Report } from '../../scripts/mutate';
+
+/**
+ * The runner reads a Playwright run (#649, spec §5) into the same report it
+ * reads from its vitest reporter. The reports here were recorded in CI by
+ * Playwright 1.63.0 (run 39053867584), from the repository at
+ * `/__w/yawelo-idle/yawelo-idle`, before the reader was written: each suite
+ * clean and with a failed expectation, and the engines suite with every
+ * test given 1 ms and with a spec that does not parse.
+ */
+
+const CWD = '/__w/yawelo-idle/yawelo-idle';
+const ENGINES = 'playwright.engines.config.ts';
+const WEB = 'playwright.web.config.ts';
+const ESC = String.fromCharCode(27);
+const PROJECTS = ['chromium', 'firefox', 'webkit'];
+
+const recorded = (name: string): unknown =>
+  JSON.parse(
+    readFileSync(`tests/unit/fixtures/mutate/playwright-${name}.json`, 'utf8'),
+  ) as unknown;
+
+const read = (name: string, config: string): Report =>
+  readPlaywrightReport(recorded(name), CWD, config);
+
+const CSP =
+  'the shell runs under its Content Security Policy with no violation';
+
+describe('readPlaywrightReport, on recorded runs', () => {
+  it('reads a clean engines run: every test once per project, no failure', () => {
+    expect(read('engines-clean', ENGINES)).toEqual<Report>({
+      total: 27,
+      files: [
+        'tests/engines/golden-log.spec.ts',
+        'tests/engines/golden-vectors.spec.ts',
+      ],
+      failing: [],
+      timedOut: [],
+    });
+  });
+
+  it('reads a clean web smoke run', () => {
+    expect(read('web-clean', WEB)).toEqual<Report>({
+      total: 12,
+      files: ['tests/web/shell.spec.ts'],
+      failing: [],
+      timedOut: [],
+    });
+  });
+
+  it('names a failed test once per project, with its file and project', () => {
+    expect(read('web-failed', WEB).failing.map((f) => f.name)).toEqual(
+      PROJECTS.map((p) => `tests/web/shell.spec.ts › ${p} > ${CSP}`),
+    );
+  });
+
+  it('keeps the total of a run with failures', () => {
+    expect(read('web-failed', WEB).total).toBe(12);
+  });
+
+  it('keeps a failure’s expectation and its source line', () => {
+    const [first] = read('web-failed', WEB).failing;
+    expect(first?.text).toContain('not.toContain');
+    expect(first?.text).toContain('content-security-policy');
+  });
+
+  it('removes the colour codes Playwright writes even with FORCE_COLOR=0', () => {
+    expect(
+      read('web-failed', WEB).failing.filter((f) => f.text.includes(ESC)),
+    ).toEqual([]);
+    expect(
+      JSON.stringify(recorded('web-failed')).includes('\\u001b['),
+      'the recorded run holds colour codes',
+    ).toBe(true);
+  });
+
+  it('removes forced colour codes from every failure', () => {
+    const { failing } = read('engines-failed-colour', ENGINES);
+    expect(failing).toHaveLength(24);
+    expect(failing.filter((f) => f.text.includes(ESC))).toEqual([]);
+  });
+
+  it('names a test that timed out, and counts it failing', () => {
+    const report = read('engines-timed-out', ENGINES);
+    const timedOut = [
+      'tests/engines/golden-log.spec.ts › %s > the golden log replays to its recorded hash',
+      'tests/engines/golden-vectors.spec.ts › %s > pow gives the same bits as Node on 100,000 vectors',
+    ].flatMap((name) => PROJECTS.map((p) => name.replace('%s', p)));
+    expect([...report.timedOut].sort()).toEqual([...timedOut].sort());
+    expect(report.failing.map((f) => f.name).sort()).toEqual(
+      [...timedOut].sort(),
+    );
+  });
+
+  it('counts skipped tests in the total, never as failing', () => {
+    expect(read('engines-timed-out', ENGINES).total).toBe(27);
+  });
+
+  it('names a spec that does not parse as its file, failing', () => {
+    const report = read('engines-load-error', ENGINES);
+    expect(report.failing.map((f) => f.name)).toEqual([
+      'tests/engines/golden-log.spec.ts › (the file)',
+    ]);
+    expect(report.failing[0]?.text).toContain('SyntaxError');
+    expect(report.total).toBe(0);
+  });
+});
+
+/** The smallest report Playwright writes for one test, in `cwd`'s `tests`. */
+function oneTest(test: Record<string, unknown>, titles: string[] = []) {
+  const spec = { title: 'reads', file: 'a.spec.ts', tests: [test] };
+  // Each describe title wraps the next level; the spec sits in the last.
+  const nest = (rest: string[]): Record<string, unknown> =>
+    rest.length === 0
+      ? { specs: [spec], suites: [] }
+      : { specs: [], suites: [{ title: rest[0], ...nest(rest.slice(1)) }] };
+  return {
+    config: { rootDir: '/repo/tests' },
+    suites: [{ title: 'a.spec.ts', file: 'a.spec.ts', ...nest(titles) }],
+    errors: [],
+  };
+}
+
+const FAILED = {
+  projectName: 'webkit',
+  status: 'unexpected',
+  results: [{ status: 'failed', errors: [{ message: 'expected 1 to be 2' }] }],
+};
+
+describe('readPlaywrightReport, on the shapes it reads', () => {
+  it('names every describe between the project and the title', () => {
+    expect(
+      readPlaywrightReport(oneTest(FAILED, ['outer', 'inner']), '/repo', WEB)
+        .failing,
+    ).toEqual([
+      {
+        name: 'tests/a.spec.ts › webkit > outer > inner > reads',
+        text: 'expected 1 to be 2',
+      },
+    ]);
+  });
+
+  it('counts a flaky test failing: the runner allows no retry', () => {
+    expect(
+      readPlaywrightReport(
+        oneTest({ ...FAILED, status: 'flaky' }),
+        '/repo',
+        WEB,
+      ).failing.map((f) => f.name),
+    ).toEqual(['tests/a.spec.ts › webkit > reads']);
+  });
+
+  it('names an error outside any file as the run', () => {
+    expect(
+      readPlaywrightReport(
+        {
+          ...oneTest({ ...FAILED, status: 'expected', results: [] }),
+          errors: [
+            { message: 'Timed out waiting 60000ms from config.webServer.' },
+          ],
+        },
+        '/repo',
+        WEB,
+      ).failing,
+    ).toEqual([
+      {
+        name: `${WEB} › (the run)`,
+        text: 'Timed out waiting 60000ms from config.webServer.',
+      },
+    ]);
+  });
+
+  it('refuses a report that is not an object', () => {
+    expect(() => readPlaywrightReport([], '/repo', WEB)).toThrow(
+      'the Playwright report is not an object',
+    );
+  });
+
+  it('refuses a test whose status it does not know', () => {
+    expect(() =>
+      readPlaywrightReport(
+        oneTest({ ...FAILED, status: 'unknown' }),
+        '/repo',
+        WEB,
+      ),
+    ).toThrow(
+      'the Playwright report gives tests/a.spec.ts › webkit > reads the status unknown',
+    );
+  });
+
+  it('refuses a test with no project', () => {
+    expect(() =>
+      readPlaywrightReport(
+        oneTest({ status: 'expected', results: [] }),
+        '/repo',
+        WEB,
+      ),
+    ).toThrow(
+      'the Playwright report has a test with no project in tests/a.spec.ts',
+    );
+  });
+});
```

- [ ] **Step 2: Run them red**

Run: `npx vitest run tests/unit/mutate-playwright.test.ts`
Expected: 16 FAIL, 13 as `TypeError: readPlaywrightReport is not a function` and 3 refusals whose message differs for the same reason (observed). The first green run left one red: the test's own builder put the spec in an untitled suite; the builder was fixed (each title wraps the next level), not the reader.

- [ ] **Step 3: Implement**

```diff
diff --git a/scripts/mutate.ts b/scripts/mutate.ts
index f267d35..01403e2 100644
--- a/scripts/mutate.ts
+++ b/scripts/mutate.ts
@@ -18,7 +18,7 @@ import {
   rmSync,
   writeFileSync,
 } from 'node:fs';
-import { dirname, join, posix } from 'node:path';
+import { dirname, join, posix, relative, sep } from 'node:path';
 import { fileURLToPath } from 'node:url';
 import {
   FILE_SEPARATOR,
@@ -96,6 +96,124 @@ export function readReport(json: unknown): Report {
   };
 }

+/** A terminal colour or cursor code, which Playwright writes into its JSON even with FORCE_COLOR=0. */
+const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');
+
+/** How Playwright ends a test (`TestCase.outcome()`). */
+const OUTCOMES = new Set(['expected', 'unexpected', 'flaky', 'skipped']);
+
+/**
+ * Reads Playwright's JSON report (#649, spec §5) into the runner's report:
+ * each test once per project, named `<file> › <project> > <describe> > … >
+ * <title>`, files repository-relative from `root` (where the suite ran). A
+ * flaky test counts failing (the runner allows no retry). An error outside
+ * any test is named by its file, or by `config` when it has none. Any shape
+ * it does not know is refused rather than read as a clean run.
+ */
+export function readPlaywrightReport(
+  json: unknown,
+  root: string,
+  config: string,
+): Report {
+  const refuse = (why: string): never => {
+    throw new Error(`the Playwright report ${why}`);
+  };
+  if (!isRecord(json)) return refuse('is not an object');
+  const { config: run, suites, errors } = json;
+  if (!isRecord(run) || typeof run.rootDir !== 'string')
+    return refuse('names no rootDir');
+  const rootDir = run.rootDir;
+  if (!Array.isArray(suites)) return refuse('has no list of suites');
+  if (!Array.isArray(errors)) return refuse('has no list of errors');
+  const fromRoot = (path: string): string =>
+    relative(root, path).split(sep).join(posix.sep);
+  const textOf = (list: unknown, where: string): string => {
+    if (!Array.isArray(list))
+      return refuse(`has no list of errors for ${where}`);
+    return list
+      .flatMap((e: unknown) => {
+        if (!isRecord(e) || typeof e.message !== 'string')
+          return refuse(`has an error with no message for ${where}`);
+        return [e.message, e.snippet, e.stack].filter(
+          (part): part is string => typeof part === 'string' && part !== '',
+        );
+      })
+      .join('\n')
+      .replace(ANSI, '');
+  };
+
+  let total = 0;
+  const files: string[] = [];
+  const failing: FailedTest[] = [];
+  const timedOut: string[] = [];
+  const walk = (suite: unknown, file: string, titles: readonly string[]) => {
+    if (!isRecord(suite))
+      return refuse(`has a suite that is not an object in ${file}`);
+    const specs = suite.specs ?? [];
+    const inner = suite.suites ?? [];
+    if (!Array.isArray(specs) || !Array.isArray(inner))
+      return refuse(`has a suite with no specs or suites in ${file}`);
+    for (const spec of specs) {
+      if (
+        !isRecord(spec) ||
+        typeof spec.title !== 'string' ||
+        !Array.isArray(spec.tests)
+      )
+        return refuse(`has a spec it cannot read in ${file}`);
+      for (const test of spec.tests as unknown[]) {
+        if (
+          !isRecord(test) ||
+          typeof test.projectName !== 'string' ||
+          test.projectName === ''
+        )
+          return refuse(`has a test with no project in ${file}`);
+        const name = `${file} › ${[test.projectName, ...titles, spec.title].join(' > ')}`;
+        if (typeof test.status !== 'string' || !OUTCOMES.has(test.status))
+          return refuse(`gives ${name} the status ${String(test.status)}`);
+        if (!Array.isArray(test.results))
+          return refuse(`has no results for ${name}`);
+        total += 1;
+        if (test.status !== 'unexpected' && test.status !== 'flaky') continue;
+        const results = test.results as unknown[];
+        failing.push({
+          name,
+          text: results
+            .map((r) =>
+              isRecord(r)
+                ? textOf(r.errors, name)
+                : refuse(`has a result it cannot read for ${name}`),
+            )
+            .filter((text) => text !== '')
+            .join('\n'),
+        });
+        if (results.some((r) => isRecord(r) && r.status === 'timedOut'))
+          timedOut.push(name);
+      }
+    }
+    for (const each of inner) {
+      if (!isRecord(each) || typeof each.title !== 'string')
+        return refuse(`has a describe with no title in ${file}`);
+      walk(each, file, [...titles, each.title]);
+    }
+  };
+  for (const top of suites) {
+    if (!isRecord(top) || typeof top.file !== 'string')
+      return refuse('has a file suite that names no file');
+    const file = fromRoot(join(rootDir, top.file));
+    files.push(file);
+    walk(top, file, []);
+  }
+  for (const error of errors) {
+    const location = isRecord(error) ? error.location : undefined;
+    const name =
+      isRecord(location) && typeof location.file === 'string'
+        ? `${fromRoot(location.file)} › (the file)`
+        : `${config} › (the run)`;
+    failing.push({ name, text: textOf([error], name) });
+  }
+  return { total, files, failing, timedOut };
+}
+
 /** `n test(s) timed out: <names>`, or nothing. */
 const timedOutLine = (timedOut: readonly string[]): string[] =>
   timedOut.length === 0
```

- [ ] **Step 4: Run them green**

Expected: 16 passed (observed).

- [ ] **Step 5: Commit** (`feat(mutate): read Playwright's JSON report, tested on six runs recorded in CI (Refs #649)`)

### Task 4: Build before the suite under one ceiling, run Playwright, list only the unit suite on the laptop

**Stage commit:** `dab0ba8`

**Files:**

- `scripts/mutate.ts`
- `tests/unit/mutate-run.test.ts`
- `tests/unit/mutate-suites.test.ts`
- `tests/unit/mutate.test.ts`

**Interfaces:** Consumes: Tasks 2 and 3. Produces: `RunOutcome.buildExit`; `runFile` reading by kind; `laptopRefusal(targets): string` (replacing the per-suite check, which can no longer fire); `playwrightArgs(request)`, `playwrightEnv(base, request, root)`; `spawnBounded(..., deadline)` returning the exit status; `realIo.run` building first.

- [ ] **Step 1: Write the failing tests**

```diff
diff --git a/tests/unit/mutate-run.test.ts b/tests/unit/mutate-run.test.ts
index 9026904..295c0f2 100644
--- a/tests/unit/mutate-run.test.ts
+++ b/tests/unit/mutate-run.test.ts
@@ -55,6 +55,10 @@ interface Answer {
   readonly ceilingHit?: boolean;
   readonly noReport?: boolean;
   readonly observations?: readonly Observation[];
+  /** The build exited with this non-zero status, so the suite never ran. */
+  readonly buildExit?: number;
+  /** What Playwright wrote, for a Playwright suite. */
+  readonly playwright?: unknown;
 }

 /** What the runner's reporter would write for `answer`. */
@@ -75,6 +79,8 @@ interface Stand {
   /** The text of the mutated file each run saw. */
   readonly seen: string[];
   readonly guarded: string[];
+  /** The suites listed, in order. */
+  readonly listed: string[];
 }

 function stand(
@@ -95,6 +101,7 @@ function stand(
   const printed: string[] = [];
   const seen: string[] = [];
   const guarded: string[] = [];
+  const listed: string[] = [];
   const observed = new Map<string, readonly Observation[]>();
   const listings =
     options.listings ??
@@ -122,7 +129,10 @@ function stand(
       !(options.dirty ?? []).includes(path) &&
       !(options.dirtyAtEnd === true && next === answers.length) &&
       (path !== SRC || files.get(SRC) === ORIGINAL),
-    list: (suite) => listings.get(suite.name) ?? [],
+    list: (suite) => {
+      listed.push(suite.name);
+      return listings.get(suite.name) ?? [];
+    },
     run: (request) => {
       runs.push(request);
       seen.push(files.get(SRC) ?? '');
@@ -135,9 +145,15 @@ function stand(
       if (request.recordTo !== undefined)
         observed.set(request.recordTo, answer.observations ?? []);
       const outcome: RunOutcome = {
-        json: answer.noReport === true ? undefined : written(answer),
+        json:
+          answer.noReport === true || answer.buildExit !== undefined
+            ? undefined
+            : (answer.playwright ?? written(answer)),
         log: '',
         ceilingHit: answer.ceilingHit ?? false,
+        ...(answer.buildExit === undefined
+          ? {}
+          : { buildExit: answer.buildExit }),
       };
       return Promise.resolve(outcome);
     },
@@ -147,7 +163,7 @@ function stand(
     release: (path) => guarded.push(`release ${path}`),
     print: (line) => printed.push(line),
   };
-  return { io, runs, printed, files, seen, guarded };
+  return { io, runs, printed, files, seen, guarded, listed };
 }

 const GREEN: Answer = { files: [TARGET] };
@@ -264,9 +280,9 @@ describe('runFile', () => {
       `${SRC} differs from HEAD: commit or restore it first`,
     ],
     [
-      'targets in no suite it can run',
-      { listings: new Map() },
-      `${TARGET} is in no suite the runner can run (the harness and Playwright suites wait on #649)`,
+      'targets in no suite it can run, in CI',
+      { ci: true, listings: new Map() },
+      `${TARGET} is in no suite the runner can run`,
     ],
   ])('refuses %s before running anything', async (_case, options, refusal) => {
     const s = stand([], options);
@@ -282,15 +298,22 @@ describe('runFile', () => {
     ).rejects.toThrow('tests/mutations/x.ts: names no targets');
   });

-  it('refuses a non-unit suite on the laptop before running anything', async () => {
+  it('refuses on the laptop a target the unit suite does not list, listing no other suite', async () => {
     const s = stand([], {
       listings: new Map([['guards suite', [TARGET]]]),
     });
     await expect(
       runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
     ).rejects.toThrow(
-      'tests/mutations/x.ts: guards suite: the laptop runs the unit suite only',
+      `tests/mutations/x.ts: ${TARGET}: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it`,
     );
+    expect(s.listed).toEqual(['unit suite']);
+  });
+
+  it('lists every suite in CI', async () => {
+    const s = stand([GREEN, BLIND], { ci: true });
+    await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES);
+    expect(s.listed).toEqual(['unit suite', 'guards suite']);
   });

   it('refuses a red baseline, naming each failure, and plants nothing', async () => {
@@ -411,3 +434,97 @@ describe('runFile in the guards suite (CI)', () => {
     ]);
   });
 });
+
+describe('runFile in a suite that builds first (CI)', () => {
+  const HARNESS: MutableSuite = {
+    name: 'game harness',
+    cwd: 'apps/web',
+    kind: 'vitest',
+    config: 'vitest.harness.config.ts',
+    build: ['npx', 'vite', 'build'],
+  };
+  const options = {
+    ci: true,
+    listings: new Map([['game harness', [TARGET]]]),
+  };
+
+  it('misses a row whose build failed, naming the exit status', async () => {
+    const s = stand([GREEN, { buildExit: 2 }], options);
+    expect(
+      await runFile(s.io, 'tests/mutations/x.ts', FILE, [HARNESS]),
+    ).toEqual({ matched: 0, rows: 1 });
+    expect(s.printed).toContain('MISS reader-blind');
+    expect(s.printed).toContain('  game harness: build failed (exit 2)');
+    expect(s.files.get(SRC)).toBe(ORIGINAL);
+  });
+
+  it('refuses a baseline whose build failed', async () => {
+    const s = stand([{ buildExit: 1 }], options);
+    await expect(
+      runFile(s.io, 'tests/mutations/x.ts', FILE, [HARNESS]),
+    ).rejects.toThrow(
+      'the game harness is red before any mutation:\n  game harness: build failed (exit 1)',
+    );
+  });
+});
+
+describe('runFile in a Playwright suite (CI)', () => {
+  const SMOKE: MutableSuite = {
+    name: 'web smoke suite',
+    cwd: '.',
+    kind: 'playwright',
+    config: 'playwright.web.config.ts',
+    build: undefined,
+  };
+  const SPEC = 'tests/web/a.spec.ts';
+  const WEBKIT = `${SPEC} › webkit > reads`;
+
+  /** What Playwright writes for one test in `tests/web/a.spec.ts`. */
+  const ran = (status: string, message?: string) => ({
+    config: { rootDir: '/repo/tests/web' },
+    suites: [
+      {
+        title: 'a.spec.ts',
+        file: 'a.spec.ts',
+        specs: [
+          {
+            title: 'reads',
+            tests: [
+              {
+                projectName: 'webkit',
+                status,
+                results:
+                  message === undefined
+                    ? [{ status: 'passed', errors: [] }]
+                    : [{ status: 'failed', errors: [{ message }] }],
+              },
+            ],
+          },
+        ],
+        suites: [],
+      },
+    ],
+    errors: [],
+  });
+
+  it('judges the run through Playwright’s report', async () => {
+    const s = stand(
+      [
+        { playwright: ran('expected') },
+        { playwright: ran('unexpected', 'expected 2 items, got 1') },
+      ],
+      { ci: true, listings: new Map([['web smoke suite', [SPEC]]]) },
+    );
+    expect(
+      await runFile(
+        s.io,
+        'tests/mutations/x.ts',
+        {
+          targets: [SPEC],
+          mutations: [{ ...MUTATION, red: { [WEBKIT]: '2 items' } }],
+        },
+        [SMOKE],
+      ),
+    ).toEqual({ matched: 1, rows: 1 });
+  });
+});
diff --git a/tests/unit/mutate-suites.test.ts b/tests/unit/mutate-suites.test.ts
index ac4487b..c907abe 100644
--- a/tests/unit/mutate-suites.test.ts
+++ b/tests/unit/mutate-suites.test.ts
@@ -1,6 +1,8 @@
 import { describe, expect, it } from 'vitest';
 import {
   mutableSuites,
+  playwrightArgs,
+  playwrightEnv,
   readObservations,
   runEnv,
   vitestArgs,
@@ -299,6 +301,63 @@ describe('runEnv', () => {
   });
 });

+const SMOKE: RunRequest = {
+  suite: {
+    name: 'web smoke suite',
+    cwd: '.',
+    kind: 'playwright',
+    config: 'playwright.web.config.ts',
+    build: undefined,
+  },
+  json: '.mutations/x/blind.json',
+  log: '.mutations/x/blind.log',
+};
+
+describe('playwrightArgs', () => {
+  it('runs the whole suite under its config, listing for people and writing JSON for the runner', () => {
+    expect(playwrightArgs(SMOKE)).toEqual([
+      'playwright',
+      'test',
+      '-c',
+      'playwright.web.config.ts',
+      '--reporter=list,json',
+    ]);
+  });
+
+  it('refuses a Playwright suite with no config', () => {
+    expect(() =>
+      playwrightArgs({
+        ...SMOKE,
+        suite: { ...SMOKE.suite, config: undefined },
+      }),
+    ).toThrow('web smoke suite names no Playwright config');
+  });
+
+  it('refuses a floor record or an importer listing, which only the guards suite takes', () => {
+    expect(() => playwrightArgs({ ...SMOKE, related: 'src/a.ts' })).toThrow(
+      'web smoke suite: only the guards suite records floors or lists importers',
+    );
+  });
+});
+
+describe('playwrightEnv', () => {
+  it('names the file Playwright writes its JSON report to', () => {
+    expect(playwrightEnv({ PATH: '/bin' }, SMOKE, '/repo')).toEqual({
+      PATH: '/bin',
+      PLAYWRIGHT_JSON_OUTPUT_FILE: '/repo/.mutations/x/blind.json',
+    });
+  });
+
+  it('drops a floor recording the caller inherited', () => {
+    expect(
+      playwrightEnv({ PATH: '/bin', [RECORD_ENV]: '/tmp/x' }, SMOKE, '/repo'),
+    ).toEqual({
+      PATH: '/bin',
+      PLAYWRIGHT_JSON_OUTPUT_FILE: '/repo/.mutations/x/blind.json',
+    });
+  });
+});
+
 describe('readObservations', () => {
   it('reads one floor check a line', () => {
     expect(
diff --git a/tests/unit/mutate.test.ts b/tests/unit/mutate.test.ts
index 73377fd..117310b 100644
--- a/tests/unit/mutate.test.ts
+++ b/tests/unit/mutate.test.ts
@@ -103,8 +103,7 @@ describe('suiteOf', () => {

   it('refuses a target no suite lists', () => {
     expect(suiteOf(['apps/web/test/game.test.ts'], listings)).toEqual({
-      refusal:
-        'apps/web/test/game.test.ts is in no suite the runner can run (the harness and Playwright suites wait on #649)',
+      refusal: 'apps/web/test/game.test.ts is in no suite the runner can run',
     });
   });

@@ -123,19 +122,13 @@ describe('suiteOf', () => {
 });

 describe('laptopRefusal', () => {
-  it('lets the unit suite run on the laptop', () => {
-    expect(laptopRefusal('unit suite', false)).toBeUndefined();
-  });
-
-  it('refuses any other suite on the laptop', () => {
-    expect(laptopRefusal('pacing suite', false)).toBe(
-      'pacing suite: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it',
+  it('names each target the laptop cannot run, and why', () => {
+    expect(
+      laptopRefusal(['tests/guards/a.test.ts', 'tests/guards/b.test.ts']),
+    ).toBe(
+      'tests/guards/a.test.ts, tests/guards/b.test.ts: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it',
     );
   });
-
-  it('lets any suite run in CI', () => {
-    expect(laptopRefusal('pacing suite', true)).toBeUndefined();
-  });
 });

 describe('corpusPredictions', () => {
```

- [ ] **Step 2: Run them red**

Run: `npx vitest run tests/unit/mutate-run.test.ts tests/unit/mutate.test.ts` then `tests/unit/mutate-suites.test.ts`
Expected: 5 FAIL in `runFile` (laptop listing, build exit twice, the Playwright judge, the no-suite text); `laptopRefusal` 1 FAIL (the old signature prints the array); after the laptop change, the no-suite row fails on the laptop sentence and moves to CI (`ci: true`); `playwrightArgs`/`playwrightEnv` 5 FAIL as not functions (observed).

- [ ] **Step 3: Implement**

```diff
diff --git a/scripts/mutate.ts b/scripts/mutate.ts
index 01403e2..0e67695 100644
--- a/scripts/mutate.ts
+++ b/scripts/mutate.ts
@@ -250,7 +250,7 @@ export function suiteOf(
       .map(([name]) => name);
     if (suites.length === 0)
       return {
-        refusal: `${target} is in no suite the runner can run (the harness and Playwright suites wait on #649)`,
+        refusal: `${target} is in no suite the runner can run`,
       };
     if (suites.length > 1)
       return { refusal: `${target} is listed by ${suites.join(' and ')}` };
@@ -266,10 +266,9 @@ export function suiteOf(

 export const UNIT_SUITE = 'unit suite';

-/** Why `suite` may not run here: the laptop runs the unit suite only. */
-export function laptopRefusal(suite: string, ci: boolean): string | undefined {
-  if (ci || suite === UNIT_SUITE) return undefined;
-  return `${suite}: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it`;
+/** Why `targets`, which the unit suite does not list, cannot run here: the laptop runs the unit suite only. */
+export function laptopRefusal(targets: readonly string[]): string {
+  return `${targets.join(', ')}: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it`;
 }

 /** A whole-repo floor the planted text moves, and the text its failure shows. */
@@ -401,6 +400,8 @@ export interface RunOutcome {
   readonly log: string;
   /** Whether the run passed the ceiling and was stopped. */
   readonly ceilingHit: boolean;
+  /** The suite's build exited with this non-zero status, so it never ran. */
+  readonly buildExit?: number;
 }

 /** Everything `runFile` does outside its own logic, so a stand-in can drive it. */
@@ -432,14 +433,27 @@ export const LOG_DIR = '.mutations';
 const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
   a.length === b.length && a.every((byte, i) => byte === b[i]);

-/** The problems of one suite run that is meant to be clean. */
-function redBaseline(outcome: RunOutcome, suite: string): string[] {
+/** How a run of `suite` ended without a report to judge, if it did. */
+function unrun(outcome: RunOutcome, suite: string): string[] {
   if (outcome.ceilingHit)
     return [
       `${suite} ran past the ${String(CEILING_SECONDS)} s ceiling and was stopped`,
     ];
+  if (outcome.buildExit !== undefined)
+    return [`${suite}: build failed (exit ${String(outcome.buildExit)})`];
+  return [];
+}
+
+/** The problems of one suite run that is meant to be clean. */
+function redBaseline(
+  outcome: RunOutcome,
+  suite: string,
+  read: (json: unknown) => Report,
+): string[] {
+  const stopped = unrun(outcome, suite);
+  if (stopped.length > 0) return stopped;
   if (outcome.json === undefined) return [NO_REPORT];
-  const report = readReport(outcome.json);
+  const report = read(outcome.json);
   return [
     ...report.failing.map((f) => `${f.name}: ${firstLine(f.text)}`),
     ...timedOutLine(report.timedOut),
@@ -471,14 +485,24 @@ export async function runFile(
     if (!io.clean(each))
       refuse(`${each} differs from HEAD: commit or restore it first`);
   }
-  const choice = suiteOf(
-    file.targets,
-    new Map(suites.map((s) => [s.name, io.list(s)])),
+  // The laptop lists the unit suite only: no other suite's listing starts there.
+  const listings = new Map(
+    (io.ci ? suites : suites.filter((s) => s.name === UNIT_SUITE)).map((s) => [
+      s.name,
+      io.list(s),
+    ]),
   );
-  if ('refusal' in choice) return refuse(choice.refusal);
+  const choice = suiteOf(file.targets, listings);
+  if ('refusal' in choice) {
+    if (io.ci) return refuse(choice.refusal);
+    const unit = listings.get(UNIT_SUITE) ?? [];
+    return refuse(laptopRefusal(file.targets.filter((t) => !unit.includes(t))));
+  }
   const suite = suites.find((s) => s.name === choice.suite) as MutableSuite;
-  const laptop = laptopRefusal(suite.name, io.ci);
-  if (laptop !== undefined) refuse(laptop);
+  const read = (json: unknown): Report =>
+    suite.kind === 'playwright'
+      ? readPlaywrightReport(json, io.root, suite.config ?? suite.name)
+      : readReport(json);

   const dir = `${LOG_DIR}/${posix.basename(path).replace(/\.[^.]*$/, '')}`;
   const at = (name: string, ext: string) => `${dir}/${name}.${ext}`;
@@ -487,12 +511,12 @@ export async function runFile(
     json: at('baseline', 'json'),
     log: at('baseline', 'log'),
   });
-  const red = redBaseline(baseline, suite.name);
+  const red = redBaseline(baseline, suite.name, read);
   if (red.length > 0)
     refuse(
       `the ${suite.name} is red before any mutation:\n  ${red.join('\n  ')}`,
     );
-  const baselineTotal = readReport(baseline.json).total;
+  const baselineTotal = read(baseline.json).total;

   const importers = new Map<string, ReadonlySet<string>>();
   const importersOf = async (target: string): Promise<ReadonlySet<string>> => {
@@ -562,16 +586,16 @@ export async function runFile(
       throw new Error(
         `${mutation.file} did not read back as it was before ${mutation.name}`,
       );
-    const found = outcome.ceilingHit
-      ? [
-          `${suite.name} ran past the ${String(CEILING_SECONDS)} s ceiling and was stopped`,
-        ]
-      : judge(
-          mutation,
-          corpus,
-          outcome.json === undefined ? undefined : readReport(outcome.json),
-          baselineTotal,
-        );
+    const stopped = unrun(outcome, suite.name);
+    const found =
+      stopped.length > 0
+        ? stopped
+        : judge(
+            mutation,
+            corpus,
+            outcome.json === undefined ? undefined : read(outcome.json),
+            baselineTotal,
+          );
     if (found.length === 0) matched += 1;
     io.print(
       found.length === 0 ? `ok   ${mutation.name}` : `MISS ${mutation.name}`,
@@ -643,6 +667,32 @@ export function vitestArgs(request: RunRequest, reporter: string): string[] {
   ];
 }

+/** The Playwright arguments for one request: the list reporter for people, JSON for the runner. */
+export function playwrightArgs(request: RunRequest): string[] {
+  const { suite } = request;
+  if (suite.config === undefined)
+    throw new Error(`${suite.name} names no Playwright config`);
+  if (request.related !== undefined || request.recordTo !== undefined)
+    throw new Error(
+      `${suite.name}: only the guards suite records floors or lists importers`,
+    );
+  return ['playwright', 'test', '-c', suite.config, '--reporter=list,json'];
+}
+
+/** The environment a Playwright run gets: the caller's, with its JSON report's file named, recording no floors. */
+export function playwrightEnv(
+  base: Readonly<Record<string, string | undefined>>,
+  request: RunRequest,
+  root: string,
+): Record<string, string | undefined> {
+  return {
+    ...Object.fromEntries(
+      Object.entries(base).filter(([key]) => key !== RECORD_ENV),
+    ),
+    PLAYWRIGHT_JSON_OUTPUT_FILE: join(root, request.json),
+  };
+}
+
 /**
  * The environment a run gets: the caller's, the report file and the
  * repository root named, floors recorded only when asked.
@@ -682,29 +732,36 @@ export function readObservations(text: string, path: string): Observation[] {
   });
 }

-/** Runs `command` under the ceiling, killing its whole process group past it. */
+/**
+ * Runs `command` until `deadline` (epoch ms), killing its whole process group
+ * past it. `exit` is the status it ended with (null: ended by a signal).
+ */
 function spawnBounded(
   command: string,
   args: readonly string[],
   options: { cwd: string; env: Record<string, string | undefined> },
-): Promise<{ log: string; ceilingHit: boolean }> {
+  deadline: number,
+): Promise<{ log: string; ceilingHit: boolean; exit: number | null }> {
   return new Promise((resolvePromise, reject) => {
     const child = spawn(command, args, { ...options, detached: true });
     let log = '';
     let ceilingHit = false;
     child.stdout.on('data', (chunk: Buffer) => (log += chunk.toString()));
     child.stderr.on('data', (chunk: Buffer) => (log += chunk.toString()));
-    const timer = setTimeout(() => {
-      ceilingHit = true;
-      if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
-    }, CEILING_SECONDS * 1_000);
+    const timer = setTimeout(
+      () => {
+        ceilingHit = true;
+        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
+      },
+      Math.max(0, deadline - Date.now()),
+    );
     child.on('error', (error) => {
       clearTimeout(timer);
       reject(error);
     });
-    child.on('close', () => {
+    child.on('close', (exit: number | null) => {
       clearTimeout(timer);
-      resolvePromise({ log, ceilingHit });
+      resolvePromise({ log, ceilingHit, exit });
     });
   });
 }
@@ -751,27 +808,58 @@ export function realIo(options: {
       return suiteFiles(entry, listed.stdout);
     },
     run: async (request) => {
-      if (request.suite.kind !== 'vitest' || request.suite.build !== undefined)
-        throw new Error(
-          `${request.suite.name}: the runner cannot build or run Playwright yet`,
-        );
+      const { suite } = request;
       mkdirSync(dirname(at(request.json)), { recursive: true });
       rmSync(at(request.json), { force: true });
       if (request.recordTo !== undefined)
         rmSync(at(request.recordTo), { force: true });
-      const { log, ceilingHit } = await spawnBounded(
+      // One ceiling for the build and the suite together (spec §6).
+      const deadline = Date.now() + CEILING_SECONDS * 1_000;
+      const cwd = at(suite.cwd);
+      let log = '';
+      if (suite.build !== undefined) {
+        const [command, ...args] = suite.build;
+        if (command === undefined)
+          throw new Error(`${suite.name} has an empty build`);
+        const built = await spawnBounded(
+          command,
+          args,
+          { cwd, env: process.env },
+          deadline,
+        );
+        log += built.log;
+        if (built.ceilingHit || built.exit !== 0) {
+          writeFileSync(at(request.log), log);
+          return built.ceilingHit
+            ? { json: undefined, log, ceilingHit: true }
+            : {
+                json: undefined,
+                log,
+                ceilingHit: false,
+                buildExit: built.exit ?? -1,
+              };
+        }
+      }
+      const ran = await spawnBounded(
         'npx',
-        vitestArgs(request, REPORTER),
+        suite.kind === 'playwright'
+          ? playwrightArgs(request)
+          : vitestArgs(request, REPORTER),
         {
-          cwd: at(request.suite.cwd),
-          env: runEnv(process.env, request, root),
+          cwd,
+          env:
+            suite.kind === 'playwright'
+              ? playwrightEnv(process.env, request, root)
+              : runEnv(process.env, request, root),
         },
+        deadline,
       );
+      log += ran.log;
       writeFileSync(at(request.log), log);
       const json = existsSync(at(request.json))
         ? (JSON.parse(readFileSync(at(request.json), 'utf8')) as unknown)
         : undefined;
-      return { json, log, ceilingHit };
+      return { json, log, ceilingHit: ran.ceilingHit };
     },
     observations: (path) =>
       readObservations(
```

- [ ] **Step 4: Run them green**

Expected: 122 passed over the six runner test files; typecheck and lint clean (observed).

- [ ] **Step 5: Commit** (`feat(mutate): build before the suite under one ceiling, run Playwright, list only the unit suite on the laptop (Refs #649)`)

### Task 5: The `mutations` workflow and AC3's two mutation files

**Stage commit:** `2dc6eb0`

**Files:**

- `.github/workflows/mutations.yml`
- `scripts/mutations-changed.ts`
- `tests/mutations/649-game-harness.ts`
- `tests/mutations/649-web-smoke.ts`
- `tests/unit/mutations-changed.test.ts`
- `tests/unit/mutations-ci.test.ts`

**Interfaces:** Produces: `scripts/mutations-changed.ts` (`readNameStatus`, `mutationFilesIn`, `summary`, `main` writing `count` and `files`); `.github/workflows/mutations.yml`; `tests/mutations/649-game-harness.ts`, `tests/mutations/649-web-smoke.ts` (predictions written before any run; every anchor counted once).

- [ ] **Step 1: Write the failing tests**

```diff
diff --git a/tests/mutations/649-game-harness.ts b/tests/mutations/649-game-harness.ts
new file mode 100644
index 0000000..34bf3ae
--- /dev/null
+++ b/tests/mutations/649-game-harness.ts
@@ -0,0 +1,57 @@
+import { mutationFile } from '../../scripts/mutation-file.ts';
+
+/**
+ * The game harness (#649, spec §8 AC3), run from `apps/web` after its build.
+ * Predicted before the first run. `shell-text-shouted` changes text the
+ * harness sees only in the built bundle, so it goes red only when the runner
+ * builds after planting. Its replacement keeps the text's length, so the
+ * bundle test beside it (asset bytes) stays out of the prediction.
+ * `base-joined` is an equivalent mutant: it must stay green.
+ */
+
+const GAME = 'apps/web/test/game.test.ts';
+const PLAY = `${GAME} › the game Worker, under /play/ (#332 AC4) >`;
+const CSP = `${GAME} › the game Worker sets a Content Security Policy (#123 AC5) >`;
+
+export default mutationFile({
+  targets: [GAME],
+  mutations: [
+    {
+      name: 'shell-text-shouted',
+      file: 'packages/ui/src/Shell.svelte',
+      anchor: '<p>Coming soon.</p>',
+      replacement: '<p>Coming SOON.</p>',
+      red: {
+        [`${PLAY} says coming soon and links to the roadmap (#332 AC6)`]:
+          'Coming soon.',
+        [`${PLAY} says coming soon and links to the launch list (#332 AC6)`]:
+          'Coming soon.',
+        [`${PLAY} says coming soon and links to the Indonesian roadmap (#332 AC6)`]:
+          'Coming soon.',
+        [`${PLAY} says coming soon and links to the Indonesian launch list (#332 AC6)`]:
+          'Coming soon.',
+      },
+    },
+    {
+      name: 'policy-objects-allowed',
+      file: 'apps/web/worker/policy.ts',
+      anchor: "object-src 'none'",
+      replacement: "object-src 'self'",
+      red: {
+        [`${CSP} on the shell`]: "object-src 'none'",
+        [`${CSP} on a client route`]: "object-src 'none'",
+        [`${CSP} on the redirect from /play`]: "object-src 'none'",
+        [`${CSP} on a path outside /play/`]: "object-src 'none'",
+        [`${CSP} on the script the shell loads, a file the asset router serves`]:
+          "object-src 'none'",
+      },
+    },
+    {
+      name: 'base-joined',
+      file: 'apps/web/worker/index.ts',
+      anchor: "const BASE = '/play/';",
+      replacement: "const BASE = '/play' + '/';",
+      red: {},
+    },
+  ],
+});
diff --git a/tests/mutations/649-web-smoke.ts b/tests/mutations/649-web-smoke.ts
new file mode 100644
index 0000000..96f9c7a
--- /dev/null
+++ b/tests/mutations/649-web-smoke.ts
@@ -0,0 +1,42 @@
+import { mutationFile } from '../../scripts/mutation-file.ts';
+
+/**
+ * The web smoke suite (#649, spec §8 AC3): Playwright, after the game's
+ * build, in Chromium, Firefox and WebKit. Predicted before the first run.
+ * Each red test is named once per project. `shell-logs-an-error` changes the
+ * game's entry, which the suite sees only in the built bundle.
+ */
+
+const SHELL = 'tests/web/shell.spec.ts';
+const PROJECTS = ['chromium', 'firefox', 'webkit'] as const;
+
+/** One test's name in each project, all predicted to fail with `text`. */
+const inEveryProject = (title: string, text: string) =>
+  Object.fromEntries(PROJECTS.map((p) => [`${SHELL} › ${p} > ${title}`, text]));
+
+export default mutationFile({
+  targets: [SHELL],
+  mutations: [
+    {
+      name: 'shell-logs-an-error',
+      file: 'apps/web/src/main.ts',
+      anchor: 'export default mount(Shell, { target });',
+      replacement:
+        "console.error('planted by #649');\nexport default mount(Shell, { target });",
+      red: inEveryProject(
+        'the shell renders with no console errors or page errors',
+        'planted by #649',
+      ),
+    },
+    {
+      name: 'policy-default-open',
+      file: 'apps/web/worker/policy.ts',
+      anchor: "default-src 'self';",
+      replacement: 'default-src *;',
+      red: inEveryProject(
+        'the shell runs under its Content Security Policy with no violation',
+        "default-src 'self'",
+      ),
+    },
+  ],
+});
diff --git a/tests/unit/mutations-changed.test.ts b/tests/unit/mutations-changed.test.ts
new file mode 100644
index 0000000..6a24245
--- /dev/null
+++ b/tests/unit/mutations-changed.test.ts
@@ -0,0 +1,107 @@
+import { describe, expect, it } from 'vitest';
+import {
+  mutationFilesIn,
+  readNameStatus,
+  summary,
+} from '../../scripts/mutations-changed';
+
+/**
+ * Which mutation files a pull request adds or changes (#649, spec §7), read
+ * from `git diff --name-status`. The `mutations` workflow runs exactly
+ * these through the runner. Paths come from the pull request, so any that
+ * could carry more than a file name is refused rather than passed on.
+ */
+
+describe('readNameStatus', () => {
+  it('reads each line’s status and path', () => {
+    expect(
+      readNameStatus('A\ttests/mutations/a.ts\nM\tscripts/mutate.ts\n'),
+    ).toEqual([
+      { status: 'A', path: 'tests/mutations/a.ts' },
+      { status: 'M', path: 'scripts/mutate.ts' },
+    ]);
+  });
+
+  it('reads a rename as its new path', () => {
+    expect(
+      readNameStatus('R087\ttests/mutations/old.ts\ttests/mutations/new.ts\n'),
+    ).toEqual([{ status: 'R', path: 'tests/mutations/new.ts' }]);
+  });
+
+  it('reads nothing from an empty diff', () => {
+    expect(readNameStatus('')).toEqual([]);
+  });
+
+  it('refuses a line it cannot read', () => {
+    expect(() => readNameStatus('tests/mutations/a.ts\n')).toThrow(
+      'git diff --name-status printed a line it cannot read: tests/mutations/a.ts',
+    );
+  });
+});
+
+describe('mutationFilesIn', () => {
+  it('keeps mutation files added, changed or renamed in', () => {
+    expect(
+      mutationFilesIn([
+        { status: 'A', path: 'tests/mutations/a.ts' },
+        { status: 'M', path: 'tests/mutations/b.ts' },
+        { status: 'R', path: 'tests/mutations/c.ts' },
+      ]),
+    ).toEqual([
+      'tests/mutations/a.ts',
+      'tests/mutations/b.ts',
+      'tests/mutations/c.ts',
+    ]);
+  });
+
+  it('leaves out a deleted mutation file', () => {
+    expect(
+      mutationFilesIn([
+        { status: 'D', path: 'tests/mutations/gone.ts' },
+        { status: 'A', path: 'tests/mutations/a.ts' },
+      ]),
+    ).toEqual(['tests/mutations/a.ts']);
+  });
+
+  it('leaves out every path outside tests/mutations/', () => {
+    expect(
+      mutationFilesIn([
+        { status: 'M', path: 'scripts/mutate.ts' },
+        { status: 'A', path: 'tests/mutations/a.ts' },
+        { status: 'A', path: 'tests/mutations-old/b.ts' },
+      ]),
+    ).toEqual(['tests/mutations/a.ts']);
+  });
+
+  it('leaves out a file in tests/mutations/ that is not TypeScript', () => {
+    expect(
+      mutationFilesIn([
+        { status: 'A', path: 'tests/mutations/README.md' },
+        { status: 'A', path: 'tests/mutations/a.ts' },
+      ]),
+    ).toEqual(['tests/mutations/a.ts']);
+  });
+
+  it.each([
+    ['a space', 'tests/mutations/a b.ts'],
+    ['a command substitution', 'tests/mutations/$(id).ts'],
+    ['a semicolon', 'tests/mutations/a;b.ts'],
+    ['a subfolder', 'tests/mutations/x/a.ts'],
+  ])('refuses a mutation file named with %s', (_case, path) => {
+    expect(() => mutationFilesIn([{ status: 'A', path }])).toThrow(
+      `${path} is not a mutation file name the workflow passes on (tests/mutations/<letters, digits, . _ ->.ts)`,
+    );
+  });
+});
+
+describe('summary', () => {
+  it('says how many mutation files changed of how many paths it judged', () => {
+    expect(summary(['tests/mutations/a.ts'], 7)).toBe(
+      '1 mutation file changed of 7 paths judged',
+    );
+  });
+
+  it('says so when none changed', () => {
+    expect(summary([], 3)).toBe('0 mutation files changed of 3 paths judged');
+  });
+});
diff --git a/tests/unit/mutations-ci.test.ts b/tests/unit/mutations-ci.test.ts
new file mode 100644
index 0000000..cecfa9e
--- /dev/null
+++ b/tests/unit/mutations-ci.test.ts
@@ -0,0 +1,106 @@
+import { readFileSync } from 'node:fs';
+import { describe, expect, it } from 'vitest';
+import { parse } from 'yaml';
+
+/**
+ * The `mutations` workflow (#649, spec §7): on every pull request into
+ * develop, it lists the mutation files the pull request adds or changes and
+ * runs them through the runner, in the image CI tests in, keeping every log.
+ */
+
+interface Step {
+  readonly name?: string;
+  readonly uses?: string;
+  readonly run?: string;
+  readonly if?: string;
+  readonly env?: Readonly<Record<string, string>>;
+  readonly with?: Readonly<Record<string, unknown>>;
+  readonly 'timeout-minutes'?: number;
+}
+
+interface Job {
+  readonly needs?: string;
+  readonly if?: string;
+  readonly 'runs-on'?: string;
+  readonly 'timeout-minutes'?: number;
+  readonly container?: { readonly image?: string; readonly options?: string };
+  readonly outputs?: Readonly<Record<string, string>>;
+  readonly steps: readonly Step[];
+}
+
+interface Workflow {
+  readonly on: { readonly pull_request?: { readonly branches?: string[] } };
+  readonly permissions: Readonly<Record<string, string>>;
+  readonly jobs: Readonly<Record<string, Job>>;
+}
+
+const read = (path: string): Workflow =>
+  parse(readFileSync(path, 'utf8')) as Workflow;
+
+const workflow = (): Workflow => read('.github/workflows/mutations.yml');
+const job = (name: string): Job => {
+  const found = workflow().jobs[name];
+  if (found === undefined) throw new Error(`mutations.yml has no job ${name}`);
+  return found;
+};
+const stepRunning = (j: Job, command: string): Step | undefined =>
+  j.steps.find((s) => s.run?.trim() === command);
+
+describe('mutations.yml', () => {
+  it('runs on every pull request into develop, reading the repository only', () => {
+    const { on, permissions } = workflow();
+    expect(on.pull_request?.branches).toEqual(['develop']);
+    expect(permissions).toEqual({ contents: 'read' });
+  });
+
+  it('has exactly the two jobs, changed then run', () => {
+    expect(Object.keys(workflow().jobs)).toEqual(['changed', 'run']);
+  });
+
+  it('lists the changed mutation files against the pull request’s base, with the whole history', () => {
+    const changed = job('changed');
+    const step = stepRunning(changed, 'node scripts/mutations-changed.ts');
+    expect(step?.env).toEqual({
+      BASE: '${{ github.event.pull_request.base.sha }}',
+    });
+    const checkout = changed.steps.find((s) =>
+      s.uses?.startsWith('actions/checkout@'),
+    );
+    expect(checkout?.with?.['fetch-depth']).toBe(0);
+    expect(changed.outputs).toEqual({
+      count: '${{ steps.list.outputs.count }}',
+      files: '${{ steps.list.outputs.files }}',
+    });
+  });
+
+  it('runs the listed files only when there are any', () => {
+    const run = job('run');
+    expect(run.needs).toBe('changed');
+    expect(run.if).toBe("${{ needs.changed.outputs.count != '0' }}");
+  });
+
+  it('passes the files through the environment, never into the script text', () => {
+    const step = stepRunning(job('run'), 'npm run mutate -- $FILES');
+    expect(step?.env).toEqual({
+      FILES: '${{ needs.changed.outputs.files }}',
+    });
+  });
+
+  it('runs in the image and as the user CI tests in', () => {
+    const ci = read('.github/workflows/ci.yml').jobs['build-and-test'];
+    expect(job('run').container).toEqual(ci?.container);
+  });
+
+  it('keeps every log, whatever the result', () => {
+    const upload = job('run').steps.find((s) =>
+      s.uses?.startsWith('actions/upload-artifact@'),
+    );
+    expect(upload?.if).toBe('${{ !cancelled() }}');
+    expect(upload?.with?.path).toBe('.mutations/');
+  });
+
+  it('bounds each job', () => {
+    expect(job('changed')['timeout-minutes']).toBe(5);
+    expect(job('run')['timeout-minutes']).toBe(30);
+  });
+});
```

- [ ] **Step 2: Run them red**

Run: `npx vitest run tests/unit/mutations-changed.test.ts` against a throwing stub, then `tests/unit/mutations-ci.test.ts` before the workflow exists
Expected: 14 FAIL, each the stub's throw; 8 FAIL, each `ENOENT … mutations.yml` (observed).

- [ ] **Step 3: Implement**

```diff
diff --git a/.github/workflows/mutations.yml b/.github/workflows/mutations.yml
new file mode 100644
index 0000000..d3c6afc
--- /dev/null
+++ b/.github/workflows/mutations.yml
@@ -0,0 +1,66 @@
+# Every third-party `uses:` is a full 40-hex commit SHA with a trailing
+# `# vX.Y.Z` comment (tests/guards/supply-chain.test.ts).
+#
+# Runs every mutation file a pull request adds or changes through the
+# mutation runner (#649, spec docs/superpowers/specs/
+# 2026-10-18-mutation-runner-harness-playwright-design.md §7): each suite runs
+# clean first, then each mutation is planted, judged against its prediction
+# and put back. #619 adds the judge that requires a mutation file for every
+# changed non-unit test, and makes this check required.
+name: mutations
+
+on:
+  pull_request:
+    branches: [develop]
+
+permissions:
+  contents: read
+
+jobs:
+  changed:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 5
+    outputs:
+      count: ${{ steps.list.outputs.count }}
+      files: ${{ steps.list.outputs.files }}
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          # The base and every commit since, for `<base>...HEAD`.
+          fetch-depth: 0
+      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
+        with:
+          node-version-file: '.nvmrc'
+      - name: List the mutation files this pull request adds or changes
+        id: list
+        env:
+          BASE: ${{ github.event.pull_request.base.sha }}
+        run: node scripts/mutations-changed.ts
+
+  run:
+    needs: changed
+    if: ${{ needs.changed.outputs.count != '0' }}
+    runs-on: ubuntu-24.04
+    # The suites' builds and runs, per mutation, measured in #649's PR.
+    timeout-minutes: 30
+    # The image and user ci.yml tests in (tests/unit/mutations-ci.test.ts).
+    container:
+      image: mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
+      options: --user 1001
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
+        with:
+          node-version-file: '.nvmrc'
+          cache: 'npm'
+      - name: Install (a warning fails it)
+        run: scripts/fail-on-warnings.sh npm ci
+      - name: Run each mutation file through the runner
+        env:
+          FILES: ${{ needs.changed.outputs.files }}
+        run: npm run mutate -- $FILES
+      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
+        if: ${{ !cancelled() }}
+        with:
+          name: mutations
+          path: .mutations/
diff --git a/scripts/mutations-changed.ts b/scripts/mutations-changed.ts
new file mode 100644
index 0000000..c782b64
--- /dev/null
+++ b/scripts/mutations-changed.ts
@@ -0,0 +1,85 @@
+/**
+ * `node scripts/mutations-changed.ts` (#649, spec §7): which mutation files a
+ * pull request adds or changes, for the `mutations` workflow to run through
+ * the runner. Reads `git diff --name-status <BASE>...HEAD`, prints how many
+ * paths it judged, and writes `count` and `files` (space-separated) to
+ * `GITHUB_OUTPUT`. #619 extends it into the judge of changed non-unit tests.
+ */
+import { spawnSync } from 'node:child_process';
+import { appendFileSync } from 'node:fs';
+
+/** One path a diff names, with git's status letter (a rename: its new path). */
+export interface Changed {
+  readonly status: string;
+  readonly path: string;
+}
+
+/** Reads `git diff --name-status` output, refusing a line it cannot read. */
+export function readNameStatus(text: string): Changed[] {
+  return text
+    .split('\n')
+    .filter((line) => line !== '')
+    .map((line) => {
+      const [code, ...paths] = line.split('\t');
+      const path = paths.at(-1);
+      if (code === undefined || code === '' || path === undefined)
+        throw new Error(
+          `git diff --name-status printed a line it cannot read: ${line}`,
+        );
+      return { status: code.charAt(0), path };
+    });
+}
+
+/** A mutation file's path as the workflow passes it on: nothing a shell could read as more. */
+const MUTATION_FILE = /^tests\/mutations\/[A-Za-z0-9._-]+\.ts$/;
+
+/**
+ * The mutation files among `changed` that exist after the change (added,
+ * changed or renamed in), refusing one whose name holds anything but
+ * letters, digits, `.`, `_` and `-`.
+ */
+export function mutationFilesIn(changed: readonly Changed[]): string[] {
+  return changed
+    .filter(
+      ({ status, path }) =>
+        status !== 'D' &&
+        path.startsWith('tests/mutations/') &&
+        path.endsWith('.ts'),
+    )
+    .map(({ path }) => {
+      if (!MUTATION_FILE.test(path))
+        throw new Error(
+          `${path} is not a mutation file name the workflow passes on (tests/mutations/<letters, digits, . _ ->.ts)`,
+        );
+      return path;
+    });
+}
+
+/** `<n> mutation file(s) changed of <m> paths judged`: never a silent pass. */
+export function summary(files: readonly string[], judged: number): string {
+  return `${String(files.length)} mutation file${files.length === 1 ? '' : 's'} changed of ${String(judged)} paths judged`;
+}
+
+function main(): void {
+  const base = process.env.BASE;
+  const output = process.env.GITHUB_OUTPUT;
+  if (base === undefined || base === '' || output === undefined)
+    throw new Error('BASE and GITHUB_OUTPUT must be set');
+  const diff = spawnSync(
+    'git',
+    ['diff', '--name-status', '-M', `${base}...HEAD`],
+    { encoding: 'utf8' },
+  );
+  if (diff.status !== 0)
+    throw new Error(`git diff failed: ${diff.stderr.trim()}`);
+  const changed = readNameStatus(diff.stdout);
+  const files = mutationFilesIn(changed);
+  console.log(summary(files, changed.length));
+  for (const file of files) console.log(`  ${file}`);
+  appendFileSync(
+    output,
+    `count=${String(files.length)}\nfiles=${files.join(' ')}\n`,
+  );
+}
+
+if (import.meta.main) main();
```

- [ ] **Step 4: Run them green**

Expected: 14 passed; 8 passed; lint clean (observed).

- [ ] **Step 5: Commit** (`feat(ci): the mutations workflow runs each mutation file a pull request adds or changes; the game harness and web smoke files (Refs #649, Refs #619)`)

### Task 6: The runner's own controls, mutation-verified on the unit suite

**Stage commit:** `a77d074`

**Files:**

- `tests/mutations/649-runner.ts`

**Interfaces:** Consumes: Tasks 1 to 5. Ten rows, each anchor counted once before writing, each prediction written before the first run. One prediction rests on a measurement: with colour codes kept, the recorded web failure still contains `not.toContain` and `content-security-policy` (20 codes, words intact), so that test stays out of `colour-kept`.

- [ ] **Step 1: Write the failing tests**

```diff
diff --git a/tests/mutations/649-runner.ts b/tests/mutations/649-runner.ts
new file mode 100644
index 0000000..0cf2d4a
--- /dev/null
+++ b/tests/mutations/649-runner.ts
@@ -0,0 +1,156 @@
+import { mutationFile } from '../../scripts/mutation-file.ts';
+
+/**
+ * The runner's new controls (#649, spec §10), each predicted before its
+ * first run: names from the repository root, the project in a Playwright
+ * name, colour codes removed, a flaky test failing, a spec that does not
+ * parse named by its file, a failed build, the laptop listing the unit suite
+ * only, the build pinned to each suite's script, and the mutations
+ * workflow's file names. Unit-suite mutations: they run on the laptop too.
+ */
+
+const REPORTER = 'tests/unit/mutate-reporter.test.ts';
+const PW = 'tests/unit/mutate-playwright.test.ts';
+const RECORDED = `${PW} › readPlaywrightReport, on recorded runs >`;
+const SHAPES = `${PW} › readPlaywrightReport, on the shapes it reads >`;
+const RUN = 'tests/unit/mutate-run.test.ts';
+const BUILDS = 'tests/unit/mutate-builds.test.ts';
+const SCRIPTS = `${BUILDS} › each suite runs as its package script does >`;
+const CHANGED = 'tests/unit/mutations-changed.test.ts';
+const FILES_IN = `${CHANGED} › mutationFilesIn >`;
+
+export default mutationFile({
+  targets: [REPORTER, PW, RUN, BUILDS, CHANGED],
+  mutations: [
+    {
+      name: 'root-ignored',
+      file: 'scripts/mutate-reporter.ts',
+      anchor: '  return named;\n}',
+      replacement: '  return vitestRoot;\n}',
+      red: {
+        [`${REPORTER} › reportRoot > is the repository root the runner names, when it names one`]:
+          '/repo/apps/web',
+        [`${REPORTER} › reportRoot > names a harness file from the repository root`]:
+          'apps/web/test/game.test.ts',
+      },
+    },
+    {
+      name: 'project-dropped',
+      file: 'scripts/mutate.ts',
+      anchor: "[test.projectName, ...titles, spec.title].join(' > ')",
+      replacement: "[...titles, spec.title].join(' > ')",
+      red: {
+        [`${RECORDED} names a failed test once per project, with its file and project`]:
+          'chromium',
+        [`${RECORDED} names a test that timed out, and counts it failing`]:
+          'chromium',
+        [`${SHAPES} names every describe between the project and the title`]:
+          'webkit',
+        [`${SHAPES} counts a flaky test failing: the runner allows no retry`]:
+          'webkit',
+        [`${SHAPES} refuses a test whose status it does not know`]:
+          'webkit > reads',
+        [`${RUN} › runFile in a Playwright suite (CI) > judges the run through Playwright’s report`]:
+          'matched',
+      },
+    },
+    {
+      name: 'colour-kept',
+      file: 'scripts/mutate.ts',
+      anchor: ".replace(ANSI, '')",
+      replacement: '.replace(ANSI, (code) => code)',
+      red: {
+        [`${RECORDED} removes the colour codes Playwright writes even with FORCE_COLOR=0`]:
+          'shell.spec.ts',
+        [`${RECORDED} removes forced colour codes from every failure`]:
+          'golden-vectors.spec.ts',
+      },
+    },
+    {
+      name: 'flaky-passed',
+      file: 'scripts/mutate.ts',
+      anchor:
+        "if (test.status !== 'unexpected' && test.status !== 'flaky') continue;",
+      replacement: "if (test.status !== 'unexpected') continue;",
+      red: {
+        [`${SHAPES} counts a flaky test failing: the runner allows no retry`]:
+          'webkit > reads',
+      },
+    },
+    {
+      name: 'location-ignored',
+      file: 'scripts/mutate.ts',
+      anchor: "isRecord(location) && typeof location.file === 'string'",
+      replacement: "isRecord(location) && typeof location.file === 'number'",
+      red: {
+        [`${RECORDED} names a spec that does not parse as its file, failing`]:
+          '(the file)',
+      },
+    },
+    {
+      name: 'build-exit-ignored',
+      file: 'scripts/mutate.ts',
+      anchor: '  if (outcome.buildExit !== undefined)',
+      replacement: '  if (outcome.buildExit === 0)',
+      red: {
+        [`${RUN} › runFile in a suite that builds first (CI) > misses a row whose build failed, naming the exit status`]:
+          'build failed (exit 2)',
+        [`${RUN} › runFile in a suite that builds first (CI) > refuses a baseline whose build failed`]:
+          'build failed (exit 1)',
+      },
+    },
+    {
+      name: 'laptop-lists-all',
+      file: 'scripts/mutate.ts',
+      anchor: '(io.ci ? suites : suites.filter((s) => s.name === UNIT_SUITE))',
+      replacement: '(io.ci ? suites : suites)',
+      red: {
+        [`${RUN} › runFile > refuses on the laptop a target the unit suite does not list, listing no other suite`]:
+          'the laptop runs the unit suite only',
+      },
+    },
+    {
+      name: 'npx-kept',
+      file: 'scripts/mutate.ts',
+      anchor: "mutate.build?.[0] === 'npx'",
+      replacement: "mutate.build?.[0] === 'npm'",
+      red: {
+        [`${BUILDS} › mutateScript > drops npx from a build, as a package script runs local binaries itself`]:
+          'vite build',
+        [`${BUILDS} › mutateScript > keeps an npm build whole`]:
+          'npm run build',
+        [`${SCRIPTS} game harness: apps/web/package.json "test"`]: 'vite build',
+        [`${SCRIPTS} site harness: apps/site/package.json "test"`]:
+          'npm run build:harness',
+        [`${SCRIPTS} dev hosts harness: apps/dev-hosts/package.json "test"`]:
+          'wrangler pages',
+        [`${SCRIPTS} web smoke suite: package.json "test:web"`]:
+          'npm run build --workspace',
+      },
+    },
+    {
+      name: 'file-name-loose',
+      file: 'scripts/mutations-changed.ts',
+      anchor: '/^tests\\/mutations\\/[A-Za-z0-9._-]+\\.ts$/',
+      replacement: '/^tests\\/mutations\\/[^/]+\\.ts$/',
+      red: {
+        [`${FILES_IN} refuses a mutation file named with a space`]:
+          'to throw an error',
+        [`${FILES_IN} refuses a mutation file named with a command substitution`]:
+          'to throw an error',
+        [`${FILES_IN} refuses a mutation file named with a semicolon`]:
+          'to throw an error',
+      },
+    },
+    {
+      name: 'deleted-kept',
+      file: 'scripts/mutations-changed.ts',
+      anchor: "status !== 'D' &&",
+      replacement: "status !== 'X' &&",
+      red: {
+        [`${FILES_IN} leaves out a deleted mutation file`]:
+          'tests/mutations/gone.ts',
+      },
+    },
+  ],
+});
```

- [ ] **Step 2: Run them red**

Run: `source ~/.claude/scripts/test-lock.zsh heavy && npm run mutate -- tests/mutations/649-runner.ts`
Expected (first run, observed): refused before any mutation, the unit suite red on 10 recorded floors the new workflow moves (`record-floors-workflow/files`, `record-floors/workflow-steps`, `record-minimums-workflow/files`, `scheduled-workflows/workflows`, `supply-chain/pinned-uses`, `supply-chain/versioned-uses`, `supply-chain/digest-images`, `supply-chain/playwright-images`, `workflow-runners/labels`, `workflow-runners/workflows`). Floors are recorded in CI only, so the run waits on Task 7.

- [ ] **Step 3: Implement**

Nothing outside `tests/`.

- [ ] **Step 4: Run them green**

Expected after Task 7: 10 of 10 matched.

- [ ] **Step 5: Commit** (`test(mutate): the runner's #649 controls, predicted before their first run (Refs #649)`)

### Task 7: Floors, the pull request, the CI rows and the close

- [ ] Tag the stages: `git tag evidence/649-stage-commits a77d074` and push the tag.
- [ ] Squash the branch to one commit (repo rule for a pull request that moves floors), run the unit suite, typecheck, lint and Prettier, push, open the pull request with the `record-floors` label.
- [ ] `npm run floors:fetch <run-id>`, fold into the one commit, push; read every CI step by name on the head.
- [ ] Re-run Task 6's file on the laptop (expected 10 of 10).
- [ ] Read `mutations.yml`'s run on the head: `649-game-harness.ts` 3 of 3 and `649-web-smoke.ts` 2 of 2 as predicted (`649-runner.ts` 10 of 10 there too); state each suite's build and run times per mutation from its logs (AC4) and set `run`'s timeout from them.
- [ ] Merge into `develop` on a green head, read deploy-dev by name, evidence on #649, close by hand; delete `scratch/649-record-playwright-reports`.

## Review log

- Pass 1 (2026-10-18, against the spec): every spec section maps to a task (§3 Task 2, §4 Tasks 1 and 2, §5 Task 3, §6 Task 4, §7 Task 5, §8 AC3 Tasks 5 and 7, §10 Task 6). The spec was corrected to the stages: the parity check is a unit test (five named files, not the tree), no `FORCE_COLOR` is set (measured), `laptopRefusal` names targets, job-level bounds. No placeholder; names match across tasks (`SuiteMutate`, `MutableSuite`, `readPlaywrightReport`, `playwrightArgs`, `playwrightEnv`, `laptopRefusal(targets)`). Clean.
- CI, first push (`98233c0`, record-floors run 39055728581): the guards suite, which the laptop does not run, found an unproved absence search (`floorless-searches`). The guard's own reader, applied to all 15 files #649 touched, found 3: both colour tests and "reads nothing from an empty diff". Fixed by the repository's idioms, never by widening the guard: `searched` with a recorded floor on the same population (`mutate-playwright/web-failures`, `mutate-playwright/forced-colour-failures`), and `againstControl` for the empty diff. The reader then found 0 unproved in all 15. The same push's `mutations` run (39055728669) matched `649-game-harness.ts` 3 of 3; `649-runner.ts` was refused on the unrecorded floors, and that refusal ended the command before `649-web-smoke.ts` ran (filed separately).
- CI, second push (`30f90b2`, record-floors run 39056261110): unit and guards clean; the integration suite's `script-loads` test lists every script with a `main` by name, and `scripts/mutations-changed.ts` was not in it. Added (it loads under Node without running its main); its floor `script-loads/scripts` is recorded with the rest. Its `mutations` run matched `649-game-harness.ts` 3 of 3 again.
- CI, floors folded in (`b4ca532`): record-floors 39056618031 green; unit 13,405 of 13,405 on the laptop; Task 6's file 10 of 10 on the laptop at its first run. build-and-test, every-commit and mutations green by name; `mutations` (39057208788) matched 15 of 15: game harness 3 of 3, runner 10 of 10, web smoke 2 of 2, in 6 min 43 s. Its whole log showed one more defect: the upload of `.mutations/` found no files (a dot-folder, which upload-artifact skips unless `include-hidden-files: true`) and only warned. Fixed with `include-hidden-files: true` and `if-no-files-found: error`, test first; the form is added to the global guard-forms reference.
