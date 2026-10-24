import { describe, expect, it } from 'vitest';
import { floorBreach } from '../../../tests/floors.ts';
import { searched } from '../../../tests/searched.ts';
import {
  BOT_EPOCH_WALL_MS,
  syntheticCourse,
} from '../../core/fixtures/synthetic-course.ts';
import { persona } from '../src/personas.ts';
import { runPersona, type PersonaRun } from '../src/run.ts';

/**
 * The Capped buyer's first day, played on the real core (#35 AC4 (h), AC6):
 * 3 opens and a sail at the second, about 50 ms of CPU warm and past a unit
 * test's 0.1 s on a busy laptop, so it runs here (#544). The unit suite's
 * `run.test.ts` checks the same bookkeeping with a stand-in player. The run
 * is played once and shared (#475); each count is a recorded floor.
 */

let cappedDay: PersonaRun | undefined;
function cappedFirstDay(): PersonaRun {
  cappedDay ??= runPersona(
    syntheticCourse(1),
    persona('capped'),
    BOT_EPOCH_WALL_MS,
    1,
  );
  return cappedDay;
}

describe('the Capped buyer’s first day', () => {
  it('plays 3 opens, sails timed from the first open', () => {
    const run = cappedFirstDay();
    expect(run.persona).toBe('capped');
    expect(run.openDays).toHaveLength(3);
    expect(run.openDays[0]).toBe(0);
    expect(run.openDays).toEqual([...run.openDays].sort((a, b) => a - b));
    expect(
      searched(
        run.openDays.filter((d) => d < 0 || d >= 1),
        { of: run.openDays, what: 'opens' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('persona-run/capped first day opens', run.openDays.length),
    ).toBeUndefined();
    expect(
      floorBreach('persona-run/capped first day events', run.events),
    ).toBeUndefined();
    expect(run.cpuMs).toBeGreaterThan(0);
    expect(
      searched(run.insane, { of: run.views, what: 'views judged' }),
    ).toEqual([]);
    expect(
      floorBreach('persona-run/capped first day views', run.views),
    ).toBeUndefined();
    expect(run.sails.length).toBeGreaterThan(0);
    const days = run.sails.map((s) => s.day);
    expect(
      searched(
        days.filter((d) => d <= 0 || d >= 1),
        { of: days, what: 'sail days' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('persona-run/capped first day sails', days.length),
    ).toBeUndefined();
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(run.sails.map((s) => s.destination)).toEqual(
      run.sails.map((_, i) => i + 1),
    );
  });

  it('ends after the open in which the asked-for sails landed', () => {
    const full = cappedFirstDay();
    const stopped = runPersona(
      syntheticCourse(1),
      persona('capped'),
      BOT_EPOCH_WALL_MS,
      1,
      { stopAfterSails: 1 },
    );
    const [sail] = stopped.sails;
    if (sail === undefined) throw new Error('the stopped run never sailed');
    expect(stopped.sails).toEqual(full.sails.slice(0, stopped.sails.length));
    expect(stopped.openDays).toEqual(
      full.openDays.slice(0, stopped.openDays.length),
    );
    // The last open played is the one the sail landed in: it began before the
    // sail, and the full run's next open begins after it.
    const last = stopped.openDays.length - 1;
    expect(stopped.openDays[last]).toBeLessThanOrEqual(sail.day);
    expect(full.openDays[last + 1]).toBeGreaterThan(sail.day);
  });

  it('judges a return 15 minutes after each of its 3 opens', () => {
    const run = cappedFirstDay();
    expect(run.returnsJudged).toBe(3);
    expect(
      searched(run.returnsUndecided, {
        of: run.returnsJudged,
        what: 'returns judged',
      }),
    ).toEqual([]);
    expect(
      searched(run.returnsPracticeOnly, {
        of: run.returnsJudged,
        what: 'returns judged',
      }),
    ).toEqual([]);
    expect(
      floorBreach('persona-run/capped first day returns', run.returnsJudged),
    ).toBeUndefined();
  });

  it('times a goal from when the Understanding earned that run reached it: no later than its sail, and hours before an open lets it sail', () => {
    // A second sail costs over 0.3 s of CPU in every persona (measured, #475),
    // so the clock's restart at each sail is SailLog's unit test.
    const { sails } = cappedFirstDay();
    expect(
      searched(
        sails.filter((s) => !Number.isFinite(s.reachedDay)),
        { of: sails, what: 'sails' },
      ),
    ).toEqual([]);
    expect(
      searched(
        sails.filter((s) => s.reachedDay > s.day || s.reachedDay <= 0),
        { of: sails, what: 'sails' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('persona-run/capped first day timed sails', sails.length),
    ).toBeUndefined();
    const waitedHours = sails.map((s) => (s.day - s.reachedDay) * 24);
    // The longest wait with the goal met, in whole hours.
    expect(
      floorBreach(
        'persona-run/capped first day hours waited',
        Math.floor(Math.max(...waitedHours)),
      ),
    ).toBeUndefined();
  });

  it('records no finale when the run ends first', () => {
    expect(cappedFirstDay().finaleDay).toBeUndefined();
  });
});
