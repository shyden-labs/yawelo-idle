import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { floorBreach } from '../../../tests/floors.ts';
import { searched } from '../../../tests/searched.ts';
import { watched } from '../../../tests/watched.ts';
import { PERSONAS } from '../src/personas.ts';
import { pacingReport } from '../src/report.ts';
import type { PersonaRun, Sail } from '../src/run.ts';
import {
  CI_BOUNDS,
  clickingNeverWins,
  decisions,
  finale,
  firstSail,
  gaps,
  idlerFinishes,
  learnersOrder,
  learningPays,
  longWaits,
  sailTiming,
  sanity,
} from '../src/targets.ts';

/**
 * The pacing targets (#35 AC4, M1 design §6), proved by playing the real
 * core every CI run. Every persona plays once, each in its own process and
 * all at once; the tests read those runs, and `pacing-report.json` records
 * them for CI to upload (AC6). The bounds are the spec's; the tuning aims
 * well inside them (AC9).
 */

const MAX_DAYS = 84;
const BUNDLE = 'node_modules/.cache/yawelo-idle/pacing-play.mjs';
const REPORT = 'pacing-report.json';

/** The asserted personas, written out: a population known before the run. */
const ASSERTED = ['idler', 'casual', 'diligent', 'clicker', 'nonlearner'];

function playOne(name: string): Promise<PersonaRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BUNDLE, name, String(MAX_DAYS)]);
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(out) as PersonaRun);
      else reject(new Error(`${name} exited ${String(code)}: ${err}`));
    });
  });
}

async function playAll(): Promise<ReadonlyMap<string, PersonaRun>> {
  await build({
    entryPoints: ['packages/bots/pacing/play.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: BUNDLE,
    logLevel: 'warning',
  });
  const runs = await Promise.all(PERSONAS.map((p) => playOne(p.name)));
  const byName = new Map(runs.map((r) => [r.persona, r]));
  const report = pacingReport(
    PERSONAS.map((p) => ({ run: runOf(byName, p.name), asserted: p.asserted })),
  );
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  return byName;
}

function runOf(
  runs: ReadonlyMap<string, PersonaRun>,
  name: string,
): PersonaRun {
  const run = runs.get(name);
  if (run === undefined) throw new Error(`no run for ${name}`);
  return run;
}

let played: Promise<ReadonlyMap<string, PersonaRun>> | undefined;

/** Every persona's run: played on first use rather than at collection (#97). */
async function run(name: string): Promise<PersonaRun> {
  played ??= playAll();
  return runOf(await played, name);
}

/**
 * `name`'s run with watched sails: `read` is the sails a check read `key` of
 * (#368, #370), so each floor counts what the check read, not the run.
 */
async function watchingSails(name: string, key: keyof Sail) {
  const r = await run(name);
  const { items, read } = watched(r.sails, key);
  return { run: { ...r, sails: items }, read };
}

describe('the pacing suite', () => {
  it('asserts exactly the personas marked asserted', () => {
    expect(ASSERTED).toEqual(
      PERSONAS.filter((p) => p.asserted).map((p) => p.name),
    );
  });
});

describe('the pacing targets (AC4), at the spec’s bounds', () => {
  it.each(ASSERTED)(
    '(a) %s sets sail for the first time after 30 to 60 minutes',
    async (name) => {
      const first = await watchingSails(name, 'day');
      expect(
        searched(firstSail(first.run, CI_BOUNDS), {
          of: first.read,
          what: 'sails firstSail read',
        }),
      ).toEqual([]);
      expect(
        floorBreach(`pacing/first-sail-${name}`, first.read.length),
      ).toBeUndefined();
    },
  );

  it('(b) the Casual Learner reaches each later destination 1 to 3 days after the one before', async () => {
    const casual = await watchingSails('casual', 'day');
    expect(
      searched(gaps(casual.run, CI_BOUNDS), {
        of: casual.read,
        what: 'sails gaps read',
      }),
    ).toEqual([]);
    expect(
      floorBreach('pacing/gaps-casual', casual.read.length),
    ).toBeUndefined();
  });

  it('(c) the Casual Learner reaches the finale in 3 to 5 weeks', async () => {
    const { items, read } = watched([await run('casual')], 'finaleDay');
    expect(
      searched(
        items.flatMap((r) => finale(r, CI_BOUNDS)),
        { of: read, what: 'runs whose finale finale read' },
      ),
    ).toEqual([]);
    expect(floorBreach('pacing/finale-casual', read.length)).toBeUndefined();
  });

  it('(d) the Idler reaches the finale within 10 weeks', async () => {
    const { items, read } = watched([await run('idler')], 'finaleDay');
    expect(
      searched(
        items.flatMap((r) => idlerFinishes(r, CI_BOUNDS)),
        { of: read, what: 'runs whose finale idlerFinishes read' },
      ),
    ).toEqual([]);
    expect(floorBreach('pacing/idler-finishes', read.length)).toBeUndefined();
  });

  // The opens are judged as the run plays them, each recorded in openDays
  // (run.ts), so openDays is the population decisions reports on.
  it.each(ASSERTED)(
    '(e) every open of %s offers a meaningful decision',
    async (name) => {
      const r = await run(name);
      expect(r.openDays.length).toBeGreaterThan(10);
      expect(
        searched(decisions(r), { of: r.openDays, what: 'opens judged' }),
      ).toEqual([]);
      expect(
        floorBreach(`pacing/opens-${name}`, r.openDays.length),
      ).toBeUndefined();
    },
  );

  it('(f) learning pays: the Casual Learner reaches the finale at least 20% sooner than the Non-learner', async () => {
    const {
      items: [casual, nonlearner],
      read,
    } = watched([await run('casual'), await run('nonlearner')], 'finaleDay');
    expect(
      searched(
        casual && nonlearner
          ? learningPays(casual, nonlearner, CI_BOUNDS)
          : ['a run was not watched'],
        { of: read, what: 'runs whose finale learningPays read' },
      ),
    ).toEqual([]);
    expect(floorBreach('pacing/learning-pays', read.length)).toBeUndefined();
  });

  it('(f) the Diligent Learner finishes no later than the Casual Learner, nor the Casual Learner than the Idler', async () => {
    const {
      items: [diligent, casual, idler],
      read,
    } = watched(
      [await run('diligent'), await run('casual'), await run('idler')],
      'finaleDay',
    );
    expect(
      searched(
        diligent && casual && idler
          ? learnersOrder(diligent, casual, idler)
          : ['a run was not watched'],
        { of: read, what: 'runs whose finale learnersOrder read' },
      ),
    ).toEqual([]);
    expect(floorBreach('pacing/learners-order', read.length)).toBeUndefined();
  });

  it('(g) clicking never beats idling: the Clicker takes at least 95% of the Casual Learner’s time to reach each sail’s goal', async () => {
    const clicker = await watchingSails('clicker', 'reachedDay');
    expect(
      searched(clickingNeverWins(clicker.run, await run('casual'), CI_BOUNDS), {
        of: clicker.read,
        what: 'Clicker sails whose goal moment clickingNeverWins read',
      }),
    ).toEqual([]);
    expect(
      floorBreach('pacing/clicker-goal-moments', clicker.read.length),
    ).toBeUndefined();
  });

  // `views` counts every view the run judged for insane values (run.ts).
  it.each(ASSERTED)(
    '(h) %s meets no NaN, negative or infinite value',
    async (name) => {
      const r = await run(name);
      expect(r.events).toBeGreaterThan(1_000);
      expect(
        searched(sanity(r), { of: r.views, what: 'views judged' }),
      ).toEqual([]);
      expect(floorBreach(`pacing/views-${name}`, r.views)).toBeUndefined();
    },
  );

  // Real multi-sail runs (Shyden, 2026-10-08, #475: "we still need these
  // tests, but they do not belong in unit tests"): every sail of a long
  // run starts a new one, so its goal is timed from the states after the
  // sail before. The unit suite proves that restart on stand-in states.
  it.each(ASSERTED)(
    '(h) %s meets each sail’s goal after the sail before and no later than its own',
    async (name) => {
      const r = await run(name);
      expect(searched(sailTiming(r), { of: r.sails, what: 'sails' })).toEqual(
        [],
      );
      expect(
        floorBreach(`pacing-sails/${name}`, r.sails.length),
      ).toBeUndefined();
    },
  );

  it('(h) the Idler waits hours with its goal met before an open lets it sail', async () => {
    expect(longWaits(await run('idler')).length).toBeGreaterThan(0);
  });
});
