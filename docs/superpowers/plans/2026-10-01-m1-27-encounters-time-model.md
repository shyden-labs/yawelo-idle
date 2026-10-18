# M1 #27: Encounters, Understanding and the Time Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@wordfarer/core` its first economy: Encounter costs, bulk buy and milestones; an anchored game state; `integrate`, `advance` and `view`; and the two Encounter actions, Listen and buy, with typed rejections.

**Architecture:** State holds every quantity at its **anchor** (the simulated time of the last event) as plain data; "now" values are derived. `integrate` moves only the two clocks, so splitting an interval cannot change any stored arithmetic and AC6's associativity holds bit for bit. `advance` clamps elapsed wall time to `[0, offline cap]` and re-anchors when the cap clips. Costs and milestone multipliers are `Num` values built only from operations #26 proved engine-identical (`Num.pow` over `det-math`, and break_infinity's add, sub, mul and div); the cross-engine replay of a whole game is #36's golden-log test.

**Tech Stack:** Node 24, npm workspaces, TypeScript 6.0, Vitest 4.1, fast-check 4.10, decimal.js 10.6 (test reference only), `Num` over break_infinity.js 2.2.0. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md` (§2.2, §2.3, §4, §5), with the parent `docs/superpowers/specs/2026-10-01-wordfarer-design.md` (§3.2) for the cost and milestone rules. Story: #27.

## Global Constraints

- Node `>=24`; npm workspaces. No task adds or changes a dependency.
- Zero warnings: lint `--max-warnings 0`, typecheck, Prettier, `npm ci` and `npm run build` (spec §12).
- `packages/core/src` reads no clock, timer, network or host object and calls no engine-approximated maths: every power goes through `Num.pow` (M1 design §2.1, #26's lint ban). No `eslint-disable` there.
- State holds plain data only: a `Num` is stored as its `[mantissa, exponent]` tuple, times as integer milliseconds (M1 design §4).
- Tests are written first and seen red against throwing stubs, each failing on its own assertion. Every guard is mutation-verified.
- Commit messages and PR bodies say `Refs #27`; never put close/fix/resolve next to an issue number. Commits are authored as Shyden.

## Review Focus

1. **An Encounter id that is an `Object.prototype` member** (`toString`, `constructor`, `__proto__`). A player expects such an id to behave like any other, and an unknown one to be refused. `ownedCount` reads own keys only; Task 2 buys a `toString` Encounter, round-trips it through JSON, and rejects `constructor` and `__proto__` as unknown (M2.1).
2. **A clock that goes backwards, stands still, or jumps past the cap** (DN21). A player who changes their clock expects nothing lost and nothing gained. Task 2 tests an hour back, the same instant, exactly the cap (not clipped), 1 ms over (clipped) and 30 days (M2.3, M2.4, M2.5).
3. **A purchase that spends exactly what is held.** A player with exactly the cost expects the purchase to go through and to hold zero, never a negative. Task 2 tests it (M2.8), and AC8's property checks every reachable state (M2.13).
4. **A count or elapsed time that is not a safe integer** (fractional, `NaN`, `Infinity`, negative), as an event or a caller could send. The game must refuse it, never store it. Counts are typed `Rejection`s (M2.9); elapsed times are a `RangeError` from `integrate`, tested from a state whose clock is past zero (M2.12).
5. **A property that never reaches the states it is about.** fast-check's default size never generates more than 10 elements, whatever `maxLength` says (measured, Task 3). AC8's sequences ask for 20 to 120 steps and count the purchases they reach (more than 100); Task 3 fixes #26's stream-independence property the same way and guards its length (M3.1).

## Decisions this plan makes

- **Production is rate × time in #27.** Design §2.2's hour buckets exist so each word's mean retrievability can differ by hour. #27 has no words, so the rate is constant between events and a bucket loop would be structure no test can observe. AC5 holds because the rate is constant within every hour, and Task 2 tests that it is linear inside one. #28 adds the per-word rates and the bucket loop together, with tests that can see the buckets.
- **Functions that read course data take the course first.** State holds no content, so a save stays small and a replay supplies the course it ran against. `initialState(wallMs)` takes no seed until a story first draws from the RNG (#30). Task 4 amends design §4 to match.
- **The offline cap is read from `BALANCE` in `advance`.** #29's Insight upgrades make it a function of state.
- **Listen and buy act at the state's own simulated time.** `apply` (#36) advances to an event's `wallMs` and checks `seq` before dispatching to them.
- **Bulk buy is checked against a derived bound, not for bit equality.** `Num.pow` computes g^n as 10^(n × log10 g), so the closed form and a sum of single purchases round differently. The bound, 8 × 6e-16 × (n + k + |log10 cost| + 4), comes from `Num.pow`'s documented error and the series term's worst magnification (1.15 / 0.15 < 8). Measured worst over n ≤ 1000, k ≤ 300: 1.07e-13 against a 60-digit reference and 2.9e-14 between bulk and singles.

## Acceptance criteria → tasks (#27)

| AC  | What                                                           | Task | Proved by                                                                                                   |
| --- | -------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `listen` adds exactly 1                                        | 2    | `sim.test.ts` "listen (AC1)", M2.7                                                                          |
| 2   | cost `c0 · 1.15^n`, bulk closed form, bulk = singles           | 1    | `encounters.test.ts` "purchaseCost (AC2)", M1.1 to M1.3, M1.7, M1.8                                         |
| 3   | output formula, milestones at 10/25/50/100 then every 100      | 1, 2 | `encounters.test.ts` "milestones" and "encounterOutput", `sim.test.ts` "encounterRate", M1.4 to M1.6, M2.11 |
| 4   | anchored state; `view` derives without changing state          | 2    | `sim.test.ts` "view (AC4)", M2.6, M2.7, M2.10                                                               |
| 5   | production constant within each clock hour                     | 2    | `sim.test.ts` "production inside an hour (AC5)", M2.10                                                      |
| 6   | `integrate` associative, bit for bit, 1,000 runs, gaps ≤ 72 h  | 2    | `sim.test.ts` "integrate (AC6)", M2.2, M2.12, M2.14                                                         |
| 7   | `advance` clamps to `[0, cap]`, summary, 1 h / 1 day / 30 days | 2    | `sim.test.ts` "advance (AC7)", M2.3 to M2.5                                                                 |
| 8   | no NaN, negative or infinite value in any reachable state      | 2, 3 | `sim.test.ts` "(AC8)", M2.13; Task 3 for the generator length                                               |
| 9   | unaffordable → typed `Rejection`, state unchanged              | 2    | `sim.test.ts` "buyEncounter (AC9)", M2.8, M2.9, M2.13                                                       |

## How this plan was reviewed

The plan was reviewed by **executing it**. Each task was built as one cumulative commit (a stage) in a scratch worktree on top of `develop` `0e33a8a`. Stages T1 to T3 were each checked out alone, installed with a clean `npm ci` and run through every CI build step (format, lint, typecheck, unit, Worker tests, build); T4 changes only the design spec and was gated on T3's install. Each task's final tests were run against its throwing stubs. Every guard was mutated with its result predicted in writing first. Every code block below is generated from those stage commits (`git show <stage>:<path>`) or the stub files, never typed, and is checked byte for byte against its source. A block labelled `(change)` is a unified diff against the previous task's tree, shown for reading: Prettier trims the single space that marks a blank context line, so make the change by hand rather than with `git apply`.

- **Pass 1 (execution)** (2026-10-01). 9 found and fixed. **Design:** (1) a per-hour-bucket production loop had no observable effect in #27, since nothing varies the rate between events, and its bucket parameter needed `void bucket;` to pass lint: removed, and the loop moves to #28 with per-word rates (Decisions); (2) an `offlineCapMs(state)` function ignored its argument the same way: `advance` reads `BALANCE` until #29. **Measured facts that changed the tests:** (3) the AC2 tolerance is derived from `Num.pow`'s documented bound and measured (worst 1.07e-13 against a 60-digit reference, 2.9e-14 bulk against singles, n ≤ 1000, k ≤ 300); (4) AC8's property reached **0 purchases in 500 runs**: fast-check's default size never generated more than 10 elements for `maxLength: 60` (2,000 samples, mean 4.8, maximum 10), short of the 10 Listens a first purchase needs. Its liveness count (`reached > 100`) is what caught it; the arrays now ask for 20 to 120 steps with `size: 'max'`. (5) The same flaw sat in #26's stream-independence property: Task 3. **Found by writing the mutation predictions before running them:** (6) every rate assertion derived its expected value from `encounterRate` itself, so keeping only the last Encounter's output would have survived: a test now sums `encounterOutput` independently (M2.11); (7) the elapsed-time refusals started from `sim = 0`, where the sum's own check throws anyway, so dropping `integrate`'s check would have survived: they start at 5,000 ms (M2.12); (8) the `advance` tests built their state while the file was collected, so a stub failed the whole file with "no tests": it is built in `beforeEach`. **Red runs:** T1 42 of 42 and T2 38 of 38 failed, every one on the stub (counted per test from the JSON reporter: T1 33 `not implemented`, 2 properties caused by it, 7 `toThrow` receiving it; T2 32, 2 and 4); (9) a first draft of Task 1's expected text said 35 and was corrected to the count. **Mutations:** 22 run, 22 as predicted. **Gates:** unit 423 (T1), 461 (T2, T3, T4); Worker 14 + 10; format, lint, typecheck and build pass at every stage.
- **Pass 2** (2026-10-01). Mechanical: all 13 generated code blocks equal their stage or stub byte for byte, and the checker reports a planted one-character change (`0NE` for `ONE` in Task 1's module: 1 differs, exit 1); every name in an Interfaces block is exported from the T2 `index.ts`, every `npm run` script named exists, and no placeholder remains, each check shown firing on a planted positive first (`notAThing`, `nope`, a `TBD` line). Full read found 5: (1) no mutation had turned AC6's associativity property red (M2.2 and M2.12 are caught by other tests): M2.14 rounds `integrate`'s step to whole seconds and was predicted, then run, as 3 failed including the property; (2) the Architecture line claimed costs have the same bits on every engine, which #27 does not measure: it now names what is inherited from #26 and where the whole-game check lives (#36); (3) Task 2's Interfaces listed `HOUR_MS` as consumed, which only the tests use; (4) Finishing passed `wait-run.sh` a SHA where the script takes a file holding one; (5) Task 1's red text quoted the full `toThrow` pattern, which Vitest prints shortened: it now quotes the measured line.
- **Pass 3** (2026-10-01). Mechanical checks re-run: 13 blocks equal, Prettier clean at the tracked path. Read every line pass 2 changed. Found 1: Finishing named the waiter's first argument `<repo>`, which reads as `owner/name`; the script `cd`s into it, so it is `<repo-dir>`, as in the script's own usage line.
- **Pass 4** (2026-10-01). Mechanical checks re-run: 13 blocks equal, Prettier clean. Read the `diff` against the text pass 3 read (its log entry and the Finishing line). Found 1: pass 3's entry said `--file-info` reported the plan not ignored, but pass 3 had not run it. Run since: `ignored: false` for the plan, `ignored: true` for a `node_modules` path as the control. The entry now says only what pass 3 ran.
- **Pass 5** (2026-10-01). Mechanical checks re-run on the text pass 4 left: 13 blocks equal, Prettier clean, `--file-info` not ignored. Read the `diff` against the text pass 4 read (the corrected pass 3 entry and the pass 4 entry), checking each claim against the run it names. **No findings: plan approved** under the house rule.

---

### Task 1: Encounter costs, bulk buy and milestones

**Files:**

- Create: `packages/core/src/encounters.ts`
- Test: `packages/core/test/encounters.test.ts`

**Interfaces:**

- Consumes: `Num` (`from`, `mul`, `div`, `sub`, `pow`) from `packages/core/src/num.ts`; `BALANCE.encounters` from `balance.ts`; the `Encounter` type from `course.ts` (all #26).
- Produces: `purchaseCost(encounter: Encounter, owned: number, count: number): Num`, `milestonesReached(owned: number): number`, `encounterOutput(encounter: Encounter, owned: number): Num`. Each throws `RangeError` for an `owned` that is not a safe non-negative integer or a `count` that is not a safe positive integer.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/encounters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import Decimal from 'decimal.js';
import type { Encounter } from '../src/course';
import {
  encounterOutput,
  milestonesReached,
  purchaseCost,
} from '../src/encounters';
import type { Num } from '../src/num';

/**
 * Encounter costs, bulk buy and milestones (#27 AC2, AC3).
 *
 * Costs are compared with a 60-digit decimal.js reference. They cannot be
 * bit-exact: `Num.pow` builds g^n as 10^(n x log10 g), so the error in
 * log10 g is multiplied by n. Its documented bound is
 * 6e-16 x (|n| + |log10 result| + 2) per power; the series term
 * (g^k - 1) / (g - 1) can magnify one power's error by g^k / (g^k - 1),
 * at most 1.15 / 0.15 < 8 (k = 1). So a cost is within
 * 8 x 6e-16 x (n + k + |log10 cost| + 4) of the exact value.
 * Measured worst over n <= 1000, k <= 300: 1.07e-13 against the reference,
 * 2.9e-14 between a bulk buy and the same purchases made singly.
 */

const D = Decimal.clone({ precision: 60 });
const GROWTH = new D('1.15');

const tea: Encounter = { id: 'tea', tags: ['food'], c0: 10, p0: 0.1 };

function exact(n: Num): Decimal {
  return new D(n.mantissa).mul(new D(10).pow(n.exponent));
}

function relativeError(got: Num, want: Decimal): number {
  return exact(got).sub(want).div(want).abs().toNumber();
}

function costBound(owned: number, count: number, cost: Decimal): number {
  const log10 = Math.abs(cost.log(10).toNumber());
  return 8 * 6e-16 * (owned + count + log10 + 4);
}

function exactCost(c0: number, owned: number, count: number): Decimal {
  return new D(c0)
    .mul(GROWTH.pow(owned))
    .mul(GROWTH.pow(count).sub(1))
    .div(GROWTH.sub(1));
}

describe('purchaseCost (AC2)', () => {
  it.each([
    [0, 10],
    [1, 11.5],
    [2, 13.225],
  ])('the purchase after %i owned costs %s', (owned, want) => {
    const got = purchaseCost(tea, owned, 1);
    expect(relativeError(got, new D(want))).toBeLessThan(
      costBound(owned, 1, new D(want)),
    );
  });

  it('the n-th purchase costs c0 x 1.15^n, n = 0..2000', () => {
    for (let owned = 0; owned <= 2000; owned++) {
      const want = exactCost(tea.c0, owned, 1);
      const got = purchaseCost(tea, owned, 1);
      expect(relativeError(got, want)).toBeLessThan(costBound(owned, 1, want));
    }
  });

  it('buying k uses the geometric series closed form', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (owned, count, c0) => {
          const encounter = { ...tea, c0 };
          const want = exactCost(c0, owned, count);
          const got = purchaseCost(encounter, owned, count);
          expect(relativeError(got, want)).toBeLessThan(
            costBound(owned, count, want),
          );
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('buying k at once costs what k single purchases cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 200 }),
        (owned, count) => {
          const bulk = exact(purchaseCost(tea, owned, count));
          let singles = new D(0);
          for (let i = 0; i < count; i++) {
            singles = singles.add(exact(purchaseCost(tea, owned + i, 1)));
          }
          const difference = bulk.sub(singles).div(singles).abs().toNumber();
          expect(difference).toBeLessThan(2 * costBound(owned, count, singles));
        },
      ),
      { numRuns: 200 },
    );
  });

  it.each([
    [-1, 1],
    [1.5, 1],
    [Number.NaN, 1],
    [0, 0],
    [0, -1],
    [0, 2.5],
    [0, Number.POSITIVE_INFINITY],
  ])('refuses owned %s, count %s', (owned, count) => {
    expect(() => purchaseCost(tea, owned, count)).toThrow(
      /must be a safe (non-negative|positive) integer/,
    );
  });
});

describe('milestones (AC3)', () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [11, 1],
    [24, 1],
    [25, 2],
    [49, 2],
    [50, 3],
    [99, 3],
    [100, 4],
    [101, 4],
    [199, 4],
    [200, 5],
    [201, 5],
    [299, 5],
    [300, 6],
    [1000, 13],
  ])('%i owned have reached %i milestones', (owned, want) => {
    expect(milestonesReached(owned)).toBe(want);
  });
});

describe('encounterOutput (AC3)', () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [11, 1],
    [24, 1],
    [25, 2],
    [99, 3],
    [100, 4],
    [101, 4],
    [199, 4],
    [200, 5],
  ])('%i owned produce p0 x owned x 2^%i per second', (owned, m) => {
    const want = new D(tea.p0).mul(owned).mul(new D(2).pow(m));
    const got = encounterOutput(tea, owned);
    if (owned === 0) {
      expect(got.mantissa).toBe(0);
    } else {
      expect(relativeError(got, want)).toBeLessThan(1e-14);
    }
  });

  it('reaching a milestone doubles the output per Encounter', () => {
    const perOne = (owned: number): Decimal =>
      exact(encounterOutput(tea, owned)).div(owned);
    expect(perOne(10).div(perOne(9)).toNumber()).toBeCloseTo(2, 12);
    expect(perOne(100).div(perOne(99)).toNumber()).toBeCloseTo(2, 12);
    expect(perOne(200).div(perOne(199)).toNumber()).toBeCloseTo(2, 12);
  });
});
```

- [ ] **Step 2: Add the throwing stub, so the tests fail on their own assertions**

`packages/core/src/encounters.ts` (stub):

```ts
/** Encounter costs, bulk buy and milestones: a stub for the red run. */
import type { Encounter } from './course';
import type { Num } from './num';

export function purchaseCost(
  encounter: Encounter,
  owned: number,
  count: number,
): Num {
  throw new Error('not implemented');
}

export function milestonesReached(owned: number): number {
  throw new Error('not implemented');
}

export function encounterOutput(encounter: Encounter, owned: number): Num {
  throw new Error('not implemented');
}
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run packages/core/test/encounters.test.ts`
Expected: `Tests  42 failed (42)`. 33 fail with `Error: not implemented`; the 7 `refuses owned …` cases fail with `expected [Function] to throw error matching /must be a safe (non-negative|positive…/ but got 'not implemented'` (Vitest shortens the pattern); the two fast-check properties report `Caused by: Error: not implemented`.

- [ ] **Step 4: Implement**

`packages/core/src/encounters.ts`:

```ts
/**
 * Encounter costs, bulk buy and milestones (parent spec §3.2, M1 design §5).
 *
 * The n-th purchase (0-based, so n is the number already owned) costs
 * c0 x growth^n. Buying k at once costs the geometric series
 * c0 x growth^n x (growth^k - 1) / (growth - 1). Every power goes through
 * `Num.pow`, so the result has the same bits on every engine (design §2.1).
 */
import { BALANCE } from './balance';
import type { Encounter } from './course';
import { Num } from './num';

const ONE = Num.from(1);
const GROWTH = Num.from(BALANCE.encounters.costGrowth);
const GROWTH_LESS_ONE = Num.sub(GROWTH, ONE);
const MILESTONE_MULTIPLIER = Num.from(BALANCE.encounters.milestoneMultiplier);

function checkOwned(owned: number): void {
  if (!Number.isSafeInteger(owned) || owned < 0) {
    throw new RangeError(
      `owned must be a safe non-negative integer, got ${String(owned)}`,
    );
  }
}

function checkCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError(
      `count must be a safe positive integer, got ${String(count)}`,
    );
  }
}

/** The cost of buying `count` more of `encounter` when `owned` are held. */
export function purchaseCost(
  encounter: Encounter,
  owned: number,
  count: number,
): Num {
  checkOwned(owned);
  checkCount(count);
  const first = Num.mul(Num.from(encounter.c0), Num.pow(GROWTH, owned));
  const series = Num.div(Num.sub(Num.pow(GROWTH, count), ONE), GROWTH_LESS_ONE);
  return Num.mul(first, series);
}

/**
 * How many milestones `owned` has reached: each listed count, then one more
 * every `milestoneEvery` past the last listed one.
 */
export function milestonesReached(owned: number): number {
  checkOwned(owned);
  const { milestones, milestoneEvery } = BALANCE.encounters;
  const listed = milestones.filter((m) => owned >= m).length;
  const last = milestones[milestones.length - 1];
  if (last === undefined || owned < last) return listed;
  return listed + Math.floor((owned - last) / milestoneEvery);
}

/** Understanding per second from `owned` of `encounter`: p0 x owned x 2^milestones. */
export function encounterOutput(encounter: Encounter, owned: number): Num {
  checkOwned(owned);
  if (owned === 0) return Num.from(0);
  return Num.mul(
    Num.from(encounter.p0 * owned),
    Num.pow(MILESTONE_MULTIPLIER, milestonesReached(owned)),
  );
}
```

- [ ] **Step 5: Run the tests and the gate**

Run: `npx vitest run packages/core/test/encounters.test.ts`
Expected: `Tests  42 passed (42)`.
Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`
Expected: all pass; `test:unit` reports `Tests  423 passed (423)`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/encounters.ts packages/core/test/encounters.test.ts
git commit -m "feat(core): Encounter costs, bulk buy and milestones (Refs #27)"
```

- [ ] **Step 7: Verify every guard by mutation**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/encounters.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `⏎` marks a line break and `(deleted)` means the line is removed.

| Id   | File                              | Change                                                                                                          | Predicted (written first)                                                                                                                                                                                                                  | Result       |
| ---- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| M1.1 | `packages/core/src/encounters.ts` | `const GROWTH = Num.from(BALANCE.encounters.costGrowth);` → `const GROWTH = Num.from(1.16);`                    | 4 failed (after 1 owned costs 11.5; after 2 owned costs 13.225; the n-th purchase costs; geometric series closed form), 38 passed                                                                                                          | as predicted |
| M1.2 | `packages/core/src/encounters.ts` | `  return Num.mul(first, series);` → `  return Num.mul(first, Num.from(count));`                                | 2 failed (geometric series closed form; costs what k single purchases cost), 40 passed                                                                                                                                                     | as predicted |
| M1.3 | `packages/core/src/encounters.ts` | `Num.pow(GROWTH, owned)` → `Num.pow(GROWTH, owned + 1)`                                                         | 5 failed (after 0 owned costs 10; after 1 owned costs 11.5; after 2 owned costs 13.225; the n-th purchase costs; geometric series closed form), 37 passed                                                                                  | as predicted |
| M1.4 | `packages/core/src/encounters.ts` | `milestones.filter((m) => owned >= m)` → `milestones.filter((m) => owned > m)`                                  | 8 failed (10 owned have reached 1; 25 owned have reached 2; 50 owned have reached 3; 100 owned have reached 4; 10 owned produce; 25 owned produce; 100 owned produce; reaching a milestone doubles), 34 passed                             | as predicted |
| M1.5 | `packages/core/src/encounters.ts` | `  return listed + Math.floor((owned - last) / milestoneEvery);` → `  return listed;`                           | 7 failed (200 owned have reached 5; 201 owned have reached 5; 299 owned have reached 5; 300 owned have reached 6; 1000 owned have reached 13; 200 owned produce; reaching a milestone doubles), 35 passed                                  | as predicted |
| M1.6 | `packages/core/src/encounters.ts` | `    Num.from(encounter.p0 * owned),` → `    Num.from(encounter.p0),`                                           | 11 failed (9 owned produce; 10 owned produce; 11 owned produce; 24 owned produce; 25 owned produce; 99 owned produce; 100 owned produce; 101 owned produce; 199 owned produce; 200 owned produce; reaching a milestone doubles), 31 passed | as predicted |
| M1.7 | `packages/core/src/encounters.ts` | `  if (!Number.isSafeInteger(count) \|\| count < 1) {` → `  if (!Number.isSafeInteger(count) \|\| count < 0) {` | 1 failed (refuses owned 0, count 0), 41 passed                                                                                                                                                                                             | as predicted |
| M1.8 | `packages/core/src/encounters.ts` | `  if (!Number.isSafeInteger(owned) \|\| owned < 0) {` → `  if (owned < 0) {`                                   | 2 failed (refuses owned 1.5, count 1; refuses owned NaN, count 1), 40 passed                                                                                                                                                               | as predicted |

### Task 2: Anchored state, `integrate`, `advance`, `view`, Listen and purchases

**Files:**

- Create: `packages/core/src/state.ts`, `packages/core/src/production.ts`, `packages/core/src/sim.ts`
- Modify: `packages/core/src/index.ts` (exports)
- Test: `packages/core/test/sim.test.ts`

**Interfaces:**

- Consumes: Task 1's `purchaseCost` and `encounterOutput`; `simMs`, `wallMs`, `SimMs`, `WallMs` from `clock.ts` (#26; the tests also use `HOUR_MS`); `Num`, `NumTuple`; `BALANCE.listen` and `BALANCE.offline`; `CourseData`.
- Produces: in `state.ts`, `interface Anchor { sim: SimMs; understanding: NumTuple }`, `interface GameState { sim: SimMs; wall: WallMs; anchor: Anchor; owned: Readonly<Record<string, number>> }`, `initialState(wall: WallMs): GameState`, `ownedCount(state, id): number`. In `production.ts`, `encounterRate(course, state): Num` and `producedBetween(course, state, from: SimMs, to: SimMs): Num`. In `sim.ts`, `type Rejection` (`unknownEncounter` | `invalidCount` | `unaffordable`), `type Result`, `interface AdvanceSummary { creditedMs; clipped; understandingEarned: NumTuple }`, `interface View { understanding: Num; rate: Num }`, and `understandingNow(course, state)`, `integrate(state, elapsedMs)`, `advance(course, state, now: WallMs)`, `view(course, state, now: WallMs)`, `listen(course, state)`, `buyEncounter(course, state, id, count): Result`. All are exported from `index.ts`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/sim.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { HOUR_MS, simMs, wallMs, type WallMs } from '../src/clock';
import type { CourseData, Encounter } from '../src/course';
import { encounterOutput, purchaseCost } from '../src/encounters';
import { Num, type NumTuple } from '../src/num';
import { encounterRate } from '../src/production';
import {
  advance,
  buyEncounter,
  integrate,
  listen,
  understandingNow,
  view,
} from '../src/sim';
import { initialState, ownedCount, type GameState } from '../src/state';

/**
 * The time model and the Encounter actions (#27 AC1, AC4 to AC9).
 *
 * The course is declared here rather than imported, so it is checked against
 * the `CourseData` contract instead of sharing it.
 */

const DAY_MS = 24 * HOUR_MS;
const CAP_MS = DAY_MS;

const tea: Encounter = { id: 'tea', tags: ['food'], c0: 10, p0: 0.1 };
const market: Encounter = { id: 'market', tags: ['food'], c0: 100, p0: 1 };
/** An id that is also an `Object.prototype` member. */
const odd: Encounter = { id: 'toString', tags: ['food'], c0: 5, p0: 0.5 };

const course: CourseData = {
  id: 'test-course',
  tags: ['food'],
  regions: [
    {
      id: 'r0',
      destinations: [],
      encounters: [tea, market, odd],
      cardSets: [],
      cultureCards: [],
      grammarNodes: [],
    },
  ],
};

const START: WallMs = wallMs(Date.UTC(2027, 0, 4));

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function stateWith(
  owned: Record<string, number>,
  understanding: number,
  leadMs = 0,
): GameState {
  const base = initialState(START);
  return deepFreeze({
    ...base,
    sim: simMs(leadMs),
    wall: wallMs(START + leadMs),
    anchor: {
      sim: simMs(0),
      understanding: Num.toTuple(Num.from(understanding)),
    },
    owned,
  });
}

function u(state: GameState): NumTuple {
  return Num.toTuple(understandingNow(course, state));
}

function json(state: GameState): string {
  return JSON.stringify(state);
}

function relativeError(got: Num, want: Num): number {
  return Math.abs(Num.toNumber(Num.div(Num.sub(got, want), want)));
}

describe('initialState', () => {
  it('starts with nothing at simulated time 0', () => {
    const s = initialState(START);
    expect(s).toEqual({
      sim: 0,
      wall: START,
      anchor: { sim: 0, understanding: [0, 0] },
      owned: {},
    });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('reads owned counts from own keys only', () => {
    const s = initialState(START);
    expect(ownedCount(s, 'toString')).toBe(0);
    expect(ownedCount(s, 'constructor')).toBe(0);
    expect(ownedCount(stateWith({ tea: 3 }, 0), 'tea')).toBe(3);
  });
});

describe('listen (AC1)', () => {
  it('adds exactly 1 Understanding to a new game', () => {
    expect(u(listen(course, initialState(START)))).toEqual([1, 0]);
  });

  it('adds exactly 1 to whatever is held, production included', () => {
    const s = stateWith({ tea: 10, market: 3 }, 123.456, 90_000);
    const before = understandingNow(course, s);
    const after = listen(course, s);
    expect(u(after)).toEqual(Num.toTuple(Num.add(before, Num.from(1))));
    expect(after.anchor.sim).toBe(s.sim);
  });

  it('1,000 taps on a new game hold exactly 1,000', () => {
    let s = initialState(START);
    for (let i = 0; i < 1000; i++) s = listen(course, s);
    expect(u(s)).toEqual(Num.toTuple(Num.from(1000)));
  });
});

describe('view (AC4)', () => {
  it('derives values at a later time without changing the state', () => {
    const s = stateWith({ tea: 12, market: 2 }, 50, 1_000);
    const before = json(s);
    const later = wallMs(s.wall + 30 * 60_000);
    const v = view(course, s, later);
    expect(json(s)).toBe(before);
    expect(Num.toTuple(v.understanding)).toEqual(
      u(advance(course, s, later).state),
    );
    expect(Num.toTuple(v.rate)).toEqual(Num.toTuple(encounterRate(course, s)));
  });

  it('at the state own wall time, shows the anchored value plus production since', () => {
    const s = stateWith({ tea: 5 }, 7, 60_000);
    const want = Num.add(
      Num.from(7),
      Num.div(
        Num.mul(encounterRate(course, s), Num.from(60_000)),
        Num.from(1000),
      ),
    );
    expect(Num.toTuple(view(course, s, s.wall).understanding)).toEqual(
      Num.toTuple(want),
    );
  });

  it('stores nothing but the anchor: integrate leaves the anchor alone', () => {
    const s = stateWith({ tea: 5 }, 7, 60_000);
    expect(integrate(s, 3 * HOUR_MS).anchor).toEqual(s.anchor);
  });
});

describe('encounterRate (AC3)', () => {
  it('sums the output of every owned Encounter in the course', () => {
    const s = stateWith({ tea: 37, market: 4, toString: 2 }, 0);
    const want = Num.add(
      Num.add(encounterOutput(tea, 37), encounterOutput(market, 4)),
      encounterOutput(odd, 2),
    );
    expect(relativeError(encounterRate(course, s), want)).toBeLessThan(1e-15);
  });

  it('is zero with nothing owned', () => {
    expect(encounterRate(course, stateWith({}, 0)).mantissa).toBe(0);
  });
});

describe('production inside an hour (AC5)', () => {
  it('is linear at the Encounter rate between any two times', () => {
    const s = stateWith({ tea: 37, market: 4, toString: 2 }, 0);
    const rate = encounterRate(course, s);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: HOUR_MS - 2 }),
        fc.integer({ min: 1, max: HOUR_MS - 1 }),
        (from, span) => {
          const to = Math.min(from + span, HOUR_MS - 1);
          fc.pre(to > from);
          const a = understandingNow(course, integrate(s, from));
          const b = understandingNow(course, integrate(s, to));
          const perSecond = Num.div(
            Num.mul(Num.sub(b, a), Num.from(1000)),
            Num.from(to - from),
          );
          expect(relativeError(perSecond, rate)).toBeLessThan(1e-9);
        },
      ),
    );
  });
});

const arbState = fc
  .record({
    tea: fc.integer({ min: 0, max: 300 }),
    market: fc.integer({ min: 0, max: 300 }),
    understanding: fc.double({ min: 0, max: 1e15, noNaN: true }),
    anchorSim: fc.integer({ min: 0, max: 1e12 }),
    lead: fc.integer({ min: 0, max: 72 * HOUR_MS }),
    wall: fc.integer({ min: 1.7e12, max: 1.9e12 }),
  })
  .map((r): GameState => ({
    sim: simMs(r.anchorSim + r.lead),
    wall: wallMs(r.wall),
    anchor: {
      sim: simMs(r.anchorSim),
      understanding: Num.toTuple(Num.from(r.understanding)),
    },
    owned: { tea: r.tea, market: r.market },
  }));

describe('integrate (AC6)', () => {
  it('integrate(integrate(s, a), b) deep-equals integrate(s, a + b), bit for bit', () => {
    const gap = fc.integer({ min: 0, max: 72 * HOUR_MS });
    fc.assert(
      fc.property(arbState, gap, gap, (s, a, b) => {
        const split = integrate(integrate(s, a), b);
        const whole = integrate(s, a + b);
        expect(split).toEqual(whole);
        expect(u(split)).toEqual(u(whole));
      }),
      { numRuns: 1000 },
    );
  });

  it('moves both clocks by the same amount', () => {
    const s = stateWith({ tea: 1 }, 0, 500);
    const t = integrate(s, 1234);
    expect(t.sim - s.sim).toBe(1234);
    expect(t.wall - s.wall).toBe(1234);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses an elapsed time of %s',
    (elapsed) => {
      expect(() => integrate(stateWith({}, 0, 5_000), elapsed)).toThrow(
        /SimMs must be a safe non-negative integer/,
      );
    },
  );
});

describe('advance (AC7)', () => {
  let s: GameState;
  beforeEach(() => {
    s = stateWith({ tea: 25, market: 1 }, 1_000, 5_000);
  });

  it('credits 1 hour in full', () => {
    const { state, summary } = advance(course, s, wallMs(s.wall + HOUR_MS));
    expect(summary.creditedMs).toBe(HOUR_MS);
    expect(summary.clipped).toBe(false);
    expect(state.sim).toBe(s.sim + HOUR_MS);
    expect(state.wall).toBe(s.wall + HOUR_MS);
    expect(summary.understandingEarned).toEqual(
      Num.toTuple(
        Num.sub(understandingNow(course, state), understandingNow(course, s)),
      ),
    );
    const want = Num.mul(encounterRate(course, s), Num.from(3600));
    expect(
      relativeError(Num.fromTuple(summary.understandingEarned), want),
    ).toBeLessThan(1e-12);
  });

  it('credits 1 day, exactly the cap, without clipping', () => {
    const { state, summary } = advance(course, s, wallMs(s.wall + DAY_MS));
    expect(summary.creditedMs).toBe(CAP_MS);
    expect(summary.clipped).toBe(false);
    expect(state.sim).toBe(s.sim + DAY_MS);
    expect(state.anchor).toEqual(s.anchor);
  });

  it('clips 1 ms over the cap', () => {
    const { summary } = advance(course, s, wallMs(s.wall + CAP_MS + 1));
    expect(summary.creditedMs).toBe(CAP_MS);
    expect(summary.clipped).toBe(true);
  });

  it('caps 30 days at 24 hours, moves the wall clock all the way, and re-anchors', () => {
    const now = wallMs(s.wall + 30 * DAY_MS);
    const { state, summary } = advance(course, s, now);
    expect(summary.creditedMs).toBe(CAP_MS);
    expect(summary.clipped).toBe(true);
    expect(state.sim).toBe(s.sim + CAP_MS);
    expect(state.wall).toBe(now);
    expect(state.anchor.sim).toBe(state.sim);
    const oneDay = advance(course, s, wallMs(s.wall + DAY_MS));
    expect(summary.understandingEarned).toEqual(
      oneDay.summary.understandingEarned,
    );
    expect(u(state)).toEqual(u(oneDay.state));
  });

  it.each([
    ['an hour back', -HOUR_MS],
    ['the same instant', 0],
  ])('advances nothing for %s', (_label, delta) => {
    const { state, summary } = advance(course, s, wallMs(s.wall + delta));
    expect(state).toEqual(s);
    expect(summary).toEqual({
      creditedMs: 0,
      clipped: false,
      understandingEarned: [0, 0],
    });
  });

  it('leaves its input unchanged', () => {
    const before = json(s);
    advance(course, s, wallMs(s.wall + 30 * DAY_MS));
    expect(json(s)).toBe(before);
  });
});

function sane(state: GameState): void {
  for (const t of [state.sim, state.wall, state.anchor.sim]) {
    expect(Number.isSafeInteger(t) && t >= 0).toBe(true);
  }
  expect(state.anchor.sim).toBeLessThanOrEqual(state.sim);
  const held = Num.fromTuple(state.anchor.understanding);
  expect(Number.isFinite(held.mantissa) && held.mantissa >= 0).toBe(true);
  const now = understandingNow(course, state);
  expect(Number.isFinite(now.mantissa) && now.mantissa >= 0).toBe(true);
  for (const n of Object.values(state.owned)) {
    expect(Number.isSafeInteger(n) && n >= 0).toBe(true);
  }
}

describe('no reachable state holds NaN, a negative or an infinite value (AC8)', () => {
  type Step =
    | { readonly kind: 'listen' }
    | { readonly kind: 'buy'; readonly id: string; readonly count: number }
    | { readonly kind: 'advance'; readonly deltaMs: number };

  const step: fc.Arbitrary<Step> = fc.oneof(
    { arbitrary: fc.constant({ kind: 'listen' as const }), weight: 5 },
    {
      arbitrary: fc.record({
        kind: fc.constant('buy' as const),
        id: fc.constantFrom('tea', 'market', 'toString'),
        count: fc.integer({ min: 1, max: 20 }),
      }),
      weight: 3,
    },
    {
      arbitrary: fc.record({
        kind: fc.constant('advance' as const),
        deltaMs: fc.integer({ min: -DAY_MS, max: 40 * DAY_MS }),
      }),
      weight: 2,
    },
  );

  it('over random sequences of listens, purchases and returns', () => {
    let reached = 0;
    fc.assert(
      fc.property(
        fc.array(step, { minLength: 20, maxLength: 120, size: 'max' }),
        (steps) => {
          let s = initialState(START);
          for (const e of steps) {
            if (e.kind === 'listen') s = listen(course, s);
            if (e.kind === 'buy') {
              const r = buyEncounter(course, s, e.id, e.count);
              if (r.ok) {
                s = r.state;
                reached++;
              }
            }
            if (e.kind === 'advance') {
              s = advance(course, s, wallMs(s.wall + e.deltaMs)).state;
            }
            sane(s);
          }
        },
      ),
      { numRuns: 500 },
    );
    expect(reached).toBeGreaterThan(100);
  });
});

describe('buyEncounter (AC9)', () => {
  it('rejects an unaffordable purchase with a typed Rejection and leaves state alone', () => {
    const s = stateWith({}, 9.99);
    const before = json(s);
    const r = buyEncounter(course, s, 'tea', 1);
    expect(r).toEqual({
      ok: false,
      rejection: {
        kind: 'unaffordable',
        cost: Num.toTuple(purchaseCost(tea, 0, 1)),
        understanding: Num.toTuple(Num.from(9.99)),
      },
    });
    expect(json(s)).toBe(before);
  });

  it('buys when Understanding equals the cost exactly, leaving zero', () => {
    const cost = purchaseCost(market, 3, 2);
    const s = deepFreeze({
      ...stateWith({ market: 3 }, 0),
      anchor: { sim: simMs(0), understanding: Num.toTuple(cost) },
    });
    const r = buyEncounter(course, s, 'market', 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(u(r.state)).toEqual([0, 0]);
    expect(ownedCount(r.state, 'market')).toBe(5);
  });

  it('pays from Understanding produced since the anchor, and re-anchors', () => {
    const s = stateWith({ tea: 10 }, 0, 10 * 60_000);
    const held = understandingNow(course, s);
    const r = buyEncounter(course, s, 'tea', 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.anchor.sim).toBe(s.sim);
    expect(r.state.anchor.understanding).toEqual(
      Num.toTuple(Num.sub(held, purchaseCost(tea, 10, 1))),
    );
    expect(ownedCount(r.state, 'tea')).toBe(11);
  });

  it('buys an Encounter whose id is an Object.prototype member', () => {
    const r = buyEncounter(course, stateWith({}, 100), 'toString', 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ownedCount(r.state, 'toString')).toBe(3);
    expect(JSON.parse(JSON.stringify(r.state))).toEqual(r.state);
  });

  it.each(['nope', 'constructor', '__proto__', ''])(
    'rejects the unknown Encounter %j',
    (id) => {
      const s = stateWith({}, 1e9);
      const before = json(s);
      expect(buyEncounter(course, s, id, 1)).toEqual({
        ok: false,
        rejection: { kind: 'unknownEncounter', id },
      });
      expect(json(s)).toBe(before);
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a count of %s',
    (count) => {
      const s = stateWith({}, 1e9);
      const before = json(s);
      expect(buyEncounter(course, s, 'tea', count)).toEqual({
        ok: false,
        rejection: { kind: 'invalidCount', count },
      });
      expect(json(s)).toBe(before);
    },
  );
});
```

- [ ] **Step 2: Add the throwing stubs**

`packages/core/src/state.ts` (stub):

```ts
/** The game state and its anchor: a stub for the red run. */
import type { SimMs, WallMs } from './clock';
import type { NumTuple } from './num';

export interface Anchor {
  readonly sim: SimMs;
  readonly understanding: NumTuple;
}

export interface GameState {
  readonly sim: SimMs;
  readonly wall: WallMs;
  readonly anchor: Anchor;
  readonly owned: Readonly<Record<string, number>>;
}

export function initialState(wall: WallMs): GameState {
  throw new Error('not implemented');
}

export function ownedCount(state: GameState, id: string): number {
  throw new Error('not implemented');
}
```

`packages/core/src/production.ts` (stub):

```ts
/** Production over simulated time: a stub for the red run. */
import type { SimMs } from './clock';
import type { CourseData } from './course';
import type { Num } from './num';
import type { GameState } from './state';

export function encounterRate(course: CourseData, state: GameState): Num {
  throw new Error('not implemented');
}

export function producedBetween(
  course: CourseData,
  state: GameState,
  from: SimMs,
  to: SimMs,
): Num {
  throw new Error('not implemented');
}
```

`packages/core/src/sim.ts` (stub):

```ts
/** The time model and the Encounter actions: a stub for the red run. */
import type { WallMs } from './clock';
import type { CourseData } from './course';
import type { Num, NumTuple } from './num';
import type { GameState } from './state';

export type Rejection =
  | { readonly kind: 'unknownEncounter'; readonly id: string }
  | { readonly kind: 'invalidCount'; readonly count: number }
  | {
      readonly kind: 'unaffordable';
      readonly cost: NumTuple;
      readonly understanding: NumTuple;
    };

export type Result =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly rejection: Rejection };

export interface AdvanceSummary {
  readonly creditedMs: number;
  readonly clipped: boolean;
  readonly understandingEarned: NumTuple;
}

export interface View {
  readonly understanding: Num;
  readonly rate: Num;
}

export function understandingNow(course: CourseData, state: GameState): Num {
  throw new Error('not implemented');
}

export function integrate(state: GameState, elapsedMs: number): GameState {
  throw new Error('not implemented');
}

export function advance(
  course: CourseData,
  state: GameState,
  now: WallMs,
): { readonly state: GameState; readonly summary: AdvanceSummary } {
  throw new Error('not implemented');
}

export function view(course: CourseData, state: GameState, now: WallMs): View {
  throw new Error('not implemented');
}

export function listen(course: CourseData, state: GameState): GameState {
  throw new Error('not implemented');
}

export function buyEncounter(
  course: CourseData,
  state: GameState,
  id: string,
  count: number,
): Result {
  throw new Error('not implemented');
}
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run packages/core/test/sim.test.ts`
Expected: `Tests  38 failed (38)`. Every failure is the stub: 32 fail with `Error: not implemented`, the two fast-check properties report `Caused by: Error: not implemented`, and the four `refuses an elapsed time of …` cases fail with `but got 'not implemented'`. The `advance (AC7)` group fails test by test, because its state is built in `beforeEach`, not while the file is collected.

- [ ] **Step 4: Implement**

`packages/core/src/state.ts`:

```ts
/**
 * The game state and its anchor (M1 design §2.2, §2.3, §4).
 *
 * State is plain, serialisable data: integer-millisecond clocks, `Num`s as
 * `[mantissa, exponent]` tuples, counts as integers. Every stored quantity is
 * its value at the **anchor**, the simulated time of the last event; values at
 * any later time are derived and never stored. That is what makes splitting
 * an interval unable to change any stored arithmetic.
 */
import { simMs, type SimMs, type WallMs } from './clock';
import { Num, type NumTuple } from './num';

export interface Anchor {
  /** The simulated time the stored quantities hold at. */
  readonly sim: SimMs;
  readonly understanding: NumTuple;
}

export interface GameState {
  /** The simulated (economy) clock. */
  readonly sim: SimMs;
  /** The latest wall-clock time seen: drives memory and the calendar. */
  readonly wall: WallMs;
  readonly anchor: Anchor;
  /** Encounters owned, by id. An id that is absent is owned 0 times. */
  readonly owned: Readonly<Record<string, number>>;
}

/** A new game at wall time `wall`: nothing owned, no Understanding. */
export function initialState(wall: WallMs): GameState {
  const start = simMs(0);
  return {
    sim: start,
    wall,
    anchor: { sim: start, understanding: Num.toTuple(Num.from(0)) },
    owned: {},
  };
}

/** How many of Encounter `id` the state owns. Reads own keys only. */
export function ownedCount(state: GameState, id: string): number {
  return Object.hasOwn(state.owned, id) ? (state.owned[id] ?? 0) : 0;
}
```

`packages/core/src/production.ts`:

```ts
/**
 * Production over simulated time (M1 design §2.2).
 *
 * The rate is constant inside each clock hour. In #27 nothing varies it
 * between events at all (there are no word or global multipliers yet), so
 * production over any span between two events is the rate times its length.
 * #28 makes the rate vary by hour bucket (each word's mean retrievability over
 * the bucket) and sums bucket by bucket from there.
 */
import type { SimMs } from './clock';
import type { CourseData } from './course';
import { encounterOutput } from './encounters';
import { Num } from './num';
import { ownedCount, type GameState } from './state';

const THOUSAND = Num.from(1000);

/** Understanding per second from every owned Encounter (parent §3.2). */
export function encounterRate(course: CourseData, state: GameState): Num {
  let rate = Num.from(0);
  for (const region of course.regions) {
    for (const encounter of region.encounters) {
      const owned = ownedCount(state, encounter.id);
      if (owned > 0) rate = Num.add(rate, encounterOutput(encounter, owned));
    }
  }
  return rate;
}

/** Understanding produced over `[from, to)` by the state's owned Encounters. */
export function producedBetween(
  course: CourseData,
  state: GameState,
  from: SimMs,
  to: SimMs,
): Num {
  if (to < from) {
    throw new RangeError(
      `producedBetween: ${String(to)} is before ${String(from)}`,
    );
  }
  const rate = encounterRate(course, state);
  return Num.div(Num.mul(rate, Num.from(to - from)), THOUSAND);
}
```

`packages/core/src/sim.ts`:

```ts
/**
 * The time model and the Encounter actions (M1 design §2.2, §2.3, §4).
 *
 * `integrate` is the pure, uncapped primitive: it moves both clocks by the
 * same amount and touches nothing else, because every stored quantity is
 * held at the anchor. `advance` is what a returning player gets: elapsed wall
 * time clamped to `[0, offline cap]`. `view` derives "now" values without
 * changing state. Actions act at the state's own simulated time; a caller
 * advances to the event's wall time first.
 */
import { BALANCE } from './balance';
import { simMs, wallMs, type WallMs } from './clock';
import type { CourseData, Encounter } from './course';
import { purchaseCost } from './encounters';
import { Num, type NumTuple } from './num';
import { encounterRate, producedBetween } from './production';
import { ownedCount, type GameState } from './state';

export type Rejection =
  | { readonly kind: 'unknownEncounter'; readonly id: string }
  | { readonly kind: 'invalidCount'; readonly count: number }
  | {
      readonly kind: 'unaffordable';
      readonly cost: NumTuple;
      readonly understanding: NumTuple;
    };

export type Result =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly rejection: Rejection };

export interface AdvanceSummary {
  /** Simulated time credited: the elapsed wall time, clamped. */
  readonly creditedMs: number;
  /** Whether the offline cap cut the credit short. */
  readonly clipped: boolean;
  readonly understandingEarned: NumTuple;
}

export interface View {
  readonly understanding: Num;
  /** Understanding per second. */
  readonly rate: Num;
}

/** Understanding at the state's simulated time: the anchor's, plus production since. */
export function understandingNow(course: CourseData, state: GameState): Num {
  return Num.add(
    Num.fromTuple(state.anchor.understanding),
    producedBetween(course, state, state.anchor.sim, state.sim),
  );
}

/** Move the anchor to the state's simulated time, holding the same values. */
function reanchor(course: CourseData, state: GameState): GameState {
  return {
    ...state,
    anchor: {
      sim: state.sim,
      understanding: Num.toTuple(understandingNow(course, state)),
    },
  };
}

/** Move both clocks forward by `elapsedMs`, uncapped (design §2.3). */
export function integrate(state: GameState, elapsedMs: number): GameState {
  const elapsed = simMs(elapsedMs);
  return {
    ...state,
    sim: simMs(state.sim + elapsed),
    wall: wallMs(state.wall + elapsed),
  };
}

/**
 * Bring the state to wall time `now` (design §2.3): the elapsed wall time,
 * clamped to `[0, offline cap]`, is credited to both clocks, and the wall
 * clock becomes `max(wall, now)`. When the cap clips, the wall clock runs on
 * past the simulated one; that changes the skew between them, so the state
 * is re-anchored first (the skew only ever changes at an anchor).
 */
export function advance(
  course: CourseData,
  state: GameState,
  now: WallMs,
): { readonly state: GameState; readonly summary: AdvanceSummary } {
  const elapsed = now - state.wall;
  const cap = BALANCE.offline.capMs;
  const credited = Math.min(Math.max(elapsed, 0), cap);
  let next = integrate(state, credited);
  const clipped = elapsed > cap;
  if (clipped) next = { ...reanchor(course, next), wall: now };
  const earned = Num.sub(
    understandingNow(course, next),
    understandingNow(course, state),
  );
  return {
    state: next,
    summary: {
      creditedMs: credited,
      clipped,
      understandingEarned: Num.toTuple(earned),
    },
  };
}

/** The values at wall time `now`, derived without changing `state`. */
export function view(course: CourseData, state: GameState, now: WallMs): View {
  const at = advance(course, state, now).state;
  return {
    understanding: understandingNow(course, at),
    rate: encounterRate(course, at),
  };
}

/** One Listen tap: +1 Understanding (design §5). */
export function listen(course: CourseData, state: GameState): GameState {
  const anchored = reanchor(course, state);
  const understanding = Num.add(
    Num.fromTuple(anchored.anchor.understanding),
    Num.from(BALANCE.listen.understandingPerTap),
  );
  return {
    ...anchored,
    anchor: { ...anchored.anchor, understanding: Num.toTuple(understanding) },
  };
}

function findEncounter(course: CourseData, id: string): Encounter | undefined {
  for (const region of course.regions) {
    const found = region.encounters.find((e) => e.id === id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Buy `count` of Encounter `id` at the state's simulated time. */
export function buyEncounter(
  course: CourseData,
  state: GameState,
  id: string,
  count: number,
): Result {
  const encounter = findEncounter(course, id);
  if (encounter === undefined) {
    return { ok: false, rejection: { kind: 'unknownEncounter', id } };
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    return { ok: false, rejection: { kind: 'invalidCount', count } };
  }
  const owned = ownedCount(state, id);
  const cost = purchaseCost(encounter, owned, count);
  const anchored = reanchor(course, state);
  const understanding = Num.fromTuple(anchored.anchor.understanding);
  if (Num.cmp(understanding, cost) < 0) {
    return {
      ok: false,
      rejection: {
        kind: 'unaffordable',
        cost: Num.toTuple(cost),
        understanding: Num.toTuple(understanding),
      },
    };
  }
  return {
    ok: true,
    state: {
      ...anchored,
      anchor: {
        ...anchored.anchor,
        understanding: Num.toTuple(Num.sub(understanding, cost)),
      },
      owned: { ...anchored.owned, [id]: owned + count },
    },
  };
}
```

`packages/core/src/index.ts` (change):

```diff
diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts
index 686fbe8..499968e 100644
--- a/packages/core/src/index.ts
+++ b/packages/core/src/index.ts
@@ -28,6 +28,21 @@ export {
   type RngStreams,
 } from './rng';
 export { BALANCE, type Balance, type Rank } from './balance';
+export { encounterOutput, milestonesReached, purchaseCost } from './encounters';
+export { encounterRate, producedBetween } from './production';
+export {
+  advance,
+  buyEncounter,
+  integrate,
+  listen,
+  understandingNow,
+  view,
+  type AdvanceSummary,
+  type Rejection,
+  type Result,
+  type View,
+} from './sim';
+export { initialState, ownedCount, type Anchor, type GameState } from './state';
 export type {
   CardSet,
   Cefr,
```

- [ ] **Step 5: Run the tests and the gate**

Run: `npx vitest run packages/core/test/sim.test.ts`
Expected: `Tests  38 passed (38)`.
Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`
Expected: all pass; `test:unit` reports `Tests  461 passed (461)`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/state.ts packages/core/src/production.ts packages/core/src/sim.ts packages/core/src/index.ts packages/core/test/sim.test.ts
git commit -m "feat(core): anchored state, integrate, advance, view, Listen and purchases (Refs #27)"
```

- [ ] **Step 7: Verify every guard by mutation**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/sim.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `⏎` marks a line break and `(deleted)` means the line is removed.

| Id    | File                              | Change                                                                                                                                                                                                                          | Predicted (written first)                                                                                                     | Result       |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------ |
| M2.1  | `packages/core/src/state.ts`      | `return Object.hasOwn(state.owned, id) ? (state.owned[id] ?? 0) : 0;` → `return state.owned[id] ?? 0;`                                                                                                                          | 3 failed (reads owned counts from own keys only; Object.prototype member; over random sequences), 35 passed                   | as predicted |
| M2.2  | `packages/core/src/sim.ts`        | `    wall: wallMs(state.wall + elapsed),` → `    wall: state.wall,`                                                                                                                                                             | 2 failed (moves both clocks by the same amount; credits 1 hour in full), 36 passed                                            | as predicted |
| M2.3  | `packages/core/src/sim.ts`        | `Math.min(Math.max(elapsed, 0), cap)` → `Math.min(elapsed, cap)`                                                                                                                                                                | 2 failed (advances nothing for an hour back; over random sequences), 36 passed                                                | as predicted |
| M2.4  | `packages/core/src/sim.ts`        | `const clipped = elapsed > cap;` → `const clipped = elapsed >= cap;`                                                                                                                                                            | 1 failed (exactly the cap, without clipping), 37 passed                                                                       | as predicted |
| M2.5  | `packages/core/src/sim.ts`        | `if (clipped) next = { ...reanchor(course, next), wall: now };` → `if (clipped) next = { ...next, wall: now };`                                                                                                                 | 1 failed (caps 30 days at 24 hours), 37 passed                                                                                | as predicted |
| M2.6  | `packages/core/src/sim.ts`        | `  const cost = purchaseCost(encounter, owned, count);⏎  const anchored = reanchor(course, state);` → `  const cost = purchaseCost(encounter, owned, count);⏎  const anchored = state;`                                         | 1 failed (pays from Understanding produced since the anchor), 37 passed                                                       | as predicted |
| M2.7  | `packages/core/src/sim.ts`        | `export function listen(course: CourseData, state: GameState): GameState {⏎  const anchored = reanchor(course, state);` → `export function listen(course: CourseData, state: GameState): GameState {⏎  const anchored = state;` | 1 failed (adds exactly 1 to whatever is held), 37 passed                                                                      | as predicted |
| M2.8  | `packages/core/src/sim.ts`        | `if (Num.cmp(understanding, cost) < 0) {` → `if (Num.cmp(understanding, cost) <= 0) {`                                                                                                                                          | 1 failed (buys when Understanding equals the cost exactly), 37 passed                                                         | as predicted |
| M2.9  | `packages/core/src/sim.ts`        | `  if (!Number.isSafeInteger(count) \|\| count < 1) {` → `  if (count < 1) {`                                                                                                                                                   | 3 failed (rejects a count of 1.5; rejects a count of NaN; rejects a count of Infinity), 35 passed                             | as predicted |
| M2.10 | `packages/core/src/production.ts` | `  return Num.div(Num.mul(rate, Num.from(to - from)), THOUSAND);` → `  return Num.mul(rate, Num.from(to - from));`                                                                                                              | 3 failed (shows the anchored value plus production since; is linear at the Encounter rate; credits 1 hour in full), 35 passed | as predicted |
| M2.11 | `packages/core/src/production.ts` | `if (owned > 0) rate = Num.add(rate, encounterOutput(encounter, owned));` → `if (owned > 0) rate = encounterOutput(encounter, owned);`                                                                                          | 1 failed (sums the output of every owned Encounter), 37 passed                                                                | as predicted |
| M2.12 | `packages/core/src/sim.ts`        | `  const elapsed = simMs(elapsedMs);` → `  const elapsed = elapsedMs;`                                                                                                                                                          | 1 failed (refuses an elapsed time of -1), 37 passed                                                                           | as predicted |
| M2.13 | `packages/core/src/sim.ts`        | `if (Num.cmp(understanding, cost) < 0) {` → `if (false) {`                                                                                                                                                                      | 2 failed (rejects an unaffordable purchase; over random sequences), 36 passed                                                 | as predicted |
| M2.14 | `packages/core/src/sim.ts`        | `    sim: simMs(state.sim + elapsed),` → `    sim: simMs(state.sim + elapsed - (elapsed % 1000)),`                                                                                                                              | 3 failed (deep-equals integrate(s, a + b); moves both clocks by the same amount; is linear at the Encounter rate), 35 passed  | as predicted |

### Task 3: Stream independence over interleavings longer than 10

#26's "are independent" property asked for up to 60 draws, and fast-check's default size never generated more than 10 (measured: `fc.array(…, { maxLength: 60 })` over 2,000 samples gave mean length 4.8 and maximum 10). Interleavings longer than 10 had never been checked.

**Files:**

- Modify: `packages/core/test/rng.test.ts`

**Interfaces:** none (a test change).

- [ ] **Step 1: Ask for the length meant, and guard it**

`packages/core/test/rng.test.ts` (change):

```diff
diff --git a/packages/core/test/rng.test.ts b/packages/core/test/rng.test.ts
index 7675cbc..1429194 100644
--- a/packages/core/test/rng.test.ts
+++ b/packages/core/test/rng.test.ts
@@ -133,10 +133,12 @@ describe('named sub-streams', () => {
   });

   it('are independent: drawing from one never changes another', () => {
+    let longest = 0;
     fc.assert(
       fc.property(
-        fc.array(fc.constantFrom(...NAMES), { maxLength: 60 }),
+        fc.array(fc.constantFrom(...NAMES), { maxLength: 60, size: 'max' }),
         (order) => {
+          longest = Math.max(longest, order.length);
           let streams = createStreams(7, NAMES);
           const seen: Record<string, number[]> = {
             recall: [],
@@ -163,6 +165,10 @@ describe('named sub-streams', () => {
         },
       ),
     );
+    // fast-check's default size never generates more than 10 elements
+    // (measured, #27), whatever maxLength says: the property must reach
+    // longer interleavings than that.
+    expect(longest).toBeGreaterThan(10);
   });

   it('refuse an unknown name, a duplicate and a name outside [a-z0-9-]', () => {
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run packages/core/test/rng.test.ts`
Expected: `Tests  18 passed (18)`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/rng.test.ts
git commit -m "test(core): stream independence over interleavings of up to 60 draws (Refs #27)"
```

- [ ] **Step 4: Verify the guard by mutation**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/core/test/rng.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `⏎` marks a line break and `(deleted)` means the line is removed.

| Id   | File                             | Change                                                 | Predicted (written first)                                    | Result       |
| ---- | -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | ------------ |
| M3.1 | `packages/core/test/rng.test.ts` | `{ maxLength: 60, size: 'max' }` → `{ maxLength: 60 }` | 1 failed (drawing from one never changes another), 17 passed | as predicted |

### Task 4: Amend design §4 to the API as built

**Files:**

- Modify: `docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md` (§4)

- [ ] **Step 1: Make the change**

`docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md` (change):

```diff
diff --git a/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md b/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
index 395f5b5..b31097f 100644
--- a/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
+++ b/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
@@ -111,8 +111,8 @@ packages/bots        personas, the open scheduler, the pacing report, and the CI
 ## 4. Events, state and API

 - **Events** (all carry `wallMs` and a sequence number `seq`; `apply` first advances to `wallMs`, so an earlier `wallMs` is clamped exactly as §2.3 clamps a backwards clock, never rejected): `listen`, `buyEncounter {id, count}`, `pickUpWord`, `answerReview {itemId, correct, latencyMs, promptType}`, `answerPractice {itemId}`, `buyUpgrade {id}`, `startJourney {slot, durationId}`, `collectJourney {slot}`, `setSail`, `buyGrammarNode {id}`, `setAutomation {enabled, intervalMs}`. A review answer carries its latency for the bot signals (parent §10.4).
-- **API:** `initialState(course, seed, wallMs)`, `apply(state, event) → Result<GameState, Rejection>`, `advance(state, wallMs) → {state, summary}` (the summary feeds the "welcome back" card: time credited, whether the cap clipped it, Understanding earned, journeys returned), `integrate(state, elapsedMs)`, `view(state, wallMs)` (derived numbers, the review queue, rates with their multiplier breakdown for DN6, the unfold flags), and `stateHash(state)` (SHA-256 of a canonical serialisation, for the replay check in M5, computed synchronously with the pure-JS `@noble/hashes` (MIT), since WebCrypto is asynchronous and a global).
-- **Rejections are values, not throws.** An unaffordable purchase, a scored review of an item that is not due, or a `seq` that does not increase returns a typed `Rejection` and leaves state unchanged. M5's replay flags are exactly these rejections.
+- **API:** `initialState(wallMs)`, `apply(course, state, event) → Result<GameState, Rejection>`, `advance(course, state, wallMs) → {state, summary}` (the summary feeds the "welcome back" card: time credited, whether the cap clipped it, Understanding earned, journeys returned), `integrate(state, elapsedMs)`, `view(course, state, wallMs)` (derived numbers, the review queue, rates with their multiplier breakdown for DN6, the unfold flags), and `stateHash(state)` (SHA-256 of a canonical serialisation, for the replay check in M5, computed synchronously with the pure-JS `@noble/hashes` (MIT), since WebCrypto is asynchronous and a global). Amended in #27: a function that reads course data takes the course first, because state holds no content (a save stays small, and a replay supplies the course it ran against); `initialState` gains a seed with the first story that draws from the RNG (#30). The Encounter actions `apply` dispatches, `listen(course, state)` and `buyEncounter(course, state, id, count) → Result`, act at the state's own simulated time; `apply` (#36) advances to the event's `wallMs` and checks `seq` first.
+- **Rejections are values, not throws.** An unaffordable purchase, an unknown Encounter, a count that is not a positive integer, a scored review of an item that is not due, or a `seq` that does not increase returns a typed `Rejection` and leaves state unchanged. M5's replay flags are exactly these rejections.
 - **State is plain, serialisable data:** no classes, no `Num` instances inside state (stored as `[mantissa, exponent]` tuples), so a save is `JSON.stringify` and the hash is stable.

 ## 5. Game rules this design fixes
```

- [ ] **Step 2: Check and commit**

Run: `npm run format:check`
Expected: passes.

```bash
git add docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
git commit -m "docs(spec): M1 design §4 takes the course first and names the Encounter actions (Refs #27)"
```

## Finishing

1. Move #27 to In Progress on the board (project 4, title "Wordfarer Stories", asserted before the write).
2. Commit this plan on the story branch `m1/27-encounters` with the four task commits, push, and open a PR into `develop` with `Refs #27`.
3. Write the PR's head SHA to a file (`gh pr view <n> --json headRefOid -q .headRefOid > <file>`) and wait with `~/.claude/scripts/wait-run.sh <repo-dir> <run-id> <file>` on its CI run: it exits 0 only when the run completed with success on that SHA, and prints every step by name.
4. Merge into `develop` (no permission needed) and wait for the deploy-dev run on the merge commit the same way: `test`, `deploy` and `verify` must pass and `dev-verified` must be posted. The verify depends on #39's two dev passwords matching.
5. Post the AC evidence on #27 (this table, the CI and deploy run ids) and move #27 to Done.
