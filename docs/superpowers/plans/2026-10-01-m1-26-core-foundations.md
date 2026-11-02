# M1 #26: Core Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@wordfarer/core` with deterministic maths and its lint ban, `Num`, the integer clocks, a seeded RNG, the balance table, the `CourseData` type with a seeded synthetic course, third-party notices, and a harness that proves `det-math` gives the same bits in Node, Chromium, Firefox and WebKit.

**Architecture:** `packages/core` is plain TypeScript compiled against ECMAScript alone (no DOM lib, no Node types), so it runs unchanged in every shipped shell. Its `build` is an esbuild bundle on the neutral platform, which fails on any Node built-in anywhere in the dependency closure. Every transcendental goes through `det-math.ts` (`@stdlib` pure-JS ports), and an ESLint block scoped to `packages/core/src` bans the engine-approximated forms and every clock, timer, network and host read. Golden vectors hashed bit by bit tie Node's results to each browser engine's.

**Tech Stack:** Node 24, npm workspaces, TypeScript 6.0, Vitest 4.1, fast-check 4.10, decimal.js 10.6 (test reference only), `@stdlib/math-base-special-*` (exact pins), break_infinity.js 2.2.0 (exact pin), esbuild 0.28, `@playwright/test` 1.63, ESLint 10 flat config.

**Spec:** `docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md` (§2.1, §2.3, §3, §5), with the parent `docs/superpowers/specs/2026-10-01-wordfarer-design.md` (§3, §4.1, §4.2, §5.6) for the balance values. Story: #26.

## Global Constraints

- Node `>=24`; npm workspaces. Run every `npm install` through `scripts/fail-on-warnings.sh`: npm prints a warning and exits 0 when it installs nothing (measured, Task 1).
- Zero warnings: lint `--max-warnings 0`, typecheck, Prettier, `npm ci` and `npm run build` (spec §12).
- `packages/core/src` reads no clock, timer, network or host object, and calls no engine-approximated maths (M1 design §2.1, §3). No `eslint-disable` there: inline config is switched off for that path (Task 2).
- Runtime dependencies of `packages/core` are exact-pinned: a patch release that moves one bit is a determinism change and must arrive as a reviewed Dependabot PR. Dev dependencies use caret ranges, as at the root.
- State holds plain data only: a `Num` is stored as its `[mantissa, exponent]` tuple, times as integer milliseconds (M1 design §4).
- Tests are written first and seen red against throwing stubs, each failing on its own assertion. Every guard is mutation-verified with any comment naming the guarded thing left in place.
- Commit messages and PR bodies say `Refs #26`; never put close/fix/resolve next to an issue number. Commits are authored as Shyden.

## Review Focus

1. **One value stored as two different tuples.** break_infinity's `add` leaves the mantissa below 1 for the integer mantissas 999999999999999 and 999999999999998 (measured on V8 and JavaScriptCore alike). A player would expect a save, a hash and a replay to agree whatever path produced a number. Task 3 renormalises every result and tests exactly that case.
2. **NaN or Infinity entering state.** `Num.from(NaN)`, a zero divisor, `pow(0, -1)`: a player expects a refused action, never a corrupted balance. Task 3 refuses each with `RangeError`; Task 1 pins `det-math`'s special values to ECMAScript's (where `@stdlib` follows C99 instead).
3. **A fractional, negative or `-0` time.** A clock change or a float slipping into an event must not split an interval differently from the whole. Task 4's brands refuse all three, storing `-0` as `0`.
4. **One RNG stream shifted by another's draws.** The pacing bots compare personas that differ in one behaviour; a shared stream would confound them. Task 5 tests independence over arbitrary interleavings.
5. **A banned API reintroduced by a side door:** `globalThis.fetch`, destructuring `Math`, a computed `d['pow']`, or an inline `eslint-disable`. Task 2 lints each form.
6. **The engine check passing by not running:** a dropped Playwright project or CI step. Task 8 guards both.

## Acceptance criteria → tasks (#26)

| AC  | What                                                                                          | Task | Proved by                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/core` built and tested by the root scripts and CI; no DOM, network or Node built-in | 1, 2 | the root `build` and `test:unit` include it; `tsconfig` has no DOM lib and `types: []`; the neutral-platform build fails on `node:fs` (M1.9); the lint ban refuses built-in imports (Task 2) |
| 2   | `det-math` within 2 ulp, including `pow(1.15, n)` for n = 0..5000                             | 1    | `det-math.test.ts`                                                                                                                                                                           |
| 3   | the ESLint ban, each form linted, `new Date(wallMs)` and `Math.sqrt` allowed                  | 2    | `core-determinism-lint.test.ts`, M2.1 to M2.7                                                                                                                                                |
| 4   | `Num` over break_infinity, tuple round-trip, `Num.pow` from `det-math`                        | 3    | `num.test.ts`, M3.2 and M3.2b                                                                                                                                                                |
| 5   | `SimMs`/`WallMs` brands, bucket and grid helpers at edges                                     | 4    | `clock.test.ts`                                                                                                                                                                              |
| 6   | xoshiro128**, JSON state, independent streams, pinned first 8                                 | 5    | `rng.test.ts`                                                                                                                                                                                |
| 7   | one frozen, fully typed `balance.ts`                                                          | 6    | `balance.test.ts`, M6.3                                                                                                                                                                      |
| 8   | `CourseData`                                                                                  | 7    | `course.ts`, type-checked by the generator and its test                                                                                                                                      |
| 9   | the seeded synthetic course, counted by content                                               | 7    | `synthetic-course.test.ts`                                                                                                                                                                   |
| 10  | cross-engine harness, 100,000 inputs per function, WebKit red under `Math.pow`                | 8    | `det-math.spec.ts`, `golden-vectors.test.ts`, M8.1b                                                                                                                                          |
| 11  | NOTICE and the third-party listing name the `@stdlib` packages                                | 1    | `third-party-notices.test.ts`                                                                                                                                                                |

## How this plan was reviewed

A block labelled `(change)` is a unified diff against the previous task's tree, shown for reading: Prettier trims the single space that marks a blank context line, so make the change by hand rather than with `git apply`.

The plan was reviewed by **executing it**. Each task was built as one cumulative commit (a stage) in a scratch worktree on top of `develop` `7dc8850`. Each stage was checked out on its own, installed with a clean `npm ci`, and run through every CI step; each task's final tests were run against its throwing stubs. Every guard was mutated, with its result predicted in writing first. Every code block below is generated from those stage commits (`git show <stage>:<path>`) or the stub files, never typed, and is checked byte-for-byte against its source.

- **Pass 1 (execution)** (2026-10-01). 17 found and fixed. **Tooling:** (1) `npm install --workspace X` before X is in the lockfile warns and installs nothing, exit 0: every install now runs through `fail-on-warnings.sh`, after a plain `npm install`; (2) `--log-level=warning` in an npm script tripped `fail-on-warnings.sh` because npm echoes the script line: flag removed. **Measured facts that changed the code:** (3) `@stdlib` `pow` follows C99, not ECMAScript, at `pow(1, ±Infinity)` and `pow(NaN, ±0)`: `det-math.pow` restores ES semantics, pinned by literal tests (a first probe misnamed the case because `JSON.stringify` writes NaN and Infinity as `null`); (4) `@stdlib` `exp(1)` is 1 ulp above `Math.E`, inside the 2-ulp bound; (5) break_infinity normalises with `Math.floor(Math.log10(|m|))`: V8 and JavaScriptCore agree on all 2,527 boundary floors tried, but on both, `add` leaves 999999999999999 and 999999999999998 unnormalised (`m < 1`), so one value had two tuples: `Num` renormalises with comparisons, `Num.from` takes its exponent from `det-math`, and design §2.1 records the caveat; (6) the closure of 6 `@stdlib` packages is 152 `@stdlib` + 9 MIT packages, while the bundle holds 68: the notices list the whole closure and say so; (7) the `@stdlib` LICENSE files append Sun and Go Authors copyrights: the listing keeps every distinct text verbatim. **Tests that were wrong:** (8) the det-math reference asked decimal.js for 383 digits on every function (27 ms a call, a 5 s timeout); only `expm1`/`log1p` need extra digits; (9) under another suite's load (load average 20 to 45), the reference tests took up to 12 s: they carry an explicit 60 s timeout, since they test accuracy, not speed; (10) the special-value cases were evaluated at collection, so a stub would fail the whole file: now thunks; (11) a clock test claimed `floor(t / H) * H` fails near 2^53: measured never wrong over the top 2,000,000 buckets, and the test was deleted rather than ship a false reason; (12) `anyPositive()` masked away bit 20 and drew even binary exponents only; (13) `Num.pow` golden values were typed placeholders, replaced by measured ones, cross-checked against decimal.js; (14) the synthetic-course test built the course at module load and the engine spec's liveness check measured bundle size: both would have gone red for a reason other than the stub; (15) the T1 red run used the already-edited NOTICE: the stub set now restores it; (16) the instance-member lint selector also matched `Math.pow` and `Decimal.pow`, reporting them twice, once with the wrong message: `Math` and `Decimal` are excluded, as they have exact entries; (17) my own mutation predictions miscounted the det-math total as 48 (it is 45), and a chained `sed` correcting them rewrote one prediction twice (M1.1, re-run clean). **Mutations:** 46 run (45 here, M3.5 in pass 7), 44 as predicted; the 2 differences are measured facts recorded in their tables (M3.1 caught twice; M8.1b leaves Firefox green, because SpiderMonkey's `Math.pow` matches V8's on all 100,000 inputs). **Gate at the last stage:** format, lint, typecheck, 312 unit and 10 Worker tests, build: all pass; `npm run test:engines`: 3 passed (Chromium, Firefox, WebKit give Node's bits on 600,000 inputs).
- **Pass 2** (2026-10-01). Mechanical: all 47 generated blocks equal their stage or stub byte for byte (diffs compared without trailing whitespace, which Prettier trims), and the checker reports a planted one-character change; every name in an Interfaces block is exported (8 as members of `Num`); every `npm run` script named exists; no placeholders. Full read found 3: (1) Task 2 paraphrased its red failure text, now quoted as measured; (2) the Playwright spec had no red step: measured red on all 3 engines against the golden stub, with `golden digests: not implemented`, and added to Task 8; (3) no map from #26's acceptance criteria to tasks: added.
- **Pass 3** (2026-10-01). Mechanical checks re-run: 47 blocks equal, Prettier clean, names and scripts resolve. Full read, including the generated mutation tables for the first time, found 2, both in the table generator: (1) changes over 70 characters were cut short with `…`, so four rows (M1.3, M1.9, M4.3, M5.3) could not be applied as written; (2) backticks were rewritten as quotes, so M1.6 showed a line the file does not contain. Each change is now printed whole, a span holding a backtick uses a double-backtick fence, and the generator asserts that every rendered change decodes back to the exact anchor the mutation ran with.
- **Pass 4** (2026-10-01). Mechanical checks re-run, unchanged. Full read of the rendered plan found 1: mutation rows that run a different test file from their table's default (M1.6 to M1.8 run the notices test, M8.2 and M8.3 the harness test) did not name it, so an executor would have run the wrong file and seen a meaningless green. Every row whose command differs from its table's default now names it.
- **Pass 5** (2026-10-01). Mechanical checks re-run, unchanged. Full read found 1, in this log: the pass 1 entry said every stage had been through the CI gate, but only the first and last had, and the first only before an amendment. Run since: each of the 8 stages checked out alone, `npm ci`, then format, lint, typecheck, unit (132, 194, 220, 256, 274, 299, 307, 312: each task adds exactly its own tests), Worker tests and build, all passing; `npm run test:engines` passes on the last. The pass 1 entry now says what was done.
- **Pass 6** (2026-10-01). Mechanical checks re-run: 47 blocks equal; code unchanged since pass 5, so names and scripts stand. Read: lines 1 to 62 (everything pass 5 changed) in full; the rest is byte-identical (`diff`) to the text pass 5 read in full. No findings.
- **Pass 7 (final-head gate)** (2026-10-01). Gating the story branch found 2 that six passes had not. (1) The `Num.pow` accuracy test used a guessed bound, `(|log10 result| + 1) x 1e-15`, and fast-check exceeded it on run 279 (1.76e-15 against 1.68e-15): green in every earlier run by chance. Error analysis gives the missing term: the error of `log10` of the base is multiplied by the exponent, so the bound is `6e-16 x (|p| + |log10 result| + 2)`; over 60,000 random cases the worst error is 0.79 of it (the old bound: 1.04). Fixed in Task 3 with the derivation in the test, and mutation M3.5 now shows the bound catching a 1e-12 loss in `log10`. Everything downstream was re-run: Task 3 red, its 6 mutations, every stage gate from Task 3 on after a clean `npm ci`, and `test:engines`. (2) Prettier had reported this plan clean while it sat in a git-ignored folder: Prettier 3 skips ignored files without a word. The plan is now formatted and checked at its tracked path.
- **Pass 8** (2026-10-01). Mechanical checks re-run: 47 blocks equal, Prettier clean at the tracked path (`--file-info` reports it not ignored), names and scripts resolve. Full read found 3: (1) pass 1's mutation count was stale after M3.5 (46 run, 44 as predicted); (2) Prettier pads every table cell to the widest, so this log's rows ran to about 3,000 characters of spaces in the raw file: the log is now a list; (3) M3.5 was listed above M3.4.
- **Pass 9** (2026-10-01). Mechanical checks re-run: 47 blocks equal, Prettier clean, names and scripts resolve. Read: lines 1 to 64 in full (the log in its list form, and everything else pass 8 changed); from Task 1 on, a `diff` against the text pass 8 read in full shows only M3.5's row moving below M3.4. Found 1: pass 5's entry still called the pass 1 entry "row 1" after the log stopped being a table. Reworded.
- **Pass 10** (2026-10-01). Mechanical checks re-run: 47 blocks equal, Prettier clean at the tracked path, names and scripts resolve. Read: a `diff` against the text pass 9 read shows only the two log entries pass 9 changed, and both were read in full. **No findings: plan approved** under the house rule.
- **Pass 11 (CI on PR #38)** (2026-10-01). CI's unit step failed where every local gate had passed: the notices generator asked the filesystem for `LICENSE.md`, which macOS (case-insensitive) answers with `ms` 2.0.0's `license.md` and Linux does not. It now lists each package directory and picks the file with a case-insensitive pattern, sorted (listing order differs between filesystems too), in a pure `pickFile` tested by 10 cases; mutations M1.10 (case-sensitive) and M1.11 (unsorted) are caught as predicted. Re-run since: Task 1 red (59 failed), its 11 mutations (all as predicted), all eight stage gates after a clean `npm ci` (unit 142, 204, 230, 266, 284, 309, 317, 322) and `test:engines` (3 passed).
- **Pass 12** (2026-10-01). Mechanical checks re-run after regeneration: 47 blocks equal, Prettier clean. Read Task 1's changed text, the M1 table and pass 11. Found 1: `pickFile` breaks ties between names of one rank by name, and no case had two candidates of one rank, so dropping the tie-break (the sort is stable, which keeps listing order) survived. Mutation M1.12 was predicted to survive and did (0 failed, 14 passed). Two cases added (`license`/`LICENSE`, `LICENSE`/`LICENCE`, each listed in the order the stable sort would keep); every notices prediction rewritten for 16 tests before the run. Re-run since: Task 1 red (61 failed), its 12 mutations (all as predicted, M1.12 now caught by both new cases), all eight stage gates after a clean `npm ci` (unit 144, 206, 232, 268, 286, 311, 319, 324) and `test:engines` (3 passed).

---

### Task 1: The core package, `det-math`, and third-party notices

**Files:**

- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/det-math.ts`, `packages/core/src/index.ts`, `scripts/third-party-notices.ts`, `THIRD-PARTY-NOTICES.md` (generated)
- Modify: `vitest.config.ts`, `package.json` (`notices` script), `NOTICE`, `.prettierignore`
- Test: `packages/core/test/det-math.test.ts`, `tests/unit/third-party-notices.test.ts`

**Interfaces:**

- Produces: `pow(base: number, exponent: number): number`, `exp(x)`, `ln(x)`, `log10(x)`, `expm1(x)`, `log1p(x)` (all `(x: number) => number`) from `packages/core/src/det-math.ts`, re-exported by `packages/core/src/index.ts`. `bundledPackages(lock: Lockfile): Bundled[]`, `pickFile(names: readonly string[], kind: 'licence' | 'notice'): string | undefined`, `renderNotices(lock: Lockfile, root: string): string` and `SHIPPED_WORKSPACES` from `scripts/third-party-notices.ts`.

- [ ] **Step 1: Create the workspace and install its dependencies**

Create `packages/core/package.json` first with only `name`, `private`, `license`, `type`, `exports` and `scripts`. Then register the workspace before adding dependencies: `npm install --workspace X` on an unregistered workspace prints `npm warn workspaces ... no workspace folder present` and installs nothing.

```bash
scripts/fail-on-warnings.sh npm install
scripts/fail-on-warnings.sh npm install --workspace @wordfarer/core --save-exact @stdlib/math-base-special-pow@0.3.1 @stdlib/math-base-special-exp@0.2.5 @stdlib/math-base-special-ln@0.2.5 @stdlib/math-base-special-log10@0.3.1 @stdlib/math-base-special-expm1@0.2.4 @stdlib/math-base-special-log1p@0.2.4
scripts/fail-on-warnings.sh npm install --workspace @wordfarer/core --save-dev decimal.js@^10.6.0 esbuild@^0.28.1 fast-check@^4.10.2
```

The result must read:

`packages/core/package.json`:

```json
{
  "name": "@wordfarer/core",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "esbuild src/index.ts --bundle --platform=neutral --main-fields=module,main --format=esm --outfile=dist/index.js"
  },
  "dependencies": {
    "@stdlib/math-base-special-exp": "0.2.5",
    "@stdlib/math-base-special-expm1": "0.2.4",
    "@stdlib/math-base-special-ln": "0.2.5",
    "@stdlib/math-base-special-log10": "0.3.1",
    "@stdlib/math-base-special-log1p": "0.2.4",
    "@stdlib/math-base-special-pow": "0.3.1"
  },
  "devDependencies": {
    "decimal.js": "^10.6.0",
    "esbuild": "^0.28.1",
    "fast-check": "^4.10.2"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  // @wordfarer/core runs unchanged in browsers, Electron, Capacitor and
  // Workers, so it sees ECMAScript alone: no DOM lib and no Node types.
  // `types: []` matters: without it, the hoisted @types/node would be
  // included automatically and `process` or `Buffer` would typecheck.
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "types": [],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "fixtures/**/*.ts"]
}
```

Add the workspace's tests to the root suite:

`vitest.config.ts` (change):

```diff
diff --git a/vitest.config.ts b/vitest.config.ts
index 38f1924..8affcb9 100644
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@ -7,7 +7,11 @@ import { defineConfig } from 'vitest/config';
  */
 export default defineConfig({
   test: {
-    include: ['tests/**/*.test.ts', 'apps/web/**/*.test.ts'],
+    include: [
+      'tests/**/*.test.ts',
+      'apps/web/**/*.test.ts',
+      'packages/*/test/**/*.test.ts',
+    ],
     exclude: ['**/node_modules/**', '**/dist/**'],
   },
 });
```

- [ ] **Step 2: Write the failing tests**

The reference is decimal.js at 60 or more significant digits, fed each input's exact value (`toPrecision(40)`, which ECMAScript rounds correctly). `new Decimal(1.15)` would read the string `"1.15"`, 7.7e-17 away from the double, and `pow(1.15, 5000)` multiplies that gap into thousands of ulp.

`packages/core/test/det-math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Decimal } from 'decimal.js';
import { exp, expm1, ln, log10, log1p, pow } from '../src/det-math';

/**
 * det-math against a high-precision reference (M1 design §2.1, #26 AC2).
 *
 * Every result must lie within 2 ulp of the true value rounded to a double.
 * The reference is decimal.js at 60+ significant digits, fed the input's
 * EXACT value: `new Decimal(1.15)` would read the shortest string "1.15",
 * which is 7.7e-17 away from the double, and pow(1.15, 5000) multiplies that
 * gap into thousands of ulp. `toPrecision(40)` is correctly rounded by
 * ECMAScript, so 40 digits carry the double exactly enough.
 */

type Unary = 'exp' | 'ln' | 'log10' | 'expm1' | 'log1p';

const bits = new Float64Array(1);
const words = new BigInt64Array(bits.buffer);

/** Maps a double to an integer whose order matches the doubles' order. */
function ordered(x: number): bigint {
  bits[0] = x;
  const raw = words[0] ?? 0n;
  return raw < 0n ? -(raw & 0x7fffffffffffffffn) : raw;
}

function ulps(a: number, b: number): bigint {
  const d = ordered(a) - ordered(b);
  return d < 0n ? -d : d;
}

/**
 * Significant digits for the reference. 1 + x and e^x - 1 near x = 0 need
 * one more digit per decade of smallness, or they cancel to nothing; the
 * other functions need no more than 60, and asking for 383 digits makes
 * decimal.js's ln take 27 ms a call (measured).
 */
function digitsFor(fn: Unary, x: number): number {
  if ((fn !== 'expm1' && fn !== 'log1p') || x === 0) return 60;
  return 60 + Math.max(0, Math.floor(-Math.log10(Math.abs(x))));
}

function exact(D: typeof Decimal, x: number): Decimal {
  return new D(x.toPrecision(40));
}

function reference(fn: Unary, x: number): number {
  const D = Decimal.clone({
    precision: digitsFor(fn, x),
    rounding: Decimal.ROUND_HALF_EVEN,
  });
  const v = exact(D, x);
  const r = {
    exp: () => D.exp(v),
    ln: () => D.ln(v),
    log10: () => D.log10(v),
    expm1: () => D.exp(v).minus(1),
    log1p: () => D.ln(new D(1).plus(v)),
  }[fn]();
  return Number(r.toString());
}

function referencePow(base: number, exponent: number): number {
  const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN });
  return Number(D.pow(exact(D, base), exact(D, exponent)).toString());
}

const UNARY = { exp, ln, log10, expm1, log1p } as const;

/** Finite-result domains, and boundary inputs at each domain's edges. */
const DOMAIN: Record<Unary, { min: number; max: number; edges: number[] }> = {
  exp: {
    min: -745,
    max: 709.78,
    edges: [-745, -744.44, -708.4, -1e-300, 5e-324, 1e-16, 1, 2, 709.78],
  },
  ln: {
    min: Number.MIN_VALUE,
    max: Number.MAX_VALUE,
    edges: [
      5e-324,
      2.2250738585072014e-308,
      0.9999999999999999,
      1.0000000000000002,
      2,
      10,
      Number.MAX_VALUE,
    ],
  },
  log10: {
    min: Number.MIN_VALUE,
    max: Number.MAX_VALUE,
    edges: [
      5e-324,
      1e-300,
      0.1,
      9.999999999999998,
      10,
      1e22,
      1e23,
      Number.MAX_VALUE,
    ],
  },
  expm1: {
    min: -50,
    max: 709.78,
    edges: [-50, -1e-300, -5e-324, 5e-324, 1e-300, 1e-10, 0.5, 1, 709.78],
  },
  log1p: {
    min: -0.9999999999999999,
    max: Number.MAX_VALUE,
    edges: [
      -0.9999999999999999,
      -0.5,
      -1e-300,
      5e-324,
      1e-300,
      1e-10,
      1,
      Number.MAX_VALUE,
    ],
  },
};

// Each test evaluates up to 5,001 decimal.js references: about 1 s on an
// idle laptop, and 12 s measured while another suite loaded the machine.
// The bound under test is accuracy, so a 5 s timeout would guard only the
// machine's load.
const REFERENCE_TIMEOUT_MS = 60_000;

describe(
  'det-math is within 2 ulp of a 60-digit reference',
  { timeout: REFERENCE_TIMEOUT_MS },
  () => {
    for (const name of Object.keys(UNARY) as Unary[]) {
      const fn = UNARY[name];
      const { min, max, edges } = DOMAIN[name];

      it(`${name} at its domain edges`, () => {
        for (const x of edges) {
          expect(
            ulps(fn(x), reference(name, x)),
            `${name}(${String(x)})`,
          ).toBeLessThanOrEqual(2n);
        }
      });

      it(`${name} on 2,000 random inputs`, () => {
        fc.assert(
          fc.property(fc.double({ min, max, noNaN: true }), (x) => {
            expect(
              ulps(fn(x), reference(name, x)),
              `${name}(${String(x)})`,
            ).toBeLessThanOrEqual(2n);
          }),
          { numRuns: 2000 },
        );
      });
    }

    it('pow(1.15, n) for every n in 0..5000, the Encounter cost curve', () => {
      let worst = 0n;
      for (let n = 0; n <= 5000; n++) {
        const d = ulps(pow(1.15, n), referencePow(1.15, n));
        if (d > worst) worst = d;
      }
      expect(worst).toBeLessThanOrEqual(2n);
    });

    it('pow on 2,000 random positive bases and real exponents', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1e-3, max: 1e3, noNaN: true }),
          fc.double({ min: -100, max: 100, noNaN: true }),
          (base, exponent) => {
            expect(
              ulps(pow(base, exponent), referencePow(base, exponent)),
              `pow(${String(base)}, ${String(exponent)})`,
            ).toBeLessThanOrEqual(2n);
          },
        ),
        { numRuns: 2000 },
      );
    });
  },
);

describe('det-math special values follow ECMAScript exactly', () => {
  // Literal expectations, never `**` or Math.*: a fixture computed by the
  // engine under test cannot disagree with it.
  const cases: [string, () => number, number][] = [
    ['exp(NaN)', () => exp(NaN), NaN],
    ['exp(-0)', () => exp(-0), 1],
    ['exp(Infinity)', () => exp(Infinity), Infinity],
    ['exp(-Infinity)', () => exp(-Infinity), 0],
    ['exp(1000)', () => exp(1000), Infinity],
    ['exp(-1000)', () => exp(-1000), 0],
    ['ln(0)', () => ln(0), -Infinity],
    ['ln(-0)', () => ln(-0), -Infinity],
    ['ln(-1)', () => ln(-1), NaN],
    ['ln(1)', () => ln(1), 0],
    ['ln(Infinity)', () => ln(Infinity), Infinity],
    ['log10(0)', () => log10(0), -Infinity],
    ['log10(-1)', () => log10(-1), NaN],
    ['log10(1)', () => log10(1), 0],
    ['expm1(-0)', () => expm1(-0), -0],
    ['expm1(-Infinity)', () => expm1(-Infinity), -1],
    ['expm1(NaN)', () => expm1(NaN), NaN],
    ['log1p(-1)', () => log1p(-1), -Infinity],
    ['log1p(-2)', () => log1p(-2), NaN],
    ['log1p(-0)', () => log1p(-0), -0],
    ['pow(NaN, 0)', () => pow(NaN, 0), 1],
    ['pow(1, NaN)', () => pow(1, NaN), NaN],
    ['pow(1, Infinity)', () => pow(1, Infinity), NaN],
    ['pow(1, -Infinity)', () => pow(1, -Infinity), NaN],
    ['pow(-1, Infinity)', () => pow(-1, Infinity), NaN],
    ['pow(NaN, -0)', () => pow(NaN, -0), 1],
    ['pow(0, -1)', () => pow(0, -1), Infinity],
    ['pow(-0, -1)', () => pow(-0, -1), -Infinity],
    ['pow(-0, -2)', () => pow(-0, -2), Infinity],
    ['pow(-8, 1/3)', () => pow(-8, 1 / 3), NaN],
    ['pow(-2, 3)', () => pow(-2, 3), -8],
    ['pow(2, 1024)', () => pow(2, 1024), Infinity],
    ['pow(2, -1074)', () => pow(2, -1074), 5e-324],
  ];
  for (const [label, actual, expected] of cases) {
    it(label, () => {
      const value = actual();
      expect(Object.is(value, expected), `${label} = ${String(value)}`).toBe(
        true,
      );
    });
  }
});
```

`tests/unit/third-party-notices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  bundledPackages,
  pickFile,
  renderNotices,
  SHIPPED_WORKSPACES,
  type Lockfile,
} from '../../scripts/third-party-notices';

/**
 * Third-party notices for everything a shipped build bundles (#26 AC11).
 *
 * Apache-2.0 §4 requires a copy of the licence and every NOTICE text of the
 * works we redistribute, and MIT requires its copyright line. The six direct
 * @stdlib packages pull in 152, several of whose LICENSE files append
 * upstream copyrights (Sun, the Go Authors) to the Apache text, so the listing is
 * derived from the lockfile and the installed files, never kept by hand.
 */

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as Lockfile;
const listing = readFileSync('THIRD-PARTY-NOTICES.md', 'utf8');

function directDependencies(workspace: string): string[] {
  const pkg = JSON.parse(readFileSync(`${workspace}/package.json`, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(pkg.dependencies ?? {});
}

describe('THIRD-PARTY-NOTICES.md', () => {
  it('is exactly what the generator renders from the lockfile (npm run notices)', () => {
    expect(listing).toBe(renderNotices(lock, '.'));
  });

  it('covers the whole dependency closure of every shipped workspace', () => {
    const names = bundledPackages(lock).map((p) => p.name);
    // The closure is larger than the direct list: @stdlib's six pull in 152.
    expect(
      names.filter((n) => n.startsWith('@stdlib/')).length,
    ).toBeGreaterThan(100);
    for (const workspace of SHIPPED_WORKSPACES) {
      for (const name of directDependencies(workspace)) {
        expect(names, `${workspace} depends on ${name}`).toContain(name);
      }
    }
    for (const name of names) {
      expect(listing, name).toContain(`\`${name}\``);
    }
  });

  it('carries every distinct licence text, including the upstream Sun and Go copyrights', () => {
    expect(listing).toContain('Apache License');
    expect(listing).toContain(
      'Copyright (C) 1993-2004 by Sun Microsystems, Inc.',
    );
    expect(listing).toContain('Copyright (c) 2009 The Go Authors.');
    expect(listing).toContain('Copyright (c) 2016-2026 The Stdlib Authors.');
  });
});

describe('pickFile, the same on every filesystem', () => {
  // Pure over a list of names, so Linux's case-sensitive behaviour is tested
  // on any OS. `ms` 2.0.0 ships `license.md`; CI (Linux) failed on it while
  // macOS's case-insensitive lookup found it.
  it.each<[string[], string | undefined]>([
    [['license.md', 'index.js'], 'license.md'],
    [['LICENSE', 'license.md'], 'LICENSE'],
    [['LICENCE.txt'], 'LICENCE.txt'],
    [['license.txt', 'LICENSE.md'], 'LICENSE.md'],
    [['LICENSE.md', 'license.txt'], 'LICENSE.md'],
    // One rank: the name decides, never the listing order.
    [['license', 'LICENSE'], 'LICENSE'],
    [['LICENSE', 'LICENCE'], 'LICENCE'],
    [['README.md', 'package.json'], undefined],
    [['LICENSE-MIT'], undefined],
  ])('picks the licence file from %j', (names, want) => {
    expect(pickFile(names, 'licence')).toBe(want);
  });

  it.each<[string[], string | undefined]>([
    [['NOTICE', 'LICENSE'], 'NOTICE'],
    [['notice.md'], 'notice.md'],
    [['LICENSE'], undefined],
  ])('picks the notice file from %j', (names, want) => {
    expect(pickFile(names, 'notice')).toBe(want);
  });
});

describe('NOTICE', () => {
  const notice = readFileSync('NOTICE', 'utf8');

  it('names each bundled Apache-2.0 @stdlib package and points to the full texts', () => {
    const stdlib = directDependencies('packages/core').filter((n) =>
      n.startsWith('@stdlib/'),
    );
    expect(stdlib.length).toBeGreaterThan(0);
    for (const name of stdlib) {
      expect(notice, name).toContain(name);
    }
    expect(notice).toContain('THIRD-PARTY-NOTICES.md');
  });
});
```

- [ ] **Step 3: Write throwing stubs and see every test fail on its own assertion**

`packages/core/src/det-math.ts` (stub):

```ts
export function pow(base: number, exponent: number): number {
  throw new Error(`det-math.pow(${String(base)}, ${String(exponent)}): not implemented`);
}
export function exp(x: number): number {
  throw new Error(`det-math.exp(${String(x)}): not implemented`);
}
export function ln(x: number): number {
  throw new Error(`det-math.ln(${String(x)}): not implemented`);
}
export function log10(x: number): number {
  throw new Error(`det-math.log10(${String(x)}): not implemented`);
}
export function expm1(x: number): number {
  throw new Error(`det-math.expm1(${String(x)}): not implemented`);
}
export function log1p(x: number): number {
  throw new Error(`det-math.log1p(${String(x)}): not implemented`);
}
```

`scripts/third-party-notices.ts` (stub):

```ts
export interface LockPackage {
  version?: string;
  license?: string;
  dependencies?: Record<string, string>;
}
export interface Lockfile {
  packages: Record<string, LockPackage>;
}
export interface Bundled {
  name: string;
  version: string;
  license: string;
  path: string;
}
export const SHIPPED_WORKSPACES = ['packages/core'] as const;
export function bundledPackages(lock: Lockfile): Bundled[] {
  throw new Error(`bundledPackages(${String(Object.keys(lock.packages).length)}): not implemented`);
}
export function pickFile(names: readonly string[], kind: 'licence' | 'notice'): string | undefined {
  throw new Error(`pickFile(${String(names.length)}, ${kind}): not implemented`);
}
export function renderNotices(lock: Lockfile, root: string): string {
  throw new Error(`renderNotices(${String(Object.keys(lock.packages).length)}, ${root}): not implemented`);
}
```

Also write `THIRD-PARTY-NOTICES.md` containing the single line `placeholder`.

Run: `npx vitest run packages/core tests/unit/third-party-notices.test.ts`
Expected: `Tests  61 failed (61)`. 45 det-math tests fail with `det-math.<fn>(...): not implemented` (the six property tests via fast-check's `Property failed` wrapper), and 16 notices tests fail: the 12 `pickFile` cases and two others with `not implemented`, one because `placeholder` holds no licence text, and one because NOTICE does not name `@stdlib/math-base-special-exp`.

- [ ] **Step 4: Implement**

`packages/core/src/det-math.ts`:

```ts
import stdlibExp from '@stdlib/math-base-special-exp';
import stdlibExpm1 from '@stdlib/math-base-special-expm1';
import stdlibLn from '@stdlib/math-base-special-ln';
import stdlibLog10 from '@stdlib/math-base-special-log10';
import stdlibLog1p from '@stdlib/math-base-special-log1p';
import stdlibPow from '@stdlib/math-base-special-pow';

/**
 * Deterministic transcendental functions (M1 design §2.1, D-M1-1).
 *
 * ECMAScript leaves Math.pow, exp and log implementation-approximated, and
 * the engines disagree: Math.pow(1.15, n) differed in 49,204 of 100,000
 * results between V8 and JavaScriptCore. Ranked replay runs an iPhone's events
 * on Cloudflare's V8, so one differing bit can flip a purchase. The @stdlib
 * ports are plain JavaScript built on + - * / and bit operations, which every
 * engine rounds identically (0 differences in 2,000,000 per function).
 *
 * Nothing else in packages/core/src may call a transcendental: an ESLint rule
 * bans the Math forms and the `**` operator there.
 */

/**
 * base raised to exponent, with the special values of ECMAScript's `**`.
 *
 * @stdlib follows C99 where the two differ: it returns 1 for pow(1, ±Infinity)
 * and NaN for pow(NaN, ±0), where ECMAScript says NaN and 1. Core keeps the
 * language's rule, so replacing `x ** y` with `pow(x, y)` never changes a
 * value.
 */
export function pow(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  if ((base === 1 || base === -1) && !Number.isFinite(exponent)) return NaN;
  return stdlibPow(base, exponent);
}

/** e raised to x. */
export function exp(x: number): number {
  return stdlibExp(x);
}

/** Natural logarithm. */
export function ln(x: number): number {
  return stdlibLn(x);
}

/** Base-10 logarithm. */
export function log10(x: number): number {
  return stdlibLog10(x);
}

/** e^x - 1, accurate where x is near 0. */
export function expm1(x: number): number {
  return stdlibExpm1(x);
}

/** ln(1 + x), accurate where x is near 0. */
export function log1p(x: number): number {
  return stdlibLog1p(x);
}
```

`packages/core/src/index.ts`:

```ts
/**
 * @wordfarer/core: every rule that moves a number (M1 design §1). Pure
 * TypeScript with no DOM, timers, network or system clock, so the same code
 * runs in browsers, Electron, Capacitor and Workers and replays identically.
 */
export { exp, expm1, ln, log10, log1p, pow } from './det-math';
```

`scripts/third-party-notices.ts`:

```ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Generates THIRD-PARTY-NOTICES.md from the lockfile (#26 AC11).
 *
 * Every package in the production dependency closure of a shipped workspace
 * is listed with its version and licence, followed by each distinct LICENSE
 * and NOTICE text verbatim. Identical texts are printed once, with the
 * packages they cover. Run `npm run notices` after any dependency change; a
 * unit test fails while the committed file differs from this output.
 */

export interface LockPackage {
  version?: string;
  license?: string;
  dependencies?: Record<string, string>;
}

export interface Lockfile {
  packages: Record<string, LockPackage>;
}

export interface Bundled {
  name: string;
  version: string;
  license: string;
  /** The package's lockfile key, which is also its path from the repo root. */
  path: string;
}

/** Workspaces whose dependencies end up inside a shipped build. */
export const SHIPPED_WORKSPACES = ['packages/core'] as const;

const FILE_PATTERNS = {
  licence: /^licen[cs]e(\.(md|txt))?$/i,
  notice: /^notice(\.(md|txt))?$/i,
} as const;

/**
 * The licence or notice file among a package's file names, matched without
 * regard to case. Asking the filesystem for `LICENSE.md` finds `license.md`
 * on macOS and not on Linux: `ms` 2.0.0 ships `license.md`, and CI failed on
 * exactly that. Candidates are sorted (no extension, then .md, then .txt,
 * then by name), because directory listing order differs between
 * filesystems too.
 */
export function pickFile(
  names: readonly string[],
  kind: keyof typeof FILE_PATTERNS,
): string | undefined {
  const rank = (name: string) =>
    name.includes('.') ? (/\.md$/i.test(name) ? 1 : 2) : 0;
  return names
    .filter((name) => FILE_PATTERNS[kind].test(name))
    .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))[0];
}

/** Finds `name` the way Node does: nearest node_modules first, then upward. */
function resolve(lock: Lockfile, from: string, name: string): string {
  let dir = from;
  for (;;) {
    const key = `${dir === '' ? '' : `${dir}/`}node_modules/${name}`;
    if (key in lock.packages) return key;
    if (dir === '') {
      throw new Error(
        `${name}, needed by ${from}, is not in package-lock.json`,
      );
    }
    const parent = dir.lastIndexOf('/node_modules/');
    dir = parent === -1 ? '' : dir.slice(0, parent);
  }
}

/** The production dependency closure of every shipped workspace, by name. */
export function bundledPackages(lock: Lockfile): Bundled[] {
  const seen = new Map<string, Bundled>();
  const queue: string[] = [...SHIPPED_WORKSPACES];
  for (let from = queue.shift(); from !== undefined; from = queue.shift()) {
    for (const name of Object.keys(lock.packages[from]?.dependencies ?? {})) {
      const path = resolve(lock, from, name);
      if (seen.has(path)) continue;
      const entry = lock.packages[path];
      if (entry?.version === undefined || entry.license === undefined) {
        throw new Error(
          `${path} has no version or licence in package-lock.json`,
        );
      }
      seen.set(path, {
        name,
        version: entry.version,
        license: entry.license,
        path,
      });
      queue.push(path);
    }
  }
  return [...seen.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en') ||
      a.version.localeCompare(b.version, 'en'),
  );
}

function readText(
  root: string,
  path: string,
  kind: keyof typeof FILE_PATTERNS,
): string | undefined {
  const file = pickFile(readdirSync(join(root, path)), kind);
  if (file === undefined) return undefined;
  return readFileSync(join(root, path, file), 'utf8')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/** A code fence longer than any backtick run inside the text. */
function fence(text: string): string {
  const longest = Math.max(
    0,
    ...[...text.matchAll(/`+/g)].map((m) => m[0].length),
  );
  return '`'.repeat(Math.max(3, longest + 1));
}

export function renderNotices(lock: Lockfile, root: string): string {
  const packages = bundledPackages(lock);
  const texts = new Map<string, string[]>();
  for (const pkg of packages) {
    const licence = readText(root, pkg.path, 'licence');
    if (licence === undefined) {
      throw new Error(
        `${pkg.name} ships no LICENSE file; supply its licence text by hand`,
      );
    }
    const notice = readText(root, pkg.path, 'notice');
    for (const text of notice === undefined ? [licence] : [licence, notice]) {
      texts.set(text, [...(texts.get(text) ?? []), pkg.name]);
    }
  }

  const lines = [
    '# Third-party notices',
    '',
    'Generated by `npm run notices` from package-lock.json. Do not edit by hand.',
    '',
    'The production dependency closure of every workspace that a shipped',
    'Wordfarer build bundles. A bundler may leave some of these out; listing',
    'the whole closure errs on the side of attribution. Each licence and NOTICE',
    'text they ship follows the list, printed once with the packages it covers.',
    '',
    '## Packages',
    '',
    ...packages.map((p) => `- \`${p.name}\` ${p.version} (${p.license})`),
    '',
    '## Licence and notice texts',
  ];
  let index = 0;
  for (const [text, names] of texts) {
    index += 1;
    const f = fence(text);
    lines.push(
      '',
      `### Text ${String(index)}`,
      '',
      `Covers: ${names.map((n) => `\`${n}\``).join(', ')}.`,
      '',
      `${f}text`,
      text,
      f,
    );
  }
  return `${lines.join('\n')}\n`;
}

if (import.meta.main) {
  const lock = JSON.parse(
    readFileSync('package-lock.json', 'utf8'),
  ) as Lockfile;
  writeFileSync('THIRD-PARTY-NOTICES.md', renderNotices(lock, '.'));
}
```

Wire the generator and keep its output out of Prettier's hands (it holds licence texts verbatim):

`package.json` (change):

```diff
diff --git a/package.json b/package.json
index 55c7df1..8413bd4 100644
--- a/package.json
+++ b/package.json
@@ -18,7 +18,8 @@
     "typecheck": "tsc --noEmit && npm run typecheck --workspaces --if-present",
     "format": "prettier --write .",
     "format:check": "prettier --check .",
-    "build": "npm run build --workspaces --if-present"
+    "build": "npm run build --workspaces --if-present",
+    "notices": "node scripts/third-party-notices.ts"
   },
   "devDependencies": {
     "@eslint/compat": "^2.1.1",
```

`.prettierignore` (change):

```diff
diff --git a/.prettierignore b/.prettierignore
index fdf61cf..f9f5aac 100644
--- a/.prettierignore
+++ b/.prettierignore
@@ -1,3 +1,5 @@
 package-lock.json
 LICENSES/
 LICENSE
+# Generated by npm run notices; holds licence texts verbatim
+THIRD-PARTY-NOTICES.md
```

`NOTICE` (change):

```diff
diff --git a/NOTICE b/NOTICE
index 704595b..e4ea761 100644
--- a/NOTICE
+++ b/NOTICE
@@ -6,3 +6,18 @@ Version 2.0 (see LICENSE). Course content is licensed per item under
 CC BY-SA 4.0 or CC BY-NC-SA 4.0 (see LICENSE-CONTENT.md). The Wordfarer
 name and logo are trademarks of Shyden Labs and are not licensed
 (see TRADEMARKS.md).
+
+This product bundles the following Apache-2.0 packages from the stdlib
+project (https://github.com/stdlib-js/stdlib), Copyright (c) 2016-2026
+The Stdlib Authors, together with the @stdlib packages they depend on:
+
+  @stdlib/math-base-special-exp
+  @stdlib/math-base-special-expm1
+  @stdlib/math-base-special-ln
+  @stdlib/math-base-special-log10
+  @stdlib/math-base-special-log1p
+  @stdlib/math-base-special-pow
+
+Some of them carry further upstream copyrights (Sun Microsystems, the Go
+Authors). The full licence and NOTICE text of every bundled third-party
+package is in THIRD-PARTY-NOTICES.md.
```

Then generate: `npm run notices`. Expected: `THIRD-PARTY-NOTICES.md` lists 161 packages (152 `@stdlib`, 9 MIT from `@stdlib`'s native-addon loader) and 15 distinct texts.

- [ ] **Step 5: Run green**

Run: `npx vitest run packages/core tests/unit/third-party-notices.test.ts`
Expected: `Tests  61 passed (61)`, the det-math file in about 4 s on an idle machine.

- [ ] **Step 6: Gate and commit**

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && scripts/fail-on-warnings.sh npm run build
git add -A && git commit -m "feat(core): package, det-math and third-party notices (Refs #26)"
```

Expected: every step exits 0; `build` prints `dist/index.js  117.8kb`.

- [ ] **Step 7: Mutations, against the commit (each predicted before it ran)**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/det-math.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `\n` marks a line break and `(deleted)` means the line is removed.

| Id    | File                     | Change                                                                                                                                 | Predicted (written first)                                                                                                                                                                                                                                                                              | Result       |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| M1.1  | `det-math.ts`            | `  return stdlibPow(base, exponent);` → `  return Math.pow(base, exponent);`                                                           | survives: 0 failed, 45 passed                                                                                                                                                                                                                                                                          | as predicted |
| M1.2  | `det-math.ts`            | `  if (exponent === 0) return 1;` → (deleted)                                                                                          | 2 failed (pow(NaN, 0); pow(NaN, -0)), 43 passed                                                                                                                                                                                                                                                        | as predicted |
| M1.3  | `det-math.ts`            | `  if ((base === 1 \|\| base === -1) && !Number.isFinite(exponent)) return NaN;` → (deleted)                                           | 2 failed (pow(1, Infinity); pow(1, -Infinity)), 43 passed                                                                                                                                                                                                                                              | as predicted |
| M1.4  | `det-math.ts`            | `  return stdlibExp(x);` → `  return stdlibExp(x) * (1 + 4 * Number.EPSILON);`                                                         | 3 failed (exp at its domain edges; exp on 2,000; exp(-0)), 42 passed                                                                                                                                                                                                                                   | as predicted |
| M1.5  | `det-math.ts`            | `  return stdlibLog1p(x);` → `  return stdlibLn(1 + x);`                                                                               | 3 failed (log1p at its domain edges; log1p on 2,000; log1p(-0)), 42 passed                                                                                                                                                                                                                             | as predicted |
| M1.6  | `THIRD-PARTY-NOTICES.md` | ``- `@stdlib/math-base-special-pow` 0.3.1 (Apache-2.0)`` → (deleted)                                                                   | `npx vitest run tests/unit/third-party-notices.test.ts`: 1 failed (is exactly what the generator renders), 15 passed                                                                                                                                                                                   | as predicted |
| M1.7  | `NOTICE`                 | `  @stdlib/math-base-special-pow` → (deleted)                                                                                          | `npx vitest run tests/unit/third-party-notices.test.ts`: 1 failed (names each bundled Apache-2.0), 15 passed                                                                                                                                                                                           | as predicted |
| M1.8  | `third-party-notices.ts` | `    dir = parent === -1 ? '' : dir.slice(0, parent);` → `    dir = parent === -1 ? '' : '';`                                          | `npx vitest run tests/unit/third-party-notices.test.ts`: 1 failed (is exactly what the generator renders), 15 passed                                                                                                                                                                                   | as predicted |
| M1.10 | `third-party-notices.ts` | `  licence: /^licen[cs]e(\.(md\|txt))?$/i,` → `  licence: /^licen[cs]e(\.(md\|txt))?$/,`                                               | `npx vitest run tests/unit/third-party-notices.test.ts`: 7 failed (is exactly what the generator renders; from ["LICENSE","license.md"]; from ["LICENCE.txt"]; from ["license.txt","LICENSE.md"]; from ["LICENSE.md","license.txt"]; from ["license","LICENSE"]; from ["LICENSE","LICENCE"]), 9 passed | as predicted |
| M1.11 | `third-party-notices.ts` | `    .sort((a, b) => rank(a) - rank(b) \|\| (a < b ? -1 : a > b ? 1 : 0))[0];` → `    .slice()[0];`                                    | `npx vitest run tests/unit/third-party-notices.test.ts`: 3 failed (from ["license.txt","LICENSE.md"]; from ["license","LICENSE"]; from ["LICENSE","LICENCE"]), 13 passed                                                                                                                               | as predicted |
| M1.12 | `third-party-notices.ts` | `    .sort((a, b) => rank(a) - rank(b) \|\| (a < b ? -1 : a > b ? 1 : 0))[0];` → `    .sort((a, b) => rank(a) - rank(b))[0];`          | `npx vitest run tests/unit/third-party-notices.test.ts`: 2 failed (from ["license","LICENSE"]; from ["LICENSE","LICENCE"]), 14 passed                                                                                                                                                                  | as predicted |
| M1.9  | `det-math.ts`            | `import stdlibPow from '@stdlib/math-base-special-pow';` → `import stdlibPow from '@stdlib/math-base-special-pow';\nimport 'node:fs';` | `npm run build --workspace @wordfarer/core` fails, output names `node:fs`                                                                                                                                                                                                                              | as predicted |

---

### Task 2: The determinism lint ban

**Files:**

- Modify: `eslint.config.js`
- Test: `tests/unit/core-determinism-lint.test.ts`

**Interfaces:**

- Consumes: the flat config's existing `tseslint.config(...)` list.
- Produces: an ESLint block for `packages/core/src/**/*.ts` using `no-restricted-properties`, `no-restricted-syntax`, `no-restricted-globals` and `no-restricted-imports`, with `linterOptions.noInlineConfig: true`. Calls on the `Num` namespace (`Num.pow`) are allowed; named `det-math` imports are allowed.

- [ ] **Step 1: Write the failing test**

`tests/unit/core-determinism-lint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ESLint, type Linter } from 'eslint';
import tseslint from 'typescript-eslint';

/**
 * The determinism ban on packages/core/src (M1 design §2.1 and §3, #26 AC3).
 *
 * Each banned form is linted as real code at a core source path and must be
 * reported by one of the ban rules. Lint runs with type information off: the
 * bans are syntactic, and the project service refuses a path that is not on
 * disk. A fixture that fails to parse reports an error too, so every
 * expectation also asserts there was no fatal parse error; without that a
 * typo in a fixture would pass as a ban.
 */

const BAN_RULES = new Set([
  'no-restricted-properties',
  'no-restricted-syntax',
  'no-restricted-globals',
  'no-restricted-imports',
]);

const eslint = new ESLint({
  overrideConfig: [
    { files: ['**/*.ts'], ...tseslint.configs.disableTypeChecked },
  ],
});

async function lint(
  code: string,
  filePath: string,
): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (result === undefined) throw new Error(`no lint result for ${filePath}`);
  const fatal = result.messages.filter((m) => m.fatal === true);
  expect(fatal, `fixture must parse: ${code}`).toEqual([]);
  return result.messages;
}

async function bans(code: string, filePath = 'packages/core/src/fixture.ts') {
  const messages = await lint(code, filePath);
  return messages.filter((m) => m.ruleId !== null && BAN_RULES.has(m.ruleId));
}

const MATH = [
  'pow',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log10',
  'log2',
  'cbrt',
  'hypot',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'random',
];
const DECIMAL = ['pow', 'exp', 'ln', 'log', 'log10', 'log2'];
const GLOBALS = [
  'setTimeout',
  'setInterval',
  'fetch',
  'window',
  'document',
  'performance',
  'crypto',
];

const BANNED: [string, string][] = [
  ...MATH.map((f): [string, string] => [
    `Math.${f}`,
    `export const x = Math.${f}(2, 3);`,
  ]),
  ['Math destructuring', 'const { pow } = Math;\nexport const x = pow(2, 3);'],
  ['the ** operator', 'export const x = 2 ** 3;'],
  ['the **= operator', 'let y = 2;\ny **= 3;\nexport const x = y;'],
  ...DECIMAL.map((f): [string, string] => [
    `Decimal.${f} (static)`,
    `import Decimal from 'break_infinity.js';\nexport const x = Decimal.${f}(2, 3);`,
  ]),
  ...DECIMAL.map((f): [string, string] => [
    `.${f}() on an instance`,
    `declare const d: Record<string, (n: number) => unknown>;\nexport const x = d.${f}(2);`,
  ]),
  [
    'a computed Decimal member',
    "declare const d: Record<string, () => unknown>;\nexport const x = d['pow']();",
  ],
  ['Date.now', 'export const x = Date.now();'],
  ['zero-argument new Date()', 'export const x = new Date();'],
  ['Date() called as a function', 'export const x = Date();'],
  ...GLOBALS.map((g): [string, string] => [
    `the ${g} global`,
    `export const x = ${g};`,
  ]),
  ...GLOBALS.map((g): [string, string] => [
    `globalThis.${g}`,
    `export const x = globalThis.${g};`,
  ]),
  [
    'a node: built-in',
    "import { readFileSync } from 'node:fs';\nexport const x = readFileSync;",
  ],
  [
    'a bare Node built-in',
    "import { readFileSync } from 'fs';\nexport const x = readFileSync;",
  ],
];

describe('packages/core/src bans every non-deterministic form', () => {
  for (const [label, code] of BANNED) {
    it(label, async () => {
      expect(await bans(code), code).not.toEqual([]);
    });
  }

  it('an inline eslint-disable cannot switch a ban off', async () => {
    const code =
      '// eslint-disable-next-line no-restricted-properties\nexport const x = Math.random();';
    expect(await bans(code)).not.toEqual([]);
  });
});

describe('the ban leaves deterministic code alone', () => {
  const ALLOWED: [string, string][] = [
    [
      'new Date(wallMs) from an explicit argument',
      'declare const wallMs: number;\nexport const x = new Date(wallMs);',
    ],
    [
      'Math.sqrt, correctly rounded everywhere',
      'export const x = Math.sqrt(2);',
    ],
    [
      'Math.floor and Math.max',
      'export const x = Math.floor(Math.max(1.5, 2));',
    ],
    [
      'Num.pow, built on det-math',
      "import { Num } from './num';\nexport const x = Num.pow(Num.from(2), 3);",
    ],
    [
      'a det-math import',
      "import { pow } from './det-math';\nexport const x = pow(1.15, 3);",
    ],
  ];
  for (const [label, code] of ALLOWED) {
    it(label, async () => {
      expect(await bans(code), code).toEqual([]);
    });
  }

  it('is scoped to packages/core/src: the same code elsewhere is not banned', async () => {
    const code = 'export const x = Math.pow(2, 3) + Date.now();';
    expect(await bans(code, 'packages/core/test/fixture.test.ts')).toEqual([]);
    expect(await bans(code, 'apps/web/src/fixture.ts')).toEqual([]);
    // Liveness: the same text IS banned at a core source path.
    expect(await bans(code)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: See it fail against the Task 1 config**

The stub is the Task 1 `eslint.config.js`, unchanged.

Run: `npx vitest run tests/unit/core-determinism-lint.test.ts --reporter=verbose`
Expected: `Tests  57 failed | 5 passed (62)`. The 56 banned forms fail with `<the fixture code>: expected [] to not deeply equal []`, and so does the scope test (its liveness check sees 0 bans at a core path, not 2). The 5 "leaves deterministic code alone" tests pass: nothing is banned yet. They can only be red under a too-broad rule, which mutations M2.3 and M2.4 supply.

- [ ] **Step 3: Implement**

`eslint.config.js` (change):

```diff
diff --git a/eslint.config.js b/eslint.config.js
index a8b24f4..7afaf40 100644
--- a/eslint.config.js
+++ b/eslint.config.js
@@ -1,3 +1,4 @@
+import { builtinModules } from 'node:module';
 import { fileURLToPath } from 'node:url';
 import { includeIgnoreFile } from '@eslint/compat';
 import js from '@eslint/js';
@@ -6,6 +7,131 @@ import svelte from 'eslint-plugin-svelte';
 import globals from 'globals';
 import svelteConfig from './apps/web/svelte.config.js';

+/**
+ * Determinism bans for packages/core/src (M1 design §2.1 and §3).
+ *
+ * Core must compute the same bits on every engine, because ranked replay runs
+ * a phone's events on Cloudflare's V8. Math.pow and friends are
+ * implementation-approximated and differed between V8 and JavaScriptCore in up
+ * to 49% of results; det-math.ts holds the deterministic versions. Core also
+ * reads no clock, timer, network or host object: time arrives as an explicit
+ * wallMs argument. Math.sqrt and + - * / are correctly rounded everywhere and
+ * stay allowed.
+ */
+const TRANSCENDENTAL =
+  'is engine-approximated; use det-math.ts (M1 design §2.1)';
+const IMPURE =
+  'reads the host; core takes time and randomness as explicit inputs (M1 design §3)';
+const MATH_BANNED = [
+  'pow',
+  'exp',
+  'expm1',
+  'log',
+  'log1p',
+  'log10',
+  'log2',
+  'cbrt',
+  'hypot',
+  'sin',
+  'cos',
+  'tan',
+  'asin',
+  'acos',
+  'atan',
+  'atan2',
+  'sinh',
+  'cosh',
+  'tanh',
+];
+const DECIMAL_BANNED = ['pow', 'exp', 'ln', 'log', 'log10', 'log2'];
+const HOST_GLOBALS = [
+  'setTimeout',
+  'setInterval',
+  'fetch',
+  'window',
+  'document',
+  'performance',
+  'crypto',
+];
+const DECIMAL_MEMBER = `/^(${DECIMAL_BANNED.join('|')})$/`;
+
+const coreDeterminism = {
+  'no-restricted-properties': [
+    'error',
+    ...MATH_BANNED.map((property) => ({
+      object: 'Math',
+      property,
+      message: `Math.${property} ${TRANSCENDENTAL}`,
+    })),
+    {
+      object: 'Math',
+      property: 'random',
+      message: `Math.random ${IMPURE}; use rng.ts`,
+    },
+    { object: 'Date', property: 'now', message: `Date.now ${IMPURE}` },
+    ...DECIMAL_BANNED.map((property) => ({
+      object: 'Decimal',
+      property,
+      message: `Decimal.${property} ${TRANSCENDENTAL}; Num builds powers from it`,
+    })),
+    ...HOST_GLOBALS.map((property) => ({
+      object: 'globalThis',
+      property,
+      message: `${property} ${IMPURE}`,
+    })),
+  ],
+  'no-restricted-syntax': [
+    'error',
+    {
+      selector: "BinaryExpression[operator='**']",
+      message: `** ${TRANSCENDENTAL}`,
+    },
+    {
+      selector: "AssignmentExpression[operator='**=']",
+      message: `**= ${TRANSCENDENTAL}`,
+    },
+    {
+      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
+      message: `new Date() ${IMPURE}`,
+    },
+    {
+      selector: "CallExpression[callee.name='Date']",
+      message: `Date() ${IMPURE}`,
+    },
+    {
+      // break_infinity's instance forms (d.pow(2)). Num.pow is the
+      // deterministic wrapper, so calls on the Num namespace are allowed;
+      // Math.* and Decimal.* statics have their own entries above, and
+      // excluding them here keeps each form reported once, by its own rule.
+      selector: `CallExpression[callee.type='MemberExpression'][callee.property.name=${DECIMAL_MEMBER}]:not([callee.object.name=/^(Num|Math|Decimal)$/])`,
+      message: `a Decimal power or logarithm ${TRANSCENDENTAL}; use Num.pow or det-math`,
+    },
+    {
+      selector: `CallExpression[callee.computed=true][callee.property.value=${DECIMAL_MEMBER}]`,
+      message: `a Decimal power or logarithm ${TRANSCENDENTAL}; use Num.pow or det-math`,
+    },
+  ],
+  'no-restricted-globals': [
+    'error',
+    ...HOST_GLOBALS.map((name) => ({ name, message: `${name} ${IMPURE}` })),
+  ],
+  'no-restricted-imports': [
+    'error',
+    {
+      paths: builtinModules.map((name) => ({
+        name,
+        message: 'core depends on no Node built-in (#26 AC1)',
+      })),
+      patterns: [
+        {
+          group: ['node:*'],
+          message: 'core depends on no Node built-in (#26 AC1)',
+        },
+      ],
+    },
+  ],
+};
+
 /**
  * One flat config for the whole monorepo. `--max-warnings 0` in the lint
  * script makes every warning a failure (zero-warnings policy, spec §12).
@@ -50,6 +176,13 @@ export default tseslint.config(
     files: ['apps/web/src/**/*.ts'],
     languageOptions: { globals: { ...globals.browser } },
   },
+  {
+    files: ['packages/core/src/**/*.ts'],
+    // An inline eslint-disable is ignored here and reported, so no ban can
+    // be switched off one line at a time.
+    linterOptions: { noInlineConfig: true },
+    rules: coreDeterminism,
+  },
   {
     files: ['**/*.js'],
     ...tseslint.configs.disableTypeChecked,
```

- [ ] **Step 4: Run green**

Run: `npx vitest run tests/unit/core-determinism-lint.test.ts`
Expected: `Tests  62 passed (62)`.

- [ ] **Step 5: Gate and commit** as in Task 1, message `feat(core): ban engine-approximated maths and host reads in core (Refs #26)`.

- [ ] **Step 6: Mutations, against the commit**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run tests/unit/core-determinism-lint.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `\n` marks a line break and `(deleted)` means the line is removed.

| Id   | File               | Change                                                                                       | Predicted (written first)                                                                                                                                                | Result       |
| ---- | ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| M2.1 | `eslint.config.js` | `  'tanh',` → (deleted)                                                                      | 1 failed (Math.tanh), 61 passed                                                                                                                                          | as predicted |
| M2.2 | `eslint.config.js` | `linterOptions: { noInlineConfig: true },` → `linterOptions: { noInlineConfig: false },`     | 1 failed (an inline eslint-disable cannot switch a ban off), 61 passed                                                                                                   | as predicted |
| M2.3 | `eslint.config.js` | `[callee.object.name=/^(Num\|Math\|Decimal)$/]` → `[callee.object.name=/^(Math\|Decimal)$/]` | 1 failed (Num.pow, built on det-math), 61 passed                                                                                                                         | as predicted |
| M2.4 | `eslint.config.js` | `[arguments.length=0]` → (deleted)                                                           | 1 failed (new Date(wallMs) from an explicit argument), 61 passed                                                                                                         | as predicted |
| M2.5 | `eslint.config.js` | `files: ['packages/core/src/**/*.ts'],` → `files: ['**/*.ts'],`                              | 1 failed (is scoped to packages/core/src), 61 passed                                                                                                                     | as predicted |
| M2.6 | `eslint.config.js` | `object: 'globalThis',` → `object: 'globalThat',`                                            | 7 failed (globalThis.setTimeout; globalThis.setInterval; globalThis.fetch; globalThis.window; globalThis.document; globalThis.performance; globalThis.crypto), 55 passed | as predicted |
| M2.7 | `eslint.config.js` | `group: ['node:*'],` → `group: ['nodeX:*'],`                                                 | 1 failed (a node: built-in), 61 passed                                                                                                                                   | as predicted |

---

### Task 3: `Num`, canonical tuples, powers from `det-math`

**Files:**

- Create: `packages/core/src/num.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/package.json` (dependency), `THIRD-PARTY-NOTICES.md` (regenerated), `docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md` (§2.1 caveat)
- Test: `packages/core/test/num.test.ts`

**Interfaces:**

- Consumes: `log10`, `pow` from `det-math`.
- Produces: `type Num` (a break_infinity `Decimal`), `type NumTuple = readonly [mantissa: number, exponent: number]`, and the frozen namespace `Num` with `from(x: number)`, `fromTuple(t: NumTuple)`, `toTuple(n: Num): NumTuple`, `add`, `sub`, `mul`, `div` (`(a: Num, b: Num) => Num`), `pow(base: Num, exponent: number): Num`, `log10(n: Num): number`, `cmp(a: Num, b: Num): -1 | 0 | 1`, `toNumber(n: Num): number`.

- [ ] **Step 1: Install break_infinity**

```bash
scripts/fail-on-warnings.sh npm install --workspace @wordfarer/core --save-exact break_infinity.js@2.2.0
npm run notices
```

Expected: the listing grows to 163 packages (`break_infinity.js` and its MIT dependency `pad-end`).

- [ ] **Step 2: Write the failing test**

`packages/core/test/num.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Decimal } from 'decimal.js';
import { Num, type NumTuple } from '../src/num';

/**
 * Num: break_infinity values held to a canonical, serialisable form (#26 AC4).
 *
 * State stores a Num as a [mantissa, exponent] tuple, so one value must have
 * one tuple: 1 <= |mantissa| < 10 with a safe-integer exponent, or exactly
 * [0, 0]. break_infinity normalises with Math.floor(Math.log10(|m|)) and its
 * add() leaves m < 1 for the integer mantissas 999999999999999 and
 * 999999999999998 (measured on V8 and JavaScriptCore alike), so Num
 * renormalises every result.
 */

const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN });

function canonical([m, e]: NumTuple): boolean {
  if (m === 0) return Object.is(m, 0) && e === 0;
  return (
    Number.isFinite(m) &&
    Math.abs(m) >= 1 &&
    Math.abs(m) < 10 &&
    Number.isSafeInteger(e)
  );
}

function sameTuple(a: NumTuple, b: NumTuple): boolean {
  return Object.is(a[0], b[0]) && Object.is(a[1], b[1]);
}

/** The exact value of a tuple, as a 60-digit decimal. */
function exact([m, e]: NumTuple): Decimal {
  return new D(m.toPrecision(40)).times(D.pow(10, e));
}

function relativeError(actual: NumTuple, expected: Decimal): number {
  if (expected.isZero()) return actual[0] === 0 ? 0 : Infinity;
  return exact(actual).minus(expected).abs().div(expected.abs()).toNumber();
}

const mantissa = fc
  .tuple(
    fc.double({ min: 1, max: 10, maxExcluded: true, noNaN: true }),
    fc.boolean(),
  )
  .map(([m, negative]) => (negative ? -m : m));
const tupleArb = fc.oneof(
  { weight: 1, arbitrary: fc.constant<NumTuple>([0, 0]) },
  {
    weight: 20,
    arbitrary: fc
      .tuple(mantissa, fc.integer({ min: -1000, max: 1000 }))
      .map((t): NumTuple => t),
  },
);
const positiveTuple = fc
  .tuple(
    fc.double({ min: 1, max: 10, maxExcluded: true, noNaN: true }),
    fc.integer({ min: -1000, max: 1000 }),
  )
  .map((t): NumTuple => t);

describe('the serialised form', () => {
  it('round-trips every canonical tuple exactly, through JSON too', () => {
    fc.assert(
      fc.property(tupleArb, (t) => {
        const out = Num.toTuple(Num.fromTuple(t));
        expect(sameTuple(out, t), JSON.stringify(t)).toBe(true);
        const viaJson = JSON.parse(JSON.stringify(out)) as NumTuple;
        expect(sameTuple(Num.toTuple(Num.fromTuple(viaJson)), t)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it.each<[string, NumTuple]>([
    ['a mantissa of 10', [10, 0]],
    ['a mantissa below 1', [0.5, 3]],
    ['a negative zero', [-0, 0]],
    ['zero with an exponent', [0, 3]],
    ['a NaN mantissa', [NaN, 0]],
    ['an infinite mantissa', [Infinity, 0]],
    ['a fractional exponent', [1, 0.5]],
    ['an unsafe exponent', [1, 2 ** 53]],
  ])('refuses %s', (_label, t) => {
    expect(() => Num.fromTuple(t)).toThrow(RangeError);
  });
});

describe('Num.from', () => {
  it.each([NaN, Infinity, -Infinity])('refuses %s', (x) => {
    expect(() => Num.from(x)).toThrow(RangeError);
  });

  it('maps both zeros to [0, 0]', () => {
    expect(sameTuple(Num.toTuple(Num.from(0)), [0, 0])).toBe(true);
    expect(sameTuple(Num.toTuple(Num.from(-0)), [0, 0])).toBe(true);
  });

  it('gives a canonical tuple within 2 parts in 2^52 of the input', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (x) => {
        const t = Num.toTuple(Num.from(x));
        expect(canonical(t), String(x)).toBe(true);
        expect(relativeError(t, new D(x.toPrecision(40)))).toBeLessThanOrEqual(
          2 * Number.EPSILON,
        );
      }),
      { numRuns: 2000 },
    );
  });
});

describe('arithmetic stays canonical and accurate', () => {
  it('renormalises the add() mantissa break_infinity leaves below 1', () => {
    // 5e14 + 4.99999999999999e14 = 999999999999999: break_infinity returns
    // [0.999999999999999, 15].
    const t = Num.toTuple(
      Num.add(Num.fromTuple([5, 14]), Num.fromTuple([4.99999999999999, 14])),
    );
    expect(canonical(t), JSON.stringify(t)).toBe(true);
    expect(t[1]).toBe(14);
    expect(relativeError(t, new D('999999999999999'))).toBeLessThanOrEqual(
      2 * Number.EPSILON,
    );
  });

  const OPS = [
    ['add', Num.add, (a: Decimal, b: Decimal) => a.plus(b)],
    ['sub', Num.sub, (a: Decimal, b: Decimal) => a.minus(b)],
    ['mul', Num.mul, (a: Decimal, b: Decimal) => a.times(b)],
  ] as const;

  for (const [name, op, ref] of OPS) {
    it(`${name} is canonical and within 1e-14 of the larger operand`, () => {
      fc.assert(
        fc.property(tupleArb, tupleArb, (a, b) => {
          const t = Num.toTuple(op(Num.fromTuple(a), Num.fromTuple(b)));
          expect(
            canonical(t),
            `${name}(${JSON.stringify(a)}, ${JSON.stringify(b)})`,
          ).toBe(true);
          const want = ref(exact(a), exact(b));
          // break_infinity adds at 15 significant digits, and a sum's error
          // is bounded by its larger operand, not by the (possibly tiny) sum.
          const scale =
            name === 'mul' ? want.abs() : D.max(exact(a).abs(), exact(b).abs());
          if (scale.isZero()) return;
          const err = exact(t).minus(want).abs().div(scale).toNumber();
          expect(err).toBeLessThanOrEqual(1e-14);
        }),
        { numRuns: 2000 },
      );
    });
  }

  it('div is canonical and within 1e-15, and refuses a zero divisor', () => {
    fc.assert(
      fc.property(tupleArb, positiveTuple, (a, b) => {
        const t = Num.toTuple(Num.div(Num.fromTuple(a), Num.fromTuple(b)));
        expect(canonical(t)).toBe(true);
        expect(relativeError(t, exact(a).div(exact(b)))).toBeLessThanOrEqual(
          1e-15,
        );
      }),
      { numRuns: 2000 },
    );
    expect(() => Num.div(Num.from(1), Num.from(0))).toThrow(RangeError);
  });
});

describe('Num.pow, built from det-math', () => {
  it('is canonical and within the derived bound 6e-16 x (|p| + |log10 result| + 2)', () => {
    // Num.pow computes l = (e + log10 m) x p. log10 m carries up to 2 ulp
    // (2.2e-16) of absolute error, which p multiplies; rounding l adds half
    // an ulp of l; 10^frac adds 2 ulp. So the relative error is at most
    // ln 10 x 2.2e-16 x (|p| + |l|) + 6.6e-16 <= 6e-16 x (|p| + |l| + 2).
    // Measured over 60,000 random cases (2026-10-01): worst 0.79 of this
    // bound. A guessed (|l| + 1) x 1e-15 was exceeded (1.04 of it).
    fc.assert(
      fc.property(
        positiveTuple,
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        (a, p) => {
          const t = Num.toTuple(Num.pow(Num.fromTuple(a), p));
          expect(canonical(t)).toBe(true);
          const want = exact(a).pow(new D(p.toPrecision(40)));
          const l = Math.abs(want.log(10).toNumber());
          const bound = 6e-16 * (Math.abs(p) + l + 2);
          expect(relativeError(t, want)).toBeLessThanOrEqual(bound);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('gives exact powers of ten', () => {
    for (const k of [0, 1, 7, 300, 4000, -300]) {
      expect(Num.toTuple(Num.pow(Num.from(10), k))).toEqual([1, k]);
    }
  });

  it('pins the bits of the cost curve far past 1e308', () => {
    // Golden values, measured 2026-10-01 and within the accuracy bound above
    // of decimal.js (3.0846206955449946e303, 6.0818451891827873e6069). Any
    // change to how Num.pow computes (Decimal.pow, Math.pow, another
    // det-math) moves these bits.
    expect(Num.toTuple(Num.pow(Num.from(1.15), 5000))).toEqual([
      3.0846206955449995, 303,
    ]);
    expect(Num.toTuple(Num.pow(Num.from(1.15), 100000))).toEqual([
      6.081845189176603, 6069,
    ]);
  });

  it('handles zero and refuses what has no real answer', () => {
    expect(Num.toTuple(Num.pow(Num.from(0), 3))).toEqual([0, 0]);
    expect(Num.toTuple(Num.pow(Num.from(0), 0))).toEqual([1, 0]);
    expect(Num.toTuple(Num.pow(Num.from(7), 0))).toEqual([1, 0]);
    expect(() => Num.pow(Num.from(0), -1)).toThrow(RangeError);
    expect(() => Num.pow(Num.from(-2), 2)).toThrow(RangeError);
    expect(() => Num.pow(Num.from(2), NaN)).toThrow(RangeError);
    expect(() => Num.pow(Num.from(2), Infinity)).toThrow(RangeError);
  });
});

describe('comparison and reading back', () => {
  it('cmp orders like the exact values', () => {
    fc.assert(
      fc.property(tupleArb, tupleArb, (a, b) => {
        expect(Num.cmp(Num.fromTuple(a), Num.fromTuple(b))).toBe(
          exact(a).cmp(exact(b)),
        );
      }),
      { numRuns: 2000 },
    );
  });

  it('log10 is the exponent plus det-math log10 of the mantissa', () => {
    expect(Num.log10(Num.fromTuple([1, 4000]))).toBe(4000);
    expect(Num.log10(Num.fromTuple([5, -3]))).toBeCloseTo(-2.30103, 5);
    expect(() => Num.log10(Num.from(0))).toThrow(RangeError);
    expect(() => Num.log10(Num.from(-1))).toThrow(RangeError);
  });

  it('toNumber reads back in range and saturates outside it', () => {
    expect(Num.toNumber(Num.fromTuple([1.5, 3]))).toBe(1500);
    expect(Num.toNumber(Num.fromTuple([1, 400]))).toBe(Infinity);
    expect(Num.toNumber(Num.fromTuple([1, -400]))).toBe(0);
  });
});
```

- [ ] **Step 3: Stub and see red**

`packages/core/src/num.ts` (stub):

```ts
import type Decimal from 'break_infinity.js';

export type Num = Decimal;
export type NumTuple = readonly [mantissa: number, exponent: number];

function notImplemented(name: string): never {
  throw new Error(`Num.${name}: not implemented`);
}

export const Num = Object.freeze({
  from: (_x: number): Num => notImplemented('from'),
  fromTuple: (_t: NumTuple): Num => notImplemented('fromTuple'),
  toTuple: (_n: Num): NumTuple => notImplemented('toTuple'),
  add: (_a: Num, _b: Num): Num => notImplemented('add'),
  sub: (_a: Num, _b: Num): Num => notImplemented('sub'),
  mul: (_a: Num, _b: Num): Num => notImplemented('mul'),
  div: (_a: Num, _b: Num): Num => notImplemented('div'),
  pow: (_base: Num, _exponent: number): Num => notImplemented('pow'),
  log10: (_n: Num): number => notImplemented('log10'),
  cmp: (_a: Num, _b: Num): -1 | 0 | 1 => notImplemented('cmp'),
  toNumber: (_n: Num): number => notImplemented('toNumber'),
});
```

Run: `npx vitest run packages/core/test/num.test.ts`
Expected: `Tests  26 failed (26)`, each with `Num.<name>: not implemented` or, for the `toThrow(RangeError)` checks, because the stub throws a plain `Error`.

- [ ] **Step 4: Implement**

`packages/core/src/num.ts`:

```ts
import Decimal from 'break_infinity.js';
import { log10 as detLog10, pow as detPow } from './det-math';

/**
 * Num: break_infinity.js values for numbers past 1e308 (M1 design §2.1, §4).
 *
 * break_infinity is used for its representation and its + - * /, which are
 * correctly rounded on every engine. Two things are not taken from it:
 *
 * - Powers and logarithms. Decimal.pow and Decimal.log10 call Math.pow and
 *   Math.log10, which differ between engines; Num.pow and Num.log10 use
 *   det-math instead.
 * - Normalisation. break_infinity normalises with Math.floor(Math.log10(|m|)),
 *   and its add() leaves the mantissa below 1 for the integer mantissas
 *   999999999999999 and 999999999999998 (measured on V8 and JavaScriptCore
 *   alike). One value would then have two tuples, so every result is brought
 *   back to canonical form with comparisons alone, and Num.from finds its
 *   exponent with det-math rather than Decimal.fromNumber's Math.log10.
 *
 * State never holds a Num: it holds the tuple from Num.toTuple, which JSON
 * round-trips exactly.
 */
export type Num = Decimal;

/** [mantissa, exponent]: 1 <= |mantissa| < 10 and a safe-integer exponent, or [0, 0]. */
export type NumTuple = readonly [mantissa: number, exponent: number];

function isCanonical(m: number, e: number): boolean {
  if (m === 0) return Object.is(m, 0) && e === 0;
  return (
    Number.isFinite(m) &&
    Math.abs(m) >= 1 &&
    Math.abs(m) < 10 &&
    Number.isSafeInteger(e)
  );
}

const ZERO = Decimal.fromMantissaExponent_noNormalize(0, 0);
const ONE = Decimal.fromMantissaExponent_noNormalize(1, 0);

/**
 * The canonical Num for m x 10^e. Callers pass a mantissa at most a decade
 * or two out of range (a break_infinity result, or 10^frac rounded up to 10),
 * so the loops run once or not at all.
 */
function canonical(m: number, e: number): Num {
  if (!Number.isFinite(m) || !Number.isFinite(e)) {
    throw new RangeError(`Num is not finite: [${String(m)}, ${String(e)}]`);
  }
  if (m === 0) return ZERO;
  let mantissa = m;
  let exponent = e;
  while (Math.abs(mantissa) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  while (Math.abs(mantissa) < 1) {
    mantissa *= 10;
    exponent -= 1;
  }
  if (!Number.isSafeInteger(exponent)) {
    throw new RangeError(`Num exponent out of range: ${String(exponent)}`);
  }
  return Decimal.fromMantissaExponent_noNormalize(mantissa, exponent);
}

/** 10^k as the nearest double: string parsing is correctly rounded everywhere. */
function tenTo(k: number): number {
  return Number(`1e${String(k)}`);
}

/** 1e16 is exact in binary, so scaling a tiny input by it adds no rounding of its own. */
const TINY_SCALE = 1e16;

function settle(d: Decimal): Num {
  return canonical(d.mantissa, d.exponent);
}

function cmp(a: Num, b: Num): -1 | 0 | 1 {
  const c = a.cmp(b);
  return c < 0 ? -1 : c > 0 ? 1 : 0;
}

export const Num = Object.freeze({
  /** A finite number as a Num. NaN and the infinities are refused. */
  from(x: number): Num {
    if (!Number.isFinite(x))
      throw new RangeError(`Num.from(${String(x)}): not finite`);
    if (x === 0) return ZERO;
    const e = Math.floor(detLog10(Math.abs(x)));
    // 10^e is subnormal or zero below 1e-307, so tiny inputs are scaled up first.
    const m = e < -300 ? (x * TINY_SCALE) / tenTo(e + 16) : x / tenTo(e);
    return canonical(m, e);
  },

  /** The Num a stored tuple holds. A non-canonical tuple is refused. */
  fromTuple(t: NumTuple): Num {
    const [m, e] = t;
    if (!isCanonical(m, e)) {
      throw new RangeError(
        `Num.fromTuple: not canonical: [${String(m)}, ${String(e)}]`,
      );
    }
    return Decimal.fromMantissaExponent_noNormalize(m, e);
  },

  toTuple(n: Num): NumTuple {
    return [n.mantissa, n.exponent];
  },

  add(a: Num, b: Num): Num {
    return settle(a.add(b));
  },

  sub(a: Num, b: Num): Num {
    return settle(a.sub(b));
  },

  mul(a: Num, b: Num): Num {
    return settle(a.mul(b));
  },

  div(a: Num, b: Num): Num {
    if (b.mantissa === 0) throw new RangeError('Num.div: division by zero');
    return settle(a.div(b));
  },

  /**
   * base^exponent for a non-negative base: 10^(exponent x log10 base), split
   * into an integer exponent and a det-math mantissa. The error in log10 of
   * the base is multiplied by the exponent, so the relative error is at most
   * 6e-16 x (|exponent| + |log10 result| + 2) (derived, and tested).
   */
  pow(base: Num, exponent: number): Num {
    if (!Number.isFinite(exponent)) {
      throw new RangeError(
        `Num.pow: exponent ${String(exponent)} is not finite`,
      );
    }
    if (exponent === 0) return ONE;
    if (base.mantissa < 0) throw new RangeError('Num.pow: negative base');
    if (base.mantissa === 0) {
      if (exponent < 0)
        throw new RangeError('Num.pow: zero to a negative power');
      return ZERO;
    }
    const l = (base.exponent + detLog10(base.mantissa)) * exponent;
    const e = Math.floor(l);
    return canonical(detPow(10, l - e), e);
  },

  /** log10 of a positive Num, through det-math. */
  log10(n: Num): number {
    if (n.mantissa <= 0) throw new RangeError('Num.log10: not positive');
    return n.exponent + detLog10(n.mantissa);
  },

  cmp,

  /** The nearest number: Infinity above 1.8e308, 0 below 5e-324. */
  toNumber(n: Num): number {
    return n.toNumber();
  },
});
```

`packages/core/src/index.ts` (change):

```diff
diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts
index 501e2c8..7f7ea39 100644
--- a/packages/core/src/index.ts
+++ b/packages/core/src/index.ts
@@ -4,3 +4,4 @@
  * runs in browsers, Electron, Capacitor and Workers and replays identically.
  */
 export { exp, expm1, ln, log10, log1p, pow } from './det-math';
+export { Num, type NumTuple } from './num';
```

Record the measured normalisation caveat in the design:

`docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md` (change):

```diff
diff --git a/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md b/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
index ad7ba01..395f5b5 100644
--- a/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
+++ b/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
@@ -46,7 +46,7 @@ ECMAScript leaves `Math.pow`, `exp`, `log` and `**` implementation-approximated.
 | `ts-fsrs` `forgetting_curve`                     | 0 / 2,000,000             |
 | `ts-fsrs` scheduler (3,000 cards × 25)           | 0 / 75,000 states         |

-**Decision D-M1-1.** Every transcendental function in `core` goes through one module, `det-math.ts`, built on the `@stdlib/math-base-special-*` pure-JS ports (Apache-2.0, compatible with our licence; their licence text joins the third-party notices of every shipped build). An ESLint rule bans `Math.pow`, `Math.exp`, `Math.expm1`, `Math.log`, `Math.log1p`, `Math.log10`, `Math.log2`, `Math.cbrt`, `Math.hypot`, the trigonometric functions and the `**` operator in `packages/core/src`, and `Decimal.pow`, `Decimal.exp`, `Decimal.log*` and their instance forms. `Num` (break_infinity) is used only for its measured-safe arithmetic, and powers are built as `Decimal.fromMantissaExponent` from a `det-math` base-10 logarithm. `ts-fsrs` stays (the parent spec's choice): its 8-decimal rounding absorbs the engine differences.
+**Decision D-M1-1.** Every transcendental function in `core` goes through one module, `det-math.ts`, built on the `@stdlib/math-base-special-*` pure-JS ports (Apache-2.0, compatible with our licence; their licence text joins the third-party notices of every shipped build). An ESLint rule bans `Math.pow`, `Math.exp`, `Math.expm1`, `Math.log`, `Math.log1p`, `Math.log10`, `Math.log2`, `Math.cbrt`, `Math.hypot`, the trigonometric functions and the `**` operator in `packages/core/src`, and `Decimal.pow`, `Decimal.exp`, `Decimal.log*` and their instance forms. `Num` (break_infinity) is used only for its measured-safe arithmetic, and powers are built as `Decimal.fromMantissaExponent` from a `det-math` base-10 logarithm. Its normalisation is not used: break_infinity normalises with `Math.floor(Math.log10(|m|))`, and its `add` leaves the mantissa below 1 for the integer mantissas 999999999999999 and 999999999999998 on V8 and JavaScriptCore alike (measured 2026-10-01 in #26; the two engines agreed on all 2,527 boundary floors tried), so one value could be stored as two tuples. `Num` brings every result back to `1 ≤ |m| < 10` with comparisons alone, and `Num.from` takes its exponent from `det-math`. `ts-fsrs` stays (the parent spec's choice): its 8-decimal rounding absorbs the engine differences.

 ### 2.2 Integration: anchored state, integer clock, hourly rate buckets

```

- [ ] **Step 5: Run green**

Run: `npx vitest run packages/core/test/num.test.ts`
Expected: `Tests  26 passed (26)`.

- [ ] **Step 6: Gate and commit**, message `feat(core): Num with canonical tuples and det-math powers (Refs #26)`.

- [ ] **Step 7: Mutations, against the commit**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/num.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `\n` marks a line break and `(deleted)` means the line is removed.

| Id    | File     | Change                                                                                                                                              | Predicted (written first)                                                                       | Result                                                                                                                                                                                                                                                                                                                         |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M3.1  | `num.ts` | `  return canonical(d.mantissa, d.exponent);` → `  return d;`                                                                                       | 1 failed (renormalises the add()), 25 passed                                                    | stronger than predicted: also caught by the random `sub` property, whose counterexample `sub([9.999999999999975, 16], [1, 0])` makes break_infinity round to the integer mantissa 999999999999998, the measured case reached through `sub`. That catch depends on the generator, so the named test is the deterministic guard. |
| M3.2  | `num.ts` | `    return canonical(detPow(10, l - e), e);` → `    return settle(base.pow(exponent));`                                                            | 1 failed (pins the bits), 25 passed                                                             | as predicted                                                                                                                                                                                                                                                                                                                   |
| M3.2b | `num.ts` | `    return canonical(detPow(10, l - e), e);` → `    return settle(base.pow(exponent));`                                                            | `npx eslint packages/core/src/num.ts` fails, output names `no-restricted-syntax`                | as predicted                                                                                                                                                                                                                                                                                                                   |
| M3.3  | `num.ts` | `    if (x === 0) return ZERO;` → (deleted)                                                                                                         | 3 failed (maps both zeros; gives a canonical tuple within; handles zero and refuses), 23 passed | as predicted                                                                                                                                                                                                                                                                                                                   |
| M3.4  | `num.ts` | `return Object.is(m, 0) && e === 0;` → `return e === 0;`                                                                                            | 1 failed (refuses a negative zero), 25 passed                                                   | as predicted                                                                                                                                                                                                                                                                                                                   |
| M3.5  | `num.ts` | `const l = (base.exponent + detLog10(base.mantissa)) * exponent;` → `const l = (base.exponent + detLog10(base.mantissa) * (1 + 1e-12)) * exponent;` | 2 failed (within the derived bound; pins the bits), 24 passed                                   | as predicted                                                                                                                                                                                                                                                                                                                   |

---

### Task 4: The integer clocks

**Files:**

- Create: `packages/core/src/clock.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/clock.test.ts`

**Interfaces:**

- Produces: `type SimMs`, `type WallMs` (branded numbers), `HOUR_MS = 3_600_000`, `simMs(n: number): SimMs`, `wallMs(n: number): WallMs`, `bucketStart(t: SimMs): SimMs`, `bucketEnd(t: SimMs): SimMs`, `nextGridTick(t: SimMs, intervalMs: number): SimMs`, `gridTicksBetween(from: SimMs, to: SimMs, intervalMs: number): number` (ticks in `(from, to]`).

- [ ] **Step 1: Write the failing test**

`packages/core/test/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  bucketEnd,
  bucketStart,
  gridTicksBetween,
  HOUR_MS,
  nextGridTick,
  simMs,
  wallMs,
  type SimMs,
  type WallMs,
} from '../src/clock';

/**
 * The integer-millisecond clocks (M1 design §2.2 and §2.3, #26 AC5).
 *
 * Every time in core is a safe non-negative integer count of milliseconds, so
 * no split of an interval can round differently from the whole. The bucket
 * and grid helpers are checked against BigInt arithmetic, which is exact at
 * every magnitude.
 */

const safeTime = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });
const interval = fc.integer({ min: 1, max: 86_400_000 });

describe('the SimMs and WallMs brands', () => {
  it.each([0, 1, 3_600_000, Number.MAX_SAFE_INTEGER])('accept %s', (n) => {
    expect(simMs(n)).toBe(n);
    expect(wallMs(n)).toBe(n);
  });

  it.each([
    1.5,
    -1,
    NaN,
    Infinity,
    -Infinity,
    2 ** 53,
    Number.MAX_SAFE_INTEGER + 2,
  ])('refuse %s', (n) => {
    expect(() => simMs(n)).toThrow(RangeError);
    expect(() => wallMs(n)).toThrow(RangeError);
  });

  it('store -0 as 0, so state never holds a zero that JSON cannot round-trip', () => {
    expect(Object.is(simMs(-0), 0)).toBe(true);
    expect(Object.is(wallMs(-0), 0)).toBe(true);
  });

  it('cannot be mixed up or made from a bare number (typecheck)', () => {
    const sim: SimMs = simMs(5);
    const wall: WallMs = wallMs(5);
    // @ts-expect-error a bare number is not a SimMs
    const fromNumber: SimMs = 5;
    // @ts-expect-error a WallMs is not a SimMs
    const crossed: SimMs = wall;
    // @ts-expect-error a SimMs is not a WallMs
    const crossedBack: WallMs = sim;
    expect([fromNumber, crossed, crossedBack]).toEqual([5, 5, 5]);
  });
});

describe('hour buckets', () => {
  it('are one clock hour long', () => {
    expect(HOUR_MS).toBe(3_600_000);
  });

  it.each([
    [0, 0, 3_600_000],
    [1, 0, 3_600_000],
    [3_599_999, 0, 3_600_000],
    [3_600_000, 3_600_000, 7_200_000],
    [3_600_001, 3_600_000, 7_200_000],
  ])('place %s in [%s, %s)', (t, start, end) => {
    expect(bucketStart(simMs(t))).toBe(start);
    expect(bucketEnd(simMs(t))).toBe(end);
  });

  it('agree with exact BigInt arithmetic at every magnitude', () => {
    const H = BigInt(HOUR_MS);
    fc.assert(
      fc.property(safeTime, (t) => {
        const start = BigInt(t) - (BigInt(t) % H);
        expect(BigInt(bucketStart(simMs(t)))).toBe(start);
        if (start + H <= BigInt(Number.MAX_SAFE_INTEGER)) {
          expect(BigInt(bucketEnd(simMs(t)))).toBe(start + H);
        }
      }),
      { numRuns: 5000 },
    );
  });

  it('refuse a bucket end past the safe range', () => {
    expect(() => bucketEnd(simMs(Number.MAX_SAFE_INTEGER))).toThrow(RangeError);
  });
});

describe('the automation grid', () => {
  it.each([
    [0, 10_000, 10_000],
    [9_999, 10_000, 10_000],
    [10_000, 10_000, 20_000],
    [10_001, 1_000, 11_000],
  ])('the next tick after %s on a %s ms grid is %s', (t, step, next) => {
    expect(nextGridTick(simMs(t), step)).toBe(next);
  });

  it.each([
    [0, 10_000, 1],
    [0, 9_999, 0],
    [10_000, 10_000, 0],
    [9_999, 10_000, 1],
    [0, 3_600_000, 360],
  ])('counts ticks in (%s, %s] on a 10 s grid as %s', (from, to, n) => {
    expect(gridTicksBetween(simMs(from), simMs(to), 10_000)).toBe(n);
  });

  it('splits exactly: ticks(a, b) + ticks(b, c) = ticks(a, c)', () => {
    fc.assert(
      fc.property(
        fc.array(safeTime, { minLength: 3, maxLength: 3 }),
        interval,
        (ts, step) => {
          const [a, b, c] = [...ts].sort((x, y) => x - y).map(simMs) as [
            SimMs,
            SimMs,
            SimMs,
          ];
          expect(
            gridTicksBetween(a, b, step) + gridTicksBetween(b, c, step),
          ).toBe(gridTicksBetween(a, c, step));
          const exact = BigInt(c) / BigInt(step) - BigInt(a) / BigInt(step);
          expect(BigInt(gridTicksBetween(a, c, step))).toBe(exact);
        },
      ),
      { numRuns: 5000 },
    );
  });

  it.each([0, -1, 1.5, NaN])('refuses a %s ms interval', (step) => {
    expect(() => nextGridTick(simMs(0), step)).toThrow(RangeError);
    expect(() => gridTicksBetween(simMs(0), simMs(1), step)).toThrow(
      RangeError,
    );
  });

  it('refuses a backwards span', () => {
    expect(() => gridTicksBetween(simMs(2), simMs(1), 1_000)).toThrow(
      RangeError,
    );
  });
});
```

- [ ] **Step 2: Stub and see red**

`packages/core/src/clock.ts` (stub):

```ts
declare const simBrand: unique symbol;
declare const wallBrand: unique symbol;
export type SimMs = number & { readonly [simBrand]: true };
export type WallMs = number & { readonly [wallBrand]: true };
export const HOUR_MS = 0;

function notImplemented(name: string): never {
  throw new Error(`clock.${name}: not implemented`);
}

export const simMs = (_n: number): SimMs => notImplemented('simMs');
export const wallMs = (_n: number): WallMs => notImplemented('wallMs');
export const bucketStart = (_t: SimMs): SimMs => notImplemented('bucketStart');
export const bucketEnd = (_t: SimMs): SimMs => notImplemented('bucketEnd');
export const nextGridTick = (_t: SimMs, _intervalMs: number): SimMs => notImplemented('nextGridTick');
export const gridTicksBetween = (_from: SimMs, _to: SimMs, _intervalMs: number): number =>
  notImplemented('gridTicksBetween');
```

Run: `npx vitest run packages/core/test/clock.test.ts`
Expected: `Tests  36 failed (36)`.

- [ ] **Step 3: Implement**

`packages/core/src/clock.ts`:

```ts
/**
 * The integer-millisecond clocks (M1 design §2.2 and §2.3).
 *
 * `SimMs` drives the economy (production, journeys, automation, buckets) and
 * `WallMs` drives memory and the calendar. Both are safe non-negative integer
 * milliseconds, branded so that one cannot be passed where the other is meant
 * and a bare number cannot be passed for either. Integers make every split of
 * an interval add up exactly, which is what makes `integrate` associative.
 *
 * The helpers use `%` rather than dividing and flooring: `%` on doubles is
 * exact, so no rounding question arises at any magnitude.
 */

declare const simBrand: unique symbol;
declare const wallBrand: unique symbol;

/** Milliseconds on the simulated (economy) clock. */
export type SimMs = number & { readonly [simBrand]: true };

/** Milliseconds on the wall (memory and calendar) clock, Unix epoch based. */
export type WallMs = number & { readonly [wallBrand]: true };

/** One clock hour: the width of a production bucket. */
export const HOUR_MS = 3_600_000;

function checkTime(n: number, kind: string): number {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(
      `${kind} must be a safe non-negative integer, got ${String(n)}`,
    );
  }
  // -0 passes both checks; store +0 so state holds one zero.
  return n === 0 ? 0 : n;
}

export function simMs(n: number): SimMs {
  return checkTime(n, 'SimMs') as SimMs;
}

export function wallMs(n: number): WallMs {
  return checkTime(n, 'WallMs') as WallMs;
}

function checkInterval(intervalMs: number): void {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new RangeError(
      `a grid interval must be a positive safe integer, got ${String(intervalMs)}`,
    );
  }
}

/** The start of the hour bucket holding t. */
export function bucketStart(t: SimMs): SimMs {
  return simMs(t - (t % HOUR_MS));
}

/** The exclusive end of the hour bucket holding t. */
export function bucketEnd(t: SimMs): SimMs {
  return simMs(bucketStart(t) + HOUR_MS);
}

/** The first tick strictly after t on the grid k x intervalMs, k >= 1. */
export function nextGridTick(t: SimMs, intervalMs: number): SimMs {
  checkInterval(intervalMs);
  return simMs(t - (t % intervalMs) + intervalMs);
}

/**
 * How many ticks of the grid k x intervalMs fall in (from, to]. Half-open, so
 * ticks(a, b) + ticks(b, c) = ticks(a, c) and no tick is counted twice when
 * an interval is split.
 */
export function gridTicksBetween(
  from: SimMs,
  to: SimMs,
  intervalMs: number,
): number {
  checkInterval(intervalMs);
  if (to < from) {
    throw new RangeError(
      `gridTicksBetween: ${String(to)} is before ${String(from)}`,
    );
  }
  return (to - (to % intervalMs) - (from - (from % intervalMs))) / intervalMs;
}
```

`packages/core/src/index.ts` (change):

```diff
diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts
index 7f7ea39..9f1ee2f 100644
--- a/packages/core/src/index.ts
+++ b/packages/core/src/index.ts
@@ -5,3 +5,14 @@
  */
 export { exp, expm1, ln, log10, log1p, pow } from './det-math';
 export { Num, type NumTuple } from './num';
+export {
+  bucketEnd,
+  bucketStart,
+  gridTicksBetween,
+  HOUR_MS,
+  nextGridTick,
+  simMs,
+  wallMs,
+  type SimMs,
+  type WallMs,
+} from './clock';
```

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/core/test/clock.test.ts && npm run typecheck --workspace @wordfarer/core`
Expected: `Tests  36 passed (36)`, and the typecheck exits 0 (the three `@ts-expect-error` lines are each used).

- [ ] **Step 5: Gate and commit**, message `feat(core): integer SimMs and WallMs clocks with buckets and grid (Refs #26)`.

- [ ] **Step 6: Mutations, against the commit**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/clock.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `\n` marks a line break and `(deleted)` means the line is removed.

| Id   | File       | Change                                                                                                                                 | Predicted (written first)                                                                                                   | Result       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------ |
| M4.1 | `clock.ts` | ` \|\| n < 0` → (deleted)                                                                                                              | 1 failed (refuse -1), 35 passed                                                                                             | as predicted |
| M4.2 | `clock.ts` | `  return n === 0 ? 0 : n;` → `  return n;`                                                                                            | 1 failed (store -0 as 0), 35 passed                                                                                         | as predicted |
| M4.3 | `clock.ts` | `  return simMs(t - (t % intervalMs) + intervalMs);` → `  return simMs(t % intervalMs === 0 ? t : t - (t % intervalMs) + intervalMs);` | 2 failed (the next tick after 0 on; the next tick after 10000 on), 34 passed                                                | as predicted |
| M4.4 | `clock.ts` | `  return simMs(bucketStart(t) + HOUR_MS);` → `  return simMs(bucketStart(t) + HOUR_MS - 1);`                                          | 6 failed (place 0 in; place 1 in; place 3599999 in; place 3600000 in; place 3600001 in; agree with exact BigInt), 30 passed | as predicted |
| M4.5 | `clock.ts` | `export type SimMs = number & { readonly [simBrand]: true };` → `export type SimMs = number;`                                          | `npm run typecheck --workspace @wordfarer/core` fails, output names `TS2578`                                                | as predicted |
| M4.6 | `clock.ts` | `  if (to < from) {` → `  if (to < 0) {`                                                                                               | 1 failed (refuses a backwards span), 35 passed                                                                              | as predicted |

---

### Task 5: The seeded RNG

**Files:**

- Create: `packages/core/src/rng.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/rng.test.ts`

**Interfaces:**

- Produces: `interface RngState { readonly s: readonly [number, number, number, number] }`, `interface Draw { readonly value: number; readonly state: RngState }`, `nextU32(state): Draw`, `nextFloat(state): Draw`, `nextInt(state, n): Draw`, `seedRng(seed: number): RngState`, `type RngStreams = Readonly<Record<string, RngState>>`, `createStreams(seed: number, names: readonly string[]): RngStreams`, `drawFrom(streams, name): { value: number; streams: RngStreams }`.

The pinned vectors come from the authors' reference C (`xoshiro128starstar.c`, `splitmix64.c`), compiled and run on 2026-10-01; the `{1, 2, 3, 4}` vector also matches the Rust `rand_xoshiro` test vector.

- [ ] **Step 1: Write the failing test**

`packages/core/test/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createStreams,
  drawFrom,
  nextFloat,
  nextInt,
  nextU32,
  seedRng,
  type RngState,
} from '../src/rng';

/**
 * The seeded PRNG (M1 design §3, #26 AC6): xoshiro128** on four 32-bit words,
 * seeded through SplitMix64 as its authors recommend.
 *
 * The pinned vectors come from the authors' reference C (xoshiro128starstar.c
 * and splitmix64.c), compiled and run on 2026-10-01, never from this module:
 * a vector produced by the code under test could not disagree with it.
 */

function take(state: RngState, n: number): number[] {
  const out: number[] = [];
  let s = state;
  for (let i = 0; i < n; i++) {
    const r = nextU32(s);
    out.push(r.value);
    s = r.state;
  }
  return out;
}

describe('xoshiro128**', () => {
  it('matches the reference C from state {1, 2, 3, 4}', () => {
    expect(take({ s: [1, 2, 3, 4] }, 10)).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034,
      3734860849, 3729100597, 4258142804,
    ]);
  });

  it('seeds through SplitMix64: seed 42 gives the reference state and first 8 outputs', () => {
    const state = seedRng(42);
    expect(state).toEqual({
      s: [803958421, 3184996902, 2993090819, 686809907],
    });
    expect(take(state, 8)).toEqual([
      1776835114, 4165204688, 17111135, 2317295270, 2792088233, 2554630222,
      2940343271, 2244566231,
    ]);
  });

  it('never mutates the state it is given', () => {
    const state: RngState = Object.freeze({
      s: Object.freeze([1, 2, 3, 4] as const),
    });
    expect(() => take(state, 5)).not.toThrow();
    expect(state).toEqual({ s: [1, 2, 3, 4] });
  });

  it('round-trips through JSON and continues the same sequence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        fc.integer({ min: 0, max: 50 }),
        (seed, skip) => {
          let s = seedRng(seed);
          for (let i = 0; i < skip; i++) s = nextU32(s).state;
          const revived = JSON.parse(JSON.stringify(s)) as RngState;
          expect(take(revived, 8)).toEqual(take(s, 8));
        },
      ),
    );
  });

  it.each([-1, 1.5, NaN, 2 ** 53])('refuses seed %s', (seed) => {
    expect(() => seedRng(seed)).toThrow(RangeError);
  });

  it('refuses the all-zero state, which xoshiro can never leave', () => {
    expect(() => nextU32({ s: [0, 0, 0, 0] })).toThrow(RangeError);
  });
});

describe('derived draws', () => {
  it('nextFloat is u32 / 2^32, in [0, 1)', () => {
    const s = seedRng(42);
    expect(nextFloat(s).value).toBe(1776835114 / 4294967296);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e9 }), (seed) => {
        const v = nextFloat(seedRng(seed)).value;
        expect(v >= 0 && v < 1).toBe(true);
      }),
    );
  });

  it('nextInt(n) stays in [0, n) and rejects the biased tail', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e9 }),
        fc.integer({ min: 1, max: 2 ** 32 }),
        (seed, n) => {
          const v = nextInt(seedRng(seed), n).value;
          expect(Number.isInteger(v) && v >= 0 && v < n).toBe(true);
        },
      ),
    );
    // n = 3 * 2^30: the top quarter of u32 values is the biased tail. From
    // state {1, 2, 3, 4} the outputs are 11520, ... so the first is accepted.
    expect(nextInt({ s: [1, 2, 3, 4] }, 3 * 2 ** 30).value).toBe(11520);
    // 3734860849 >= 3 * 2^30 = 3221225472 is rejected and the next output,
    // 3729100597, is rejected too; 4258142804 likewise; the draw moves on.
    let s: RngState = { s: [1, 2, 3, 4] };
    for (let i = 0; i < 7; i++) s = nextU32(s).state;
    const r = nextInt(s, 3 * 2 ** 30);
    expect(r.value).toBeLessThan(3 * 2 ** 30);
    expect(r.state).not.toEqual(nextU32(s).state);
  });

  it.each([0, -1, 1.5, 2 ** 32 + 1])('nextInt refuses n = %s', (n) => {
    expect(() => nextInt(seedRng(1), n)).toThrow(RangeError);
  });
});

describe('named sub-streams', () => {
  const NAMES = ['recall', 'latency', 'opens'];

  it('are reproducible from the seed and distinct from each other', () => {
    const a = createStreams(7, NAMES);
    expect(createStreams(7, NAMES)).toEqual(a);
    const firsts = NAMES.map((n) => drawFrom(a, n).value);
    expect(new Set(firsts).size).toBe(NAMES.length);
    expect(createStreams(8, NAMES)).not.toEqual(a);
  });

  it('are independent: drawing from one never changes another', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...NAMES), { maxLength: 60 }),
        (order) => {
          let streams = createStreams(7, NAMES);
          const seen: Record<string, number[]> = {
            recall: [],
            latency: [],
            opens: [],
          };
          for (const name of order) {
            const r = drawFrom(streams, name);
            seen[name]?.push(r.value);
            streams = r.streams;
          }
          // Each stream's values equal drawing that stream alone, whatever the
          // interleaving with the others.
          for (const name of NAMES) {
            let alone = createStreams(7, NAMES);
            const solo: number[] = [];
            for (let i = 0; i < (seen[name]?.length ?? 0); i++) {
              const r = drawFrom(alone, name);
              solo.push(r.value);
              alone = r.streams;
            }
            expect(seen[name]).toEqual(solo);
          }
        },
      ),
    );
  });

  it('refuse an unknown name, a duplicate and a name outside [a-z0-9-]', () => {
    expect(() => drawFrom(createStreams(1, NAMES), 'missing')).toThrow(
      RangeError,
    );
    expect(() => createStreams(1, ['a', 'a'])).toThrow(RangeError);
    expect(() => createStreams(1, ['Recall'])).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Stub and see red**

`packages/core/src/rng.ts` (stub):

```ts
export interface RngState {
  readonly s: readonly [number, number, number, number];
}
export interface Draw {
  readonly value: number;
  readonly state: RngState;
}
export type RngStreams = Readonly<Record<string, RngState>>;

function notImplemented(name: string): never {
  throw new Error(`rng.${name}: not implemented`);
}

export const nextU32 = (_state: RngState): Draw => notImplemented('nextU32');
export const nextFloat = (_state: RngState): Draw => notImplemented('nextFloat');
export const nextInt = (_state: RngState, _n: number): Draw => notImplemented('nextInt');
export const seedRng = (_seed: number): RngState => notImplemented('seedRng');
export const createStreams = (_seed: number, _names: readonly string[]): RngStreams =>
  notImplemented('createStreams');
export const drawFrom = (_streams: RngStreams, _name: string): { value: number; streams: RngStreams } =>
  notImplemented('drawFrom');
```

Run: `npx vitest run packages/core/test/rng.test.ts`
Expected: `Tests  18 failed (18)`.

- [ ] **Step 3: Implement**

`packages/core/src/rng.ts`:

```ts
/**
 * Seeded randomness for core (M1 design §3): xoshiro128** on four 32-bit
 * words, seeded through SplitMix64 as its authors recommend.
 *
 * State is plain data ({ s: [a, b, c, d] }), so it serialises with the game
 * state and a replay continues the same sequence. Every function returns the
 * next state rather than mutating, and all arithmetic is 32-bit integer work
 * (Math.imul, shifts, >>> 0) or BigInt, which every engine computes alike.
 *
 * Named sub-streams give each purpose (recall draws, latencies, open times,
 * card order) its own state, so drawing for one never shifts another: the
 * pacing bots rely on this to compare personas that differ in one behaviour.
 */

export interface RngState {
  readonly s: readonly [number, number, number, number];
}

export interface Draw {
  readonly value: number;
  readonly state: RngState;
}

const TWO_POW_32 = 4294967296;
const MASK_64 = 0xffffffffffffffffn;

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** The next 32-bit output, from 0 to 2^32 - 1. */
export function nextU32(state: RngState): Draw {
  const [s0, s1, s2, s3] = state.s;
  if ((s0 | s1 | s2 | s3) === 0) {
    throw new RangeError('xoshiro128** cannot leave the all-zero state');
  }
  const value = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  const n2 = (s2 ^ s0) >>> 0;
  const n3 = (s3 ^ s1) >>> 0;
  const n1 = (s1 ^ n2) >>> 0;
  const n0 = (s0 ^ n3) >>> 0;
  return { value, state: { s: [n0, n1, (n2 ^ t) >>> 0, rotl(n3, 11)] } };
}

/** A float in [0, 1): the 32-bit output divided by 2^32, which is exact. */
export function nextFloat(state: RngState): Draw {
  const r = nextU32(state);
  return { value: r.value / TWO_POW_32, state: r.state };
}

/** A uniform integer in [0, n), 1 <= n <= 2^32, by rejecting the biased tail. */
export function nextInt(state: RngState, n: number): Draw {
  if (!Number.isInteger(n) || n < 1 || n > TWO_POW_32) {
    throw new RangeError(
      `nextInt: n must be an integer in [1, 2^32], got ${String(n)}`,
    );
  }
  const limit = TWO_POW_32 - (TWO_POW_32 % n);
  let r = nextU32(state);
  while (r.value >= limit) r = nextU32(r.state);
  return { value: r.value % n, state: r.state };
}

function splitmix64(x: bigint): { value: bigint; next: bigint } {
  const next = (x + 0x9e3779b97f4a7c15n) & MASK_64;
  let z = next;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
  return { value: z ^ (z >> 31n), next };
}

function stateFrom64(seed: bigint): RngState {
  const a = splitmix64(seed);
  const b = splitmix64(a.next);
  const lo = (v: bigint) => Number(v & 0xffffffffn);
  const hi = (v: bigint) => Number(v >> 32n);
  const state: RngState = {
    s: [lo(a.value), hi(a.value), lo(b.value), hi(b.value)],
  };
  // SplitMix64 never yields two zero outputs in a row; checked anyway.
  if (state.s.every((w) => w === 0))
    throw new RangeError('seed produced the all-zero state');
  return state;
}

function checkSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new RangeError(
      `a seed must be a safe non-negative integer, got ${String(seed)}`,
    );
  }
}

/** The state for a seed: two SplitMix64 outputs, low word then high word. */
export function seedRng(seed: number): RngState {
  checkSeed(seed);
  return stateFrom64(BigInt(seed));
}

/** Independent generators keyed by purpose. */
export type RngStreams = Readonly<Record<string, RngState>>;

const STREAM_NAME = /^[a-z][a-z0-9-]*$/;

/** FNV-1a, 64-bit, over the name's characters (names are ASCII by rule). */
function fnv1a64(text: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    h = ((h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & MASK_64;
  }
  return h;
}

/** One stream per name, each seeded from the seed mixed with the name's hash. */
export function createStreams(
  seed: number,
  names: readonly string[],
): RngStreams {
  checkSeed(seed);
  const streams: Record<string, RngState> = {};
  for (const name of names) {
    if (!STREAM_NAME.test(name)) {
      throw new RangeError(
        `stream name ${JSON.stringify(name)} must match ${String(STREAM_NAME)}`,
      );
    }
    if (name in streams) throw new RangeError(`duplicate stream name ${name}`);
    streams[name] = stateFrom64(BigInt(seed) ^ fnv1a64(name));
  }
  return streams;
}

/** The next 32-bit output of one stream; every other stream is untouched. */
export function drawFrom(
  streams: RngStreams,
  name: string,
): { value: number; streams: RngStreams } {
  const state = Object.hasOwn(streams, name) ? streams[name] : undefined;
  if (state === undefined) throw new RangeError(`no stream named ${name}`);
  const r = nextU32(state);
  return { value: r.value, streams: { ...streams, [name]: r.state } };
}
```

`packages/core/src/index.ts` (change):

```diff
diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts
index 9f1ee2f..41b4950 100644
--- a/packages/core/src/index.ts
+++ b/packages/core/src/index.ts
@@ -16,3 +16,14 @@ export {
   type SimMs,
   type WallMs,
 } from './clock';
+export {
+  createStreams,
+  drawFrom,
+  nextFloat,
+  nextInt,
+  nextU32,
+  seedRng,
+  type Draw,
+  type RngState,
+  type RngStreams,
+} from './rng';
```

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/core/test/rng.test.ts`
Expected: `Tests  18 passed (18)`.

- [ ] **Step 5: Gate and commit**, message `feat(core): xoshiro128** RNG with independent named streams (Refs #26)`.

- [ ] **Step 6: Mutations, against the commit**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/rng.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `\n` marks a line break and `(deleted)` means the line is removed.

| Id   | File     | Change                                                                                                                                                                  | Predicted (written first)                                                                                   | Result       |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------ |
| M5.1 | `rng.ts` | `rotl(Math.imul(s1, 5) >>> 0, 7)` → `rotl(Math.imul(s1, 5) >>> 0, 8)`                                                                                                   | 4 failed (matches the reference C; seeds through SplitMix64; nextFloat is u32; nextInt(n) stays), 14 passed | as predicted |
| M5.2 | `rng.ts` | `s: [lo(a.value), hi(a.value), lo(b.value), hi(b.value)],` → `s: [hi(a.value), lo(a.value), lo(b.value), hi(b.value)],`                                                 | 2 failed (seeds through SplitMix64; nextFloat is u32), 16 passed                                            | as predicted |
| M5.3 | `rng.ts` | `streams: { ...streams, [name]: r.state } };` → `streams: Object.fromEntries(Object.entries(streams).map(([k, s]) => [k, k === name ? r.state : nextU32(s).state])) };` | 1 failed (are independent), 17 passed                                                                       | as predicted |
| M5.4 | `rng.ts` | `  return h;\n}` → `  return 0n;\n}`                                                                                                                                    | 1 failed (are reproducible from the seed and distinct), 17 passed                                           | as predicted |
| M5.5 | `rng.ts` | `  while (r.value >= limit) r = nextU32(r.state);` → (deleted)                                                                                                          | 1 failed (nextInt(n) stays in [0, n)), 17 passed                                                            | as predicted |

---

### Task 6: `balance.ts`

**Files:**

- Create: `packages/core/src/balance.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/balance.test.ts`

**Interfaces:**

- Produces: `type Rank = 'heard' | 'recognised' | 'recalled' | 'fluent' | 'mastered'`, `interface Balance`, `BALANCE: Balance` (deep-frozen). Later M1 stories add their keys to `Balance` and `BALANCE` together.

- [ ] **Step 1: Write the failing test**

Every value is pinned as a literal against the spec section it comes from. A pin derived from `BALANCE` would move with it and guard nothing.

`packages/core/test/balance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BALANCE, type Balance } from '../src/balance';

/**
 * balance.ts: one frozen table of every tunable number (#26 AC7).
 *
 * The values are pinned as literals against the spec section each comes from.
 * A pin derived from BALANCE itself would move with it and guard nothing.
 */

function walk(
  value: unknown,
  path: string,
  visit: (path: string, value: unknown) => void,
): void {
  visit(path, value);
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value))
      walk(child, `${path}.${key}`, visit);
  }
}

describe('BALANCE', () => {
  it('is frozen all the way down', () => {
    const containers: string[] = [];
    walk(BALANCE, 'BALANCE', (path, value) => {
      if (typeof value === 'object' && value !== null) {
        containers.push(path);
        expect(Object.isFrozen(value), path).toBe(true);
      }
    });
    // Liveness: the walk reached the nested tables and arrays.
    expect(containers.length).toBeGreaterThanOrEqual(18);
    expect(() => {
      (BALANCE.encounters as { costGrowth: number }).costGrowth = 2;
    }).toThrow(TypeError);
    expect(() => {
      (BALANCE.journeys.durationsMs as number[]).push(1);
    }).toThrow(TypeError);
  });

  it('holds only finite, non-negative numbers', () => {
    const leaves: string[] = [];
    walk(BALANCE, 'BALANCE', (path, value) => {
      if (typeof value !== 'object' || value === null) {
        leaves.push(path);
        expect(typeof value, path).toBe('number');
        expect(Number.isFinite(value) && (value as number) >= 0, path).toBe(
          true,
        );
      }
    });
    expect(leaves.length).toBeGreaterThanOrEqual(40);
  });

  it.each<[string, (b: Balance) => unknown, unknown]>([
    ['parent §3.2: cost growth 1.15', (b) => b.encounters.costGrowth, 1.15],
    [
      'parent §3.2: milestones at 10, 25, 50, 100, then every 100',
      (b) => [b.encounters.milestones, b.encounters.milestoneEvery],
      [[10, 25, 50, 100], 100],
    ],
    [
      'parent §3.2: each milestone doubles output',
      (b) => b.encounters.milestoneMultiplier,
      2,
    ],
    [
      'parent §4.1: first Encounter at 10 Understanding',
      (b) => b.encounters.firstAtUnderstanding,
      10,
    ],
    [
      'parent §3.3: rank bonuses',
      (b) => b.words.rankBonus,
      {
        heard: 0.02,
        recognised: 0.05,
        recalled: 0.12,
        fluent: 0.25,
        mastered: 0.4,
      },
    ],
    [
      'parent §3.3: the floor is half the rank bonus',
      (b) => b.words.floorShare,
      0.5,
    ],
    [
      'parent §3.4: rank stability thresholds in days',
      (b) => b.memory.rankStabilityDays,
      { recognised: 2, recalled: 7, fluent: 14, mastered: 30 },
    ],
    ['parent §3.4: queue of 10', (b) => b.memory.queueSize, 10],
    [
      'parent §3.4: Insight 1 + 0.5 x rankIndex',
      (b) => [b.memory.insightBase, b.memory.insightPerRank],
      [1, 0.5],
    ],
    [
      'parent §4.1: tutorial word due after 4 minutes',
      (b) => b.memory.tutorialDueMs,
      240_000,
    ],
    [
      'parent §4.2: journeys of 30 min, 2 h, 4 h, 8 h, 24 h',
      (b) => b.journeys.durationsMs,
      [1_800_000, 7_200_000, 14_400_000, 28_800_000, 86_400_000],
    ],
    [
      'parent §4.2: 1 slot, upgradable to 3',
      (b) => [b.journeys.startingSlots, b.journeys.maxSlots],
      [1, 3],
    ],
    [
      'parent §3.1: +10% production per stamp',
      (b) => b.stamps.globalBonusPerStamp,
      0.1,
    ],
    [
      'design §5: cost -5% per level, capped at -40%',
      (b) => [b.stamps.costDiscountPerLevel, b.stamps.costDiscountCap],
      [0.05, 0.4],
    ],
    [
      'design §5: journeys -10% per level, capped at -30%',
      (b) => [b.stamps.journeyCutPerLevel, b.stamps.journeyCutCap],
      [0.1, 0.3],
    ],
    ['design §5: Listen gives 1', (b) => b.listen.understandingPerTap, 1],
    [
      'design §5: Phrasebook x2 for one tag',
      (b) => b.insightUpgrades.phrasebookMultiplier,
      2,
    ],
    [
      'design §5: offline cap 24 h, +24 h twice, to 72 h',
      (b) => b.offline,
      { capMs: 86_400_000, capStepMs: 86_400_000, maxCapMs: 259_200_000 },
    ],
    ['design §5: grammar g = 0.5', (b) => b.grammar.rootGain, 0.5],
    [
      'design §5: Pemandu 10 s, then 5 s, 2 s, 1 s',
      (b) => b.automation.intervalsMs,
      [10_000, 5_000, 2_000, 1_000],
    ],
    [
      'design §5: Mastery goal x 1.5 per replay',
      (b) => b.mastery.goalGrowthPerReplay,
      1.5,
    ],
    ['design §5: in-season bonus x 2', (b) => b.seasons.inSeasonMultiplier, 2],
  ])('%s', (_source, read, expected) => {
    expect(read(BALANCE)).toEqual(expected);
  });

  it('fails typecheck when a key is missing', () => {
    const withoutGrammar: Omit<Balance, 'grammar'> = BALANCE;
    // @ts-expect-error a Balance without `grammar` is not a Balance
    const incomplete: Balance = withoutGrammar;
    const fourRanks: Omit<Balance['words']['rankBonus'], 'mastered'> =
      BALANCE.words.rankBonus;
    // @ts-expect-error every rank needs a bonus
    const missingRank: Balance['words']['rankBonus'] = fourRanks;
    expect([incomplete, missingRank]).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Stub and see red**

`packages/core/src/balance.ts` (stub):

```ts
export type Rank = 'heard' | 'recognised' | 'recalled' | 'fluent' | 'mastered';

export interface Balance {
  readonly listen: { readonly understandingPerTap: number };
  readonly encounters: {
    readonly costGrowth: number;
    readonly milestones: readonly number[];
    readonly milestoneEvery: number;
    readonly milestoneMultiplier: number;
    readonly firstAtUnderstanding: number;
  };
  readonly words: { readonly rankBonus: Readonly<Record<Rank, number>>; readonly floorShare: number };
  readonly memory: {
    readonly rankStabilityDays: Readonly<Record<Exclude<Rank, 'heard'>, number>>;
    readonly queueSize: number;
    readonly insightBase: number;
    readonly insightPerRank: number;
    readonly tutorialDueMs: number;
  };
  readonly journeys: { readonly durationsMs: readonly number[]; readonly startingSlots: number; readonly maxSlots: number };
  readonly stamps: {
    readonly globalBonusPerStamp: number;
    readonly costDiscountPerLevel: number;
    readonly costDiscountCap: number;
    readonly journeyCutPerLevel: number;
    readonly journeyCutCap: number;
  };
  readonly insightUpgrades: { readonly phrasebookMultiplier: number };
  readonly offline: { readonly capMs: number; readonly capStepMs: number; readonly maxCapMs: number };
  readonly grammar: { readonly rootGain: number };
  readonly automation: { readonly intervalsMs: readonly number[] };
  readonly mastery: { readonly goalGrowthPerReplay: number };
  readonly seasons: { readonly inSeasonMultiplier: number };
}

// Every value zero and nothing frozen: each test fails on its own assertion.
export const BALANCE: Balance = {
  listen: { understandingPerTap: 0 },
  encounters: { costGrowth: 0, milestones: [], milestoneEvery: 0, milestoneMultiplier: 0, firstAtUnderstanding: 0 },
  words: { rankBonus: { heard: 0, recognised: 0, recalled: 0, fluent: 0, mastered: 0 }, floorShare: 0 },
  memory: {
    rankStabilityDays: { recognised: 0, recalled: 0, fluent: 0, mastered: 0 },
    queueSize: 0,
    insightBase: 0,
    insightPerRank: 0,
    tutorialDueMs: 0,
  },
  journeys: { durationsMs: [], startingSlots: 0, maxSlots: 0 },
  stamps: { globalBonusPerStamp: 0, costDiscountPerLevel: 0, costDiscountCap: 0, journeyCutPerLevel: 0, journeyCutCap: 0 },
  insightUpgrades: { phrasebookMultiplier: 0 },
  offline: { capMs: 0, capStepMs: 0, maxCapMs: 0 },
  grammar: { rootGain: 0 },
  automation: { intervalsMs: [] },
  mastery: { goalGrowthPerReplay: 0 },
  seasons: { inSeasonMultiplier: 0 },
};
```

Run: `npx vitest run packages/core/test/balance.test.ts`
Expected: `Tests  24 failed | 1 passed (25)`. The one pass is the type-level test, whose `@ts-expect-error` lines hold against the stub's identical types. Its red is mutation M6.3, under `npm run typecheck`.

- [ ] **Step 3: Implement**

`packages/core/src/balance.ts`:

```ts
/**
 * Every tunable number in the game, in one frozen table (parent spec §3, M1
 * design §5).
 *
 * These are starting values for the pacing bots (#35) to tune, and the
 * operator may veto any of them. The bots guard outcomes, not these
 * constants. Each later M1 story adds the keys its rules need (for example
 * the Set Sail goal curve in #31), and the `Balance` type makes a missing key
 * a typecheck error. Times are integer milliseconds.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Word ranks, Heard (new) to Mastered (parent §3.4). */
export type Rank = 'heard' | 'recognised' | 'recalled' | 'fluent' | 'mastered';

export interface Balance {
  readonly listen: {
    /** Understanding per Listen tap (design §5). */
    readonly understandingPerTap: number;
  };
  readonly encounters: {
    /** The n-th purchase costs c0 x costGrowth^n (parent §3.2). */
    readonly costGrowth: number;
    /** Owned counts that each double output (parent §3.2). */
    readonly milestones: readonly number[];
    /** After the last listed milestone, one more every this many owned. */
    readonly milestoneEvery: number;
    readonly milestoneMultiplier: number;
    /** Understanding at which the first Encounter appears (parent §4.1). */
    readonly firstAtUnderstanding: number;
  };
  readonly words: {
    /** b_w = rankBonus[rank] x (floorShare + (1 - floorShare) x R) (parent §3.3). */
    readonly rankBonus: Readonly<Record<Rank, number>>;
    readonly floorShare: number;
  };
  readonly memory: {
    /** FSRS stability, in days, at which each rank above Heard is reached (parent §3.4). */
    readonly rankStabilityDays: Readonly<
      Record<Exclude<Rank, 'heard'>, number>
    >;
    /** At most this many due items are shown (parent §3.4, DN23). */
    readonly queueSize: number;
    /** A correct due answer gives insightBase + insightPerRank x rankIndex. */
    readonly insightBase: number;
    readonly insightPerRank: number;
    /** The tutorial word falls due this long after pick-up (parent §4.1). */
    readonly tutorialDueMs: number;
  };
  readonly journeys: {
    /** Tutorial outing first, then the regular durations (parent §4.2). */
    readonly durationsMs: readonly number[];
    readonly startingSlots: number;
    readonly maxSlots: number;
  };
  readonly stamps: {
    /** Global production per stamp held (parent §3.1). */
    readonly globalBonusPerStamp: number;
    /** Stamp upgrades (design §5). */
    readonly costDiscountPerLevel: number;
    readonly costDiscountCap: number;
    readonly journeyCutPerLevel: number;
    readonly journeyCutCap: number;
  };
  readonly insightUpgrades: {
    /** "Phrasebook": production multiplier for one tag (design §5). */
    readonly phrasebookMultiplier: number;
  };
  readonly offline: {
    /** Offline time credited, raised by Insight upgrades (design §5, DN19). */
    readonly capMs: number;
    readonly capStepMs: number;
    readonly maxCapMs: number;
  };
  readonly grammar: {
    /** A node multiplies each word on its roots by (1 + rootGain) (design §5). */
    readonly rootGain: number;
  };
  readonly automation: {
    /** Pemandu intervals: the starting one, then each upgrade (design §5). */
    readonly intervalsMs: readonly number[];
  };
  readonly mastery: {
    /** A replayed destination's goal x goalGrowthPerReplay^replays (design §5). */
    readonly goalGrowthPerReplay: number;
  };
  readonly seasons: {
    /** A festival card's bonus while its window is live (design §5). */
    readonly inSeasonMultiplier: number;
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const BALANCE: Balance = deepFreeze({
  listen: { understandingPerTap: 1 },
  encounters: {
    costGrowth: 1.15,
    milestones: [10, 25, 50, 100],
    milestoneEvery: 100,
    milestoneMultiplier: 2,
    firstAtUnderstanding: 10,
  },
  words: {
    rankBonus: {
      heard: 0.02,
      recognised: 0.05,
      recalled: 0.12,
      fluent: 0.25,
      mastered: 0.4,
    },
    floorShare: 0.5,
  },
  memory: {
    rankStabilityDays: { recognised: 2, recalled: 7, fluent: 14, mastered: 30 },
    queueSize: 10,
    insightBase: 1,
    insightPerRank: 0.5,
    tutorialDueMs: 4 * MINUTE_MS,
  },
  journeys: {
    durationsMs: [
      30 * MINUTE_MS,
      2 * HOUR_MS,
      4 * HOUR_MS,
      8 * HOUR_MS,
      24 * HOUR_MS,
    ],
    startingSlots: 1,
    maxSlots: 3,
  },
  stamps: {
    globalBonusPerStamp: 0.1,
    costDiscountPerLevel: 0.05,
    costDiscountCap: 0.4,
    journeyCutPerLevel: 0.1,
    journeyCutCap: 0.3,
  },
  insightUpgrades: { phrasebookMultiplier: 2 },
  offline: {
    capMs: 24 * HOUR_MS,
    capStepMs: 24 * HOUR_MS,
    maxCapMs: 72 * HOUR_MS,
  },
  grammar: { rootGain: 0.5 },
  automation: { intervalsMs: [10_000, 5_000, 2_000, 1_000] },
  mastery: { goalGrowthPerReplay: 1.5 },
  seasons: { inSeasonMultiplier: 2 },
});
```

`packages/core/src/index.ts` (change):

```diff
diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts
index 41b4950..aec89b9 100644
--- a/packages/core/src/index.ts
+++ b/packages/core/src/index.ts
@@ -27,3 +27,4 @@ export {
   type RngState,
   type RngStreams,
 } from './rng';
+export { BALANCE, type Balance, type Rank } from './balance';
```

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/core/test/balance.test.ts && npm run typecheck --workspace @wordfarer/core`
Expected: `Tests  25 passed (25)`; typecheck exits 0.

- [ ] **Step 5: Gate and commit**, message `feat(core): balance.ts, one frozen table of tunables (Refs #26)`.

- [ ] **Step 6: Mutations, against the commit**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/balance.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `\n` marks a line break and `(deleted)` means the line is removed.

| Id   | File         | Change                                                                         | Predicted (written first)                                                    | Result       |
| ---- | ------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------ |
| M6.1 | `balance.ts` | `    for (const child of Object.values(value)) deepFreeze(child);` → (deleted) | 1 failed (is frozen all the way down), 24 passed                             | as predicted |
| M6.2 | `balance.ts` | `    costGrowth: 1.15,` → `    costGrowth: 1.16,`                              | 1 failed (cost growth 1.15), 24 passed                                       | as predicted |
| M6.3 | `balance.ts` | `  readonly grammar: {` → `  readonly grammar?: {`                             | `npm run typecheck --workspace @wordfarer/core` fails, output names `TS2578` | as predicted |

---

### Task 7: `CourseData` and the synthetic course

**Files:**

- Create: `packages/core/src/course.ts`, `packages/core/fixtures/synthetic-course.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/synthetic-course.test.ts`

**Interfaces:**

- Consumes: `createStreams`, `nextInt`, `RngStreams` (Task 5).
- Produces: `CourseData`, `Region`, `Destination`, `Encounter`, `LexiconItem`, `CultureCard`, `CardSet`, `GrammarNode`, `FestivalWindow`, `Cefr` (types), and from the fixture `syntheticCourse(seed: number): CourseData`, `TAGS`, `BOT_EPOCH_WALL_MS = 1_799_020_800_000` (2027-01-04 00:00 UTC).

Encounters, cards and grammar nodes belong to a region; each destination holds its lexicon in curriculum order. Tags are course-wide, so words from earlier regions keep paying on later Encounters (parent §3.3).

- [ ] **Step 1: Write the failing test**

`packages/core/test/synthetic-course.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CourseData, LexiconItem } from '../src/course';
import {
  BOT_EPOCH_WALL_MS,
  syntheticCourse,
} from '../fixtures/synthetic-course';

/**
 * The synthetic course (#26 AC8, AC9): sized like v1 and reproducible from a
 * seed. Counts are taken by content, so an empty id or an unused tag cannot
 * pass as an entry.
 */

// Built on first use inside a test, so a generator that throws fails each
// test on its own rather than the whole file at collection.
let cached: CourseData | undefined;
const course = (): CourseData => (cached ??= syntheticCourse(1));

const nonEmpty = (ids: readonly string[]) =>
  ids.filter((id) => id.trim() !== '');

function allItems(c: CourseData): LexiconItem[] {
  return c.regions.flatMap((r) => [
    ...r.destinations.flatMap((d) => d.lexicon),
    ...r.grammarNodes.flatMap((g) => g.derived),
  ]);
}

describe('syntheticCourse', () => {
  it('gives a deep-equal course for the same seed, and plain JSON data', () => {
    expect(syntheticCourse(1)).toEqual(course());
    expect(JSON.parse(JSON.stringify(course()))).toEqual(course());
  });

  it('varies with the seed beyond its id', () => {
    expect(syntheticCourse(2).regions).not.toEqual(course().regions);
  });

  it('has 3 regions of 4 destinations, 150 lexicon items, 6 Encounters, 12 cards in sets and 4 grammar nodes', () => {
    expect(nonEmpty(course().regions.map((r) => r.id))).toHaveLength(3);
    for (const r of course().regions) {
      expect(nonEmpty(r.destinations.map((d) => d.id)), r.id).toHaveLength(4);
      expect(
        nonEmpty(r.destinations.flatMap((d) => d.lexicon.map((w) => w.id))),
        r.id,
      ).toHaveLength(150);
      expect(nonEmpty(r.encounters.map((e) => e.id)), r.id).toHaveLength(6);
      expect(nonEmpty(r.cultureCards.map((c) => c.id)), r.id).toHaveLength(12);
      expect(nonEmpty(r.grammarNodes.map((g) => g.id)), r.id).toHaveLength(4);
      const sets = new Set(r.cardSets.map((s) => s.id));
      expect(nonEmpty([...sets]).length, r.id).toBeGreaterThanOrEqual(2);
      for (const card of r.cultureCards)
        expect(sets.has(card.setId), card.id).toBe(true);
      for (const set of sets) {
        expect(
          r.cultureCards.filter((c) => c.setId === set).length,
          set,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('uses 10 tags, each on at least one Encounter and one item, and no other tag', () => {
    expect(nonEmpty(course().tags)).toHaveLength(10);
    expect(new Set(course().tags).size).toBe(10);
    const onEncounters = new Set(
      course().regions.flatMap((r) => r.encounters.flatMap((e) => e.tags)),
    );
    const onItems = new Set(allItems(course()).flatMap((w) => w.tags));
    const onCards = new Set(
      course().regions.flatMap((r) => r.cultureCards.flatMap((c) => c.tags)),
    );
    for (const t of course().tags) {
      expect(onEncounters.has(t), `${t} on an Encounter`).toBe(true);
      expect(onItems.has(t), `${t} on an item`).toBe(true);
    }
    for (const t of [...onEncounters, ...onItems, ...onCards]) {
      expect(course().tags, t).toContain(t);
    }
  });

  it('gives every lexicon item, Encounter and card a unique id', () => {
    const ids = [
      ...allItems(course()).map((w) => w.id),
      ...course().regions.flatMap((r) => r.encounters.map((e) => e.id)),
      ...course().regions.flatMap((r) => r.cultureCards.map((c) => c.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(3 * (150 + 12 + 6 + 12));
  });

  it('orders each destination A1 first, and gives every grammar root words to multiply', () => {
    const rank = { A1: 0, A2: 1, B1: 2 } as const;
    for (const r of course().regions) {
      for (const d of r.destinations) {
        const levels = d.lexicon.map((w) => rank[w.cefr]);
        expect(levels, d.id).toEqual([...levels].sort((a, b) => a - b));
        expect(levels[0], d.id).toBe(0);
      }
      const rootsInLexicon = new Set(
        r.destinations.flatMap((d) =>
          d.lexicon.flatMap((w) => (w.root === undefined ? [] : [w.root])),
        ),
      );
      for (const node of r.grammarNodes) {
        expect(node.roots.length, node.id).toBeGreaterThan(0);
        expect(
          nonEmpty(node.derived.map((w) => w.id)).length,
          node.id,
        ).toBeGreaterThan(0);
        for (const root of node.roots)
          expect(rootsInLexicon.has(root), `${node.id} ${root}`).toBe(true);
      }
    }
  });

  it('prices Encounters positively and ascending within a region', () => {
    for (const r of course().regions) {
      const c0 = r.encounters.map((e) => e.c0);
      expect(
        c0.every((c) => c > 0) && r.encounters.every((e) => e.p0 > 0),
        r.id,
      ).toBe(true);
      expect(c0, r.id).toEqual([...c0].sort((a, b) => a - b));
    }
  });

  it('places festival windows on the bot calendar, as integer half-open wall-clock spans', () => {
    const windows = course().regions.flatMap((r) =>
      r.cultureCards.flatMap((c) => c.festival?.windows ?? []),
    );
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(
        Number.isSafeInteger(w.startWallMs) &&
          Number.isSafeInteger(w.endWallMs),
      ).toBe(true);
      expect(w.startWallMs).toBeGreaterThanOrEqual(BOT_EPOCH_WALL_MS);
      expect(w.endWallMs).toBeGreaterThan(w.startWallMs);
    }
  });
});
```

- [ ] **Step 2: Write the types, stub the generator, see red**

`packages/core/src/course.ts`:

```ts
/**
 * CourseData: the typed shape a course must produce for core (M1 design §3).
 *
 * A course is data, not code (parent §5.1): core never branches on a language.
 * This type holds only what moves a number; text, translations, audio and the
 * review block stay in the content pack, and M2's Zod schema targets this
 * shape. It is plain, readonly data, so it serialises and deep-compares.
 *
 * Shape: a course has regions (parent §4.4); a region has destinations, each
 * with its lexicon in curriculum order, plus the region's Encounters, culture
 * cards and their sets, and grammar nodes. Tags are shared across the whole
 * course, so words from an earlier region keep paying on later Encounters
 * (parent §3.3).
 */

export type Cefr = 'A1' | 'A2' | 'B1';

/** A word or phrase the player can pick up (parent §5.2, the fields core needs). */
export interface LexiconItem {
  readonly id: string;
  readonly tags: readonly string[];
  readonly cefr: Cefr;
  /** The grammar root this item derives from, when a grammar node can attach to it. */
  readonly root?: string;
}

/** A generator (parent §3.2): the n-th purchase costs c0 x growth^n, output scales with p0. */
export interface Encounter {
  readonly id: string;
  readonly tags: readonly string[];
  /** Understanding cost of the first purchase. */
  readonly c0: number;
  /** Understanding per second from one owned, before multipliers. */
  readonly p0: number;
}

/** A wall-clock window [startWallMs, endWallMs) in which a festival is live. */
export interface FestivalWindow {
  readonly startWallMs: number;
  readonly endWallMs: number;
}

/** A culture card a Journey returns (parent §4.2). */
export interface CultureCard {
  readonly id: string;
  readonly setId: string;
  readonly tags: readonly string[];
  /** Permanent production bonus on the card's tags while held. */
  readonly bonus: number;
  /** A real-calendar festival: the card's bonus is raised while a window is live. */
  readonly festival?: { readonly windows: readonly FestivalWindow[] };
}

/** A set of cards; holding every card in it grants the set bonus. */
export interface CardSet {
  readonly id: string;
  readonly bonus: number;
}

/** A grammar node (parent §4.3): multiplies words on its roots and teaches derived words. */
export interface GrammarNode {
  readonly id: string;
  readonly roots: readonly string[];
  /** Words the node adds to the pick-up pool. */
  readonly derived: readonly LexiconItem[];
}

export interface Destination {
  readonly id: string;
  /** Picked up in this order, CEFR A1 first (parent §3.3). */
  readonly lexicon: readonly LexiconItem[];
}

export interface Region {
  readonly id: string;
  readonly destinations: readonly Destination[];
  readonly encounters: readonly Encounter[];
  readonly cardSets: readonly CardSet[];
  readonly cultureCards: readonly CultureCard[];
  readonly grammarNodes: readonly GrammarNode[];
}

export interface CourseData {
  readonly id: string;
  /** Every tag used anywhere in the course. */
  readonly tags: readonly string[];
  readonly regions: readonly Region[];
}
```

`packages/core/fixtures/synthetic-course.ts` (stub):

```ts
import type { CourseData } from '../src/course';

export const TAGS = [] as const;
export const BOT_EPOCH_WALL_MS = 0;

export function syntheticCourse(seed: number): CourseData {
  throw new Error(`syntheticCourse(${String(seed)}): not implemented`);
}
```

Run: `npx vitest run packages/core/test/synthetic-course.test.ts`
Expected: `Tests  8 failed (8)`, each with `syntheticCourse(1): not implemented` (the course is built inside each test, so the file still collects).

- [ ] **Step 3: Implement**

`packages/core/fixtures/synthetic-course.ts`:

```ts
import type {
  Cefr,
  CourseData,
  CultureCard,
  Destination,
  Encounter,
  GrammarNode,
  LexiconItem,
  Region,
} from '../src/course';
import { createStreams, nextInt, type RngStreams } from '../src/rng';

/**
 * A generated course sized like v1 (parent §5.6, M1 design §6): the content
 * the pacing bots play until M2's real courses exist.
 *
 * Per region: 4 destinations holding 150 lexicon items, 6 Encounters, 3 sets
 * of 4 culture cards, and 4 grammar nodes with 2 roots and 3 derived words
 * each. 10 tags are shared across the course. Coverage is built in, not
 * hoped for: item i's first tag cycles through every tag, the Encounters of
 * each region cover every tag, and every root has items. The seed varies the
 * rest (second tags, card tags, derived words' tags).
 *
 * The Encounter cost and output ladder is a placeholder for the bots to tune
 * in #35. Festival windows hang off the bots' wall-clock start, 2027-01-04
 * 00:00 UTC (M1 design §2.3), so they fall on the same simulated days in
 * every run.
 */

export const TAGS = [
  'food',
  'transport',
  'greetings',
  'market',
  'family',
  'numbers',
  'ceremony',
  'weather',
  'work',
  'travel',
] as const;

/** 2027-01-04 00:00 UTC, the pacing bots' wall-clock start. */
export const BOT_EPOCH_WALL_MS = 1_799_020_800_000;

const DAY_MS = 86_400_000;
const REGIONS = 3;
const DESTINATION_SIZES = [38, 38, 37, 37] as const;
const ROOTS_PER_REGION = 8;
const SETS = 3;
const CARDS_PER_SET = 4;
const GRAMMAR_NODES = 4;
const DERIVED_PER_NODE = 3;

/** Placeholder ladder: each Encounter costs 12x and yields 8x the one before. */
const C0 = [10, 120, 1_440, 17_280, 207_360, 2_488_320] as const;
const P0 = [0.5, 4, 32, 256, 2_048, 16_384] as const;
/** Each region's Encounters are 1000x the previous region's. */
const REGION_SCALE = [1, 1_000, 1_000_000] as const;

const STREAMS = ['second-tags', 'card-tags', 'derived-tags'];

function tag(index: number): string {
  const t = TAGS[index % TAGS.length];
  if (t === undefined) throw new RangeError(`no tag ${String(index)}`);
  return t;
}

/** Draws a uniform integer in [0, n) from one named stream. */
function drawer(seed: number): (stream: string, n: number) => number {
  let streams: RngStreams = createStreams(seed, STREAMS);
  return (stream, n) => {
    const state = streams[stream];
    if (state === undefined) throw new RangeError(`no stream ${stream}`);
    const r = nextInt(state, n);
    streams = { ...streams, [stream]: r.state };
    return r.value;
  };
}

function cefrAt(position: number, size: number): Cefr {
  if (position * 3 < size) return 'A1';
  if (position * 3 < size * 2) return 'A2';
  return 'B1';
}

function region(
  r: number,
  draw: (stream: string, n: number) => number,
): Region {
  const roots = Array.from(
    { length: ROOTS_PER_REGION },
    (_, k) => `r${String(r)}-root-${String(k)}`,
  );

  let i = 0;
  const destinations: Destination[] = DESTINATION_SIZES.map((size, d) => {
    const lexicon: LexiconItem[] = [];
    for (let p = 0; p < size; p++, i++) {
      const first = tag(i + r);
      const second =
        draw('second-tags', 2) === 0
          ? undefined
          : tag(i + r + 1 + draw('second-tags', TAGS.length - 1));
      const root = i % 5 === 0 ? roots[(i / 5) % ROOTS_PER_REGION] : undefined;
      lexicon.push({
        id: `r${String(r)}-d${String(d)}-w${String(p)}`,
        tags: second === undefined ? [first] : [first, second],
        cefr: cefrAt(p, size),
        ...(root === undefined ? {} : { root }),
      });
    }
    return { id: `r${String(r)}-d${String(d)}`, lexicon };
  });

  const scale = REGION_SCALE[r] ?? 1;
  const encounters: Encounter[] = C0.map((c0, k) => ({
    id: `r${String(r)}-e${String(k)}`,
    tags: [tag(2 * k + r), tag(2 * k + 1 + r)],
    c0: c0 * scale,
    p0: (P0[k] ?? 0) * scale,
  }));

  const cardSets = Array.from({ length: SETS }, (_, s) => ({
    id: `r${String(r)}-set-${String(s)}`,
    bonus: 0.25,
  }));
  const cultureCards: CultureCard[] = [];
  for (let s = 0; s < SETS; s++) {
    for (let c = 0; c < CARDS_PER_SET; c++) {
      const card: CultureCard = {
        id: `r${String(r)}-card-${String(s)}-${String(c)}`,
        setId: `r${String(r)}-set-${String(s)}`,
        tags: [tag(draw('card-tags', TAGS.length))],
        bonus: 0.05,
      };
      if (s === 0 && c === 0) {
        // One festival card per region, live for a week this year and next.
        const start = BOT_EPOCH_WALL_MS + (14 + 28 * r) * DAY_MS;
        cultureCards.push({
          ...card,
          festival: {
            windows: [
              { startWallMs: start, endWallMs: start + 7 * DAY_MS },
              {
                startWallMs: start + 364 * DAY_MS,
                endWallMs: start + 371 * DAY_MS,
              },
            ],
          },
        });
      } else {
        cultureCards.push(card);
      }
    }
  }

  const grammarNodes: GrammarNode[] = Array.from(
    { length: GRAMMAR_NODES },
    (_, g) => {
      const nodeRoots = [roots[2 * g], roots[2 * g + 1]].filter(
        (x): x is string => x !== undefined,
      );
      return {
        id: `r${String(r)}-gram-${String(g)}`,
        roots: nodeRoots,
        derived: Array.from(
          { length: DERIVED_PER_NODE },
          (_, j): LexiconItem => {
            const root = nodeRoots[j % nodeRoots.length];
            return {
              id: `r${String(r)}-gram-${String(g)}-w${String(j)}`,
              tags: [tag(draw('derived-tags', TAGS.length))],
              cefr: 'A2',
              ...(root === undefined ? {} : { root }),
            };
          },
        ),
      };
    },
  );

  return {
    id: `r${String(r)}`,
    destinations,
    encounters,
    cardSets,
    cultureCards,
    grammarNodes,
  };
}

/** The synthetic course for a seed. The same seed always gives a deep-equal course. */
export function syntheticCourse(seed: number): CourseData {
  const draw = drawer(seed);
  return {
    id: `synthetic-${String(seed)}`,
    tags: [...TAGS],
    regions: Array.from({ length: REGIONS }, (_, r) => region(r, draw)),
  };
}
```

`packages/core/src/index.ts` (change):

```diff
diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts
index aec89b9..686fbe8 100644
--- a/packages/core/src/index.ts
+++ b/packages/core/src/index.ts
@@ -28,3 +28,15 @@ export {
   type RngStreams,
 } from './rng';
 export { BALANCE, type Balance, type Rank } from './balance';
+export type {
+  CardSet,
+  Cefr,
+  CourseData,
+  CultureCard,
+  Destination,
+  Encounter,
+  FestivalWindow,
+  GrammarNode,
+  LexiconItem,
+  Region,
+} from './course';
```

- [ ] **Step 4: Run green**

Run: `npx vitest run packages/core/test/synthetic-course.test.ts`
Expected: `Tests  8 passed (8)`.

- [ ] **Step 5: Gate and commit**, message `feat(core): CourseData and the seeded synthetic course (Refs #26)`.

- [ ] **Step 6: Mutations, against the commit**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/synthetic-course.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `\n` marks a line break and `(deleted)` means the line is removed.

| Id   | File                  | Change                                                                            | Predicted (written first)                                                      | Result       |
| ---- | --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| M7.1 | `synthetic-course.ts` | `tags: [tag(2 * k + r), tag(2 * k + 1 + r)],` → `tags: [tag(0), tag(1)],`         | 1 failed (uses 10 tags), 7 passed                                              | as predicted |
| M7.2 | `synthetic-course.ts` | `[38, 38, 37, 37]` → `[38, 38, 37, 36]`                                           | 2 failed (has 3 regions of 4 destinations; gives every lexicon item), 6 passed | as predicted |
| M7.3 | `synthetic-course.ts` | `const root = i % 5 === 0 ?` → `const root = i % 5 === 7 ?`                       | 1 failed (gives every grammar root words), 7 passed                            | as predicted |
| M7.4 | `synthetic-course.ts` | `createStreams(seed, STREAMS)` → `createStreams(0, STREAMS)`                      | 1 failed (varies with the seed), 7 passed                                      | as predicted |
| M7.5 | `synthetic-course.ts` | `if (position * 3 < size) return 'A1';` → `if (position * 3 < size) return 'B1';` | 1 failed (orders each destination A1 first), 7 passed                          | as predicted |

---

### Task 8: The cross-engine harness

**Files:**

- Create: `packages/core/test/golden-vectors.ts`, `packages/core/test/golden-vectors.test.ts`, `tests/engines/det-math.spec.ts`, `playwright.engines.config.ts`, `tests/unit/cross-engine-harness.test.ts`
- Modify: `package.json` (`@playwright/test`, `test:engines`), `tsconfig.json`, `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: `det-math` (Task 1), `seedRng`, `nextU32` (Task 5).
- Produces: `digests(): Record<GoldenFunction, string>`, `digest(fn)`, `FUNCTIONS`, `VECTORS_PER_FUNCTION = 100_000` from `packages/core/test/golden-vectors.ts`; `npm run test:engines`.

- [ ] **Step 1: Install Playwright and its browsers**

```bash
scripts/fail-on-warnings.sh npm install --save-dev @playwright/test@^1.63.0
npx playwright install chromium firefox webkit
```

- [ ] **Step 2: Write the failing tests**

`packages/core/test/golden-vectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { digests, FUNCTIONS, VECTORS_PER_FUNCTION } from './golden-vectors';

/**
 * The golden vectors' Node digests (#26 AC10), measured 2026-10-01.
 *
 * tests/engines proves each browser engine gives Node's bits; this pin proves
 * Node's bits have not moved. A det-math change that alters any result, such
 * as swapping in Math.pow, moves a digest, so it is seen here first, on
 * every engine, before the cross-engine comparison runs.
 */

describe('det-math golden vectors', () => {
  it('cover at least 100,000 inputs for each of the six functions', () => {
    expect(VECTORS_PER_FUNCTION).toBe(100_000);
    expect([...FUNCTIONS].sort()).toEqual([
      'exp',
      'expm1',
      'ln',
      'log10',
      'log1p',
      'pow',
    ]);
  });

  it('hash to the pinned digests under Node', () => {
    expect(digests()).toEqual({
      pow: '3d7063d7ea64de4e',
      exp: '282e82fba82afd4e',
      ln: 'c42cd90d8c5957cf',
      log10: '7975fd2b8f7c506e',
      expm1: '2c1250daae88b5ac',
      log1p: '2b1b9cb3cddb4cb2',
    });
  });
});
```

`tests/engines/det-math.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import {
  digests,
  FUNCTIONS,
  type GoldenFunction,
} from '../../packages/core/test/golden-vectors';

/**
 * Cross-engine determinism of det-math (M1 design §2.1 and §7, #26 AC10).
 *
 * The golden vectors are bundled exactly as a shipped build would bundle
 * core, run in each browser engine, and their bit digests compared with the
 * ones Node computes. Measured on 2026-10-01: Math.pow(1.15, n) differs
 * between V8 and JavaScriptCore in 49% of results, so swapping det-math for
 * Math turns the WebKit comparison red.
 */

interface GoldenGlobal {
  wordfarerGolden: { digests(): Record<GoldenFunction, string> };
}

let bundle = '';

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: "export { digests } from './golden-vectors';",
      resolveDir: 'packages/core/test',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'wordfarerGolden',
    platform: 'browser',
    mainFields: ['module', 'main'],
    logLevel: 'error',
  });
  bundle = result.outputFiles[0]?.text ?? '';
  // Liveness: esbuild produced the global the page will call.
  expect(bundle).toContain('wordfarerGolden');
});

test('det-math gives the same bits as Node on 100,000 inputs per function', async ({
  page,
  browserName,
}) => {
  const node = digests();
  await page.setContent(
    '<!doctype html><title>det-math golden vectors</title>',
  );
  await page.addScriptTag({ content: bundle });
  const engine = await page.evaluate(() =>
    (globalThis as unknown as GoldenGlobal).wordfarerGolden.digests(),
  );
  for (const fn of FUNCTIONS) {
    expect.soft(engine[fn], `${browserName}: ${fn}`).toBe(node[fn]);
  }
});
```

`tests/unit/cross-engine-harness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import config from '../../playwright.engines.config';

/**
 * The cross-engine check stays wired (#26 AC10). A Playwright project dropped
 * from the config, or a CI step removed, would let the check pass by not
 * running; this suite fails instead. The workflow is read as parsed YAML, so
 * a comment naming a command cannot stand in for the step.
 */

interface Step {
  name?: string;
  run?: string;
}

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
  jobs: Record<string, { steps: Step[] }>;
};

describe('the cross-engine harness', () => {
  it('runs on Chromium, Firefox and WebKit', () => {
    const engines = (config.projects ?? []).map(
      (p) => p.use?.defaultBrowserType,
    );
    expect([...engines].sort()).toEqual(['chromium', 'firefox', 'webkit']);
  });

  it('runs in CI, after installing all three browsers', () => {
    const steps = ci.jobs['build-and-test']?.steps ?? [];
    const install = steps.findIndex((s) =>
      /playwright install --with-deps chromium firefox webkit/.test(
        s.run ?? '',
      ),
    );
    const run = steps.findIndex(
      (s) => (s.run ?? '').trim() === 'npm run test:engines',
    );
    expect(install, 'browser install step').toBeGreaterThanOrEqual(0);
    expect(run, 'test:engines step').toBeGreaterThan(install);
  });

  it('is what npm run test:engines runs', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:engines']).toBe(
      'playwright test -c playwright.engines.config.ts',
    );
  });
});
```

The pinned digests were measured by running the implemented `golden-vectors.ts` under Node. An executor reproduces them, never types them: after Step 4, `npx vitest run packages/core/test/golden-vectors.test.ts` must pass unchanged.

- [ ] **Step 3: Stub and see red**

`packages/core/test/golden-vectors.ts` (stub):

```ts
export const VECTORS_PER_FUNCTION = 0;
export const FUNCTIONS = [] as const;
export type GoldenFunction = 'pow' | 'exp' | 'ln' | 'log10' | 'expm1' | 'log1p';

export function digest(fn: GoldenFunction): string {
  throw new Error(`golden digest(${fn}): not implemented`);
}

export function digests(): Record<GoldenFunction, string> {
  throw new Error('golden digests: not implemented');
}
```

`playwright.engines.config.ts` (stub):

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({ testDir: 'tests/engines', projects: [] });
```

The other stubs are the Task 7 `package.json` and `.github/workflows/ci.yml`, unchanged.

Run: `npx vitest run packages/core/test/golden-vectors.test.ts tests/unit/cross-engine-harness.test.ts`
Expected: `Tests  5 failed (5)`.

Then restore the real `playwright.engines.config.ts` (Step 4) with the golden-vectors stub still in place, and see the spec itself red:

Run: `npm run test:engines`
Expected: `3 failed`, one per engine (`[chromium]`, `[firefox]`, `[webkit]`), each with `golden digests: not implemented`. The bundle's liveness check (`wordfarerGolden` is present) passes, so the failure is the comparison's own.

- [ ] **Step 4: Implement**

`packages/core/test/golden-vectors.ts`:

```ts
import { exp, expm1, ln, log10, log1p, pow } from '../src/det-math';
import { nextU32, seedRng, type RngState } from '../src/rng';

/**
 * det-math golden vectors (#26 AC10): 100,000 inputs per function, generated
 * from a fixed seed, hashed over the exact bits of every result.
 *
 * The same module runs under Node (a unit test pins its digests) and, bundled,
 * in Chromium, WebKit and Firefox (tests/engines). Equal digests mean equal
 * bits on every engine. The inputs and the hash use only integer operations,
 * division by 2^32 and little-endian DataView access, which every engine
 * computes alike, so any difference is det-math's.
 */

export const VECTORS_PER_FUNCTION = 100_000;

export const FUNCTIONS = [
  'pow',
  'exp',
  'ln',
  'log10',
  'expm1',
  'log1p',
] as const;
export type GoldenFunction = (typeof FUNCTIONS)[number];

const TWO_POW_32 = 4294967296;

class Inputs {
  private state: RngState;
  private readonly view = new DataView(new ArrayBuffer(8));

  constructor(seed: number) {
    this.state = seedRng(seed);
  }

  u32(): number {
    const r = nextU32(this.state);
    this.state = r.state;
    return r.value;
  }

  /** A uniform float in [0, 1). */
  unit(): number {
    return this.u32() / TWO_POW_32;
  }

  /**
   * A non-negative finite double with a uniformly random exponent field
   * (0 to 2046: subnormals through the largest finite), so every magnitude
   * is drawn.
   */
  anyPositive(): number {
    const exponentField = this.u32() % 2047;
    const hi = ((exponentField << 20) | (this.u32() & 0xfffff)) >>> 0;
    this.view.setUint32(0, this.u32(), true);
    this.view.setUint32(4, hi, true);
    return this.view.getFloat64(0, true);
  }
}

/** cyrb53-style 2 x 32-bit hash over each result's two 32-bit words. */
class BitHash {
  private h1 = 0xdeadbeef;
  private h2 = 0x41c6ce57;
  private readonly view = new DataView(new ArrayBuffer(8));

  add(x: number): void {
    this.view.setFloat64(0, x, true);
    for (const w of [
      this.view.getUint32(0, true),
      this.view.getUint32(4, true),
    ]) {
      this.h1 = Math.imul(this.h1 ^ w, 2654435761);
      this.h2 = Math.imul(this.h2 ^ w, 1597334677);
    }
  }

  hex(): string {
    let h1 = Math.imul(this.h1 ^ (this.h1 >>> 16), 2246822507);
    h1 ^= Math.imul(this.h2 ^ (this.h2 >>> 13), 3266489909);
    let h2 = Math.imul(this.h2 ^ (this.h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (
      (h2 >>> 0).toString(16).padStart(8, '0') +
      (h1 >>> 0).toString(16).padStart(8, '0')
    );
  }
}

/** One input set per function, covering each one's whole finite domain. */
function vector(fn: GoldenFunction, i: Inputs, k: number): number {
  switch (fn) {
    case 'pow':
      // Three shapes in turn: the cost curve, powers of ten, and general.
      if (k % 3 === 0) return pow(1.15, i.u32() % 100_001);
      if (k % 3 === 1) return pow(10, i.unit() * 600 - 300);
      return pow(i.unit() * 1000, i.unit() * 200 - 100);
    case 'exp':
      return exp(i.unit() * 1454.9 - 745.1);
    case 'ln':
      return ln(i.anyPositive());
    case 'log10':
      return log10(i.anyPositive());
    case 'expm1':
      return expm1(i.unit() * 760 - 50);
    case 'log1p':
      return log1p(k % 2 === 0 ? i.unit() * 2 - 1 : i.anyPositive());
  }
}

/** The digest of one function's 100,000 golden vectors. */
export function digest(fn: GoldenFunction): string {
  const inputs = new Inputs(20261001 + FUNCTIONS.indexOf(fn));
  const hash = new BitHash();
  for (let k = 0; k < VECTORS_PER_FUNCTION; k++)
    hash.add(vector(fn, inputs, k));
  return hash.hex();
}

export function digests(): Record<GoldenFunction, string> {
  const out = {} as Record<GoldenFunction, string>;
  for (const fn of FUNCTIONS) out[fn] = digest(fn);
  return out;
}
```

`playwright.engines.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

/**
 * The cross-engine determinism check (M1 design §7): the same golden vectors
 * in Node and in each browser engine. One worker, since the check is a few
 * seconds of CPU per engine and the web app's own e2e suite will want the
 * machine.
 */
export default defineConfig({
  testDir: 'tests/engines',
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

`package.json` (change):

```diff
diff --git a/package.json b/package.json
index 8413bd4..5143b99 100644
--- a/package.json
+++ b/package.json
@@ -14,6 +14,7 @@
     "postinstall": "npm run types --workspace @wordfarer/sync-worker",
     "test:unit": "vitest run",
     "test:worker": "npm run test --workspace @wordfarer/sync-worker",
+    "test:engines": "playwright test -c playwright.engines.config.ts",
     "lint": "eslint . --max-warnings 0",
     "typecheck": "tsc --noEmit && npm run typecheck --workspaces --if-present",
     "format": "prettier --write .",
@@ -24,6 +25,7 @@
   "devDependencies": {
     "@eslint/compat": "^2.1.1",
     "@eslint/js": "^10.0.0",
+    "@playwright/test": "^1.63.0",
     "@types/node": "^24.0.0",
     "eslint": "^10.11.0",
     "eslint-plugin-svelte": "^3.23.0",
```

`tsconfig.json` (change):

```diff
diff --git a/tsconfig.json b/tsconfig.json
index 530ae33..14c403a 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -15,5 +15,10 @@
     "noEmit": true,
     "types": ["node"]
   },
-  "include": ["tests/**/*.ts", "scripts/**/*.ts", "vitest.config.ts"]
+  "include": [
+    "tests/**/*.ts",
+    "scripts/**/*.ts",
+    "vitest.config.ts",
+    "playwright.engines.config.ts"
+  ]
 }
```

`.github/workflows/ci.yml` (change):

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 1b78915..35747c0 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -36,5 +36,9 @@ jobs:
         run: npm run test:unit
       - name: Worker tests (workerd + local D1)
         run: npm run test:worker
+      - name: Browsers for the cross-engine check
+        run: npx playwright install --with-deps chromium firefox webkit
+      - name: Cross-engine determinism (Node, Chromium, Firefox, WebKit)
+        run: npm run test:engines
       - name: Build (a warning fails it)
         run: scripts/fail-on-warnings.sh npm run build
```

- [ ] **Step 5: Run green**

Run: `npx vitest run packages/core/test/golden-vectors.test.ts tests/unit/cross-engine-harness.test.ts && npm run test:engines`
Expected: `Tests  5 passed (5)`, then `3 passed` from Playwright (`[chromium]`, `[firefox]`, `[webkit]`).

- [ ] **Step 6: Gate and commit**, message `test(core): cross-engine harness for det-math golden vectors (Refs #26)`. The gate now includes `npm run test:engines`.

- [ ] **Step 7: Mutations, against the commit**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/golden-vectors.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `\n` marks a line break and `(deleted)` means the line is removed.

| Id    | File                           | Change                                                                                  | Predicted (written first)                                                                                           | Result                                                                                                                                                                                                                       |
| ----- | ------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M8.1  | `det-math.ts`                  | `  return stdlibPow(base, exponent);` → `  return Math.pow(base, exponent);`            | 1 failed (hash to the pinned digests), 1 passed                                                                     | as predicted                                                                                                                                                                                                                 |
| M8.1b | `det-math.ts`                  | `  return stdlibPow(base, exponent);` → `  return Math.pow(base, exponent);`            | `npm run test:engines`: red on firefox, webkit; green on chromium                                                   | red on webkit; green on chromium **and firefox**. The prediction was red on Firefox too: measured, SpiderMonkey's `Math.pow` matches V8's on all 100,000 inputs. AC10 requires the WebKit comparison to go red, and it does. |
| M8.2  | `playwright.engines.config.ts` | `    { name: 'webkit', use: { ...devices['Desktop Safari'] } },` → (deleted)            | `npx vitest run tests/unit/cross-engine-harness.test.ts`: 1 failed (runs on Chromium, Firefox and WebKit), 2 passed | as predicted                                                                                                                                                                                                                 |
| M8.3  | `ci.yml`                       | `run: npx playwright install --with-deps chromium firefox webkit` → `run: echo skipped` | `npx vitest run tests/unit/cross-engine-harness.test.ts`: 1 failed (runs in CI), 2 passed                           | as predicted                                                                                                                                                                                                                 |
| M8.4  | `golden-vectors.ts`            | `      this.view.getUint32(4, true),` → (deleted)                                       | 1 failed (hash to the pinned digests), 1 passed                                                                     | as predicted                                                                                                                                                                                                                 |

---

## Finishing

- [ ] Push the branch, open a PR into `develop` whose body says `Refs #26` and maps each acceptance criterion to its test, read the CI steps on the head SHA by name (including both new ones), merge, and confirm the dev deploy and `dev-verified`.
- [ ] Tick #26's acceptance criteria with links to the tests, and move #26 to Done on the board (resolve the board by node id, assert its title first).
