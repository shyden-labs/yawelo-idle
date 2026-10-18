# M1 #28: Words, Memory and the Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@wordfarer/core` its words and memory: FSRS-6 retrievability and its exact mean over a window; ranks, FSRS reviews, the review queue and Insight; words in game state, with each Encounter's output multiplied by the words that share its tags, hour bucket by hour bucket; and the pick-up, review and practice actions.

**Architecture:** Memory runs on the wall clock and the economy on the simulated one (M1 design §2.3). A word's bonus in an hour bucket uses its **exact** mean retrievability over that bucket, in closed form, so an hour with no event produces exactly what the continuous model does (design §2.2). The state holds one `memorySince`: each word's mean in a bucket starts at the later of the bucket's start and `memorySince`, which a review or a clipped return moves and a purchase does not. Every action that changes a stored quantity re-anchors first, so production up to the action is banked at the rates that held before it. FSRS is `ts-fsrs` with its FSRS-6 defaults and fuzz off, behind core's own `review`, and its bits are checked on Chromium, Firefox and WebKit by the golden-vector harness.

**Tech Stack:** Node 24, npm workspaces, TypeScript 6.0, Vitest 4.1, fast-check 4.10, decimal.js 10.6 (test reference only), `Num` over break_infinity.js 2.2.0, ts-fsrs 5.4.2 (new; MIT, added to `THIRD-PARTY-NOTICES.md`), Playwright 1.63 for the engines.

**Spec:** `docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md` (§2.1, §2.2, §2.3, §5, §7), with the parent `docs/superpowers/specs/2026-10-01-wordfarer-design.md` (§3.3, §3.4) for the bonus, ranks, queue and Insight. Story: #28.

## Global Constraints

- Node `>=24`; npm workspaces. Task 1 adds one dependency, `ts-fsrs` 5.4.2, pinned exactly.
- Zero warnings: lint `--max-warnings 0`, typecheck, Prettier, `npm ci` and `npm run build` (spec §12).
- `packages/core/src` reads no clock, timer, network or host object and calls no engine-approximated maths: every power, exponential and logarithm goes through `det-math` (M1 design §2.1, #26's lint ban). No `eslint-disable` there.
- State holds plain data only: a `Num` as its `[mantissa, exponent]` tuple, times as integer milliseconds, a word's FSRS card as numbers (M1 design §4).
- One test per case: a population known before the run is generated as one test each; a loop inside a test body carries `// runtime population:` or `// one scenario:` (#58). `BURN_DOWN` stays empty.
- Tests are written first and seen red against throwing stubs, each failing on its own assertion. Every guard is mutation-verified; each mutation's predicted failures are written before it runs.
- A property or reference test slower than about 1 s alone carries a named budget in its file (`PROPERTY_TIMEOUT_MS`, `REFERENCE_TIMEOUT_MS`), never a raised global timeout (#64, #72).
- Commit messages and PR bodies say `Refs #28`; never put close/fix/resolve next to an issue number. Commits are authored as Shyden.

## Review Focus

1. **A word id that is an `Object.prototype` member** (`toString`, `constructor`, `__proto__`, `hasOwnProperty`). The synthetic course has a word called `toString`; a player expects it to be picked up and answered like any other, and an id never picked up to be refused. `pickedWord` reads own keys only (M3.13, whose three catchers are the three prototype names).
2. **A return the offline cap clips in the middle of an hour.** The wall clock runs on past the simulated one, so every word's mean must restart at the clip, or the rest of that hour is paid at the wrong R. M3.16 survived the whole suite until Task 3's clipped-return test was written (1.46e-6 relative off the continuous model under the mutation, against a 1e-12 bound).
3. **An empty pool when the player also cannot pay.** The player must be told the pool is empty, not that they cannot afford a word that does not exist. M3.14 survived until Task 3's test empties the pool of a player holding 15.15 against a sixth pick-up's 40.23.
4. **A float bound that holds in exact maths and not in floats.** Over a 1 ns window 100,000 days out, R at both ends and the mean agree to an ulp, so the "mean lies between" property failed 6 times in 2,000,000 runs. Task 1 states it to AC3's accuracy (1e-14) and keeps the found case as its own test.
5. **FSRS bits on every engine with the parameters that ship.** M1 design §2.1 measured the scheduler across engines with short-term steps off; core ships them on. Task 4 hashes core's own `review` over 100,000 seeded reviews on Chromium, Firefox and WebKit. Putting `Math.exp` into the review turned WebKit red, and Chromium too: its `Math.exp` bits differ from Node's (E1, E2).
6. **A property that never reaches the states it is about.** The random review histories count their correct steps (over 1,000), the game sequences count pick-ups (over 300) and answers (over 1,000), so a generator that stopped producing them fails rather than passing on nothing.

## Decisions this plan makes

- **One `memorySince` per state.** Each word's hour mean starts at `max(bucketStart, memorySince)`. A review or a clipped return moves it; a purchase does not, so a bucket's per-word means are reused across a purchase (design §2.2.3, amended in Task 5). A pick-up moves nothing: a new word has R = 0, so its bonus is its floor whatever the window.
- **The shifted form for a window that starts after the review:** `mean(S, a, T) = R(S, a) · mean₀(S + F·a, T)`. The difference of two integrals loses up to 0.58% (at `a` = 100 years, `T` = 1 ms); the shifted form's worst row against the 30-digit table is 1.19e-15 (design §2.2.4, amended in Task 5).
- **A never-reviewed word has R = 0**, as ts-fsrs gives a new card, so its bonus sits exactly on the floor, `0.5 · rankBonus[rank]` (AC4).
- **ts-fsrs defaults, fuzz off.** Learning steps of 1 and 10 minutes; `elapsed_days` is not stored, because ts-fsrs recomputes it from `last_review` (Task 2 checks equal results with the true value passed).
- **Insight is paid by the rank the word was asked at**, before the answer moves it. Every wrong answer drops exactly one rank, Heard staying Heard.
- **The pick-up cost's `n` counts the current destination's picked items**, so a new destination starts at 20 again (design §5, added in Task 5). `currentDestination` is region 0's first destination until #31 adds Set Sail.
- **Production walks hour buckets**, so `understandingNow` costs O(hours since the anchor). The AC6 associativity property spans up to 216 h and runs under `PROPERTY_TIMEOUT_MS`: 1.3 s alone, against 53 ms before buckets.

## Acceptance criteria → tasks (#28)

| AC  | What                                                                                                                          | Task | Proved by                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pickUpWord` spends Understanding and takes the next item in curriculum order; refused when unaffordable or the pool is empty | 3    | `words.test.ts` "picking up a word (AC1)", M3.5 to M3.7, M3.14, `pickup-3`                                                                                                                                                          |
| 2   | bonus `rankBonus · (0.5 + 0.5·R̄)`, R̄ the exact hour mean on the wall clock; `M_words`                                         | 3    | `words.test.ts` "the word bonus (AC2)", M3.1, M3.2, M3.4, M3.11, M3.12, `bonus-fluent-half`                                                                                                                                         |
| 3   | mean R to 1e-12 against a 30-digit reference table                                                                            | 1    | `memory.test.ts` "the mean retrievability over a window (AC3)", M1.1 to M1.6, `ref-row-stored`, `ref-row-agrees`, `refuse-span-neg1`, `refuse-start-neg1`                                                                           |
| 4   | floor `0.5 · rankBonus`, never below it; ranks never fall through absence                                                     | 3    | `words.test.ts` "the floor (AC4)", M3.3, `floor-mastered`, `floor-falls-1-30`                                                                                                                                                       |
| 5   | FSRS-6 defaults, fuzz off; Good and Again; thresholds 2/7/14/30 d; one step down on a lapse                                   | 1, 2 | `memory.test.ts` "the FSRS-6 forgetting curve", `review.test.ts` "ranks", "a picked-up word", "a review (AC5)", M2.1 to M2.7, M2.13, `threshold-14`, `r90-at-2.3065`, `falls-30-365`, `refuse-stability-inf`, `refuse-elapsed-1e-9` |
| 6   | queue of at most 10, lowest R first, ties by id; no backlog count                                                             | 2, 3 | `review.test.ts` "the review queue (AC6)", "due items", `words.test.ts` "the view (AC6, DN23)", M2.8 to M2.11                                                                                                                       |
| 7   | a correct due answer gives `1 + 0.5 · rankIndex` Insight; a wrong one costs nothing; not due → `Rejection`                    | 2, 3 | `review.test.ts` "Insight for a correct due answer (AC7)", `words.test.ts` "answering a review (AC5, AC7)", M2.12, M3.8 to M3.10, M3.13, `insight-both`, `refuse-nope`                                                              |
| 8   | `answerPractice` changes no currency, no FSRS state and no rank                                                               | 3    | `words.test.ts` "practice (AC8)", M3.15, `practice-toString`                                                                                                                                                                        |
| 9   | after a capped 30-day absence, R reflects 30 days and Understanding the cap                                                   | 3    | `words.test.ts` "memory ages on the wall clock (AC9)", M3.16                                                                                                                                                                        |

## How this plan was reviewed

The plan was reviewed by **executing it**. Each task is one cumulative commit (a stage) on top of `develop` `4289892`, and the last stage's tree is byte-identical to the story branch's head. Every stage was checked out alone, installed with a clean `npm ci` (no warnings) and run through every CI build step (format, lint, typecheck, unit, Worker tests, build). Tasks 1 to 3 were run red against their throwing stubs at their own stage. Every mutation was run against the whole unit suite at the final stage, with its predicted failures written first; Task 4's engine mutations ran on Chromium, Firefox and WebKit.

- **Pass 1 (execution)** (2026-10-02). Stages T1 to T5 pass alone (unit tests 2943, 2983, 3049, 3056, 3064). Red runs: T1 `179 failed | 151 passed (330)`, T2 `40 failed (40)`, T3 `67 failed | 62 passed (129)`, each pass accounted for (the reference-table checks, which call no code under test, and #27's own tests). 51 unit mutations and 2 engine mutations. 12 found and fixed: (1) the story branch's Task 1 to 3 commits predated the one-test-per-case split, so none could pass the gate alone; the stages were rebuilt with the split tests from the start. (2) The 19 looped sites the guard named were split: 9 → 329 tests in `memory.test.ts`, 30 → 40 in `review.test.ts`, 33 → 63 in `words.test.ts`; two loops that carry state are marked `// one scenario:`. (3) The split left 11 mutation predictions naming tests that no longer existed (M1.1 to M1.6, M2.3, M2.7, M3.3, M3.6, M3.13); each now names the generated tests. M2.3's slipped past a staleness check that matched a substring of the correct-answer case's title while the mutation hits the wrong-answer case. (4) M3.14 (the pool check after the cost check) and M3.16 (a clipped return keeping `memorySince`) survived the whole suite; Task 3 gained a test for each. (5) The "mean lies between R at the window's ends" property failed 6 times in 2,000,000 runs, one ulp out over a 1 ns window; it is now bounded to AC3's accuracy, with the found case as its own test. (6) AC6's associativity property timed out at 5 s in the full suite once production walked hour buckets (1341 ms alone, against 53 ms on `develop`); it runs under `PROPERTY_TIMEOUT_MS`. (7) A one-case mutation, Hard for Again, was predicted to fail one test and failed six: Hard raises S where each lapse test asserts it falls. It duplicated M2.3 and was removed; M2.3 carries the full prediction. (8) Two predictions were written before the tests that also catch them (Task 4's review digest, Task 3's clipped-return test); both were updated and re-run exact. (9) The AC table cited three `describe` names that do not exist; corrected, and a check now reads every cited name against the tests. (10) The plan generator would have taken T5 as the stage before T1 (a negative index); a `T0` base was added and the lookup refuses the first stage. (11) An explanation of Firefox's engine result was written as if measured; it now says only what was measured. (12) `digests()` lost its one caller when the pins became one test per function, and was removed.
- **Pass 2** (2026-10-02). Mechanical: all 27 generated code blocks equal their stage or stub byte for byte, and a planted one-character change (`decoy` for `decay` in Task 1's module) is reported (1 differs, exit 1); Prettier clean at the tracked path, not ignored; every cited `describe` name exists. Read the whole document outside the code blocks. Found 5: (1) AC5's row cited `wrong-as-hard-corrected`, removed in pass 1; the check now also reads every cited mutation id against the four tables, and reported this one when run against the plan as it stood. (2) Task 1 installed ts-fsrs in Step 4, after Step 3's red run, though `memory.test.ts` imports it: run in that order, Step 3 fails on the import rather than on the tests' own assertions. The install moves to Step 2. (3) Task 5's expected red message for `RANKS` read `[ …(5) ]`; rerunning the test at stage T4 prints `[ 'heard', 'recognised', …(3) ]`. (4) The three GREEN lines lacked their full stops. (5) The placeholder scan matched the 38 diff hunk headers (`@@ -23,6 …`), so a real leftover marker would have hidden among them; it now matches only the generator's own markers (a planted `@@ T1 x` is caught) and allows Task 4's placeholder digest only in its two prose lines.
- **Pass 3** (2026-10-02). Mechanical checks re-run on the text pass 2 left: 27 blocks equal, 51 cited mutation ids and every cited `describe` name found, no generator marker left, Prettier clean. Read every line pass 2 changed (Task 1's Steps 2 and 4, the three GREEN lines, Task 5's red message, AC5's row, the pass 2 entry) and checked Tasks 3 to 5 for the ordering defect pass 2 found in Task 1: Task 4's pins go red only after Step 2 extends the harness, as its Step 3 says, and Task 5's red was reproduced at stage T4. **No findings: plan approved** under the house rule.

---

### Task 1: FSRS-6 retrievability and its exact mean over a window

**Files:**

- Create: `packages/core/src/memory.ts`, `packages/core/test/memory.test.ts`, `packages/core/test/mean-r-reference.ts`
- Modify: `packages/core/package.json` (ts-fsrs 5.4.2), `package-lock.json`, `THIRD-PARTY-NOTICES.md`, `packages/core/src/clock.ts` (`DAY_MS`)

**Interfaces:**

- Consumes: `exp`, `expm1`, `log1p`, `pow` from `det-math.ts`; `generatorParameters` from ts-fsrs (for `w[20]`, the FSRS-6 decay).
- Produces: `DECAY: number` (0.1542), `FACTOR: number`, `retrievability(stabilityDays: number, elapsedDays: number): number`, `meanRetrievability(stabilityDays: number, fromDays: number, spanDays: number): number`. Each throws `RangeError` for a stability that is not positive and finite, an elapsed time or window start that is negative or not finite, or a span that is not positive and finite.

- [ ] **Step 1: Write the failing tests and the reference table**

`packages/core/test/memory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import Decimal from 'decimal.js';
import { generatorParameters } from 'ts-fsrs';
import { DAY_MS } from '../src/clock';
import {
  DECAY,
  FACTOR,
  meanRetrievability,
  retrievability,
} from '../src/memory';
import { MEAN_R_REFERENCE } from './mean-r-reference';

/**
 * Memory maths (#28 AC3): FSRS-6 retrievability and its exact mean over a
 * window, which production uses for each word's bonus in an hour bucket.
 */

const D = Decimal.clone({ precision: 60 });

/** The exact mean over [from, from + span] days, by the subtraction of two integrals. */
function exactMean(s: number, fromDays: number, spanDays: number): Decimal {
  // The literal, not DECAY: the reference must not move with the code.
  const d = new D(0.1542);
  const f = new D('0.9').pow(new D(-1).div(d)).minus(1);
  const e = new D(1).minus(d);
  const integral = (t: Decimal): Decimal =>
    new D(s).div(f.mul(e)).mul(f.mul(t).div(s).plus(1).pow(e).minus(1));
  const from = new D(fromDays);
  const span = new D(spanDays);
  return integral(from.plus(span)).minus(integral(from)).div(span);
}

function relative(got: number, want: Decimal | string): number {
  const w = new D(want);
  return new D(got).minus(w).div(w).abs().toNumber();
}

describe('the FSRS-6 forgetting curve', () => {
  it('uses the scheduler’s own decay, w[20] = 0.1542', () => {
    expect(DECAY).toBe(0.1542);
    expect(DECAY).toBe(generatorParameters().w[20]);
  });

  it('has the factor that puts R at 90% when t equals S', () => {
    expect(
      relative(FACTOR, new D('0.9').pow(new D(-1).div(0.1542)).minus(1)),
    ).toBeLessThan(1e-15);
  });

  for (const s of [0.01, 1, 2.3065, 365])
    it(`puts R at 90% when t equals S = ${String(s)}`, () => {
      expect(retrievability(s, s)).toBeCloseTo(0.9, 14);
    });

  it('is 1 at the review', () => {
    expect(retrievability(3, 0)).toBe(1);
  });

  for (const [earlier, later] of [
    [0, 1e-9],
    [1e-9, 1],
    [1, 30],
    [30, 365],
    [365, 36525],
    [36525, 1e9],
  ] as const)
    it(`falls from t = ${String(earlier)} to t = ${String(later)} and stays above 0`, () => {
      const r = retrievability(3, later);
      expect(r).toBeLessThan(retrievability(3, earlier));
      expect(r).toBeGreaterThan(0);
    });

  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses stability ${String(bad)}`, () => {
      expect(() => retrievability(bad, 1)).toThrow(/stability/);
    });

  for (const bad of [-1e-9, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses elapsed time ${String(bad)}`, () => {
      expect(() => retrievability(1, bad)).toThrow(/elapsed/);
    });
});

describe('the mean retrievability over a window (AC3)', () => {
  it('stores 150 reference rows: 5 stabilities × 6 spans × 5 window starts', () => {
    expect(MEAN_R_REFERENCE).toHaveLength(150);
    const spans = new Set(MEAN_R_REFERENCE.map((r) => r[2]));
    expect([...spans].sort((a, b) => a - b)).toEqual([
      1,
      1000,
      3_600_000,
      DAY_MS,
      30 * DAY_MS,
      36_525 * DAY_MS,
    ]);
    const stabilities = new Set(MEAN_R_REFERENCE.map((r) => r[0]));
    expect([...stabilities].sort((a, b) => a - b)).toEqual([
      0.01, 0.5, 2, 30, 365,
    ]);
    expect(MEAN_R_REFERENCE.filter((r) => r[1] === 0)).toHaveLength(30);
  });

  for (const [s, fromMs, spanMs, mean] of MEAN_R_REFERENCE) {
    const row = `S=${String(s)} from=${String(fromMs)} span=${String(spanMs)}`;

    it(`stores ${row} to 30 significant digits of the exact value`, () => {
      const exact = exactMean(s, fromMs / DAY_MS, spanMs / DAY_MS);
      expect(mean).toBe(exact.toSignificantDigits(30).toString());
    });

    it(`agrees with ${row} to 1e-12 relative`, () => {
      const got = meanRetrievability(s, fromMs / DAY_MS, spanMs / DAY_MS);
      const error = relative(got, mean);
      expect(error).toBeLessThan(1e-12);
      // Measured 2026-10-02: worst row 1.19e-15. The bound above is the AC's;
      // this shows the margin.
      expect(error).toBeLessThan(1e-14);
    });
  }

  // The mean lies between R at the window's ends exactly; the computed values
  // meet that to the accuracy AC3 pins, since over a window of nanoseconds
  // R(from), the mean and R(from + span) agree to an ulp or two.
  const ROUNDING = 1e-14;

  it('lies between R at the window’s end and R at its start', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 36_500, noNaN: true }),
        fc.double({ min: 0, max: 1e5, noNaN: true }),
        fc.double({ min: 1e-9, max: 1e5, noNaN: true }),
        (s, from, span) => {
          const mean = meanRetrievability(s, from, span);
          expect(mean).toBeLessThanOrEqual(
            retrievability(s, from) * (1 + ROUNDING),
          );
          expect(mean).toBeGreaterThanOrEqual(
            retrievability(s, from + span) * (1 - ROUNDING),
          );
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('lies between them over a 1 ns window 100,000 days out, where R barely moves', () => {
    // Found by the property above (6 in 2,000,000 runs, 2026-10-02).
    const [s, from, span] = [
      0.002616681480501123, 99999.99999999977, 1.0000000000000034e-9,
    ];
    const mean = meanRetrievability(s, from, span);
    expect(mean).toBeLessThanOrEqual(retrievability(s, from) * (1 + ROUNDING));
    expect(mean).toBeGreaterThanOrEqual(
      retrievability(s, from + span) * (1 - ROUNDING),
    );
  });

  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses span ${String(bad)} and stability ${String(bad)}`, () => {
      expect(() => meanRetrievability(1, 0, bad)).toThrow(/span/);
      expect(() => meanRetrievability(bad, 0, 1)).toThrow(/stability/);
    });

  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses a window starting at ${String(bad)} days`, () => {
      expect(() => meanRetrievability(1, bad, 1)).toThrow(/elapsed/);
    });
});
```

The reference table (150 rows, each to 30 significant digits, computed offline with decimal.js at 60 digits):

`packages/core/test/mean-r-reference.ts`:

```ts
/**
 * Mean FSRS-6 retrievability, the reference for #28 AC3.
 *
 * Each row is [stability in days, window start in ms after the review,
 * window length in ms, exact mean over the window]. The means were computed
 * offline with decimal.js at 60 significant digits from the integral of
 * R(t) = (1 + F t / S)^(-d), as I(start + span) - I(start) over span, and
 * are printed to 30. That is the subtraction the closed form avoids; at 60
 * digits it still leaves more than 40. memory.test.ts recomputes every row,
 * so an edited row fails.
 */
export const MEAN_R_REFERENCE: readonly (readonly [
  stabilityDays: number,
  fromMs: number,
  spanMs: number,
  mean: string,
])[] = [
  [0.01, 0, 1, '0.999999912517729486777365422071'],
  [0.01, 0, 1000, '0.999912555857647484830125426275'],
  [0.01, 0, 3600000, '0.855881411814645915446172988263'],
  [0.01, 0, 86400000, '0.575956340895233418800914965503'],
  [0.01, 0, 2592000000, '0.344753149026028294597715584043'],
  [0.01, 0, 3155760000000, '0.115374287460765267968258343928'],
  [0.5, 0, 1, '0.99999999825035384121847646488'],
  [0.5, 0, 1000, '0.99999825036910162402844800274'],
  [0.5, 0, 3600000, '0.993890963629687252361481708693'],
  [0.5, 0, 86400000, '0.907167360143885499743186123785'],
  [0.5, 0, 2592000000, '0.619727408280550931011797840634'],
  [0.5, 0, 3155760000000, '0.210893152734377274102806424895'],
  [2, 0, 1, '0.999999999562588457440393889356'],
  [2, 0, 1000, '0.99999956258941122449198061644'],
  [2, 0, 3600000, '0.99843755752649861220984765213'],
  [2, 0, 86400000, '0.967889536317592362214139467769'],
  [2, 0, 2592000000, '0.745399167527919823694026551805'],
  [2, 0, 3155760000000, '0.261119733415881356349235605717'],
  [30, 0, 1, '0.999999999970839230436620105723'],
  [30, 0, 1000, '0.999999970839234675672644442602'],
  [30, 0, 3600000, '0.999895076182390692702628565057'],
  [30, 0, 86400000, '0.997511639325501972110107618765'],
  [30, 0, 2592000000, '0.943479840455781508181882452307'],
  [30, 0, 3155760000000, '0.395826090769452233495045683187'],
  [365, 0, 1, '0.999999999997603224419128129299'],
  [365, 0, 1000, '0.99999999760322444776500694305'],
  [365, 0, 3600000, '0.999991371979391812245440733184'],
  [365, 0, 86400000, '0.999793132267940633557726970837'],
  [365, 0, 2592000000, '0.99397219128227020036405221601'],
  [365, 0, 3155760000000, '0.575899078989175279541417329915'],
  [0.01, 3600000, 1, '0.778202932547067631512938930772'],
  [0.01, 3600000, 1000, '0.778189558299484697368437948549'],
  [0.01, 3600000, 3600000, '0.740572476585673475484523583731'],
  [0.01, 3600000, 86400000, '0.560743828577049124200759491899'],
  [0.01, 3600000, 2592000000, '0.343969705090573201542414036268'],
  [0.01, 3600000, 3155760000000, '0.115373422416736016341887840338'],
  [0.5, 3600000, 1, '0.987963732470762327079394778846'],
  [0.5, 3600000, 1000, '0.987962136047034321098532310431'],
  [0.5, 3600000, 3600000, '0.982371481576845770659713986079'],
  [0.5, 3600000, 86400000, '0.900926232214052263877901828091'],
  [0.5, 3600000, 2592000000, '0.619085981632447774618489327344'],
  [0.5, 3600000, 3155760000000, '0.210892222428561670333860986426'],
  [2, 3600000, 1, '0.99688722104383812058731204142'],
  [2, 3600000, 1000, '0.996886794149679884939376043866'],
  [2, 3600000, 3600000, '0.995360580858586978928273802221'],
  [2, 3600000, 86400000, '0.965427797197356514271901471983'],
  [2, 3600000, 2592000000, '0.744920675024188900827329746261'],
  [2, 3600000, 3155760000000, '0.261118846421824876160609840813'],
  [30, 3600000, 1, '0.999790207248244025188104356228'],
  [30, 3600000, 1000, '0.999790178162354188482106074351'],
  [30, 3600000, 3600000, '0.999685448036732783016209082847'],
  [30, 3600000, 86400000, '0.997305709922474103748534366085'],
  [30, 3600000, 2592000000, '0.943341031049058264792622889104'],
  [30, 3600000, 3155760000000, '0.395825332671645667424534546175'],
  [365, 3600000, 1, '0.999982744327847825146887100973'],
  [365, 3600000, 1000, '0.999982741933778289491311363841'],
  [365, 3600000, 3600000, '0.999974117423928566167230073268'],
  [365, 3600000, 86400000, '0.999775903291883002053926992748'],
  [365, 3600000, 2592000000, '0.993955694311183111191990147049'],
  [365, 3600000, 3155760000000, '0.575898499796337696537671925436'],
  [0.01, 86400000, 1, '0.492322425148045641425115982087'],
  [0.01, 86400000, 1000, '0.492321990691587130917565928181'],
  [0.01, 86400000, 3600000, '0.490781116178222821676022701031'],
  [0.01, 86400000, 86400000, '0.464288051219698882768696135824'],
  [0.01, 86400000, 2592000000, '0.335257693947617903665085748739'],
  [0.01, 86400000, 3155760000000, '0.115361190329416177230848790451'],
  [0.5, 86400000, 1, '0.845884644649550981216674037521'],
  [0.5, 86400000, 1000, '0.845884145268333321243772056279'],
  [0.5, 86400000, 3600000, '0.844103893313689582008286111805'],
  [0.5, 86400000, 86400000, '0.81090598218920789191937420867'],
  [0.5, 86400000, 2592000000, '0.607181554691002818257151958433'],
  [0.5, 86400000, 3155760000000, '0.210873199747783884825173472572'],
  [2, 86400000, 1, '0.94034428861690279637670031096'],
  [2, 86400000, 1000, '0.940344012873442971208031085571'],
  [2, 86400000, 3600000, '0.939355818640838257814904464588'],
  [2, 86400000, 86400000, '0.919070144593970654149625436846'],
  [2, 86400000, 2592000000, '0.734883961256417224091021773106'],
  [2, 86400000, 3155760000000, '0.261099281905531348546921433211'],
  [30, 86400000, 1, '0.995053873205150702539811386605'],
  [30, 86400000, 1000, '0.99505384513491970829747384499'],
  [30, 86400000, 3600000, '0.994952770509721851708562937703'],
  [30, 86400000, 86400000, '0.992655239504625019223285547609'],
  [30, 86400000, 2592000000, '0.940191525237059142306928995611'],
  [30, 86400000, 3155760000000, '0.395807961658482046597698316456'],
  [365, 86400000, 1, '0.999586477903139978843956380228'],
  [365, 86400000, 1000, '0.999586475516162467722694858456'],
  [365, 86400000, 3600000, '0.999577876554008656127777551825'],
  [365, 86400000, 86400000, '0.999380249052649352358129376609'],
  [365, 86400000, 2592000000, '0.993576828876930680086399989731'],
  [365, 86400000, 3155760000000, '0.575885183761591870204459360098'],
  [0.01, 2592000000, 1, '0.291833001431916168010156994312'],
  [0.01, 2592000000, 1000, '0.291832992762865037291880640227'],
  [0.01, 2592000000, 3600000, '0.291801778286978879527962044448'],
  [0.01, 2592000000, 86400000, '0.291092688542921690822019906389'],
  [0.01, 2592000000, 2592000000, '0.275089601453873473995861464286'],
  [0.01, 2592000000, 3155760000000, '0.115171268567658216014101287317'],
  [0.5, 2592000000, 1, '0.532119776191283426464376996818'],
  [0.5, 2592000000, 1000, '0.532119760643341338449202418643'],
  [0.5, 2592000000, 3600000, '0.532063776995414619622412195635'],
  [0.5, 2592000000, 86400000, '0.530791752457442117103809657764'],
  [0.5, 2592000000, 2592000000, '0.501975013148084092349541796294'],
  [0.5, 2592000000, 3155760000000, '0.210530644480017155763864805502'],
  [2, 2592000000, 1, '0.653988494191173921121993862148'],
  [2, 2592000000, 1000, '0.653988475994903779087511039958'],
  [2, 2592000000, 3600000, '0.653922954840234126139213088726'],
  [2, 2592000000, 86400000, '0.652433348172514374123996106785'],
  [2, 2592000000, 2592000000, '0.618313960408402244392445311483'],
  [2, 2592000000, 3155760000000, '0.260688920632294655494766892842'],
  [30, 2592000000, 1, '0.899999999986747423906387988708'],
  [30, 2592000000, 1000, '0.8999999867474248792001360453'],
  [30, 2592000000, 3600000, '0.899952303341655446039405597056'],
  [30, 2592000000, 86400000, '0.898862182763830995861503917894'],
  [30, 2592000000, 2592000000, '0.870854879831989491304489795264'],
  [30, 2592000000, 3155760000000, '0.395326579899730832715348721215'],
  [365, 2592000000, 1, '0.988121442620101563827297161199'],
  [365, 2592000000, 1000, '0.988121440430587744997689515261'],
  [365, 2592000000, 3600000, '0.988113552796687607600570653797'],
  [365, 2592000000, 86400000, '0.987932260107755025228160182483'],
  [365, 2592000000, 2592000000, '0.982597267875178881284451777564'],
  [365, 2592000000, 3155760000000, '0.575486978728437670755632658818'],
  [0.01, 3155760000000, 1, '0.0975838243554962966409430223592'],
  [0.01, 3155760000000, 1000, '0.0975838243531145606898694729464'],
  [0.01, 3155760000000, 3600000, '0.0975838157726701905316798907256'],
  [0.01, 3155760000000, 86400000, '0.0975836183696942349169742509213'],
  [0.01, 3155760000000, 2592000000, '0.0975776466681925404114991607543'],
  [0.01, 3155760000000, 3155760000000, '0.0919836680889444896874990746705'],
  [0.5, 3155760000000, 1, '0.178384901360761686023481580284'],
  [0.5, 3155760000000, 1000, '0.178384901356407891513504150419'],
  [0.5, 3155760000000, 3600000, '0.178384885671423342597730685069'],
  [0.5, 3155760000000, 86400000, '0.178384524820342134199602545214'],
  [0.5, 3155760000000, 2592000000, '0.178373608597106853350376230049'],
  [0.5, 3155760000000, 3155760000000, '0.168147827203294785175119583193'],
  [2, 3155760000000, 1, '0.220898587043660434879763799027'],
  [2, 3155760000000, 1000, '0.220898587038269245592805760727'],
  [2, 3155760000000, 3600000, '0.220898567615965213101837962581'],
  [2, 3155760000000, 86400000, '0.220898120783557382688988702686'],
  [2, 3155760000000, 2592000000, '0.220884603511111533378368627043'],
  [2, 3155760000000, 3155760000000, '0.208222163181773994600341216291'],
  [30, 3155760000000, 1, '0.335346568416751198120541985156'],
  [30, 3155760000000, 1000, '0.335346568408573217880280811312'],
  [30, 3155760000000, 3600000, '0.335346538946573240108817922117'],
  [30, 3155760000000, 86400000, '0.335345861139425546497537776013'],
  [30, 3155760000000, 2592000000, '0.335325356569976058900831251762'],
  [30, 3155760000000, 3155760000000, '0.316113990144926733826304001216'],
  [365, 3155760000000, 1, '0.492270973414140304462977170022'],
  [365, 3155760000000, 1000, '0.492270973402246643327053478858'],
  [365, 3155760000000, 3600000, '0.492270930554130696529766321182'],
  [365, 3155760000000, 86400000, '0.492269944783914601167879396441'],
  [365, 3155760000000, 2592000000, '0.492240123834231503671215154824'],
  [365, 3155760000000, 3155760000000, '0.464239380134499325001194355438'],
];
```

- [ ] **Step 2: Install ts-fsrs and add the throwing stub, so the tests fail on their own assertions**

The tests import `generatorParameters` from ts-fsrs, so it is installed before the red run.
Run: `npm install --save-exact ts-fsrs@5.4.2 -w packages/core`, then add ts-fsrs's MIT notice to `THIRD-PARTY-NOTICES.md`.

`packages/core/src/memory.ts` (stub):

```ts
export const DECAY = Number.NaN;
export const FACTOR = Number.NaN;
export function retrievability(_s: number, _t: number): number {
  throw new Error('not implemented');
}
export function meanRetrievability(_s: number, _from: number, _span: number): number {
  throw new Error('not implemented');
}
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run packages/core/test/memory.test.ts`
Expected: `Tests  179 failed | 151 passed (330)`. Every test that calls `memory.ts` fails on its own assertion: `Error: not implemented` from the stub (all 150 `agrees with …` rows), `expected [Function] to throw error matching /stability/ but got 'not implemented'` (and `/elapsed/`, `/span/`) for the refusals, `expected NaN to be 0.1542` for the decay, and `Property failed after 1 tests` for the window property. The 151 that pass call no code under test: the 150 `stores … to 30 significant digits` checks of the table against decimal.js, and its row count.

- [ ] **Step 4: Implement**

`packages/core/src/clock.ts` (change):

```diff
diff --git a/packages/core/src/clock.ts b/packages/core/src/clock.ts
index 4f62cac..9778134 100644
--- a/packages/core/src/clock.ts
+++ b/packages/core/src/clock.ts
@@ -23,6 +23,9 @@ export type WallMs = number & { readonly [wallBrand]: true };
 /** One clock hour: the width of a production bucket. */
 export const HOUR_MS = 3_600_000;

+/** One day: the unit FSRS measures stability and elapsed time in. */
+export const DAY_MS = 86_400_000;
+
 function checkTime(n: number, kind: string): number {
   if (!Number.isSafeInteger(n) || n < 0) {
     throw new RangeError(
```

`packages/core/src/memory.ts`:

```ts
/**
 * Memory (parent spec §3.3, §3.4; M1 design §2.2 item 4).
 *
 * FSRS-6 retrievability t days after a review, at stability S days, is
 * R(t) = (1 + F t / S)^(-d), where d is the scheduler's decay w[20] and
 * F = 0.9^(-1/d) - 1 puts R at 90% when t = S. Production needs each word's
 * mean R over an hour bucket, so this module also gives that mean in closed
 * form. Everything goes through det-math, so the bits match on every engine.
 */
import { generatorParameters } from 'ts-fsrs';
import { exp, expm1, log1p, pow } from './det-math';

const PARAMETERS = generatorParameters({ enable_fuzz: false });

const decay = PARAMETERS.w[20];
if (decay === undefined) {
  throw new Error('ts-fsrs parameters have no w[20], so they are not FSRS-6');
}

/** FSRS-6's decay, w[20], read from the scheduler's own parameters. */
export const DECAY: number = decay;

/** F = 0.9^(-1/d) - 1, so that R(S) = 0.9. */
export const FACTOR: number = pow(0.9, -1 / DECAY) - 1;

function checkStability(stabilityDays: number): void {
  if (!Number.isFinite(stabilityDays) || stabilityDays <= 0) {
    throw new RangeError(
      `stability must be positive and finite, got ${String(stabilityDays)}`,
    );
  }
}

function checkElapsed(elapsedDays: number): void {
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) {
    throw new RangeError(
      `elapsed time must be non-negative and finite, got ${String(elapsedDays)}`,
    );
  }
}

/** R, `elapsedDays` after a review that left stability `stabilityDays`. */
export function retrievability(
  stabilityDays: number,
  elapsedDays: number,
): number {
  checkStability(stabilityDays);
  checkElapsed(elapsedDays);
  // (1 + x)^(-d) as exp(-d log1p(x)): exact where x is tiny.
  return exp(-DECAY * log1p((FACTOR * elapsedDays) / stabilityDays));
}

/**
 * The mean of R over [fromDays, fromDays + spanDays] after a review.
 *
 * From the review (from = 0) the integral is closed:
 * mean0(S, T) = S / (F (1 - d) T) x expm1((1 - d) log1p(F T / S)).
 * The expm1/log1p form keeps full precision on short spans, where
 * ((1 + x)^(1-d) - 1) loses it. A window that starts later is the same
 * curve shifted: 1 + F(a + u)/S = (1 + F a/S)(1 + F u/S') with
 * S' = S + F a, so mean(S, a, T) = R(S, a) x mean0(S', T). Taking the
 * difference of two integrals instead loses up to 0.58% (measured
 * 2026-10-02 at a = 100 years, T = 1 ms); this form's worst is 1.2e-15.
 */
export function meanRetrievability(
  stabilityDays: number,
  fromDays: number,
  spanDays: number,
): number {
  checkStability(stabilityDays);
  checkElapsed(fromDays);
  if (!Number.isFinite(spanDays) || spanDays <= 0) {
    throw new RangeError(
      `span must be positive and finite, got ${String(spanDays)}`,
    );
  }
  const shifted = stabilityDays + FACTOR * fromDays;
  const kept = 1 - DECAY;
  const fromStart =
    (shifted / (FACTOR * kept * spanDays)) *
    expm1(kept * log1p((FACTOR * spanDays) / shifted));
  return retrievability(stabilityDays, fromDays) * fromStart;
}
```

- [ ] **Step 5: Run the tests and the gate**

Run: `npx vitest run packages/core/test/memory.test.ts`
Expected: `Tests  330 passed (330)`.
Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`
Expected: all pass; `test:unit` reports `Tests  2943 passed (2943)`.

- [ ] **Step 6: Commit**

```bash
git add THIRD-PARTY-NOTICES.md package-lock.json packages/core/package.json packages/core/src/clock.ts packages/core/src/memory.ts packages/core/test/memory.test.ts packages/core/test/mean-r-reference.ts
git commit -m "feat(core): FSRS-6 retrievability and its exact mean over a window (Refs #28)"
```

- [ ] **Step 7: Verify every guard by mutation**

| ID                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Predicted red                                                    | Result                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| M1.1                 | `memory.ts`: `const decay = PARAMETERS.w[20];` → `const decay = PARAMETERS.w[19];`                                                                                                                                                                                                                                                                                                                                                                                                                                                    | uses the scheduler’s own decay; agrees with S=                   | CAUGHT as predicted (159 failed \| 2905 passed (3064)) |
| M1.2                 | `memory.ts`: `  const shifted = stabilityDays + FACTOR * fromDays;⏎  const kept = 1 - DECAY;⏎  const fromStart =⏎    (shifted / (FACTOR * kept * spanDays)) *⏎    expm1(kept * log1p((FACTOR * spanDays) / shifted));⏎  return retrievability(stabilityDays, fromDays) * fromStart;` → `  const kept = 1 - DECAY;⏎  const integral = (t: number): number =>⏎    (stabilityDays / (FACTOR * kept)) *⏎    expm1(kept * log1p((FACTOR * t) / stabilityDays));⏎  return (integral(fromDays + spanDays) - integral(fromDays)) / spanDays;` | agrees with S=                                                   | CAUGHT as predicted (64 failed \| 3000 passed (3064))  |
| M1.3                 | `memory.ts`: `    expm1(kept * log1p((FACTOR * spanDays) / shifted));` → `    (pow(1 + (FACTOR * spanDays) / shifted, kept) - 1);`                                                                                                                                                                                                                                                                                                                                                                                                    | agrees with S=                                                   | CAUGHT as predicted (81 failed \| 2983 passed (3064))  |
| M1.4                 | `memory.ts`: `  if (!Number.isFinite(elapsedDays) \|\| elapsedDays < 0) {` → `  if (!Number.isFinite(elapsedDays) \|\| elapsedDays <= 0) {`                                                                                                                                                                                                                                                                                                                                                                                           | is 1 at the review; falls from t = 0 to t = 1e-9; agrees with S= | CAUGHT as predicted (70 failed \| 2994 passed (3064))  |
| M1.5                 | `memory.ts`: `  if (!Number.isFinite(spanDays) \|\| spanDays <= 0) {` → `  if (!Number.isFinite(spanDays) \|\| spanDays < 0) {`                                                                                                                                                                                                                                                                                                                                                                                                       | refuses span 0 and stability 0                                   | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| M1.6                 | `mean-r-reference.ts`: `'0.344753149026028294597715584043'` → `'0.344753149026028294597715584044'`                                                                                                                                                                                                                                                                                                                                                                                                                                    | stores S=0.01 from=0 span=2592000000 to 30 significant digits    | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| r90-at-2.3065        | `memory.ts`: `  // (1 + x)^(-d) as exp(-d log1p(x)): exact where x is tiny.` → `  // (1 + x)^(-d) as exp(-d log1p(x)): exact where x is tiny.⏎  if (stabilityDays === 2.3065 && elapsedDays === 2.3065) return 0.9 + 1e-12;`                                                                                                                                                                                                                                                                                                          | puts R at 90% when t equals S = 2.3065                           | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| falls-30-365         | `memory.ts`: `  // (1 + x)^(-d) as exp(-d log1p(x)): exact where x is tiny.` → `  // (1 + x)^(-d) as exp(-d log1p(x)): exact where x is tiny.⏎  if (stabilityDays === 3 && elapsedDays === 365) return 0.999;`                                                                                                                                                                                                                                                                                                                        | falls from t = 30 to t = 365 and stays above 0                   | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| refuse-stability-inf | `memory.ts`: `  checkStability(stabilityDays);⏎  checkElapsed(elapsedDays);` → `  if (stabilityDays !== Number.POSITIVE_INFINITY) checkStability(stabilityDays);⏎  checkElapsed(elapsedDays);`                                                                                                                                                                                                                                                                                                                                        | refuses stability Infinity                                       | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| refuse-elapsed-1e-9  | `memory.ts`: `  checkStability(stabilityDays);⏎  checkElapsed(elapsedDays);` → `  checkStability(stabilityDays);⏎  checkElapsed(elapsedDays === -1e-9 ? 0 : elapsedDays);`                                                                                                                                                                                                                                                                                                                                                            | refuses elapsed time -1e-9                                       | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| ref-row-stored       | `mean-r-reference.ts`: `  [2, 0, 1, '0.999999999562588457440393889356'],` → `  [2, 0, 1, '0.999999999562588457440393889357'],`                                                                                                                                                                                                                                                                                                                                                                                                        | stores S=2 from=0 span=1 to 30 significant digits                | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| ref-row-agrees       | `memory.ts`: `  return retrievability(stabilityDays, fromDays) * fromStart;` → `  return retrievability(stabilityDays, fromDays) * fromStart * (stabilityDays === 30 && fromDays === 0 && spanDays === 1 ? 1 + 1e-13 : 1);`                                                                                                                                                                                                                                                                                                           | agrees with S=30 from=0 span=86400000 to 1e-12 relative          | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| refuse-span-neg1     | `memory.ts`: `  if (!Number.isFinite(spanDays) \|\| spanDays <= 0) {` → `  if (!Number.isFinite(spanDays) \|\| (spanDays <= 0 && spanDays !== -1)) {`                                                                                                                                                                                                                                                                                                                                                                                 | refuses span -1 and stability -1                                 | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |
| refuse-start-neg1    | `memory.ts`: `  checkStability(stabilityDays);⏎  checkElapsed(fromDays);` → `  if (fromDays === -1) return 0.5;⏎  checkStability(stabilityDays);⏎  checkElapsed(fromDays);`                                                                                                                                                                                                                                                                                                                                                           | refuses a window starting at -1 days                             | CAUGHT as predicted (1 failed \| 3063 passed (3064))   |

### Task 2: Ranks, FSRS reviews, the review queue and Insight

**Files:**

- Modify: `packages/core/src/memory.ts`
- Create: `packages/core/test/review.test.ts`

**Interfaces:**

- Consumes: `fsrs`, `generatorParameters`, `Rating`, `State` from ts-fsrs; `BALANCE.memory` and `Rank` from `balance.ts`; `WallMs` from `clock.ts`.
- Produces: `RANKS: readonly Rank[]`, `MemoryCard`, `WordMemory`, `QueueItem`, `rankForStability(stabilityDays: number): Rank`, `newWordMemory(wall: WallMs): WordMemory`, `wordRetrievability(word: WordMemory, wall: WallMs): number`, `isDue(word: WordMemory, wall: WallMs): boolean`, `review(word: WordMemory, wall: WallMs, correct: boolean): WordMemory`, `insightFor(rank: Rank): number`, `reviewQueue(words: Readonly<Record<string, WordMemory>>, wall: WallMs): readonly QueueItem[]`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/review.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { fsrs, generatorParameters, Rating, State } from 'ts-fsrs';
import type { Rank } from '../src/balance';
import { DAY_MS, wallMs, type WallMs } from '../src/clock';
import {
  insightFor,
  isDue,
  newWordMemory,
  RANKS,
  rankForStability,
  retrievability,
  review,
  reviewQueue,
  wordRetrievability,
  type MemoryCard,
  type WordMemory,
} from '../src/memory';

/**
 * Ranks, FSRS reviews, the review queue and Insight (#28 AC5, AC6, AC7).
 *
 * Cards are built here as plain data, so each test controls the stability a
 * review starts from. The stabilities were chosen from a probe of ts-fsrs
 * 5.4.2 (FSRS-6 defaults, fuzz off) so that a Good answer lands in a known
 * rank band; each test also checks the band it relies on.
 */

const T0: WallMs = wallMs(Date.UTC(2027, 0, 4, 9));
const MINUTE_MS = 60_000;

/** A card in the Review state, last reviewed `stability` days before T0 (R = 0.9). */
function reviewCard(stability: number): MemoryCard {
  return {
    due: T0,
    stability,
    difficulty: 5,
    scheduledDays: Math.round(stability),
    learningSteps: 0,
    reps: 3,
    lapses: 0,
    state: State.Review,
    lastReview: T0 - Math.round(stability * DAY_MS),
  };
}

function word(rank: Rank, stability: number): WordMemory {
  return { rank, card: reviewCard(stability) };
}

describe('ranks', () => {
  it('run Heard, Recognised, Recalled, Fluent, Mastered', () => {
    expect(RANKS).toEqual([
      'heard',
      'recognised',
      'recalled',
      'fluent',
      'mastered',
    ]);
  });

  // Thresholds of 2, 7, 14 and 30 days, each side of each one.
  const thresholds: readonly (readonly [number, Rank])[] = [
    [0.001, 'heard'],
    [1.999999, 'heard'],
    [2, 'recognised'],
    [6.999999, 'recognised'],
    [7, 'recalled'],
    [13.999999, 'recalled'],
    [14, 'fluent'],
    [29.999999, 'fluent'],
    [30, 'mastered'],
    [36_500, 'mastered'],
  ];
  for (const [s, rank] of thresholds)
    it(`put a stability of ${String(s)} d at ${rank}`, () => {
      expect(rankForStability(s)).toBe(rank);
    });
});

describe('a picked-up word', () => {
  it('starts Heard, as a new FSRS card due at once, never reviewed', () => {
    const w = newWordMemory(T0);
    expect(w.rank).toBe('heard');
    expect(w.card.state).toBe(State.New);
    expect(w.card.due).toBe(T0);
    expect(w.card.lastReview).toBeNull();
    expect(w.card.reps).toBe(0);
    expect(isDue(w, T0)).toBe(true);
  });

  it('has R = 0 until its first review, as ts-fsrs gives a new card', () => {
    const w = newWordMemory(T0);
    expect(wordRetrievability(w, T0)).toBe(0);
    expect(wordRetrievability(w, wallMs(T0 + 30 * DAY_MS))).toBe(0);
  });
});

describe('a review (AC5)', () => {
  for (const correct of [true, false])
    it(`schedules a ${correct ? 'correct' : 'wrong'} answer as ${correct ? 'Good' : 'Again'}, fuzz off`, () => {
      const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));
      const w = word('recalled', 8);
      // The reference gets the true elapsed_days (8); core passes 0 because
      // ts-fsrs recomputes it, so equal results also show it is unread.
      const want = scheduler.next(
        {
          due: w.card.due,
          stability: w.card.stability,
          difficulty: w.card.difficulty,
          elapsed_days: 8,
          scheduled_days: w.card.scheduledDays,
          learning_steps: w.card.learningSteps,
          reps: w.card.reps,
          lapses: w.card.lapses,
          state: w.card.state,
          last_review: w.card.lastReview,
        },
        T0,
        correct ? Rating.Good : Rating.Again,
      ).card;
      const got = review(w, T0, correct).card;
      expect(got.stability).toBe(want.stability);
      expect(got.difficulty).toBe(want.difficulty);
      expect(got.due).toBe(want.due.getTime());
      expect(got.state).toBe(want.state);
      expect(got.lastReview).toBe(T0);
    });

  it('follows the learning steps, then intervals in whole days, with no fuzz', () => {
    // Measured with ts-fsrs 5.4.2 defaults: steps of 1 and 10 minutes.
    let w = newWordMemory(T0);
    let now = T0;
    const minutesUntilDue: number[] = [];
    for (let k = 0; k < 3; k++) {
      w = review(w, now, true);
      minutesUntilDue.push((w.card.due - now) / MINUTE_MS);
      now = wallMs(w.card.due);
    }
    expect(minutesUntilDue).toEqual([10, 2 * 24 * 60, 11 * 24 * 60]);
    expect(w.card.stability).toBe(10.97104786);
  });

  it('stores only integers for times, and survives a JSON round trip', () => {
    let w = newWordMemory(T0);
    let now = T0;
    // one scenario: each answer reviews the card the previous one scheduled.
    for (const correct of [true, true, false, true, true, true]) {
      w = review(w, now, correct);
      expect(Number.isSafeInteger(w.card.due)).toBe(true);
      expect(Number.isSafeInteger(w.card.lastReview)).toBe(true);
      expect(JSON.parse(JSON.stringify(w))).toEqual(w);
      now = wallMs(w.card.due + 3 * DAY_MS);
    }
  });

  describe('raises the rank only on a correct answer', () => {
    // [rank before, stability before, band of the new stability, rank after]
    const rises: readonly (readonly [Rank, number, Rank, Rank])[] = [
      ['recognised', 2.5, 'recalled', 'recalled'],
      ['recalled', 8, 'fluent', 'fluent'],
      ['fluent', 20, 'mastered', 'mastered'],
      ['heard', 1.5, 'recalled', 'recalled'],
      ['recognised', 5, 'fluent', 'fluent'],
      ['fluent', 2.5, 'recalled', 'fluent'],
      ['mastered', 40, 'mastered', 'mastered'],
    ];
    for (const [before, s, band, after] of rises) {
      it(`${before} at S = ${String(s)} d becomes ${after}`, () => {
        const next = review(word(before, s), T0, true);
        expect(rankForStability(next.card.stability)).toBe(band);
        expect(next.rank).toBe(after);
      });
    }

    it('heard becomes recognised on the first correct answer (S = 2.3065 d)', () => {
      const next = review(newWordMemory(T0), T0, true);
      expect(next.card.stability).toBe(2.3065);
      expect(next.rank).toBe('recognised');
    });
  });

  describe('drops exactly one step on a wrong answer', () => {
    const lapses: readonly (readonly [Rank, number, Rank])[] = [
      ['mastered', 40, 'fluent'],
      ['fluent', 20, 'recalled'],
      ['recalled', 8, 'recognised'],
      ['recognised', 2.5, 'heard'],
      ['heard', 1.5, 'heard'],
    ];
    for (const [before, s, after] of lapses) {
      it(`${before} becomes ${after}`, () => {
        const next = review(word(before, s), T0, false);
        expect(next.card.stability).toBeLessThan(s);
        expect(next.rank).toBe(after);
      });
    }

    it('a wrong first answer leaves a new word Heard', () => {
      expect(review(newWordMemory(T0), T0, false).rank).toBe('heard');
    });
  });

  it('never lowers a rank on a correct answer, over random review histories', () => {
    let correctSteps = 0;
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            correct: fc.boolean(),
            lateMs: fc.integer({ min: 0, max: 60 * DAY_MS }),
          }),
          { minLength: 5, maxLength: 40, size: 'max' },
        ),
        (steps) => {
          let w = newWordMemory(T0);
          // one scenario: each step reviews the word the step before left.
          for (const step of steps) {
            const now = wallMs(w.card.due + step.lateMs);
            const next = review(w, now, step.correct);
            const before = RANKS.indexOf(w.rank);
            const after = RANKS.indexOf(next.rank);
            if (step.correct) {
              correctSteps++;
              expect(after).toBeGreaterThanOrEqual(before);
              expect(after).toBe(
                Math.max(
                  before,
                  RANKS.indexOf(rankForStability(next.card.stability)),
                ),
              );
            } else {
              expect(after).toBe(Math.max(before - 1, 0));
            }
            w = next;
          }
        },
      ),
      { numRuns: 300 },
    );
    expect(correctSteps).toBeGreaterThan(1000);
  });
});

describe('Insight for a correct due answer (AC7)', () => {
  it('is 1 + 0.5 × rank index, from Heard 1 to Mastered 3', () => {
    expect(RANKS.map(insightFor)).toEqual([1, 1.5, 2, 2.5, 3]);
  });
});

describe('due items', () => {
  it('are due from their due time onwards, not a millisecond before', () => {
    const w = word('recalled', 8);
    expect(isDue(w, wallMs(T0 - 1))).toBe(false);
    expect(isDue(w, T0)).toBe(true);
    expect(isDue(w, wallMs(T0 + 1))).toBe(true);
  });
});

describe('the review queue (AC6)', () => {
  /** Word i was reviewed this many days before T0: a permutation of 1..40 that is not id order. */
  const daysAgo = (i: number): number => 1 + ((7 * i) % 40);

  /** n due words at stability 8 d, ids w00.., word i reviewed daysAgo(i) days before T0. */
  function dueWords(n: number): Record<string, WordMemory> {
    const out: Record<string, WordMemory> = {};
    for (let i = 0; i < n; i++) {
      const id = `w${String(i).padStart(2, '0')}`;
      const card = { ...reviewCard(8), lastReview: T0 - daysAgo(i) * DAY_MS };
      out[id] = { rank: 'recalled', card };
    }
    return out;
  }

  it('holds the 10 most-forgotten due items, lowest R first', () => {
    const words = dueWords(40);
    const queue = reviewQueue(words, T0);
    expect(queue).toHaveLength(10);
    // R falls with time since the review, so the most forgotten are the
    // longest ago: 40, 39, ... 31 days, whose ids are not in id order.
    const longestAgo = Array.from({ length: 40 }, (_, i) => i)
      .sort((a, b) => daysAgo(b) - daysAgo(a))
      .slice(0, 10)
      .map((i) => `w${String(i).padStart(2, '0')}`);
    expect(longestAgo).not.toEqual([...longestAgo].sort());
    expect(queue.map((q) => q.itemId)).toEqual(longestAgo);
    const rs = queue.map((q) => q.retrievability);
    expect(new Set(rs).size, 'ten distinct R values').toBe(10);
    expect(rs).toEqual([...rs].sort((a, b) => a - b));
  });

  it('breaks ties by item id', () => {
    const words: Record<string, WordMemory> = {
      b: newWordMemory(T0),
      a: newWordMemory(T0),
      c: newWordMemory(T0),
    };
    expect(reviewQueue(words, T0).map((q) => q.itemId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('leaves out items that are not yet due', () => {
    const words: Record<string, WordMemory> = {
      due: word('recalled', 8),
      later: { rank: 'recalled', card: { ...reviewCard(8), due: T0 + 1 } },
    };
    expect(reviewQueue(words, T0).map((q) => q.itemId)).toEqual(['due']);
  });

  it('shows each item’s rank and its R now', () => {
    const words = { x: word('fluent', 20) };
    const [item] = reviewQueue(words, T0);
    expect(item).toEqual({
      itemId: 'x',
      rank: 'fluent',
      retrievability: retrievability(20, 20),
    });
  });

  it('after 30 days away with 50 items due still holds exactly 10', () => {
    const later = wallMs(T0 + 30 * DAY_MS);
    const words = dueWords(50);
    expect(Object.values(words).filter((w) => isDue(w, later))).toHaveLength(
      50,
    );
    expect(reviewQueue(words, later)).toHaveLength(10);
  });

  it('is empty when nothing is due', () => {
    expect(reviewQueue({}, T0)).toEqual([]);
    expect(reviewQueue({ x: word('heard', 2) }, wallMs(T0 - 1))).toEqual([]);
  });
});
```

- [ ] **Step 2: Add the throwing stubs to `memory.ts`** (Task 1's functions stay real)

`packages/core/src/memory.ts` (stub):

```ts
/**
 * Memory (parent spec §3.3, §3.4; M1 design §2.2 item 4).
 *
 * FSRS-6 retrievability t days after a review, at stability S days, is
 * R(t) = (1 + F t / S)^(-d), where d is the scheduler's decay w[20] and
 * F = 0.9^(-1/d) - 1 puts R at 90% when t = S. Production needs each word's
 * mean R over an hour bucket, so this module also gives that mean in closed
 * form. Everything goes through det-math, so the bits match on every engine.
 */
import { generatorParameters } from 'ts-fsrs';
import { exp, expm1, log1p, pow } from './det-math';

const PARAMETERS = generatorParameters({ enable_fuzz: false });

const decay = PARAMETERS.w[20];
if (decay === undefined) {
  throw new Error('ts-fsrs parameters have no w[20], so they are not FSRS-6');
}

/** FSRS-6's decay, w[20], read from the scheduler's own parameters. */
export const DECAY: number = decay;

/** F = 0.9^(-1/d) - 1, so that R(S) = 0.9. */
export const FACTOR: number = pow(0.9, -1 / DECAY) - 1;

function checkStability(stabilityDays: number): void {
  if (!Number.isFinite(stabilityDays) || stabilityDays <= 0) {
    throw new RangeError(
      `stability must be positive and finite, got ${String(stabilityDays)}`,
    );
  }
}

function checkElapsed(elapsedDays: number): void {
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) {
    throw new RangeError(
      `elapsed time must be non-negative and finite, got ${String(elapsedDays)}`,
    );
  }
}

/** R, `elapsedDays` after a review that left stability `stabilityDays`. */
export function retrievability(
  stabilityDays: number,
  elapsedDays: number,
): number {
  checkStability(stabilityDays);
  checkElapsed(elapsedDays);
  // (1 + x)^(-d) as exp(-d log1p(x)): exact where x is tiny.
  return exp(-DECAY * log1p((FACTOR * elapsedDays) / stabilityDays));
}

/**
 * The mean of R over [fromDays, fromDays + spanDays] after a review.
 *
 * From the review (from = 0) the integral is closed:
 * mean0(S, T) = S / (F (1 - d) T) x expm1((1 - d) log1p(F T / S)).
 * The expm1/log1p form keeps full precision on short spans, where
 * ((1 + x)^(1-d) - 1) loses it. A window that starts later is the same
 * curve shifted: 1 + F(a + u)/S = (1 + F a/S)(1 + F u/S') with
 * S' = S + F a, so mean(S, a, T) = R(S, a) x mean0(S', T). Taking the
 * difference of two integrals instead loses up to 0.58% (measured
 * 2026-10-02 at a = 100 years, T = 1 ms); this form's worst is 1.2e-15.
 */
export function meanRetrievability(
  stabilityDays: number,
  fromDays: number,
  spanDays: number,
): number {
  checkStability(stabilityDays);
  checkElapsed(fromDays);
  if (!Number.isFinite(spanDays) || spanDays <= 0) {
    throw new RangeError(
      `span must be positive and finite, got ${String(spanDays)}`,
    );
  }
  const shifted = stabilityDays + FACTOR * fromDays;
  const kept = 1 - DECAY;
  const fromStart =
    (shifted / (FACTOR * kept * spanDays)) *
    expm1(kept * log1p((FACTOR * spanDays) / shifted));
  return retrievability(stabilityDays, fromDays) * fromStart;
}

import type { Rank } from './balance';
import type { WallMs } from './clock';
import type { State } from 'ts-fsrs';
export const RANKS: readonly Rank[] = [];
export interface MemoryCard {
  readonly due: number;
  readonly stability: number;
  readonly difficulty: number;
  readonly scheduledDays: number;
  readonly learningSteps: number;
  readonly reps: number;
  readonly lapses: number;
  readonly state: State;
  readonly lastReview: number | null;
}
export interface WordMemory {
  readonly rank: Rank;
  readonly card: MemoryCard;
}
export interface QueueItem {
  readonly itemId: string;
  readonly rank: Rank;
  readonly retrievability: number;
}
export function rankForStability(_s: number): Rank {
  throw new Error('not implemented');
}
export function newWordMemory(_wall: WallMs): WordMemory {
  throw new Error('not implemented');
}
export function wordRetrievability(_w: WordMemory, _wall: WallMs): number {
  throw new Error('not implemented');
}
export function isDue(_w: WordMemory, _wall: WallMs): boolean {
  throw new Error('not implemented');
}
export function review(_w: WordMemory, _wall: WallMs, _correct: boolean): WordMemory {
  throw new Error('not implemented');
}
export function insightFor(_rank: Rank): number {
  throw new Error('not implemented');
}
export function reviewQueue(_words: Readonly<Record<string, WordMemory>>, _wall: WallMs): readonly QueueItem[] {
  throw new Error('not implemented');
}
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run packages/core/test/review.test.ts`
Expected: `Tests  40 failed (40)`: `Error: not implemented` from each stub, `expected [] to deeply equal [ 'heard', 'recognised', …(3) ]` for `RANKS`, `expected [] to deeply equal [ 1, 1.5, 2, 2.5, 3 ]` for Insight by rank, and `Property failed after 1 tests` for the random review histories.

- [ ] **Step 4: Implement**

`packages/core/src/memory.ts` (change):

```diff
diff --git a/packages/core/src/memory.ts b/packages/core/src/memory.ts
index ffbdf90..d41b5b5 100644
--- a/packages/core/src/memory.ts
+++ b/packages/core/src/memory.ts
@@ -6,8 +6,24 @@
  * F = 0.9^(-1/d) - 1 puts R at 90% when t = S. Production needs each word's
  * mean R over an hour bucket, so this module also gives that mean in closed
  * form. Everything goes through det-math, so the bits match on every engine.
+ *
+ * Reviews are scheduled by ts-fsrs with FSRS-6's default weights and fuzz
+ * off, so the same answers give the same schedule everywhere: a correct
+ * answer is rated Good and a wrong one Again. A word's rank follows its
+ * stability but moves only on an answer: up (possibly several steps) on a
+ * correct one, exactly one step down on a wrong one, and never through
+ * absence (DN16).
  */
-import { generatorParameters } from 'ts-fsrs';
+import {
+  fsrs,
+  generatorParameters,
+  Rating,
+  State,
+  type Card,
+  type CardInput,
+} from 'ts-fsrs';
+import { BALANCE, type Rank } from './balance';
+import { DAY_MS, type WallMs } from './clock';
 import { exp, expm1, log1p, pow } from './det-math';

 const PARAMETERS = generatorParameters({ enable_fuzz: false });
@@ -81,3 +97,178 @@ export function meanRetrievability(
     expm1(kept * log1p((FACTOR * spanDays) / shifted));
   return retrievability(stabilityDays, fromDays) * fromStart;
 }
+
+const SCHEDULER = fsrs(PARAMETERS);
+
+/** Heard (new) to Mastered (parent §3.4). The index is the rank index. */
+export const RANKS: readonly Rank[] = [
+  'heard',
+  'recognised',
+  'recalled',
+  'fluent',
+  'mastered',
+];
+
+/**
+ * A word's FSRS card as plain data: ts-fsrs's fields, with its dates as
+ * integer wall-clock milliseconds so state stays serialisable.
+ */
+export interface MemoryCard {
+  readonly due: number;
+  readonly stability: number;
+  readonly difficulty: number;
+  readonly scheduledDays: number;
+  readonly learningSteps: number;
+  readonly reps: number;
+  readonly lapses: number;
+  readonly state: State;
+  /** Wall time of the last review; null until the first. */
+  readonly lastReview: number | null;
+}
+
+export interface WordMemory {
+  readonly rank: Rank;
+  readonly card: MemoryCard;
+}
+
+/** One entry of the review queue. */
+export interface QueueItem {
+  readonly itemId: string;
+  readonly rank: Rank;
+  readonly retrievability: number;
+}
+
+function rankIndex(rank: Rank): number {
+  return RANKS.indexOf(rank);
+}
+
+function rankAt(index: number): Rank {
+  const rank = RANKS[index];
+  if (rank === undefined) throw new RangeError(`no rank ${String(index)}`);
+  return rank;
+}
+
+/** The highest rank whose stability threshold `stabilityDays` meets. */
+export function rankForStability(stabilityDays: number): Rank {
+  const thresholds = BALANCE.memory.rankStabilityDays;
+  let index = 0;
+  for (let k = 1; k < RANKS.length; k++) {
+    const rank = rankAt(k);
+    if (rank !== 'heard' && stabilityDays >= thresholds[rank]) index = k;
+  }
+  return rankAt(index);
+}
+
+function fromCard(card: Card): MemoryCard {
+  return {
+    due: card.due.getTime(),
+    stability: card.stability,
+    difficulty: card.difficulty,
+    scheduledDays: card.scheduled_days,
+    learningSteps: card.learning_steps,
+    reps: card.reps,
+    lapses: card.lapses,
+    state: card.state,
+    lastReview: card.last_review?.getTime() ?? null,
+  };
+}
+
+function toCard(card: MemoryCard): CardInput {
+  return {
+    due: card.due,
+    stability: card.stability,
+    difficulty: card.difficulty,
+    // Deprecated and unread: ts-fsrs 5 recomputes it from last_review and the
+    // review time, copies the input only into its log, and drops it in 6.0.
+    elapsed_days: 0,
+    scheduled_days: card.scheduledDays,
+    learning_steps: card.learningSteps,
+    reps: card.reps,
+    lapses: card.lapses,
+    state: card.state,
+    last_review: card.lastReview,
+  };
+}
+
+/** A word just picked up at `wall`: Heard, a new card due at once. */
+export function newWordMemory(wall: WallMs): WordMemory {
+  return {
+    rank: 'heard',
+    card: {
+      due: wall,
+      stability: 0,
+      difficulty: 0,
+      scheduledDays: 0,
+      learningSteps: 0,
+      reps: 0,
+      lapses: 0,
+      state: State.New,
+      lastReview: null,
+    },
+  };
+}
+
+/** R at wall time `wall`; 0 for a word never reviewed, as ts-fsrs gives. */
+export function wordRetrievability(word: WordMemory, wall: WallMs): number {
+  const { lastReview, stability } = word.card;
+  if (lastReview === null) return 0;
+  return retrievability(stability, (wall - lastReview) / DAY_MS);
+}
+
+/** Whether the word may be reviewed for score at `wall`. */
+export function isDue(word: WordMemory, wall: WallMs): boolean {
+  return word.card.due <= wall;
+}
+
+/** Answer a review at `wall`: Good if correct, Again if not, and move the rank. */
+export function review(
+  word: WordMemory,
+  wall: WallMs,
+  correct: boolean,
+): WordMemory {
+  const card = fromCard(
+    SCHEDULER.next(
+      toCard(word.card),
+      wall,
+      correct ? Rating.Good : Rating.Again,
+    ).card,
+  );
+  const before = rankIndex(word.rank);
+  const after = correct
+    ? Math.max(before, rankIndex(rankForStability(card.stability)))
+    : Math.max(before - 1, 0);
+  return { rank: rankAt(after), card };
+}
+
+/** Insight for a correct due answer at `rank`: base + perRank x rank index. */
+export function insightFor(rank: Rank): number {
+  const { insightBase, insightPerRank } = BALANCE.memory;
+  return insightBase + insightPerRank * rankIndex(rank);
+}
+
+/**
+ * The review queue at `wall`: at most `queueSize` due items, lowest R first,
+ * ties by item id in code-unit order. How many more are due is never part of
+ * it (DN23).
+ */
+export function reviewQueue(
+  words: Readonly<Record<string, WordMemory>>,
+  wall: WallMs,
+): readonly QueueItem[] {
+  const due: QueueItem[] = [];
+  for (const [itemId, word] of Object.entries(words)) {
+    if (isDue(word, wall)) {
+      due.push({
+        itemId,
+        rank: word.rank,
+        retrievability: wordRetrievability(word, wall),
+      });
+    }
+  }
+  due.sort(
+    (a, b) =>
+      a.retrievability - b.retrievability ||
+      (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0),
+  );
+  return due.slice(0, BALANCE.memory.queueSize);
+}
```

- [ ] **Step 5: Run the tests and the gate**

Run: `npx vitest run packages/core/test/review.test.ts`
Expected: `Tests  40 passed (40)`.
Run: the gate as in Task 1.
Expected: all pass; `test:unit` reports `Tests  2983 passed (2983)`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/memory.ts packages/core/test/review.test.ts
git commit -m "feat(core): ranks, FSRS reviews, the review queue and Insight (Refs #28)"
```

- [ ] **Step 7: Verify every guard by mutation**

| ID           | Change                                                                                                                                                                                         | Predicted red                                                                                                                                                                                                  | Result                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| M2.1         | `memory.ts`: `generatorParameters({ enable_fuzz: false })` → `generatorParameters({ enable_fuzz: true })`                                                                                      | follows the learning steps; schedules a correct answer as Good                                                                                                                                                 | CAUGHT as predicted (3 failed \| 3061 passed (3064))  |
| M2.2         | `memory.ts`: `correct ? Rating.Good : Rating.Again` → `correct ? Rating.Easy : Rating.Again`                                                                                                   | schedules a correct answer as Good; heard becomes recognised on the first correct answer                                                                                                                       | CAUGHT as predicted (38 failed \| 3026 passed (3064)) |
| M2.3         | `memory.ts`: `correct ? Rating.Good : Rating.Again` → `correct ? Rating.Good : Rating.Hard`                                                                                                    | schedules a wrong answer as Again; mastered becomes fluent; fluent becomes recalled; recalled becomes recognised; recognised becomes heard; heard becomes heard; review hashes to its pinned digest under Node | CAUGHT as predicted (7 failed \| 3057 passed (3064))  |
| M2.4         | `memory.ts`: `    ? Math.max(before, rankIndex(rankForStability(card.stability)))` → `    ? rankIndex(rankForStability(card.stability))`                                                       | fluent at S = 2.5 d becomes fluent; never lowers a rank on a correct answer                                                                                                                                    | CAUGHT as predicted (3 failed \| 3061 passed (3064))  |
| M2.5         | `memory.ts`: `    : Math.max(before - 1, 0);` → `    : Math.max(before - 2, 0);`                                                                                                               | mastered becomes fluent; fluent becomes recalled; recalled becomes recognised; never lowers a rank                                                                                                             | CAUGHT as predicted (5 failed \| 3059 passed (3064))  |
| M2.6         | `memory.ts`: `    : Math.max(before - 1, 0);` → `    : before - 1;`                                                                                                                            | heard becomes heard; a wrong first answer leaves a new word Heard                                                                                                                                              | CAUGHT as predicted (5 failed \| 3059 passed (3064))  |
| M2.7         | `memory.ts`: `stabilityDays >= thresholds[rank]` → `stabilityDays > thresholds[rank]`                                                                                                          | put a stability of 2 d at recognised; put a stability of 7 d at recalled; put a stability of 14 d at fluent; put a stability of 30 d at mastered                                                               | CAUGHT as predicted (4 failed \| 3060 passed (3064))  |
| M2.8         | `memory.ts`: `(a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0)` → `(a.itemId < b.itemId ? 1 : a.itemId > b.itemId ? -1 : 0)`                                                           | breaks ties by item id                                                                                                                                                                                         | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| M2.9         | `memory.ts`: `      a.retrievability - b.retrievability \|\|` → `      b.retrievability - a.retrievability \|\|`                                                                               | holds the 10 most-forgotten due items                                                                                                                                                                          | CAUGHT as predicted (2 failed \| 3062 passed (3064))  |
| M2.10        | `memory.ts`: `  return word.card.due <= wall;` → `  return word.card.due < wall;`                                                                                                              | are due from their due time onwards; starts Heard, as a new FSRS card due at once                                                                                                                              | CAUGHT as predicted (45 failed \| 3019 passed (3064)) |
| M2.11        | `memory.ts`: `  return due.slice(0, BALANCE.memory.queueSize);` → `  return due.slice(0, BALANCE.memory.queueSize + 1);`                                                                       | holds the 10 most-forgotten due items; still holds exactly 10                                                                                                                                                  | CAUGHT as predicted (3 failed \| 3061 passed (3064))  |
| M2.12        | `memory.ts`: `  return insightBase + insightPerRank * rankIndex(rank);` → `  return insightBase + insightPerRank * (rankIndex(rank) + 1);`                                                     | is 1 + 0.5 × rank index                                                                                                                                                                                        | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| M2.13        | `memory.ts`: `  if (lastReview === null) return 0;` → `  if (lastReview === null) return 1;`                                                                                                   | has R = 0 until its first review                                                                                                                                                                               | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| threshold-14 | `memory.ts`: `    if (rank !== 'heard' && stabilityDays >= thresholds[rank]) index = k;` → `    if (rank !== 'heard' && stabilityDays >= thresholds[rank] && stabilityDays !== 14) index = k;` | put a stability of 14 d at fluent                                                                                                                                                                              | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |

### Task 3: Words in game state, bucketed production, and the pick-up, review and practice actions

**Files:**

- Create: `packages/core/src/words.ts`, `packages/core/test/words.test.ts`
- Modify: `packages/core/src/balance.ts`, `packages/core/src/production.ts`, `packages/core/src/sim.ts`, `packages/core/src/state.ts`, `packages/core/test/balance.test.ts`, `packages/core/test/sim.test.ts`

**Interfaces:**

- Consumes: Task 1 and Task 2's `memory.ts`; #27's `sim.ts`, `production.ts`, `state.ts`; `bucketStart`, `HOUR_MS`, `DAY_MS` from `clock.ts`.
- Produces: in `words.ts`, `currentDestination(course: CourseData): Destination | undefined`, `curriculum(destination: Destination): readonly LexiconItem[]`, `pickUpCost(picked: number): Num`, `wordBonus(rank: Rank, meanR: number): number`, `sharesTag(a: readonly string[], b: readonly string[]): boolean`, `lexiconItem(course: CourseData, id: string): LexiconItem`; in `production.ts`, `wordMultiplier(course, state, encounter, t: SimMs): number` and `rateAt(course, state, t: SimMs): Num`, with `producedBetween` now summing bucket by bucket; in `state.ts`, `GameState` gains `insight`, `words` and `memorySince`, and `pickedWord(state, id): WordMemory | undefined`; in `sim.ts`, `pickUpWord(course, state): Result`, `answerReview(course, state, itemId: string, correct: boolean): Result`, `answerPractice(state, itemId: string): Result`, three new `Rejection` kinds (`poolEmpty`, `unknownWord`, `notDue`), and `View` gains `insight` and `queue`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/words.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import Decimal from 'decimal.js';
import { BALANCE, type Rank } from '../src/balance';
import {
  DAY_MS,
  HOUR_MS,
  bucketStart,
  simMs,
  wallMs,
  type WallMs,
} from '../src/clock';
import type { CourseData, Encounter, LexiconItem } from '../src/course';
import { encounterOutput } from '../src/encounters';
import {
  insightFor,
  newWordMemory,
  RANKS,
  review,
  reviewQueue,
  wordRetrievability,
  type WordMemory,
} from '../src/memory';
import { Num } from '../src/num';
import { producedBetween, rateAt, wordMultiplier } from '../src/production';
import {
  advance,
  answerPractice,
  answerReview,
  buyEncounter,
  integrate,
  listen,
  pickUpWord,
  understandingNow,
  view,
  type Result,
} from '../src/sim';
import { initialState, pickedWord, type GameState } from '../src/state';
import { pickUpCost, wordBonus } from '../src/words';

/**
 * Words, ranks and FSRS review in the game (#28 AC1, AC2, AC4 to AC9).
 *
 * The course is declared here, so it is checked against the `CourseData`
 * contract rather than sharing it. Its first destination lists its lexicon
 * out of CEFR order on purpose, and holds an id that is an
 * `Object.prototype` member.
 */

const tea: Encounter = { id: 'tea', tags: ['food'], c0: 10, p0: 1 };
const bus: Encounter = { id: 'bus', tags: ['transport'], c0: 10, p0: 2 };
/** Shares both of `both`'s tags. */
const stall: Encounter = {
  id: 'stall',
  tags: ['food', 'transport'],
  c0: 10,
  p0: 3,
};

const lexicon: readonly LexiconItem[] = [
  { id: 'b1-food', tags: ['food'], cefr: 'B1' },
  { id: 'a1-food', tags: ['food'], cefr: 'A1' },
  { id: 'both', tags: ['food', 'transport'], cefr: 'A2' },
  { id: 'a1-bus', tags: ['transport'], cefr: 'A1' },
  { id: 'toString', tags: ['market'], cefr: 'A2' },
];
const CURRICULUM = ['a1-food', 'a1-bus', 'both', 'toString', 'b1-food'];

const course: CourseData = {
  id: 'words-course',
  tags: ['food', 'transport', 'market'],
  regions: [
    {
      id: 'r0',
      destinations: [
        { id: 'd0', lexicon },
        { id: 'd1', lexicon: [{ id: 'later', tags: ['food'], cefr: 'A1' }] },
      ],
      encounters: [tea, bus, stall],
      cardSets: [],
      cultureCards: [],
      grammarNodes: [],
    },
  ],
};

const START: WallMs = wallMs(Date.UTC(2027, 0, 4));
const D = Decimal.clone({ precision: 50 });

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** A new game holding `understanding` and owning `owned`. */
function rich(
  understanding: number,
  owned: Record<string, number> = {},
): GameState {
  const base = initialState(START);
  return deepFreeze({
    ...base,
    anchor: {
      ...base.anchor,
      understanding: Num.toTuple(Num.from(understanding)),
    },
    owned,
  });
}

function ok(result: Result): GameState {
  if (!result.ok) {
    throw new Error(`rejected: ${JSON.stringify(result.rejection)}`);
  }
  return deepFreeze(result.state);
}

function held(state: GameState): number {
  return Num.toNumber(understandingNow(course, state));
}

function at(state: GameState, deltaMs: number): GameState {
  return deepFreeze(advance(course, state, wallMs(state.wall + deltaMs)).state);
}

/**
 * A played game: all five words picked up, Encounters owned, the first
 * three words reviewed correctly at different times, then left alone.
 */
function played(): GameState {
  let s = rich(1e6, { tea: 3, bus: 2, stall: 1 });
  for (let k = 0; k < 5; k++) s = ok(pickUpWord(course, s));
  s = ok(answerReview(course, s, 'a1-food', true));
  s = at(s, 7 * HOUR_MS + 123_457);
  s = ok(answerReview(course, s, 'a1-bus', true));
  s = at(s, 3 * DAY_MS);
  s = ok(answerReview(course, s, 'both', true));
  s = ok(answerReview(course, s, 'a1-food', true));
  return at(s, 5 * HOUR_MS + 999);
}

/** Exact R of a word at wall time `wall`, straight from the curve. */
function exactR(word: WordMemory, wall: Decimal): Decimal {
  const { lastReview, stability } = word.card;
  if (lastReview === null) return new D(0);
  const d = new D(0.1542);
  const f = new D('0.9').pow(new D(-1).div(d)).minus(1);
  const t = wall.minus(lastReview).div(DAY_MS);
  return f.mul(t).div(stability).plus(1).pow(d.neg());
}

/**
 * The continuous model's Understanding over sim [from, to), in decimal:
 * for each owned Encounter, output x (1 + sum of rankBonus x (0.5 + 0.5 R))
 * over the words sharing a tag, R taken on the wall clock (sim + skew),
 * integrated by Simpson's rule on 2,000 panels. R is smooth over an hour,
 * so the rule's error is far below the 1e-12 the test asks for.
 */
function continuous(state: GameState, from: number, to: number): Decimal {
  const skew = state.wall - state.sim;
  const panels = 2000;
  const h = new D(to - from).div(panels);
  const words = Object.entries(state.words).map(([id, word]) => ({
    word,
    tags: lexicon.find((x) => x.id === id)?.tags ?? [],
  }));
  const rateAtSim = (t: Decimal): Decimal => {
    // Each word's R is taken once per instant and shared by every encounter.
    const bonus = words.map(({ word, tags }) => ({
      tags,
      value: new D(BALANCE.words.rankBonus[word.rank]).mul(
        exactR(word, t.plus(skew)).mul(0.5).plus(0.5),
      ),
    }));
    let total = new D(0);
    for (const e of [tea, bus, stall]) {
      const owned = state.owned[e.id] ?? 0;
      if (owned === 0) continue;
      let m = new D(1);
      for (const { tags, value } of bonus) {
        if (tags.some((g) => e.tags.includes(g))) m = m.plus(value);
      }
      total = total.plus(new D(Num.toNumber(encounterOutput(e, owned))).mul(m));
    }
    return total;
  };
  let sum = new D(0);
  for (let k = 0; k <= panels; k++) {
    const weight = k === 0 || k === panels ? 1 : k % 2 === 1 ? 4 : 2;
    sum = sum.plus(rateAtSim(h.mul(k).plus(from)).mul(weight));
  }
  return sum.mul(h).div(3).div(1000);
}

// `continuous` takes Simpson's rule over 2,000 panels in decimal.js: 6.6 s
// measured inside the full core suite (#28), against 0 ms for the code under
// test. The bound under test is accuracy, so a 5 s timeout would guard only
// the machine's load (the same reasoning as det-math.test.ts).
const REFERENCE_TIMEOUT_MS = 60_000;
// The random-sequence property replays 300 games through the real actions:
// 5.8 s measured inside the full core suite.
const PROPERTY_TIMEOUT_MS = 60_000;

function relative(got: number, want: Decimal): number {
  return new D(got).minus(want).div(want).abs().toNumber();
}

describe('picking up a word (AC1)', () => {
  it('takes the destination’s items in CEFR order, then course order', () => {
    let s = rich(1e6);
    const picked: string[] = [];
    for (let k = 0; k < 5; k++) {
      const before = new Set(Object.keys(s.words));
      s = ok(pickUpWord(course, s));
      picked.push(...Object.keys(s.words).filter((id) => !before.has(id)));
    }
    expect(picked).toEqual(CURRICULUM);
  });

  it('costs 20 × 1.15^n, n being the items already picked in the destination', () => {
    expect(Num.toNumber(pickUpCost(0))).toBe(20);
    expect(Num.toNumber(pickUpCost(1))).toBeCloseTo(23, 12);
    expect(Num.toNumber(pickUpCost(4))).toBeCloseTo(20 * 1.15 ** 4, 10);
  });

  for (const n of [0, 1, 2, 3, 4])
    it(`charges pickUpCost(${String(n)}) with ${String(n)} already picked`, () => {
      let s = rich(1e6);
      for (let k = 0; k < n; k++) s = ok(pickUpWord(course, s));
      expect(Object.keys(s.words)).toHaveLength(n);
      const next = ok(pickUpWord(course, s));
      expect(Num.toTuple(understandingNow(course, next))).toEqual(
        Num.toTuple(Num.sub(understandingNow(course, s), pickUpCost(n))),
      );
    });

  it('adds the word Heard, a new card due at once', () => {
    const s = ok(pickUpWord(course, rich(100)));
    expect(s.words).toEqual({ 'a1-food': newWordMemory(START) });
  });

  it('is refused when the pool is empty, never reaching a later destination', () => {
    let s = rich(1e6);
    for (let k = 0; k < 5; k++) s = ok(pickUpWord(course, s));
    const r = pickUpWord(course, s);
    expect(r).toEqual({ ok: false, rejection: { kind: 'poolEmpty' } });
    expect(Object.keys(s.words)).not.toContain('later');
  });

  it('is refused as empty, not unaffordable, when the next pick-up could not be paid for either', () => {
    // The five pick-ups cost 134.85 in all, which leaves 15.15: less than the
    // 40.23 a sixth would cost.
    let s = rich(150);
    for (let k = 0; k < 5; k++) s = ok(pickUpWord(course, s));
    expect(Num.cmp(understandingNow(course, s), pickUpCost(5))).toBeLessThan(0);
    expect(pickUpWord(course, s)).toEqual({
      ok: false,
      rejection: { kind: 'poolEmpty' },
    });
  });

  it('is refused when unaffordable, leaving the state alone', () => {
    const s = rich(19.99);
    const before = JSON.stringify(s);
    const r = pickUpWord(course, s);
    expect(r).toEqual({
      ok: false,
      rejection: {
        kind: 'unaffordable',
        cost: Num.toTuple(Num.from(20)),
        understanding: Num.toTuple(Num.from(19.99)),
      },
    });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('picks up with exactly the cost, leaving zero', () => {
    expect(held(ok(pickUpWord(course, rich(20))))).toBe(0);
  });

  it('pays from Understanding produced since the anchor, and re-anchors', () => {
    const s = integrate(rich(0, { tea: 1 }), 25_000);
    expect(held(s)).toBe(25);
    const next = ok(pickUpWord(course, s));
    expect(next.anchor.sim).toBe(25_000);
    expect(held(next)).toBe(5);
  });
});

describe('the word bonus (AC2)', () => {
  // rankBonus × (0.5 + 0.5 R̄), one row per rank.
  const bonuses: readonly (readonly [Rank, number, number])[] = [
    ['heard', 0, 0.01],
    ['recognised', 1, 0.05],
    ['recalled', 0.5, 0.09],
    ['fluent', 0.5, 0.1875],
    ['mastered', 1, 0.4],
  ];
  for (const [rank, r, bonus] of bonuses)
    it(`is ${String(bonus)} for ${rank} at R̄ = ${String(r)}`, () => {
      expect(wordBonus(rank, r)).toBeCloseTo(bonus, 15);
    });

  it('M_words is 1 plus the bonus of each word sharing a tag, counted once', () => {
    const s = played();
    const t = s.sim;
    const bonusOf = (id: string): number => {
      const one = {
        ...s,
        words: { [id]: s.words[id] ?? newWordMemory(START) },
      };
      return wordMultiplier(course, one, stall, t) - 1;
    };
    // stall shares food with a1-food and b1-food, transport with a1-bus,
    // and both tags with both, which still counts once; toString shares none.
    const want =
      1 +
      bonusOf('a1-food') +
      bonusOf('b1-food') +
      bonusOf('a1-bus') +
      bonusOf('both');
    expect(wordMultiplier(course, s, stall, t)).toBeCloseTo(want, 14);
    expect(bonusOf('toString')).toBe(0);
    expect(wordMultiplier(course, s, tea, t)).toBeCloseTo(
      1 + bonusOf('a1-food') + bonusOf('b1-food') + bonusOf('both'),
      14,
    );
  });

  it(
    'over a whole hour with no event, production equals the continuous model to 1e-12',
    { timeout: REFERENCE_TIMEOUT_MS },
    () => {
      const s = played();
      const h = bucketStart(simMs(s.sim + HOUR_MS));
      const later = integrate(s, h - s.sim);
      const want = continuous(later, h, h + HOUR_MS);
      const got = Num.toNumber(
        producedBetween(course, later, h, simMs(h + HOUR_MS)),
      );
      expect(relative(got, want)).toBeLessThan(1e-12);
      // Liveness: the words move production, so a word-blind rate would fail.
      const blind = { ...later, words: {} };
      expect(
        relative(
          Num.toNumber(producedBetween(course, blind, h, simMs(h + HOUR_MS))),
          want,
        ),
      ).toBeGreaterThan(1e-3);
    },
  );

  it(
    'across three hour boundaries, production equals the continuous model to 1e-12',
    { timeout: REFERENCE_TIMEOUT_MS },
    () => {
      // Whole hours only: each hour runs at its own mean, which equals the
      // exact integral over a whole bucket, so a span using one hour's rate
      // for all three (no bucket split) is off by R's decay across them.
      const s = played();
      const h = bucketStart(simMs(s.sim + HOUR_MS));
      const later = integrate(s, h - s.sim);
      const got = Num.toNumber(
        producedBetween(course, later, h, simMs(h + 3 * HOUR_MS)),
      );
      expect(relative(got, continuous(later, h, h + 3 * HOUR_MS))).toBeLessThan(
        1e-12,
      );
    },
  );

  it(
    'after a review mid-hour, production to the hour’s end equals the continuous model',
    { timeout: REFERENCE_TIMEOUT_MS },
    () => {
      let s = played();
      s = integrate(s, HOUR_MS - (s.sim % HOUR_MS) + 1_234_567);
      s = ok(answerReview(course, s, 'a1-bus', false));
      const end = bucketStart(s.sim) + HOUR_MS;
      const got = Num.toNumber(producedBetween(course, s, s.sim, simMs(end)));
      expect(relative(got, continuous(s, s.sim, end))).toBeLessThan(1e-12);
    },
  );

  it('keeps each word’s mean over the hour through a purchase', () => {
    let s = played();
    s = integrate(s, HOUR_MS - (s.sim % HOUR_MS) + 600_000);
    const before = wordMultiplier(course, s, tea, simMs(s.sim + 1000));
    const bought = ok(buyEncounter(course, s, 'tea', 1));
    expect(bought.anchor.sim).toBe(s.sim);
    expect(wordMultiplier(course, bought, tea, simMs(bought.sim + 1000))).toBe(
      before,
    );
  });

  it('takes R on the wall clock, not the simulated one', () => {
    const s = played();
    const skewed = { ...s, wall: wallMs(s.wall + 20 * DAY_MS) };
    const t = s.sim;
    expect(wordMultiplier(course, skewed, tea, t)).toBeLessThan(
      wordMultiplier(course, s, tea, t),
    );
  });

  it('includes the word multipliers in the rate', () => {
    const s = played();
    const t = s.sim;
    let want = Num.from(0);
    for (const e of [tea, bus, stall]) {
      want = Num.add(
        want,
        Num.mul(
          encounterOutput(e, s.owned[e.id] ?? 0),
          Num.from(wordMultiplier(course, s, e, t)),
        ),
      );
    }
    expect(Num.toTuple(rateAt(course, s, t))).toEqual(Num.toTuple(want));
  });
});

describe('the floor (AC4)', () => {
  it('a never-reviewed word gives exactly half its rank bonus', () => {
    let s = rich(1e6, { tea: 1 });
    s = ok(pickUpWord(course, s));
    expect(wordMultiplier(course, s, tea, s.sim)).toBe(
      1 + 0.5 * BALANCE.words.rankBonus.heard,
    );
  });

  for (const rank of RANKS)
    it(`gives ${rank} exactly half its rank bonus at R̄ = 0`, () => {
      expect(wordBonus(rank, 0)).toBe(0.5 * BALANCE.words.rankBonus[rank]);
    });

  // A word reviewed once, by tea, and the multiplier its floor allows.
  const reviewedFloor = 1 + 0.5 * BALANCE.words.rankBonus.recognised;
  function reviewedTeaAfter(days: number): number {
    let s = rich(1e6, { tea: 1 });
    s = ok(pickUpWord(course, s));
    s = ok(answerReview(course, s, 'a1-food', true));
    const later = integrate(s, Math.round(days * DAY_MS));
    return wordMultiplier(course, later, tea, later.sim);
  }

  it('a reviewed word’s bonus starts above the floor', () => {
    expect(reviewedTeaAfter(0)).toBeGreaterThan(reviewedFloor);
  });

  for (const [earlier, later] of [
    [0, 1],
    [1, 30],
    [30, 365],
    [365, 36_525],
    [36_525, 1e8],
  ] as const)
    it(`a reviewed word’s bonus falls from ${String(earlier)} to ${String(later)} days and stays above the floor`, () => {
      const m = reviewedTeaAfter(later);
      expect(m).toBeGreaterThan(reviewedFloor);
      expect(m).toBeLessThan(reviewedTeaAfter(earlier));
    });

  it('a reviewed word’s bonus has fallen 90% of the way to the floor by 1e8 days', () => {
    // A power law falls slowly: at 1e8 days R is about 0.067 (FSRS-6, S = 2.3 d).
    expect(reviewedTeaAfter(1e8) - reviewedFloor).toBeLessThan(
      0.1 * (reviewedTeaAfter(0) - reviewedFloor),
    );
  });

  it('ranks and memory never change through absence', () => {
    const s = played();
    fc.assert(
      fc.property(fc.integer({ min: -DAY_MS, max: 400 * DAY_MS }), (delta) => {
        expect(advance(course, s, wallMs(s.wall + delta)).state.words).toEqual(
          s.words,
        );
        expect(integrate(s, Math.max(delta, 0)).words).toEqual(s.words);
      }),
      { numRuns: 200 },
    );
  });
});

describe('answering a review (AC5, AC7)', () => {
  for (const id of ['a1-food', 'both', 'b1-food'])
    it(`a correct due answer to ${id} gives 1 + 0.5 × rank index Insight, by the rank it was asked at`, () => {
      const s = at(played(), 400 * DAY_MS);
      const word = s.words[id];
      if (word === undefined) throw new Error(id);
      const next = ok(answerReview(course, s, id, true));
      expect(
        Num.toNumber(
          Num.sub(Num.fromTuple(next.insight), Num.fromTuple(s.insight)),
        ),
      ).toBe(insightFor(word.rank));
      expect(next.words[id]).toEqual(review(word, s.wall, true));
    });

  it('a wrong answer costs nothing and reschedules the word', () => {
    const s = at(played(), 400 * DAY_MS);
    const next = ok(answerReview(course, s, 'both', false));
    expect(next.insight).toEqual(s.insight);
    expect(held(next)).toBe(held(s));
    expect(next.words.both?.card.due).toBeGreaterThan(s.wall);
    expect(next.words.both).toEqual(
      review(s.words.both ?? newWordMemory(START), s.wall, false),
    );
  });

  it('re-anchors at the answer and restarts every word’s hour mean there', () => {
    const s = at(played(), 400 * DAY_MS);
    const next = ok(answerReview(course, s, 'both', true));
    expect(next.anchor.sim).toBe(s.sim);
    expect(next.memorySince).toBe(s.sim);
    expect(Num.toTuple(understandingNow(course, next))).toEqual(
      Num.toTuple(understandingNow(course, s)),
    );
  });

  it('refuses an item that is not due, leaving the state alone', () => {
    let s = rich(1e6);
    s = ok(pickUpWord(course, s));
    s = ok(answerReview(course, s, 'a1-food', true));
    const word = s.words['a1-food'];
    expect(word && word.card.due > s.wall).toBe(true);
    const before = JSON.stringify(s);
    expect(answerReview(course, s, 'a1-food', true)).toEqual({
      ok: false,
      rejection: { kind: 'notDue', itemId: 'a1-food', due: word?.card.due },
    });
    expect(JSON.stringify(s)).toBe(before);
  });

  // Not picked up, including Object.prototype names.
  for (const id of [
    'later',
    'nope',
    'constructor',
    '__proto__',
    'hasOwnProperty',
  ])
    it(`refuses ${id}, a word not picked up`, () => {
      expect(answerReview(course, played(), id, true)).toEqual({
        ok: false,
        rejection: { kind: 'unknownWord', itemId: id },
      });
    });

  it('answers a word whose id is an Object.prototype member', () => {
    let s = rich(1e6);
    for (let k = 0; k < 4; k++) s = ok(pickUpWord(course, s));
    expect(Object.hasOwn(s.words, 'toString')).toBe(true);
    s = ok(answerReview(course, s, 'toString', true));
    expect(pickedWord(s, 'toString')?.rank).toBe('recognised');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('practice (AC8)', () => {
  for (const id of CURRICULUM)
    it(`on ${id} changes no currency, no FSRS state and no rank`, () => {
      const s = played();
      const r = answerPractice(s, id);
      expect(r.ok && r.state).toEqual(s);
    });

  it('is open at any time, due or not, over random states', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 * DAY_MS }),
        fc.constantFrom(...CURRICULUM),
        (delta, id) => {
          const s = at(played(), delta);
          const r = answerPractice(s, id);
          expect(r).toEqual({ ok: true, state: s });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('refuses a word not picked up', () => {
    expect(answerPractice(rich(0), 'a1-food')).toEqual({
      ok: false,
      rejection: { kind: 'unknownWord', itemId: 'a1-food' },
    });
  });
});

describe('the view (AC6, DN23)', () => {
  it('holds Understanding, the rate, Insight and the queue, and nothing else', () => {
    const v = view(course, played(), wallMs(START + 9 * DAY_MS));
    expect(Object.keys(v).sort()).toEqual([
      'insight',
      'queue',
      'rate',
      'understanding',
    ]);
  });

  it('shows the same 10 whether 11 or 50 items are due', () => {
    // Fifty due words beyond the course, all newer than the ten oldest.
    const words = (n: number): Record<string, WordMemory> => {
      const out: Record<string, WordMemory> = {};
      for (let i = 0; i < n; i++) {
        const lastReview = START - (60 - i) * DAY_MS;
        out[`x${String(i).padStart(2, '0')}`] = {
          rank: 'recalled',
          card: {
            ...review(
              newWordMemory(wallMs(lastReview)),
              wallMs(lastReview),
              true,
            ).card,
            due: START,
          },
        };
      }
      return out;
    };
    // Through the view, so the wiring is tested; review.test.ts owns the cap.
    const queueOf = (n: number) =>
      view(course, { ...rich(0), words: words(n) }, START).queue;
    expect(queueOf(50)).toHaveLength(10);
    expect(queueOf(11)).toEqual(queueOf(50));
  });

  it('shows the rate with the word multipliers and the queue at the view’s time', () => {
    const s = played();
    const now = wallMs(s.wall + 2 * DAY_MS);
    const v = view(course, s, now);
    const later = advance(course, s, now).state;
    expect(Num.toTuple(v.rate)).toEqual(
      Num.toTuple(rateAt(course, later, later.sim)),
    );
    expect(v.queue).toEqual(reviewQueue(later.words, now));
    expect(Num.toTuple(v.insight)).toEqual(later.insight);
  });
});

describe('memory ages on the wall clock (AC9)', () => {
  it('after a capped 30-day absence, R reflects 30 days and Understanding the cap', () => {
    const s = played();
    const now = wallMs(s.wall + 30 * DAY_MS);
    const { state: back, summary } = advance(course, s, now);
    expect(summary.creditedMs).toBe(BALANCE.offline.capMs);
    expect(summary.clipped).toBe(true);
    expect(Num.toTuple(understandingNow(course, back))).toEqual(
      Num.toTuple(
        understandingNow(course, integrate(s, BALANCE.offline.capMs)),
      ),
    );
    const word = s.words['a1-food'];
    if (word === undefined) throw new Error('a1-food');
    const item = view(course, back, now).queue.find(
      (q) => q.itemId === 'a1-food',
    );
    expect(item?.retrievability).toBe(wordRetrievability(word, now));
    expect(
      relative(item?.retrievability ?? 0, exactR(word, new D(now))),
    ).toBeLessThan(1e-13);
  });

  it(
    'after a clipped return mid-hour, production to the hour’s end equals the continuous model',
    { timeout: REFERENCE_TIMEOUT_MS },
    () => {
      let s = played();
      s = integrate(s, HOUR_MS - (s.sim % HOUR_MS) + 1_234_567);
      const { state: back, summary } = advance(
        course,
        s,
        wallMs(s.wall + 30 * DAY_MS),
      );
      expect(summary.clipped).toBe(true);
      // The cap is whole hours, so the clip lands 1,234,567 ms into an hour.
      expect(back.sim % HOUR_MS).toBe(1_234_567);
      const end = bucketStart(back.sim) + HOUR_MS;
      const got = Num.toNumber(
        producedBetween(course, back, back.sim, simMs(end)),
      );
      expect(relative(got, continuous(back, back.sim, end))).toBeLessThan(
        1e-12,
      );
    },
  );
});

describe('no reachable state holds NaN, a negative or an infinite value', () => {
  type Step =
    | { readonly kind: 'listen' }
    | { readonly kind: 'buy'; readonly id: string }
    | { readonly kind: 'pick' }
    | {
        readonly kind: 'answer';
        readonly pick: number;
        readonly correct: boolean;
      }
    | { readonly kind: 'advance'; readonly deltaMs: number };

  const step: fc.Arbitrary<Step> = fc.oneof(
    { arbitrary: fc.constant({ kind: 'listen' as const }), weight: 2 },
    {
      arbitrary: fc.record({
        kind: fc.constant('buy' as const),
        id: fc.constantFrom('tea', 'bus', 'stall'),
      }),
      weight: 2,
    },
    { arbitrary: fc.constant({ kind: 'pick' as const }), weight: 2 },
    {
      arbitrary: fc.record({
        kind: fc.constant('answer' as const),
        pick: fc.nat(),
        correct: fc.boolean(),
      }),
      weight: 4,
    },
    {
      arbitrary: fc.record({
        kind: fc.constant('advance' as const),
        deltaMs: fc.integer({ min: -DAY_MS, max: 40 * DAY_MS }),
      }),
      weight: 3,
    },
  );

  function sane(s: GameState): void {
    for (const t of [s.sim, s.wall, s.anchor.sim, s.memorySince]) {
      expect(Number.isSafeInteger(t) && t >= 0).toBe(true);
    }
    expect(s.memorySince).toBeLessThanOrEqual(s.anchor.sim);
    expect(s.anchor.sim).toBeLessThanOrEqual(s.sim);
    for (const n of [
      Num.fromTuple(s.insight),
      understandingNow(course, s),
      rateAt(course, s, s.sim),
    ]) {
      expect(Number.isFinite(n.mantissa) && n.mantissa >= 0).toBe(true);
    }
    for (const w of Object.values(s.words)) {
      for (const x of [
        w.card.due,
        w.card.stability,
        w.card.difficulty,
        w.card.reps,
        w.card.lapses,
      ]) {
        expect(Number.isFinite(x) && x >= 0).toBe(true);
      }
      if (w.card.lastReview !== null)
        expect(w.card.lastReview).toBeLessThanOrEqual(s.wall);
    }
  }

  it(
    'over random sequences of pick-ups, answers, purchases and returns',
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      let picks = 0;
      let answers = 0;
      fc.assert(
        fc.property(
          fc.array(step, { minLength: 20, maxLength: 120, size: 'max' }),
          (steps) => {
            let s = rich(500);
            for (const e of steps) {
              let r: Result | undefined;
              if (e.kind === 'listen') s = listen(course, s);
              if (e.kind === 'buy') r = buyEncounter(course, s, e.id, 1);
              if (e.kind === 'pick') {
                r = pickUpWord(course, s);
                if (r.ok) picks++;
              }
              if (e.kind === 'answer') {
                const due = reviewQueue(s.words, s.wall);
                const q = due[e.pick % Math.max(due.length, 1)];
                if (q !== undefined) {
                  r = answerReview(course, s, q.itemId, e.correct);
                  if (r.ok) answers++;
                }
              }
              if (e.kind === 'advance')
                s = advance(course, s, wallMs(s.wall + e.deltaMs)).state;
              if (r?.ok === true) s = r.state;
              sane(s);
            }
          },
        ),
        { numRuns: 300 },
      );
      expect(picks).toBeGreaterThan(300);
      expect(answers).toBeGreaterThan(1000);
    },
  );
});

/** Not an AC: the bucket helpers the tests rely on behave as stated. */
describe('test fixtures', () => {
  it('played() picks all five words and reviews three, at a sim time mid-hour', () => {
    const s = played();
    expect(Object.keys(s.words).sort()).toEqual([...CURRICULUM].sort());
    expect(
      Object.values(s.words).filter((w) => w.card.lastReview !== null),
    ).toHaveLength(3);
    expect(s.sim % HOUR_MS).not.toBe(0);
  });
});
```

`packages/core/test/sim.test.ts` (change):

```diff
diff --git a/packages/core/test/sim.test.ts b/packages/core/test/sim.test.ts
index a92e496..ba95e10 100644
--- a/packages/core/test/sim.test.ts
+++ b/packages/core/test/sim.test.ts
@@ -83,7 +83,9 @@ function json(state: GameState): string {

 // The random-sequence property replays games through the real actions: 1.8 s
 // alone, 9.8 s measured inside the full core suite on a loaded machine (#28).
-// The property is correctness, so a 5 s timeout would guard only the load.
+// AC6 walks every hour bucket from the anchor (D-M1-2.3) over spans of up to
+// 216 h: 1.3 s alone, over 5 s in the full suite (#28; 53 ms before buckets).
+// Both properties are correctness, so a 5 s timeout would guard only the load.
 const PROPERTY_TIMEOUT_MS = 60_000;

 function relativeError(got: Num, want: Num): number {
@@ -98,6 +100,9 @@ describe('initialState', () => {
       wall: START,
       anchor: { sim: 0, understanding: [0, 0] },
       owned: {},
+      insight: [0, 0],
+      words: {},
+      memorySince: 0,
     });
     expect(JSON.parse(JSON.stringify(s))).toEqual(s);
   });
@@ -219,21 +224,28 @@ const arbState = fc
       understanding: Num.toTuple(Num.from(r.understanding)),
     },
     owned: { tea: r.tea, market: r.market },
+    insight: Num.toTuple(Num.from(0)),
+    words: {},
+    memorySince: simMs(r.anchorSim),
   }));

 describe('integrate (AC6)', () => {
-  it('integrate(integrate(s, a), b) deep-equals integrate(s, a + b), bit for bit', () => {
-    const gap = fc.integer({ min: 0, max: 72 * HOUR_MS });
-    fc.assert(
-      fc.property(arbState, gap, gap, (s, a, b) => {
-        const split = integrate(integrate(s, a), b);
-        const whole = integrate(s, a + b);
-        expect(split).toEqual(whole);
-        expect(u(split)).toEqual(u(whole));
-      }),
-      { numRuns: 1000 },
-    );
-  });
+  it(
+    'integrate(integrate(s, a), b) deep-equals integrate(s, a + b), bit for bit',
+    { timeout: PROPERTY_TIMEOUT_MS },
+    () => {
+      const gap = fc.integer({ min: 0, max: 72 * HOUR_MS });
+      fc.assert(
+        fc.property(arbState, gap, gap, (s, a, b) => {
+          const split = integrate(integrate(s, a), b);
+          const whole = integrate(s, a + b);
+          expect(split).toEqual(whole);
+          expect(u(split)).toEqual(u(whole));
+        }),
+        { numRuns: 1000 },
+      );
+    },
+  );

   it('moves both clocks by the same amount', () => {
     const s = stateWith({ tea: 1 }, 0, 500);
```

`packages/core/test/balance.test.ts` (change):

```diff
diff --git a/packages/core/test/balance.test.ts b/packages/core/test/balance.test.ts
index 7b304f4..f1eb7b4 100644
--- a/packages/core/test/balance.test.ts
+++ b/packages/core/test/balance.test.ts
@@ -86,6 +86,11 @@ describe('BALANCE', () => {
       (b) => b.words.floorShare,
       0.5,
     ],
+    [
+      'design §5: the n-th pick-up in a destination costs 20 x 1.15^n',
+      (b) => [b.words.pickUpC0, b.words.pickUpGrowth],
+      [20, 1.15],
+    ],
     [
       'parent §3.4: rank stability thresholds in days',
       (b) => b.memory.rankStabilityDays,
```

- [ ] **Step 2: Add the throwing stubs**

`packages/core/src/words.ts` (stub):

```ts
// Task 3 stub: every export throws (Refs #28).

export function currentDestination(..._args: unknown[]): never {
  throw new Error('not implemented: currentDestination');
}

export function curriculum(..._args: unknown[]): never {
  throw new Error('not implemented: curriculum');
}

export function pickUpCost(..._args: unknown[]): never {
  throw new Error('not implemented: pickUpCost');
}

export function wordBonus(..._args: unknown[]): never {
  throw new Error('not implemented: wordBonus');
}

export function sharesTag(..._args: unknown[]): never {
  throw new Error('not implemented: sharesTag');
}

export function lexiconItem(..._args: unknown[]): never {
  throw new Error('not implemented: lexiconItem');
}
```

`packages/core/src/state.ts` (stub):

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

export function pickedWord(..._args: unknown[]): never {
  throw new Error('not implemented: pickedWord');
}
```

`packages/core/src/production.ts` (stub):

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

export function wordMultiplier(..._args: unknown[]): never {
  throw new Error('not implemented: wordMultiplier');
}

export function rateAt(..._args: unknown[]): never {
  throw new Error('not implemented: rateAt');
}
```

`packages/core/src/sim.ts` (stub):

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

export function pickUpWord(..._args: unknown[]): never {
  throw new Error('not implemented: pickUpWord');
}

export function answerReview(..._args: unknown[]): never {
  throw new Error('not implemented: answerReview');
}

export function answerPractice(..._args: unknown[]): never {
  throw new Error('not implemented: answerPractice');
}
```

`packages/core/src/balance.ts` (stub):

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

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run packages/core/test/words.test.ts packages/core/test/sim.test.ts packages/core/test/balance.test.ts`
Expected: `Tests  67 failed | 62 passed (129)`. All 65 tests in `words.test.ts` fail (`Error: not implemented: pickUpWord` and the other named stubs), with `initialState` "starts with nothing at simulated time 0" (the stub state lacks `insight`, `words` and `memorySince`) and the balance pin "the n-th pick-up in a destination costs 20 x 1.15^n" (`expected [ undefined, undefined ] to deeply equal [ 20, 1.15 ]`). The 62 that pass are #27's own `sim` and `balance` tests, which the stubs leave real.

- [ ] **Step 4: Implement**

`packages/core/src/words.ts`:

```ts
/**
 * Words (parent spec §3.3): pick-up, tags and the rank bonus.
 *
 * Spending Understanding picks up the next lexicon item of the current
 * destination in curriculum order: CEFR first, then the course's own order.
 * Each word boosts every Encounter sharing one of its tags by
 * b_w = rankBonus[rank] x (floorShare + (1 - floorShare) x R), so it never
 * falls below floorShare x rankBonus however long it goes unreviewed (DN16).
 */
import { BALANCE, type Rank } from './balance';
import type { Cefr, CourseData, Destination, LexiconItem } from './course';
import { Num } from './num';

const CEFR_ORDER: Readonly<Record<Cefr, number>> = { A1: 0, A2: 1, B1: 2 };
const PICK_UP_C0 = Num.from(BALANCE.words.pickUpC0);
const PICK_UP_GROWTH = Num.from(BALANCE.words.pickUpGrowth);

/**
 * The destination words are picked up from: the course's first until Set
 * Sail (#31) moves the player on.
 */
export function currentDestination(
  course: CourseData,
): Destination | undefined {
  return course.regions[0]?.destinations[0];
}

/** A destination's lexicon in curriculum order: CEFR, then course order. */
export function curriculum(destination: Destination): readonly LexiconItem[] {
  // Array.prototype.sort is stable, so equal CEFR keeps the course's order.
  return [...destination.lexicon].sort(
    (a, b) => CEFR_ORDER[a.cefr] - CEFR_ORDER[b.cefr],
  );
}

/** The cost of the next pick-up when `picked` items of the destination are held. */
export function pickUpCost(picked: number): Num {
  if (!Number.isSafeInteger(picked) || picked < 0) {
    throw new RangeError(
      `picked must be a safe non-negative integer, got ${String(picked)}`,
    );
  }
  return Num.mul(PICK_UP_C0, Num.pow(PICK_UP_GROWTH, picked));
}

/** A word's bonus at `rank` with mean retrievability `meanR` (parent §3.3). */
export function wordBonus(rank: Rank, meanR: number): number {
  const { rankBonus, floorShare } = BALANCE.words;
  return rankBonus[rank] * (floorShare + (1 - floorShare) * meanR);
}

/** Whether two tag lists share at least one tag. */
export function sharesTag(a: readonly string[], b: readonly string[]): boolean {
  return a.some((tag) => b.includes(tag));
}

const itemIndexes = new WeakMap<CourseData, ReadonlyMap<string, LexiconItem>>();

/** The lexicon item `id` anywhere in the course. */
export function lexiconItem(course: CourseData, id: string): LexiconItem {
  let index = itemIndexes.get(course);
  if (index === undefined) {
    const built = new Map<string, LexiconItem>();
    for (const region of course.regions) {
      for (const destination of region.destinations) {
        for (const item of destination.lexicon) built.set(item.id, item);
      }
    }
    itemIndexes.set(course, built);
    index = built;
  }
  const item = index.get(id);
  if (item === undefined) {
    throw new RangeError(`word ${id} is not in course ${course.id}`);
  }
  return item;
}
```

`packages/core/src/state.ts` (change):

```diff
diff --git a/packages/core/src/state.ts b/packages/core/src/state.ts
index 8c7398e..15c9015 100644
--- a/packages/core/src/state.ts
+++ b/packages/core/src/state.ts
@@ -8,6 +8,7 @@
  * an interval unable to change any stored arithmetic.
  */
 import { simMs, type SimMs, type WallMs } from './clock';
+import type { WordMemory } from './memory';
 import { Num, type NumTuple } from './num';

 export interface Anchor {
@@ -24,9 +25,20 @@ export interface GameState {
   readonly anchor: Anchor;
   /** Encounters owned, by id. An id that is absent is owned 0 times. */
   readonly owned: Readonly<Record<string, number>>;
+  /** Insight held. Only correct due reviews earn it, so it never accrues between events. */
+  readonly insight: NumTuple;
+  /** Words picked up, by lexicon item id: each one's rank and FSRS card. */
+  readonly words: Readonly<Record<string, WordMemory>>;
+  /**
+   * The simulated time since which every word's retrievability curve and the
+   * wall-minus-sim skew have held unchanged: the last review or offline-cap
+   * clip. Each word's mean R in an hour bucket is taken from here or the
+   * bucket's start, whichever is later (design §2.2 item 3).
+   */
+  readonly memorySince: SimMs;
 }

-/** A new game at wall time `wall`: nothing owned, no Understanding. */
+/** A new game at wall time `wall`: nothing owned, no Understanding, no words. */
 export function initialState(wall: WallMs): GameState {
   const start = simMs(0);
   return {
@@ -34,6 +46,9 @@ export function initialState(wall: WallMs): GameState {
     wall,
     anchor: { sim: start, understanding: Num.toTuple(Num.from(0)) },
     owned: {},
+    insight: Num.toTuple(Num.from(0)),
+    words: {},
+    memorySince: start,
   };
 }

@@ -41,3 +56,11 @@ export function initialState(wall: WallMs): GameState {
 export function ownedCount(state: GameState, id: string): number {
   return Object.hasOwn(state.owned, id) ? (state.owned[id] ?? 0) : 0;
 }
+
+/** The memory of word `id` if it has been picked up. Reads own keys only. */
+export function pickedWord(
+  state: GameState,
+  id: string,
+): WordMemory | undefined {
+  return Object.hasOwn(state.words, id) ? state.words[id] : undefined;
+}
```

`packages/core/src/production.ts` (change):

```diff
diff --git a/packages/core/src/production.ts b/packages/core/src/production.ts
index bde3621..6597458 100644
--- a/packages/core/src/production.ts
+++ b/packages/core/src/production.ts
@@ -1,21 +1,32 @@
 /**
  * Production over simulated time (M1 design §2.2).
  *
- * The rate is constant inside each clock hour. In #27 nothing varies it
- * between events at all (there are no word or global multipliers yet), so
- * production over any span between two events is the rate times its length.
- * #28 makes the rate vary by hour bucket (each word's mean retrievability over
- * the bucket) and sums bucket by bucket from there.
+ * The rate is constant inside each clock hour, a bucket. Each Encounter's
+ * output is multiplied by M_words = 1 + the sum of b_w over the words sharing
+ * one of its tags (parent §3.3), and a word's bonus in a bucket uses its
+ * exact mean retrievability over the bucket, on the wall clock, from the
+ * later of the bucket's start and `memorySince`. The rate is linear in each
+ * word's R, so an hour with no event produces exactly what the continuous
+ * model does. A purchase leaves `memorySince` alone, so a bucket's means are
+ * reused across it; a review or an offline-cap clip moves it, so the means
+ * restart there.
  */
-import type { SimMs } from './clock';
-import type { CourseData } from './course';
+import { DAY_MS, HOUR_MS, bucketStart, simMs, type SimMs } from './clock';
+import type { CourseData, Encounter } from './course';
 import { encounterOutput } from './encounters';
+import { meanRetrievability } from './memory';
 import { Num } from './num';
 import { ownedCount, type GameState } from './state';
+import { lexiconItem, sharesTag, wordBonus } from './words';

 const THOUSAND = Num.from(1000);

-/** Understanding per second from every owned Encounter (parent §3.2). */
+interface TaggedBonus {
+  readonly tags: readonly string[];
+  readonly bonus: number;
+}
+
+/** Understanding per second from every owned Encounter, before any multiplier. */
 export function encounterRate(course: CourseData, state: GameState): Num {
   let rate = Num.from(0);
   for (const region of course.regions) {
@@ -27,7 +38,81 @@ export function encounterRate(course: CourseData, state: GameState): Num {
   return rate;
 }

-/** Understanding produced over `[from, to)` by the state's owned Encounters. */
+/**
+ * Every word's bonus in the bucket holding `t`, in code-unit order of id, so
+ * the sums that use them add in the same order on every engine.
+ */
+function bucketBonuses(
+  course: CourseData,
+  state: GameState,
+  t: SimMs,
+): readonly TaggedBonus[] {
+  const start = bucketStart(t);
+  const from = Math.max(start, state.memorySince);
+  const spanDays = (start + HOUR_MS - from) / DAY_MS;
+  const skew = state.wall - state.sim;
+  return Object.entries(state.words)
+    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
+    .map(([id, word]) => {
+      const { lastReview, stability } = word.card;
+      const meanR =
+        lastReview === null
+          ? 0
+          : meanRetrievability(
+              stability,
+              (from + skew - lastReview) / DAY_MS,
+              spanDays,
+            );
+      return {
+        tags: lexiconItem(course, id).tags,
+        bonus: wordBonus(word.rank, meanR),
+      };
+    });
+}
+
+function multiplier(
+  bonuses: readonly TaggedBonus[],
+  encounter: Encounter,
+): number {
+  let m = 1;
+  for (const { tags, bonus } of bonuses) {
+    if (sharesTag(tags, encounter.tags)) m += bonus;
+  }
+  return m;
+}
+
+/** M_words for `encounter` in the bucket holding `t`. */
+export function wordMultiplier(
+  course: CourseData,
+  state: GameState,
+  encounter: Encounter,
+  t: SimMs,
+): number {
+  return multiplier(bucketBonuses(course, state, t), encounter);
+}
+
+/** Understanding per second in the bucket holding `t`, word multipliers included. */
+export function rateAt(course: CourseData, state: GameState, t: SimMs): Num {
+  let bonuses: readonly TaggedBonus[] | undefined;
+  let rate = Num.from(0);
+  for (const region of course.regions) {
+    for (const encounter of region.encounters) {
+      const owned = ownedCount(state, encounter.id);
+      if (owned === 0) continue;
+      bonuses ??= bucketBonuses(course, state, t);
+      rate = Num.add(
+        rate,
+        Num.mul(
+          encounterOutput(encounter, owned),
+          Num.from(multiplier(bonuses, encounter)),
+        ),
+      );
+    }
+  }
+  return rate;
+}
+
+/** Understanding produced over `[from, to)`, bucket by bucket. */
 export function producedBetween(
   course: CourseData,
   state: GameState,
@@ -39,6 +124,14 @@ export function producedBetween(
       `producedBetween: ${String(to)} is before ${String(from)}`,
     );
   }
-  const rate = encounterRate(course, state);
-  return Num.div(Num.mul(rate, Num.from(to - from)), THOUSAND);
+  let total = Num.from(0);
+  for (let t = from; t < to;) {
+    const end = simMs(Math.min(bucketStart(t) + HOUR_MS, to));
+    total = Num.add(
+      total,
+      Num.mul(rateAt(course, state, t), Num.from(end - t)),
+    );
+    t = end;
+  }
+  return Num.div(total, THOUSAND);
 }
```

`packages/core/src/sim.ts` (change):

```diff
diff --git a/packages/core/src/sim.ts b/packages/core/src/sim.ts
index 1d12708..e4893d8 100644
--- a/packages/core/src/sim.ts
+++ b/packages/core/src/sim.ts
@@ -1,20 +1,31 @@
 /**
- * The time model and the Encounter actions (M1 design §2.2, §2.3, §4).
+ * The time model and the actions (M1 design §2.2, §2.3, §4).
  *
  * `integrate` is the pure, uncapped primitive: it moves both clocks by the
  * same amount and touches nothing else, because every stored quantity is
  * held at the anchor. `advance` is what a returning player gets: elapsed wall
  * time clamped to `[0, offline cap]`. `view` derives "now" values without
  * changing state. Actions act at the state's own simulated time; a caller
- * advances to the event's wall time first.
+ * advances to the event's wall time first. Every action that changes a
+ * stored quantity re-anchors first, so production up to the action is banked
+ * at the rates that held before it.
  */
 import { BALANCE } from './balance';
 import { simMs, wallMs, type WallMs } from './clock';
 import type { CourseData, Encounter } from './course';
 import { purchaseCost } from './encounters';
+import {
+  insightFor,
+  isDue,
+  newWordMemory,
+  review,
+  reviewQueue,
+  type QueueItem,
+} from './memory';
 import { Num, type NumTuple } from './num';
-import { encounterRate, producedBetween } from './production';
-import { ownedCount, type GameState } from './state';
+import { producedBetween, rateAt } from './production';
+import { ownedCount, pickedWord, type GameState } from './state';
+import { currentDestination, curriculum, pickUpCost } from './words';

 export type Rejection =
   | { readonly kind: 'unknownEncounter'; readonly id: string }
@@ -23,7 +34,10 @@ export type Rejection =
       readonly kind: 'unaffordable';
       readonly cost: NumTuple;
       readonly understanding: NumTuple;
-    };
+    }
+  | { readonly kind: 'poolEmpty' }
+  | { readonly kind: 'unknownWord'; readonly itemId: string }
+  | { readonly kind: 'notDue'; readonly itemId: string; readonly due: number };

 export type Result =
   | { readonly ok: true; readonly state: GameState }
@@ -39,8 +53,11 @@ export interface AdvanceSummary {

 export interface View {
   readonly understanding: Num;
-  /** Understanding per second. */
+  /** Understanding per second, word multipliers included. */
   readonly rate: Num;
+  readonly insight: Num;
+  /** At most 10 due items; how many more are due is never shown (DN23). */
+  readonly queue: readonly QueueItem[];
 }

 /** Understanding at the state's simulated time: the anchor's, plus production since. */
@@ -77,7 +94,8 @@ export function integrate(state: GameState, elapsedMs: number): GameState {
  * clamped to `[0, offline cap]`, is credited to both clocks, and the wall
  * clock becomes `max(wall, now)`. When the cap clips, the wall clock runs on
  * past the simulated one; that changes the skew between them, so the state
- * is re-anchored first (the skew only ever changes at an anchor).
+ * is re-anchored first (the skew only ever changes at an anchor) and every
+ * word's hour mean restarts there.
  */
 export function advance(
   course: CourseData,
@@ -89,7 +107,9 @@ export function advance(
   const credited = Math.min(Math.max(elapsed, 0), cap);
   let next = integrate(state, credited);
   const clipped = elapsed > cap;
-  if (clipped) next = { ...reanchor(course, next), wall: now };
+  if (clipped) {
+    next = { ...reanchor(course, next), wall: now, memorySince: next.sim };
+  }
   const earned = Num.sub(
     understandingNow(course, next),
     understandingNow(course, state),
@@ -109,7 +129,9 @@ export function view(course: CourseData, state: GameState, now: WallMs): View {
   const at = advance(course, state, now).state;
   return {
     understanding: understandingNow(course, at),
-    rate: encounterRate(course, at),
+    rate: rateAt(course, at, at.sim),
+    insight: Num.fromTuple(at.insight),
+    queue: reviewQueue(at.words, at.wall),
   };
 }

@@ -174,3 +196,94 @@ export function buyEncounter(
     },
   };
 }
+
+/**
+ * Pick up the next word of the current destination in curriculum order,
+ * paying for it from Understanding (parent §3.3).
+ */
+export function pickUpWord(course: CourseData, state: GameState): Result {
+  const destination = currentDestination(course);
+  const pool = destination === undefined ? [] : curriculum(destination);
+  const next = pool.find((item) => pickedWord(state, item.id) === undefined);
+  if (next === undefined) {
+    return { ok: false, rejection: { kind: 'poolEmpty' } };
+  }
+  const picked = pool.filter(
+    (item) => pickedWord(state, item.id) !== undefined,
+  );
+  const cost = pickUpCost(picked.length);
+  const anchored = reanchor(course, state);
+  const understanding = Num.fromTuple(anchored.anchor.understanding);
+  if (Num.cmp(understanding, cost) < 0) {
+    return {
+      ok: false,
+      rejection: {
+        kind: 'unaffordable',
+        cost: Num.toTuple(cost),
+        understanding: Num.toTuple(understanding),
+      },
+    };
+  }
+  return {
+    ok: true,
+    state: {
+      ...anchored,
+      anchor: {
+        ...anchored.anchor,
+        understanding: Num.toTuple(Num.sub(understanding, cost)),
+      },
+      words: { ...anchored.words, [next.id]: newWordMemory(state.wall) },
+    },
+  };
+}
+
+/**
+ * Answer the due review of word `itemId` at the state's wall time (parent
+ * §3.4): a correct answer earns Insight by the rank it was asked at; a wrong
+ * one costs nothing. Either way FSRS reschedules the word, and every word's
+ * hour mean restarts here.
+ */
+export function answerReview(
+  course: CourseData,
+  state: GameState,
+  itemId: string,
+  correct: boolean,
+): Result {
+  const word = pickedWord(state, itemId);
+  if (word === undefined) {
+    return { ok: false, rejection: { kind: 'unknownWord', itemId } };
+  }
+  if (!isDue(word, state.wall)) {
+    return {
+      ok: false,
+      rejection: { kind: 'notDue', itemId, due: word.card.due },
+    };
+  }
+  const anchored = reanchor(course, state);
+  const insight = correct
+    ? Num.add(Num.fromTuple(anchored.insight), Num.from(insightFor(word.rank)))
+    : Num.fromTuple(anchored.insight);
+  return {
+    ok: true,
+    state: {
+      ...anchored,
+      insight: Num.toTuple(insight),
+      words: {
+        ...anchored.words,
+        [itemId]: review(word, state.wall, correct),
+      },
+      memorySince: state.sim,
+    },
+  };
+}
+
+/**
+ * Practise word `itemId`: open at any time, and it changes nothing, so it
+ * cannot be ground for currency or rank (DN24).
+ */
+export function answerPractice(state: GameState, itemId: string): Result {
+  if (pickedWord(state, itemId) === undefined) {
+    return { ok: false, rejection: { kind: 'unknownWord', itemId } };
+  }
+  return { ok: true, state };
+}
```

`packages/core/src/balance.ts` (change):

```diff
diff --git a/packages/core/src/balance.ts b/packages/core/src/balance.ts
index 8f9a10f..1ae0cb2 100644
--- a/packages/core/src/balance.ts
+++ b/packages/core/src/balance.ts
@@ -35,6 +35,9 @@ export interface Balance {
     /** b_w = rankBonus[rank] x (floorShare + (1 - floorShare) x R) (parent §3.3). */
     readonly rankBonus: Readonly<Record<Rank, number>>;
     readonly floorShare: number;
+    /** The n-th pick-up in a destination (n already picked there) costs pickUpC0 x pickUpGrowth^n (design §5). */
+    readonly pickUpC0: number;
+    readonly pickUpGrowth: number;
   };
   readonly memory: {
     /** FSRS stability, in days, at which each rank above Heard is reached (parent §3.4). */
@@ -118,6 +121,8 @@ export const BALANCE: Balance = deepFreeze({
       mastered: 0.4,
     },
     floorShare: 0.5,
+    pickUpC0: 20,
+    pickUpGrowth: 1.15,
   },
   memory: {
     rankStabilityDays: { recognised: 2, recalled: 7, fluent: 14, mastered: 30 },
```

- [ ] **Step 5: Run the tests and the gate**

Run: `npx vitest run packages/core/test/words.test.ts packages/core/test/sim.test.ts packages/core/test/balance.test.ts`
Expected: `Tests  129 passed (129)`.
Run: the gate as in Task 1.
Expected: all pass; `test:unit` reports `Tests  3049 passed (3049)`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): words in game state, bucketed production, review and practice actions (Refs #28)"
```

- [ ] **Step 7: Verify every guard by mutation**

| ID                | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Predicted red                                                                                                                                                                                                                                                                                                                                           | Result                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| M3.1              | `production.ts`: `const from = Math.max(start, state.memorySince);` → `const from = start;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | re-anchors at the answer and restarts every word’s hour mean there; after a review mid-hour                                                                                                                                                                                                                                                             | CAUGHT as predicted (30 failed \| 3034 passed (3064)) |
| M3.2              | `production.ts`: `const skew = state.wall - state.sim;` → `const skew = 0;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | takes R on the wall clock, not the simulated one                                                                                                                                                                                                                                                                                                        | CAUGHT as predicted (36 failed \| 3028 passed (3064)) |
| M3.3              | `words.ts`: `return rankBonus[rank] * (floorShare + (1 - floorShare) * meanR);` → `return rankBonus[rank] * meanR;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | a never-reviewed word gives exactly half its rank bonus; is 0.01 for heard at R̄ = 0; is 0.09 for recalled at R̄ = 0.5; is 0.1875 for fluent at R̄ = 0.5                                                                                                                                                                                                   | CAUGHT as predicted (16 failed \| 3048 passed (3064)) |
| M3.4              | `production.ts`: `if (sharesTag(tags, encounter.tags)) m += bonus;` → `for (const tag of tags) if (encounter.tags.includes(tag)) m += bonus;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | counted once                                                                                                                                                                                                                                                                                                                                            | CAUGHT as predicted (5 failed \| 3059 passed (3064))  |
| M3.5              | `words.ts`: `(a, b) => CEFR_ORDER[a.cefr] - CEFR_ORDER[b.cefr],` → `() => 0,`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | takes the destination’s items in CEFR order, then course order                                                                                                                                                                                                                                                                                          | CAUGHT as predicted (11 failed \| 3053 passed (3064)) |
| M3.6              | `sim.ts`: `const cost = pickUpCost(picked.length);` → `const cost = pickUpCost(picked.length + 1);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | charges pickUpCost(0) with 0 already picked; charges pickUpCost(1) with 1 already picked; charges pickUpCost(2) with 2 already picked; charges pickUpCost(3) with 3 already picked; charges pickUpCost(4) with 4 already picked; picks up with exactly the cost, leaving zero                                                                           | CAUGHT as predicted (9 failed \| 3055 passed (3064))  |
| M3.7              | `sim.ts`: `const cost = pickUpCost(picked.length);⏎  const anchored = reanchor(course, state);⏎  const understanding = Num.fromTuple(anchored.anchor.understanding);⏎  if (Num.cmp(understanding, cost) < 0) {` → `const cost = pickUpCost(picked.length);⏎  const anchored = reanchor(course, state);⏎  const understanding = Num.fromTuple(anchored.anchor.understanding);⏎  if (Num.cmp(understanding, cost) <= 0) {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | picks up with exactly the cost, leaving zero                                                                                                                                                                                                                                                                                                            | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| M3.8              | `sim.ts`: `  const insight = correct` → `  const insight = true`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | a wrong answer costs nothing and reschedules the word                                                                                                                                                                                                                                                                                                   | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| M3.9              | `sim.ts`: `      memorySince: state.sim,` → ``                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | re-anchors at the answer and restarts every word’s hour mean there                                                                                                                                                                                                                                                                                      | CAUGHT as predicted (30 failed \| 3034 passed (3064)) |
| M3.10             | `sim.ts`: `if (!isDue(word, state.wall)) {` → `if (false) {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | refuses an item that is not due, leaving the state alone                                                                                                                                                                                                                                                                                                | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| M3.11             | `production.ts`: `Num.from(multiplier(bonuses, encounter)),` → `Num.from(1),`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | includes the word multipliers in the rate                                                                                                                                                                                                                                                                                                               | CAUGHT as predicted (5 failed \| 3059 passed (3064))  |
| M3.12             | `production.ts`: `const end = simMs(Math.min(bucketStart(t) + HOUR_MS, to));` → `const end = to;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | across three hour boundaries, production equals the continuous model to 1e-12                                                                                                                                                                                                                                                                           | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| M3.13             | `state.ts`: `return Object.hasOwn(state.words, id) ? state.words[id] : undefined;` → `return id in state.words ? state.words[id] : undefined;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | refuses constructor, a word not picked up; refuses **proto**, a word not picked up; refuses hasOwnProperty, a word not picked up                                                                                                                                                                                                                        | CAUGHT as predicted (41 failed \| 3023 passed (3064)) |
| M3.14             | `sim.ts`: `  if (next === undefined) {⏎    return { ok: false, rejection: { kind: 'poolEmpty' } };⏎  }⏎  const picked = pool.filter(⏎    (item) => pickedWord(state, item.id) !== undefined,⏎  );⏎  const cost = pickUpCost(picked.length);⏎  const anchored = reanchor(course, state);⏎  const understanding = Num.fromTuple(anchored.anchor.understanding);⏎  if (Num.cmp(understanding, cost) < 0) {⏎    return {⏎      ok: false,⏎      rejection: {⏎        kind: 'unaffordable',⏎        cost: Num.toTuple(cost),⏎        understanding: Num.toTuple(understanding),⏎      },⏎    };⏎  }` → `  const picked = pool.filter(⏎    (item) => pickedWord(state, item.id) !== undefined,⏎  );⏎  const cost = pickUpCost(picked.length);⏎  const anchored = reanchor(course, state);⏎  const understanding = Num.fromTuple(anchored.anchor.understanding);⏎  if (Num.cmp(understanding, cost) < 0) {⏎    return {⏎      ok: false,⏎      rejection: {⏎        kind: 'unaffordable',⏎        cost: Num.toTuple(cost),⏎        understanding: Num.toTuple(understanding),⏎      },⏎    };⏎  }⏎  if (next === undefined) {⏎    return { ok: false, rejection: { kind: 'poolEmpty' } };⏎  }` | is refused as empty, not unaffordable, when the next pick-up could not be paid for either                                                                                                                                                                                                                                                               | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| M3.15             | `sim.ts`: `  return { ok: true, state };⏎}` → `  return { ok: true, state: { ...state, insight: [1, 0] } };⏎}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | on a1-food changes no currency, no FSRS state and no rank; on a1-bus changes no currency, no FSRS state and no rank; on both changes no currency, no FSRS state and no rank; on toString changes no currency, no FSRS state and no rank; on b1-food changes no currency, no FSRS state and no rank; is open at any time, due or not, over random states | CAUGHT as predicted (6 failed \| 3058 passed (3064))  |
| M3.16             | `sim.ts`: `next = { ...reanchor(course, next), wall: now, memorySince: next.sim };` → `next = { ...reanchor(course, next), wall: now };`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | after a clipped return mid-hour, production to the hour’s end equals the continuous model                                                                                                                                                                                                                                                               | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| pickup-3          | `sim.ts`: `  const cost = pickUpCost(picked.length);` → `  const cost = pickUpCost(picked.length === 3 ? 4 : picked.length);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | charges pickUpCost(3) with 3 already picked                                                                                                                                                                                                                                                                                                             | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| bonus-fluent-half | `words.ts`: `  return rankBonus[rank] * (floorShare + (1 - floorShare) * meanR);` → `  if (rank === 'fluent' && meanR === 0.5) return 0.19;⏎  return rankBonus[rank] * (floorShare + (1 - floorShare) * meanR);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | is 0.1875 for fluent at R̄ = 0.5                                                                                                                                                                                                                                                                                                                         | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| floor-mastered    | `words.ts`: `  return rankBonus[rank] * (floorShare + (1 - floorShare) * meanR);` → `  if (rank === 'mastered' && meanR === 0) return 0.21;⏎  return rankBonus[rank] * (floorShare + (1 - floorShare) * meanR);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | gives mastered exactly half its rank bonus at R̄ = 0                                                                                                                                                                                                                                                                                                     | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| floor-falls-1-30  | `memory.ts`: `  const shifted = stabilityDays + FACTOR * fromDays;` → `  if (stabilityDays === 2.3065 && fromDays >= 30 && fromDays < 31) return 0.99;⏎  const shifted = stabilityDays + FACTOR * fromDays;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | falls from 1 to 30 days and stays above the floor; after a clipped return mid-hour, production to the hour’s end equals the continuous model                                                                                                                                                                                                            | CAUGHT as predicted (2 failed \| 3062 passed (3064))  |
| insight-both      | `sim.ts`: `    ? Num.add(Num.fromTuple(anchored.insight), Num.from(insightFor(word.rank)))` → `    ? Num.add(Num.fromTuple(anchored.insight), Num.from(insightFor(word.rank) + (itemId === 'both' ? 1 : 0)))`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a correct due answer to both gives                                                                                                                                                                                                                                                                                                                      | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| refuse-nope       | `sim.ts`: `  const word = pickedWord(state, itemId);⏎  if (word === undefined) {` → `  const word = pickedWord(state, itemId);⏎  if (word === undefined && itemId !== 'nope') {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | refuses nope, a word not picked up                                                                                                                                                                                                                                                                                                                      | CAUGHT as predicted (1 failed \| 3063 passed (3064))  |
| practice-toString | `sim.ts`: `  return { ok: true, state };⏎}` → `  return { ok: true, state: itemId === 'toString' ? { ...state, insight: [1, 0] } : state };⏎}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | on toString changes no currency, no FSRS state and no rank; is open at any time, due or not, over random states                                                                                                                                                                                                                                         | CAUGHT as predicted (2 failed \| 3062 passed (3064))  |

### Task 4: Golden vectors for the FSRS review and the mean R on every engine

M1 design §2.1 measured the ts-fsrs scheduler across engines with short-term steps off; core ships ts-fsrs's defaults, steps on. This task adds core's own `review` and `meanRetrievability` to #26's golden-vector harness, which hashes 100,000 results per function in Node and in each browser engine.

**Files:**

- Modify: `packages/core/test/golden-vectors.ts`, `packages/core/test/golden-vectors.test.ts`, `tests/unit/one-test-per-case.test.ts` (the spec's new path in its liveness check)
- Rename: `tests/engines/det-math.spec.ts` → `tests/engines/golden-vectors.spec.ts` (it now covers more than det-math)

**Interfaces:**

- Produces: `FUNCTIONS` gains `'meanR'` and `'review'`; `digest(fn)` hashes 4,000 cards × 25 seeded reviews for `review`. `digests()` is removed: its one caller was the old all-in-one pin, which becomes one test per function.

- [ ] **Step 1: Write the failing pins** (the two new digests start as `'unmeasured'`)

`packages/core/test/golden-vectors.test.ts` (change):

```diff
diff --git a/packages/core/test/golden-vectors.test.ts b/packages/core/test/golden-vectors.test.ts
index 68169d6..ed9643c 100644
--- a/packages/core/test/golden-vectors.test.ts
+++ b/packages/core/test/golden-vectors.test.ts
@@ -1,8 +1,14 @@
 import { describe, expect, it } from 'vitest';
-import { digests, FUNCTIONS, VECTORS_PER_FUNCTION } from './golden-vectors';
+import {
+  digest,
+  FUNCTIONS,
+  VECTORS_PER_FUNCTION,
+  type GoldenFunction,
+} from './golden-vectors';

 /**
- * The golden vectors' Node digests (#26 AC10), measured 2026-10-01.
+ * The golden vectors' Node digests (#26 AC10, #28): det-math measured
+ * 2026-10-01, meanR and review 2026-10-02.
  *
  * tests/engines proves each browser engine gives Node's bits; this pin proves
  * Node's bits have not moved. A det-math change that alters any result, such
@@ -10,8 +16,19 @@ import { digests, FUNCTIONS, VECTORS_PER_FUNCTION } from './golden-vectors';
  * every engine, before the cross-engine comparison runs.
  */

-describe('det-math golden vectors', () => {
-  it('cover at least 100,000 inputs for each of the six functions', () => {
+const PINNED: Record<GoldenFunction, string> = {
+  pow: '3d7063d7ea64de4e',
+  exp: '282e82fba82afd4e',
+  ln: 'c42cd90d8c5957cf',
+  log10: '7975fd2b8f7c506e',
+  expm1: '2c1250daae88b5ac',
+  log1p: '2b1b9cb3cddb4cb2',
+  meanR: 'ec29edb532f4e19d',
+  review: '1856bc56fcfef272',
+};
+
+describe('golden vectors', () => {
+  it('cover 100,000 vectors for each of the eight functions', () => {
     expect(VECTORS_PER_FUNCTION).toBe(100_000);
     expect([...FUNCTIONS].sort()).toEqual([
       'exp',
@@ -19,18 +36,14 @@ describe('det-math golden vectors', () => {
       'ln',
       'log10',
       'log1p',
+      'meanR',
       'pow',
+      'review',
     ]);
   });

-  it('hash to the pinned digests under Node', () => {
-    expect(digests()).toEqual({
-      pow: '3d7063d7ea64de4e',
-      exp: '282e82fba82afd4e',
-      ln: 'c42cd90d8c5957cf',
-      log10: '7975fd2b8f7c506e',
-      expm1: '2c1250daae88b5ac',
-      log1p: '2b1b9cb3cddb4cb2',
+  for (const fn of FUNCTIONS)
+    it(`${fn} hashes to its pinned digest under Node`, () => {
+      expect(digest(fn)).toBe(PINNED[fn]);
     });
-  });
 });
```

- [ ] **Step 2: Extend the harness**

`packages/core/test/golden-vectors.ts` (change):

```diff
diff --git a/packages/core/test/golden-vectors.ts b/packages/core/test/golden-vectors.ts
index 1d23137..638e79c 100644
--- a/packages/core/test/golden-vectors.ts
+++ b/packages/core/test/golden-vectors.ts
@@ -1,15 +1,27 @@
+import { DAY_MS, HOUR_MS, wallMs } from '../src/clock';
 import { exp, expm1, ln, log10, log1p, pow } from '../src/det-math';
+import {
+  meanRetrievability,
+  newWordMemory,
+  RANKS,
+  review,
+  type WordMemory,
+} from '../src/memory';
 import { nextU32, seedRng, type RngState } from '../src/rng';

 /**
- * det-math golden vectors (#26 AC10): 100,000 inputs per function, generated
- * from a fixed seed, hashed over the exact bits of every result.
+ * Golden vectors (#26 AC10, #28): 100,000 per function, generated from a
+ * fixed seed, hashed over the exact bits of every result. The six det-math
+ * functions, the mean retrievability over a window, and core's FSRS review
+ * with the parameters it ships (ts-fsrs defaults, short-term steps on, fuzz
+ * off), whose cross-engine bits M1 design §2.1 measured only with short-term
+ * steps off.
  *
  * The same module runs under Node (a unit test pins its digests) and, bundled,
  * in Chromium, WebKit and Firefox (tests/engines). Equal digests mean equal
  * bits on every engine. The inputs and the hash use only integer operations,
- * division by 2^32 and little-endian DataView access, which every engine
- * computes alike, so any difference is det-math's.
+ * correctly rounded division and little-endian DataView access, which every
+ * engine computes alike, so any difference is the function's.
  */

 export const VECTORS_PER_FUNCTION = 100_000;
@@ -21,9 +33,15 @@ export const FUNCTIONS = [
   'log10',
   'expm1',
   'log1p',
+  'meanR',
+  'review',
 ] as const;
 export type GoldenFunction = (typeof FUNCTIONS)[number];

+/** The review vectors are 4,000 cards of 25 reviews each, from new. */
+const REVIEWS_PER_CARD = 25;
+const REVIEW_START = wallMs(1_790_000_000_000);
+
 const TWO_POW_32 = 4294967296;

 class Inputs {
@@ -89,7 +107,11 @@ class BitHash {
 }

 /** One input set per function, covering each one's whole finite domain. */
-function vector(fn: GoldenFunction, i: Inputs, k: number): number {
+function vector(
+  fn: Exclude<GoldenFunction, 'review'>,
+  i: Inputs,
+  k: number,
+): number {
   switch (fn) {
     case 'pow':
       // Three shapes in turn: the cost curve, powers of ten, and general.
@@ -106,6 +128,42 @@ function vector(fn: GoldenFunction, i: Inputs, k: number): number {
       return expm1(i.unit() * 760 - 50);
     case 'log1p':
       return log1p(k % 2 === 0 ? i.unit() * 2 - 1 : i.anyPositive());
+    case 'meanR': {
+      // S from 0.01 d to 100 y, a window starting up to 100 y after the
+      // review, and a span of up to one bucket or up to 100 y, in turn.
+      const s = ((i.u32() % 3_652_500) + 1) / 100;
+      const from = (i.u32() % 3_652_500) / 100;
+      const span =
+        k % 2 === 0
+          ? ((i.u32() % HOUR_MS) + 1) / DAY_MS
+          : ((i.u32() % 3_652_500) + 1) / 100;
+      return meanRetrievability(s, from, span);
+    }
+  }
+}
+
+/**
+ * Every field of each card after each review. Answers come at most an hour
+ * late and at most 40 days late in turn, so cards pass through the learning
+ * steps as well as long intervals; one answer in four is wrong.
+ */
+function reviewVectors(i: Inputs, hash: BitHash): void {
+  let word: WordMemory = newWordMemory(REVIEW_START);
+  for (let k = 0; k < VECTORS_PER_FUNCTION; k++) {
+    if (k % REVIEWS_PER_CARD === 0) word = newWordMemory(REVIEW_START);
+    const late = i.u32() % (k % 2 === 0 ? HOUR_MS : 40 * DAY_MS);
+    word = review(word, wallMs(word.card.due + late), i.u32() % 4 !== 0);
+    const c = word.card;
+    hash.add(c.due);
+    hash.add(c.stability);
+    hash.add(c.difficulty);
+    hash.add(c.scheduledDays);
+    hash.add(c.learningSteps);
+    hash.add(c.reps);
+    hash.add(c.lapses);
+    hash.add(c.state);
+    hash.add(c.lastReview ?? -1);
+    hash.add(RANKS.indexOf(word.rank));
   }
 }

@@ -113,13 +171,9 @@ function vector(fn: GoldenFunction, i: Inputs, k: number): number {
 export function digest(fn: GoldenFunction): string {
   const inputs = new Inputs(20261001 + FUNCTIONS.indexOf(fn));
   const hash = new BitHash();
-  for (let k = 0; k < VECTORS_PER_FUNCTION; k++)
-    hash.add(vector(fn, inputs, k));
+  if (fn === 'review') reviewVectors(inputs, hash);
+  else
+    for (let k = 0; k < VECTORS_PER_FUNCTION; k++)
+      hash.add(vector(fn, inputs, k));
   return hash.hex();
 }
-
-export function digests(): Record<GoldenFunction, string> {
-  const out = {} as Record<GoldenFunction, string>;
-  for (const fn of FUNCTIONS) out[fn] = digest(fn);
-  return out;
-}
```

- [ ] **Step 3: Run the pins and watch the two new ones fail**

Run: `npx vitest run packages/core/test/golden-vectors.test.ts`
Expected: `Tests  2 failed | 7 passed (9)`, each new pin with `expected '<16 hex digits>' to be 'unmeasured'`. Copy each digest from that output (never retype it) into `PINNED`, as the diff above shows; the run then passes 9 of 9.

- [ ] **Step 4: Check the review vectors reach what they claim**

Over the 100,000 reviews: Learning 8,325, Review 69,850, Relearning 21,825; all five ranks (each 16,915 to 23,870); 30,150 schedules under a day; intervals up to 36,501 days.

- [ ] **Step 5: Rename the engines spec and run every engine**

`tests/engines/golden-vectors.spec.ts` (change):

```diff
diff --git a/tests/engines/golden-vectors.spec.ts b/tests/engines/golden-vectors.spec.ts
new file mode 100644
index 0000000..7f927f4
--- /dev/null
+++ b/tests/engines/golden-vectors.spec.ts
@@ -0,0 +1,59 @@
+import { expect, test } from '@playwright/test';
+import { build } from 'esbuild';
+import {
+  digest,
+  FUNCTIONS,
+  type GoldenFunction,
+} from '../../packages/core/test/golden-vectors';
+
+/**
+ * Cross-engine determinism of det-math, the mean retrievability and the FSRS
+ * review (M1 design §2.1 and §7, #26 AC10, #28).
+ *
+ * The golden vectors are bundled exactly as a shipped build would bundle
+ * core, run in each browser engine, and their bit digests compared with the
+ * ones Node computes. Measured on 2026-10-01: Math.pow(1.15, n) differs
+ * between V8 and JavaScriptCore in 49% of results, so swapping det-math for
+ * Math turns the WebKit comparison red.
+ */
+
+interface GoldenGlobal {
+  wordfarerGolden: { digest(fn: GoldenFunction): string };
+}
+
+let bundle = '';
+
+test.beforeAll(async () => {
+  const result = await build({
+    stdin: {
+      contents: "export { digest } from './golden-vectors';",
+      resolveDir: 'packages/core/test',
+      loader: 'ts',
+    },
+    bundle: true,
+    write: false,
+    format: 'iife',
+    globalName: 'wordfarerGolden',
+    platform: 'browser',
+    mainFields: ['module', 'main'],
+    logLevel: 'error',
+  });
+  bundle = result.outputFiles[0]?.text ?? '';
+  // Liveness: esbuild produced the global the page will call.
+  expect(bundle).toContain('wordfarerGolden');
+});
+
+for (const fn of FUNCTIONS)
+  test(`${fn} gives the same bits as Node on 100,000 vectors`, async ({
+    page,
+    browserName,
+  }) => {
+    await page.setContent('<!doctype html><title>golden vectors</title>');
+    await page.addScriptTag({ content: bundle });
+    const engine = await page.evaluate(
+      (name) =>
+        (globalThis as unknown as GoldenGlobal).wordfarerGolden.digest(name),
+      fn,
+    );
+    expect(engine, `${browserName}: ${fn}`).toBe(digest(fn));
+  });
```

Run: `git mv tests/engines/det-math.spec.ts tests/engines/golden-vectors.spec.ts`, update the path in `tests/unit/one-test-per-case.test.ts`, then `npm run test:engines`.
Expected: `24 passed` (8 functions × Chromium, Firefox, WebKit). Then the gate as in Task 1; `test:unit` reports `Tests  3056 passed (3056)`.

- [ ] **Step 6: Commit**

```bash
git add -A packages/core/test tests/engines tests/unit/one-test-per-case.test.ts
git commit -m "test(core): golden vectors for the FSRS review and the mean R on every engine (Refs #28)"
```

- [ ] **Step 7: Verify the engine guard by mutation**

| ID            | Change                                                                      | Predicted red                             | Result                                                                               |
| ------------- | --------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| E1-review-exp | `memory.ts` `review` returns `stability × Math.exp(stability × 1e-3)`       | webkit: review (Chromium predicted green) | red: chromium: review, firefox: review, webkit: review (3 failed, 21 passed (11.2s)) |
| E2-meanR-exp  | `memory.ts` `meanRetrievability` multiplied by `Math.exp(fromStart × 1e-3)` | webkit: meanR (Chromium predicted green)  | red: chromium: meanR, webkit: meanR (2 failed, 22 passed (14.3s))                    |

Both held for WebKit. Chromium was predicted green and went red for both: its `Math.exp` bits differ from Node's (V8 13.6.233.17-node.53), measured as a digest mismatch; the cause was not established. Firefox went red for `review` and stayed green for `meanR`; why the two differ there was not measured. Only `det-math` gives the same bits on all four runtimes, which is what M1 design §2.1 requires.

### Task 5: The entry point, and the design amended from what was built

**Files:**

- Create: `packages/core/test/index.test.ts`
- Modify: `packages/core/src/index.ts`, `docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md`

- [ ] **Step 1: Write the failing test**

`packages/core/test/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as core from '../src/index';

/**
 * The words and memory API (#28) is reachable from the package entry point,
 * which is all the UI and the pacing bots import.
 */
describe('the package entry point', () => {
  for (const name of [
    'pickUpWord',
    'answerReview',
    'answerPractice',
    'pickUpCost',
    'pickedWord',
    'rateAt',
    'wordMultiplier',
  ] as const)
    it(`exports ${name}`, () => {
      expect(core[name]).toBeTypeOf('function');
    });

  it('exports the five ranks in order', () => {
    expect(core.RANKS).toEqual([
      'heard',
      'recognised',
      'recalled',
      'fluent',
      'mastered',
    ]);
  });
});
```

Run: `npx vitest run packages/core/test/index.test.ts`
Expected: `Tests  8 failed (8)`: each `exports …` with `expected undefined to be type of 'function'`, and `exports the five ranks in order` with `expected undefined to deeply equal [ 'heard', 'recognised', …(3) ]`.

- [ ] **Step 2: Export the words and memory API**

`packages/core/src/index.ts` (change):

```diff
diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts
index 499968e..2091dc9 100644
--- a/packages/core/src/index.ts
+++ b/packages/core/src/index.ts
@@ -29,12 +29,27 @@ export {
 } from './rng';
 export { BALANCE, type Balance, type Rank } from './balance';
 export { encounterOutput, milestonesReached, purchaseCost } from './encounters';
-export { encounterRate, producedBetween } from './production';
+export {
+  encounterRate,
+  producedBetween,
+  rateAt,
+  wordMultiplier,
+} from './production';
+export {
+  RANKS,
+  type MemoryCard,
+  type QueueItem,
+  type WordMemory,
+} from './memory';
+export { pickUpCost } from './words';
 export {
   advance,
+  answerPractice,
+  answerReview,
   buyEncounter,
   integrate,
   listen,
+  pickUpWord,
   understandingNow,
   view,
   type AdvanceSummary,
@@ -42,7 +57,13 @@ export {
   type Result,
   type View,
 } from './sim';
-export { initialState, ownedCount, type Anchor, type GameState } from './state';
+export {
+  initialState,
+  ownedCount,
+  pickedWord,
+  type Anchor,
+  type GameState,
+} from './state';
 export type {
   CardSet,
   Cefr,
```

Run: `npx vitest run packages/core/test/index.test.ts`
Expected: `Tests  8 passed (8)`.

- [ ] **Step 3: Amend the design**

`docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md` (change):

```diff
diff --git a/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md b/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
index b31097f..a2b655b 100644
--- a/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
+++ b/docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
@@ -63,8 +63,8 @@ Four variants were tried against a toy economy (50 and 450 words with mixed stab

 1. **Integer milliseconds.** All simulated time is an integer count of milliseconds (`SimMs`, a branded number, always a safe integer). There are no fractional days anywhere in state.
 2. **Anchored state.** The stored state holds every quantity at its **anchor**: the time of the last event or internal event. Values at "now" are derived (`view(state, wallMs)`) and never stored. Splitting an interval therefore cannot change any stored arithmetic, which is what makes associativity exact rather than approximate.
-3. **Hourly rate buckets.** Production inside one clock hour (`[h·3,600,000, (h+1)·3,600,000)` on the simulated clock) is constant. Each word's bonus in that bucket uses the word's **exact mean retrievability over the bucket**, computed in closed form from the FSRS-6 curve, so while Encounter counts are unchanged a whole hour's total equals the continuous model's. A review or pick-up mid-bucket recomputes that word's mean from the event onward. A purchase changes only the Encounter factor of the rate, so the bucket's per-word means are reused and a purchase costs O(Encounters), not O(words).
-4. **Closed-form mean R.** FSRS-6 gives `R(t) = (1 + F·t/S)^(−d)` with `d = 0.1542` and `F = 0.9^(−1/d) − 1`. Its integral is `∫₀ᵀ R = (S / (F·(1−d))) · expm1((1−d) · log1p(F·T/S))`. The textbook form `((1+x)^(1−d) − 1)` loses precision on short gaps (worst relative error 9.0e-6 at `T` = 1e-9 d, `S` = 365 d, against a 60-digit reference); the `expm1`/`log1p` form's worst is 1.3e-15.
+3. **Hourly rate buckets.** Production inside one clock hour (`[h·3,600,000, (h+1)·3,600,000)` on the simulated clock) is constant. Each word's bonus in that bucket uses the word's **exact mean retrievability over the bucket**, computed in closed form from the FSRS-6 curve, so while Encounter counts are unchanged a whole hour's total equals the continuous model's. A review, or a return the offline cap clips, restarts every word's mean from that moment, since the state holds one `memorySince` (#28). A pick-up restarts nothing: the new word has R = 0, so its bonus is its floor whatever the window. A purchase changes only the Encounter factor of the rate, so the bucket's per-word means are reused and a purchase costs O(Encounters), not O(words).
+4. **Closed-form mean R.** FSRS-6 gives `R(t) = (1 + F·t/S)^(−d)` with `d = 0.1542` and `F = 0.9^(−1/d) − 1`. Its integral is `∫₀ᵀ R = (S / (F·(1−d))) · expm1((1−d) · log1p(F·T/S))`. The textbook form `((1+x)^(1−d) − 1)` loses precision on short gaps (worst relative error 9.0e-6 at `T` = 1e-9 d, `S` = 365 d, against a 60-digit reference); the `expm1`/`log1p` form's worst is 1.3e-15. A window starting `a` days after the review is the same curve shifted: `mean(S, a, T) = R(S, a) · mean₀(S + F·a, T)`. Taking the difference of two integrals instead loses up to 0.58% (measured at `a` = 100 years, `T` = 1 ms); the shifted form's worst row against the 30-digit reference table is 1.19e-15 (#28).
 5. **Internal events fall on the absolute clock.** Automation ticks fall on a fixed grid of the simulated clock, and journey returns at fixed times on the same clock. When the next purchase becomes affordable, its tick is solved in O(1) from the bucket's linear rate, then confirmed by evaluating the tick and the one before it, so the result never depends on how far `advance` was asked to go.

 The parent's wording "closed-form integration between events" still holds: each bucket is integrated in closed form.
@@ -122,6 +122,7 @@ The parent leaves these open. They are **starting values for the bots to tune**,
 - **Listen:** +1 💬 per tap, no upgrades. How much it can matter is bounded by §6 assertion 7 (DN10).
 - **Insight upgrades:** journey slot 2 and 3; offline cap +24 h (twice, to 72 h); "Phrasebook" ×2 production for one tag (one per tag); faster Pemandu interval.
 - **Stamp upgrades** (bought with 🛂, kept forever): starting Understanding; Encounter cost −5% per level (capped at −40%); journey duration −10% per level (capped at −30%); Pemandu unlocked one destination early. Each stamp also gives +10% global production (parent §3.1).
+- **Pick-up:** the next word of the current destination, in curriculum order (CEFR, then course order), costs `20 · 1.15^n` Understanding, `n` being the items of that destination already picked up (#28).
 - **Grammar:** each node multiplies every word whose lexicon `root` it attaches to by `×(1 + g)`, with `g = 0.5` to start, and adds the derived words to the pick-up pool.
 - **Automation:** unlocks at region 2. The player chooses an interval from those owned (start 10 s; upgrades 5 s, 2 s, 1 s). Each tick buys one unit of the affordable Encounter with the lowest `cost / Δrate`.
 - **Set Sail goal:** destination `i` (0-based over all 12) needs `U_goal(i) = U₀ · g_U^i` and `words(i) = w₀ + w_step · i`. **Mastery mode** replays a destination with its goal × `1.5^replays`.
@@ -152,7 +153,7 @@ The parent leaves these open. They are **starting values for the bots to tune**,
   - `apply` then `advance` equals `advance` then `apply` when the event's `wallMs` is the later time;
   - no NaN, negative or infinite value in any reachable state;
   - FSRS rank transitions, the floor, and queue order and cap;
-  - the closed-form mean R agrees with numerical quadrature to 1e-9 relative, and with a high-precision reference at `T` near 0;
+  - the closed-form mean R agrees to 1e-12 relative with a reference table computed at 30 significant digits, over 5 stabilities × 6 spans × 5 window starts (#28 AC3; quadrature cannot reach that precision near `T` = 0);
   - the bulk-buy closed form equals summing single purchases;
   - every rejection fires and leaves state unchanged.
 - **Cross-engine determinism:** a golden event log (a seeded 5-week Diligent run) is replayed in Node and, through Playwright, in **Chromium, WebKit and Firefox**; all four must produce the same `stateHash`. This test turns §2.1's one-off measurement into a guard.
@@ -189,3 +190,4 @@ The parent leaves these open. They are **starting values for the bots to tune**,
 | 3    | 2026-10-01 | Mechanical checks re-run, unchanged. Full read found 2: (1) `integrate(state, simMs)` read as an absolute time while the associativity property needs an elapsed gap; renamed `elapsedMs` in §2.3 and §4; (2) "fixed absolute times" for journey returns did not say which clock; the simulated one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
 | 4    | 2026-10-01 | Mechanical checks re-run, unchanged. Full read found 2: (1) assertion 6 compared Diligent with Casual, whose opens also differ, so it could pass with reviewing worth nothing; it now compares the Casual Learner with a Casual Non-learner on identical opens and seed, requiring 20% sooner; (2) `advance` returned no summary, yet §7 and parent §6.2 require a "welcome back" summary; it now returns `{state, summary}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
 | 5    | 2026-10-01 | Mechanical checks re-run: no placeholders; every parent § cited exists (§12.1 and §12.2 are the parent's numbered items, as its §12 states); Node 24 confirmed from `.nvmrc`. Full read of all sections: **no findings**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
+| 6    | 2026-10-02 | Amended by #28 from what it built and measured: §2.2.3 one `memorySince` per state (a review or a clipped return restarts every word's mean; a pick-up restarts nothing); §2.2.4 the shifted form for a window starting after the review; §5 the pick-up cost; §7 the 30-digit reference table in place of quadrature. Mechanical: each figure traced to `memory.ts`, `memory.test.ts` and `balance.ts` on the #28 branch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
```

- [ ] **Step 4: Run the gate and commit**

Run: the gate as in Task 1.
Expected: all pass; `test:unit` reports `Tests  3064 passed (3064)`.

```bash
git add packages/core/src/index.ts packages/core/test/index.test.ts docs/superpowers/specs/2026-10-01-m1-core-simulation-design.md
git commit -m "feat(core): the words and memory API on the entry point; the design amended (Refs #28)"
```

## Finishing

1. Commit this plan on the story branch `m1/28-words-memory` after the five task commits, push, and open a PR into `develop` with `Refs #28`.
2. Write the PR's head SHA to a file (`gh pr view <n> --json headRefOid -q .headRefOid > <file>`) and wait with `~/.claude/scripts/wait-run.sh <repo-dir> <run-id> <file>` on its CI run: it exits 0 only when the run completed with success on that SHA, and prints every step by name.
3. Merge into `develop` (no permission needed) and wait for the deploy-dev run on the merge commit the same way: `test`, `deploy` and `verify` must pass and `dev-verified` must be posted.
4. Post the AC evidence on #28 (the table above, the CI and deploy run ids) and move #28 to Done on the board (project 4, title "Wordfarer Stories", asserted before the write).
