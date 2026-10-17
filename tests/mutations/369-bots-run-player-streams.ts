import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #369's mutations (the bots run, player and streams absence floors), each
 * predicted before it first ran on 2026-10-17. Converted by script from the
 * session's mutants.py when the tracked runner landed (#527 AC4a), no
 * prediction edited: each test is prefixed with the one file whose top-level
 * describe it names.
 */
export default mutationFile({
  targets: [
    'packages/bots/test/player.test.ts',
    'packages/bots/test/run.test.ts',
    'packages/bots/test/streams.test.ts',
  ],
  mutations: [
    {
      name: 'R1-judged-no-gains',
      file: 'packages/bots/src/run.ts',
      anchor: '      [`gain.${o.id}`, o.gain],\n',
      replacement: '',
      red: {
        'packages/bots/test/run.test.ts › insaneValues > finds nothing in a new game’s view':
          'run/new game values',
      },
    },
    {
      name: 'R2-judged-no-retrievability',
      file: 'packages/bots/src/run.ts',
      anchor:
        '    ...v.queue.map((q): [string, number] => [\n      `R.${q.itemId}`,\n      q.retrievability,\n    ]),\n',
      replacement: '',
      red: {
        'packages/bots/test/run.test.ts › insaneValues > names a retrievability that is not a number':
          'R.w',
      },
    },
    {
      name: 'P1-shop-blind-to-last',
      file: 'packages/bots/test/open.ts',
      anchor:
        '  return view(course(), player.state, wallMs(last.wallMs + STEP_MS)).shop;',
      replacement:
        '  const shop = view(course(), player.state, wallMs(last.wallMs + STEP_MS)).shop;\n  return { ...shop, encounters: shop.encounters.slice(0, -1) };',
      red: {
        'packages/bots/test/player.test.ts › an open > buys until nothing is affordable':
          'player/casual offers',
        'packages/bots/test/player.test.ts › an open > the Random Buyer buys until nothing is affordable, in its own order':
          'player/random offers',
      },
    },
    {
      name: 'P2-first-buy-loss',
      file: 'packages/bots/test/player.test.ts',
      anchor: '    const fromFirstBuy = order.slice(firstBuy);',
      replacement: '    const fromFirstBuy = order.slice(firstBuy + 1);',
      red: {
        'packages/bots/test/player.test.ts › an open > taps Listen while it owns nothing and nothing is affordable, then buys':
          'searched no',
      },
    },
    {
      name: 'P3-first-buy-growth',
      file: 'packages/bots/test/player.test.ts',
      anchor: '    const fromFirstBuy = order.slice(firstBuy);',
      replacement:
        '    const fromFirstBuy = [...order.slice(firstBuy), ...order.slice(firstBuy)];',
      red: {
        'packages/bots/test/player.test.ts › an open > taps Listen while it owns nothing and nothing is affordable, then buys':
          'player/events from the first buy',
      },
    },
    {
      name: 'P4-due-blind-to-first',
      file: 'packages/bots/test/player.test.ts',
      anchor: '    const dueReviews = view(course(), due, due.wall).queue;',
      replacement:
        '    const dueReviews = view(course(), due, due.wall).queue.slice(1);',
      red: {
        'packages/bots/test/player.test.ts › an open > a learner answers every due review':
          'player/learner due reviews',
      },
    },
    {
      name: 'P5-nonlearner-blind-to-first',
      file: 'packages/bots/test/player.test.ts',
      anchor:
        "    const { events, player } = play('nonlearner', due, ONE_CHECK);",
      replacement:
        "    const { events: all, player } = play('nonlearner', due, ONE_CHECK);\n    const events = all.slice(1);",
      red: {
        'packages/bots/test/player.test.ts › an open > a Non-learner answers none':
          'player/nonlearner events',
      },
    },
    {
      name: 'P6-before-sail-blind-to-first',
      file: 'packages/bots/test/player.test.ts',
      anchor: '    const beforeSail = after.slice(0, sail);',
      replacement: '    const beforeSail = after.slice(1, sail);',
      red: {
        'packages/bots/test/player.test.ts › an open > sets sail at the first check the goal is met, buying nothing in it':
          'player/events before the sail',
      },
    },
    {
      name: 'S1-floats-blind-to-first',
      file: 'packages/bots/test/streams.test.ts',
      anchor: "    const xs = draws(DRAWS, () => s.float('buys'));",
      replacement:
        "    const xs = draws(DRAWS, () => s.float('buys')).slice(1);",
      red: {
        'packages/bots/test/streams.test.ts › the streams > draw floats in [0, 1)':
          'streams/float draws',
      },
    },
    {
      name: 'S2-r0-blind-to-first',
      file: 'packages/bots/test/streams.test.ts',
      anchor: '    const recalls = draws(1_000, () => s.recalls(0));',
      replacement:
        '    const recalls = draws(1_000, () => s.recalls(0)).slice(1);',
      red: {
        'packages/bots/test/streams.test.ts › recall > is never correct at R = 0':
          'streams/recalls at R = 0',
      },
    },
    {
      name: 'S3-r1-blind-to-first',
      file: 'packages/bots/test/streams.test.ts',
      anchor: '    const recalls = draws(1_000, () => s.recalls(1));',
      replacement:
        '    const recalls = draws(1_000, () => s.recalls(1)).slice(1);',
      red: {
        'packages/bots/test/streams.test.ts › recall > is always correct at R = 1':
          'streams/recalls at R = 1',
      },
    },
    {
      name: 'S4-latency-blind-to-first',
      file: 'packages/bots/test/streams.test.ts',
      anchor: '    const xs = draws(DRAWS, () => s.latencyMs());',
      replacement: '    const xs = draws(DRAWS, () => s.latencyMs()).slice(1);',
      red: {
        'packages/bots/test/streams.test.ts › latency > is a whole, positive number of milliseconds':
          'streams/latency draws',
      },
    },
    {
      name: 'S5-later-opens-a-day-short',
      file: 'packages/bots/test/streams.test.ts',
      anchor: '    const days = Array.from({ length: 30 }, (_, d) => d + 1);',
      replacement:
        '    const days = Array.from({ length: 29 }, (_, d) => d + 1);',
      red: {
        'packages/bots/test/streams.test.ts › the open schedule > places later opens at whole seconds of waking hours, in order':
          'streams/later opens',
      },
    },
    {
      name: 'S6-gaps-blind-to-first',
      file: 'packages/bots/test/streams.test.ts',
      anchor:
        '    const gaps = starts.slice(1).map((t, i) => t - (starts[i] ?? 0));',
      replacement:
        '    const gaps = starts.slice(1).map((t, i) => t - (starts[i] ?? 0)).slice(1);',
      red: {
        'packages/bots/test/streams.test.ts › the open schedule > keeps opens at least an hour apart, from one day to the next too':
          'streams/open gaps',
      },
    },
    {
      name: 'S7-slots-a-day-short',
      file: 'packages/bots/test/streams.test.ts',
      anchor:
        '    const offsets = Array.from({ length: 30 }, (_, d) => d + 1).flatMap((day) =>',
      replacement:
        '    const offsets = Array.from({ length: 29 }, (_, d) => d + 1).flatMap((day) =>',
      red: {
        'packages/bots/test/streams.test.ts › the open schedule > places each open in its own slot of waking hours':
          'streams/slot offsets',
      },
    },
  ],
});
