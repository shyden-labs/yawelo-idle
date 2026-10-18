import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The pacing suite's absence searches check floors on what each check read
 * (#370 AC4). Predicted before the first run. Each mutation blinds a check,
 * or the run that feeds it, to part of its population, and goes red through
 * that population's floor alone: the verdicts stay clean. A population of one
 * (the first sail, each finale run) takes a loss and a growth mutant, since
 * no part of one can be lost. `opens-every-other-day` keeps the returns the
 * run judged in step with the opens it records, so `decisions` stays clean
 * and only the floor sees the opens lost; `views-every-other-look` drops
 * half the views from the count only, so play is unchanged.
 *
 * Three rows were corrected after run 39140097562 missed them, so their
 * predictions are hindsight: `first-sail-unread` and `finales-unread` went
 * red through `searched` itself, which refuses an empty population before
 * the floor is read, and `views-every-other-look` also reds run.test.ts,
 * whose capped first day floors its own views. The rows after them test
 * both causes with predictions written before any run: `learning-pays-unread`
 * reads no finale (refused by `searched`) beside `learning-pays-skips-
 * nonlearner`, which reads one (the floor); `views-stop-after-431` and
 * `views-stop-after-432` count views up to the capped first day's 432 less
 * one, which reds it, and exactly, which leaves it green.
 */

const PACING = 'packages/bots/pacing/pacing.test.ts';
const TARGETS = `${PACING} › the pacing targets (AC4), at the spec’s bounds >`;
const PERSONAS = ['idler', 'casual', 'diligent', 'clicker', 'nonlearner'];

const firstSail = (read: number) =>
  Object.fromEntries(
    PERSONAS.map((p) => [
      `${TARGETS} (a) ${p} sets sail for the first time after 30 to 60 minutes`,
      `pacing/first-sail-${p}: read ${String(read)}`,
    ]),
  );

const EMPTY = 'an absence assertion over an empty population';

const firstSailUnread = Object.fromEntries(
  PERSONAS.map((p) => [
    `${TARGETS} (a) ${p} sets sail for the first time after 30 to 60 minutes`,
    `searched no sails firstSail read: ${EMPTY}`,
  ]),
);

const CAPPED =
  'packages/bots/pacing/run.test.ts › the Capped buyer’s first day > plays 3 opens, sails timed from the first open';

/** The five sanity tests, each reading `read` views, and the capped day's `capped` (undefined: green). */
const views = (read: string, capped?: number) => ({
  ...Object.fromEntries(
    PERSONAS.map((p) => [
      `${TARGETS} (h) ${p} meets no NaN, negative or infinite value`,
      `pacing/views-${p}: read ${read}`,
    ]),
  ),
  ...(capped === undefined
    ? {}
    : {
        [CAPPED]: `persona-run/capped first day views: read ${String(capped)}`,
      }),
});

const FINALE = `${TARGETS} (c) the Casual Learner reaches the finale in 3 to 5 weeks`;
const IDLER = `${TARGETS} (d) the Idler reaches the finale within 10 weeks`;

const finaleTests = `    const { items, read } = watched([await run('casual')], 'finaleDay');
    expect(
      searched(
        items.flatMap((r) => finale(r, CI_BOUNDS)),
        { of: read, what: 'runs whose finale finale read' },
      ),
    ).toEqual([]);
    expect(floorBreach('pacing/finale-casual', read.length)).toBeUndefined();
  });

  it('(d) the Idler reaches the finale within 10 weeks', async () => {
    const { items, read } = watched([await run('idler')], 'finaleDay');`;

const opens = `      openDays.push(dayOf(startMs));
      const decided = player.open(
        startMs,
        lengthMs,
        today[i + 1]?.startMs ?? tomorrow,
      );
      if (!decided) undecided.push(dayOf(startMs));
      // After the finale comes Mastery mode, which the pacing does not judge.
      if (!player.state.finale) {
        returnsJudged += 1;`;

export default mutationFile({
  targets: [PACING],
  mutations: [
    {
      name: 'first-sail-unread',
      file: 'packages/bots/src/targets.ts',
      anchor: '  const minutes = first.day * MINUTES_PER_DAY;',
      replacement: '  const minutes = 45;',
      red: firstSailUnread,
    },
    {
      name: 'first-sail-reads-two',
      file: 'packages/bots/src/targets.ts',
      anchor: '  const first = run.sails[0];',
      replacement: '  const first = run.sails[0];\n  void run.sails[1]?.day;',
      red: firstSail(2),
    },
    {
      name: 'gaps-skips-last',
      file: 'packages/bots/src/targets.ts',
      anchor: '  run.sails.forEach((sail, i) => {',
      replacement: '  run.sails.slice(0, -1).forEach((sail, i) => {',
      red: {
        [`${TARGETS} (b) the Casual Learner reaches each later destination 1 to 3 days after the one before`]:
          'pacing/gaps-casual: read 11',
      },
    },
    {
      name: 'finales-unread',
      file: 'packages/bots/src/targets.ts',
      anchor: `  const day = finaleOf(run);
  if (day === undefined) return [\`\${run.persona} did not reach the finale\`];
  return outside(day, b.finaleDays)
    ? [\`\${run.persona} reached the finale on day \${days(day)}\`]
    : [];
}

/** (d) The Idler reaches the finale by \`idlerFinaleBy\`. */
export function idlerFinishes(idler: PersonaRun, b: Bounds): string[] {
  const day = finaleOf(idler);`,
      replacement: `  const day = 28;
  if (day === undefined) return [\`\${run.persona} did not reach the finale\`];
  return outside(day, b.finaleDays)
    ? [\`\${run.persona} reached the finale on day \${days(day)}\`]
    : [];
}

/** (d) The Idler reaches the finale by \`idlerFinaleBy\`. */
export function idlerFinishes(idler: PersonaRun, b: Bounds): string[] {
  const day = 60;`,
      red: {
        [FINALE]: `searched no runs whose finale finale read: ${EMPTY}`,
        [IDLER]: `searched no runs whose finale idlerFinishes read: ${EMPTY}`,
      },
    },
    {
      name: 'finales-read-twice',
      file: PACING,
      anchor: finaleTests,
      replacement: `    const { items, read } = watched([await run('casual'), { ...(await run('casual')) }], 'finaleDay');
    expect(
      searched(
        items.flatMap((r) => finale(r, CI_BOUNDS)),
        { of: read, what: 'runs whose finale finale read' },
      ),
    ).toEqual([]);
    expect(floorBreach('pacing/finale-casual', read.length)).toBeUndefined();
  });

  it('(d) the Idler reaches the finale within 10 weeks', async () => {
    const { items, read } = watched([await run('idler'), { ...(await run('idler')) }], 'finaleDay');`,
      red: {
        [FINALE]: 'pacing/finale-casual: read 2',
        [IDLER]: 'pacing/idler-finishes: read 2',
      },
    },
    {
      name: 'opens-every-other-day',
      file: 'packages/bots/src/run.ts',
      anchor: opens,
      replacement: `      const counted = day % 2 === 0;
      const decided = player.open(
        startMs,
        lengthMs,
        today[i + 1]?.startMs ?? tomorrow,
      );
      if (counted || player.state.finale) openDays.push(dayOf(startMs));
      if (!decided) undecided.push(dayOf(startMs));
      // After the finale comes Mastery mode, which the pacing does not judge.
      if (!player.state.finale) {
        if (counted) returnsJudged += 1;`,
      red: Object.fromEntries(
        PERSONAS.map((p) => [
          `${TARGETS} (e) every open of ${p} offers a meaningful decision`,
          `pacing/opens-${p}: read`,
        ]),
      ),
    },
    {
      name: 'views-every-other-look',
      file: 'packages/bots/src/player.ts',
      anchor: '    this.watcher.saw?.(v);',
      replacement:
        '    this.looks = (this.looks ?? 0) + 1;\n    if (this.looks % 2 === 0) this.watcher.saw?.(v);',
      red: views('', 216),
    },
    {
      name: 'views-stop-after-431',
      file: 'packages/bots/src/player.ts',
      anchor: '    this.watcher.saw?.(v);',
      replacement:
        '    this.looks = (this.looks ?? 0) + 1;\n    if (this.looks <= 431) this.watcher.saw?.(v);',
      red: views('431', 431),
    },
    {
      name: 'views-stop-after-432',
      file: 'packages/bots/src/player.ts',
      anchor: '    this.watcher.saw?.(v);',
      replacement:
        '    this.looks = (this.looks ?? 0) + 1;\n    if (this.looks <= 432) this.watcher.saw?.(v);',
      red: views('432'),
    },
    {
      name: 'learning-pays-unread',
      file: 'packages/bots/src/targets.ts',
      anchor:
        '  const c = finaleOf(casual);\n  const n = finaleOf(nonlearner);',
      replacement: '  const c = 20;\n  const n = 30;',
      red: {
        [`${TARGETS} (f) learning pays: the Casual Learner reaches the finale at least 20% sooner than the Non-learner`]: `searched no runs whose finale learningPays read: ${EMPTY}`,
      },
    },
    {
      name: 'learning-pays-skips-nonlearner',
      file: 'packages/bots/src/targets.ts',
      anchor: '  const n = finaleOf(nonlearner);',
      replacement: '  const n = c === undefined ? undefined : 2 * c;',
      red: {
        [`${TARGETS} (f) learning pays: the Casual Learner reaches the finale at least 20% sooner than the Non-learner`]:
          'pacing/learning-pays: read 1',
      },
    },
    {
      name: 'learners-order-skips-idler',
      file: 'packages/bots/src/targets.ts',
      anchor:
        '  const [d, c, i] = [finaleOf(diligent), finaleOf(casual), finaleOf(idler)];',
      replacement:
        '  const [d, c, i] = [finaleOf(diligent), finaleOf(casual), Infinity];',
      red: {
        [`${TARGETS} (f) the Diligent Learner finishes no later than the Casual Learner, nor the Casual Learner than the Idler`]:
          'pacing/learners-order: read 2',
      },
    },
    {
      name: 'clicker-skips-last',
      file: 'packages/bots/src/targets.ts',
      anchor: '  return clicker.sails.flatMap((sail, i) => {',
      replacement: '  return clicker.sails.slice(0, -1).flatMap((sail, i) => {',
      red: {
        [`${TARGETS} (g) clicking never beats idling: the Clicker takes at least 95% of the Casual Learner’s time to reach each sail’s goal`]:
          'pacing/clicker-goal-moments: read 11',
      },
    },
  ],
});
