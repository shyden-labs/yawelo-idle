import { writeFileSync } from 'node:fs';
import { syntheticCourse } from '../packages/core/fixtures/synthetic-course';
import {
  GOLDEN,
  GOLDEN_HEAVY_SLICES,
  GOLDEN_OPEN_PARTS,
  GOLDEN_SHOP_FREE_SLICES,
  playGolden,
  writeGolden,
  writeGoldenSlices,
  writeGoldenStarts,
} from '../packages/core/fixtures/golden-log';

/**
 * Writes the golden event log (#34, M1 design §7) to
 * `packages/core/fixtures/golden-log.jsonl`. Run `npm run golden-log` after a
 * change to any rule or dependency moves the replay's hash: the unit test
 * that replays the fixture names this command when the hash differs.
 * Prints the event count and the CPU time the play took.
 */

const OUT = 'packages/core/fixtures/golden-log.jsonl';
/** The log cut into the player's opens, beside it (#473, #542). */
const SLICES_OUT = 'packages/core/fixtures/golden-slices.jsonl';
/** Where each open began: a day's whole start, then deltas (#542). */
const STARTS_OUT = 'packages/core/fixtures/golden-starts.jsonl';

const before = process.cpuUsage();
const run = playGolden(syntheticCourse(GOLDEN.courseSeed));
const used = process.cpuUsage(before);
const heavy = run.slices.filter((s) => s.heavy).map((s) => s.slice);
if (JSON.stringify(heavy) !== JSON.stringify(GOLDEN_HEAVY_SLICES)) {
  // The test files list their slices from the constant while Vitest collects
  // them (#97), so it must name the heavy slices this play found.
  throw new Error(
    `the heavy slices are ${JSON.stringify(heavy)}: set GOLDEN_HEAVY_SLICES in packages/core/fixtures/golden-log.ts to them and run again`,
  );
}
const perOpen = new Map<number, number>();
for (const s of run.slices) {
  const open = s.day * GOLDEN.opensPerDay + s.open;
  perOpen.set(open, (perOpen.get(open) ?? 0) + 1);
}
const parts = Object.fromEntries(
  [...perOpen].filter(([, n]) => n !== GOLDEN.minParts),
);
if (JSON.stringify(parts) !== JSON.stringify(GOLDEN_OPEN_PARTS)) {
  // The test files number their slices from the constant (#97, #553).
  throw new Error(
    `the opens not cut into ${String(GOLDEN.minParts)} are ${JSON.stringify(parts)}: set GOLDEN_OPEN_PARTS in packages/core/fixtures/golden-log.ts to them and run again`,
  );
}
const shopFree = run.slices
  .filter((s) =>
    Object.values(s.shop).every(
      (count) => count.accepted + count.refused === 0,
    ),
  )
  .map((s) => s.slice);
if (JSON.stringify(shopFree) !== JSON.stringify(GOLDEN_SHOP_FREE_SLICES)) {
  // The shop test lists its slices from the constant (#97, #553).
  throw new Error(
    `the shop-free slices are ${JSON.stringify(shopFree)}: set GOLDEN_SHOP_FREE_SLICES in packages/core/fixtures/golden-log.ts to them and run again`,
  );
}
const starts = writeGoldenStarts(run);
writeFileSync(OUT, writeGolden(run));
writeFileSync(SLICES_OUT, writeGoldenSlices(run));
writeFileSync(STARTS_OUT, starts);
console.log(
  `${OUT}: ${String(run.events.length)} events, ${String(Math.round((used.user + used.system) / 1000))} ms of CPU`,
);
