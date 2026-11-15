import { describe, expect, it } from 'vitest';
import {
  apply,
  HOUR_MS,
  initialState,
  Num,
  offlineCapMs,
  view,
  wallMs,
  type GameState,
  type WallMs,
} from '@yawelo-idle/core';
import { syntheticCourse } from '@yawelo-idle/core/fixtures/synthetic-course';
import type { PlatformLifecycle, Unsubscribe } from '@yawelo-idle/platform';
import {
  COMMIT_MS,
  createGameStore,
  SAMPLE_MS,
  type Every,
  type GameStore,
  type Sample,
} from '../src/game-store';

/**
 * The UI store over the core (#128; spec §6.3, DN22). Its host is stood in:
 * a clock the test sets, a lifecycle the test flips, and an `every` that
 * records each running sampler and ticks only when the test says. The real
 * browser timers and lifecycle are counted in game-store-hidden.test.ts.
 */

const START: WallMs = wallMs(Date.UTC(2027, 0, 4, 8));
const course = syntheticCourse(1);

interface Host {
  readonly clock: { now: WallMs };
  readonly samplers: { ms: number; tick: () => void; running: boolean }[];
  show(visible: boolean): void;
  /** Ticks every running sampler once. */
  tick(): void;
  readonly every: Every;
  readonly lifecycle: PlatformLifecycle;
}

function host(): Host {
  const clock = { now: START };
  const samplers: Host['samplers'] = [];
  const listeners = new Set<(visible: boolean) => void>();
  return {
    clock,
    samplers,
    show(visible) {
      for (const listener of listeners) listener(visible);
    },
    tick() {
      for (const sampler of samplers) if (sampler.running) sampler.tick();
    },
    every(ms, tick) {
      const sampler = { ms, tick, running: true };
      samplers.push(sampler);
      return () => {
        sampler.running = false;
      };
    },
    lifecycle: {
      onVisibility(listener): Unsubscribe {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      onPageHide(): Unsubscribe {
        return () => undefined;
      },
    },
  };
}

function start(
  h: Host,
  state: GameState = initialState(START, 7),
  visible = true,
): { store: GameStore; samples: Sample[] } {
  const store = createGameStore({
    course,
    state,
    now: () => h.clock.now,
    lifecycle: h.lifecycle,
    visible,
    every: h.every,
  });
  const samples: Sample[] = [];
  store.subscribe((sample) => samples.push(sample));
  return { store, samples };
}

const running = (h: Host): number => h.samplers.filter((s) => s.running).length;

describe('the store samples the core about 4 times a second while visible (#128 AC1)', () => {
  it('samples every 250 ms', () => {
    expect(SAMPLE_MS).toBe(250);
  });

  it('starts one sampler at SAMPLE_MS when it starts visible', () => {
    const h = host();
    start(h);
    expect(h.samplers.map((s) => [s.ms, s.running])).toEqual([
      [SAMPLE_MS, true],
    ]);
  });

  it('gives a new subscriber the current sample at once', () => {
    const h = host();
    const { samples } = start(h);
    expect(samples).toHaveLength(1);
  });

  it('each tick is the view at the platform clock’s time', () => {
    const h = host();
    const { store, samples } = start(h);
    h.clock.now = wallMs(START + 1_000);
    h.tick();
    expect(samples).toHaveLength(2);
    expect(samples[1]?.view).toEqual(
      view(course, store.state(), wallMs(START + 1_000)),
    );
  });

  it('a tick changes no state: the live state moves only through apply', () => {
    const h = host();
    const { store } = start(h);
    const before = store.state();
    h.clock.now = wallMs(START + 1_000);
    h.tick();
    expect(store.state()).toBe(before);
  });

  it('an action is applied as an event stamped with the next seq and the clock’s time', () => {
    const h = host();
    const { store } = start(h);
    const before = store.state();
    h.clock.now = wallMs(START + 2_000);
    expect(store.send({ type: 'listen' })).toBe(true);
    const expected = apply(course, before, {
      type: 'listen',
      seq: before.seq + 1,
      wallMs: wallMs(START + 2_000),
    });
    expect(expected.ok).toBe(true);
    expect(store.state()).toEqual(expected.ok ? expected.state : undefined);
  });

  it('an accepted action is sampled at once', () => {
    const h = host();
    const { store, samples } = start(h);
    store.send({ type: 'listen' });
    expect(samples).toHaveLength(2);
    expect(samples[1]?.view).toEqual(view(course, store.state(), h.clock.now));
  });

  it('a page left visible past the offline cap keeps earning: each hour is credited in full', () => {
    const h = host();
    const { store } = start(h);
    const before = store.state();
    const hours = offlineCapMs(before) / HOUR_MS + 1;
    // One scenario: an hour per tick, until past the cap.
    for (let hour = 1; hour <= hours; hour += 1) {
      h.clock.now = wallMs(START + hour * HOUR_MS);
      h.tick();
    }
    expect(store.state().sim - before.sim).toBe(hours * HOUR_MS);
  });

  it('a sample within COMMIT_MS of the last event commits nothing', () => {
    const h = host();
    const { store } = start(h);
    const before = store.state();
    h.clock.now = wallMs(START + COMMIT_MS - 1);
    h.tick();
    expect(store.state()).toBe(before);
  });

  it('a sample COMMIT_MS after the last event commits a resume at the clock’s time', () => {
    const h = host();
    const { store } = start(h);
    const before = store.state();
    h.clock.now = wallMs(START + COMMIT_MS);
    h.tick();
    const resumed = apply(course, before, {
      type: 'resume',
      seq: before.seq + 1,
      wallMs: h.clock.now,
    });
    expect(store.state()).toEqual(resumed.ok ? resumed.state : undefined);
  });

  it('starting the store records a resume at the clock’s time (design §6.2)', () => {
    const h = host();
    const state = initialState(START, 7);
    h.clock.now = wallMs(START + 3 * 60_000);
    const { store } = start(h, state);
    const resumed = apply(course, state, {
      type: 'resume',
      seq: state.seq + 1,
      wallMs: h.clock.now,
    });
    expect(store.state()).toEqual(resumed.ok ? resumed.state : undefined);
  });
});

describe('while hidden the store runs no sampler (#128 AC2)', () => {
  it('starting hidden starts no sampler', () => {
    const h = host();
    start(h, initialState(START, 7), false);
    expect(h.samplers).toEqual([]);
  });

  it('hiding stops the sampler', () => {
    const h = host();
    start(h);
    h.show(false);
    expect(running(h)).toBe(0);
  });

  it('showing again starts exactly one sampler', () => {
    const h = host();
    start(h);
    h.show(false);
    h.show(true);
    expect(running(h)).toBe(1);
  });

  it('a second visible signal while visible starts no second sampler', () => {
    const h = host();
    start(h);
    h.show(true);
    expect(running(h)).toBe(1);
  });

  it('destroy stops the sampler and the visibility listener', () => {
    const h = host();
    const { store } = start(h);
    store.destroy();
    h.show(true);
    expect(running(h)).toBe(0);
  });
});

describe('becoming visible advances by the real gap once, clamped (#128 AC3)', () => {
  it('a forward gap is applied once, as a resume at the clock’s time', () => {
    const h = host();
    const { store } = start(h);
    h.show(false);
    const before = store.state();
    h.clock.now = wallMs(START + 10 * 60_000);
    h.show(true);
    const resumed = apply(course, before, {
      type: 'resume',
      seq: before.seq + 1,
      wallMs: h.clock.now,
    });
    expect(store.state()).toEqual(resumed.ok ? resumed.state : undefined);
    expect(store.state().seq).toBe(before.seq + 1);
  });

  it('a backwards jump advances nothing', () => {
    const h = host();
    const { store } = start(h);
    h.show(false);
    const before = store.state();
    h.clock.now = wallMs(START - HOUR_MS);
    h.show(true);
    expect(store.state().sim).toBe(before.sim);
    expect(
      Num.toTuple(view(course, store.state(), h.clock.now).understanding),
    ).toEqual(Num.toTuple(view(course, before, START).understanding));
  });

  it('a forward jump past the offline cap is credited the cap alone', () => {
    const h = host();
    const { store } = start(h);
    h.show(false);
    const before = store.state();
    const cap = offlineCapMs(before);
    h.clock.now = wallMs(START + cap + 5 * HOUR_MS);
    h.show(true);
    expect(store.state().sim - before.sim).toBe(cap);
  });
});

describe('a refused action is a message, never a throw (#128 AC5)', () => {
  it('send returns false and leaves the state as it was', () => {
    const h = host();
    const { store } = start(h);
    const before = store.state();
    expect(store.send({ type: 'buyUpgrade', id: 'no-such-upgrade' })).toBe(
      false,
    );
    expect(store.state()).toBe(before);
  });

  it('the refusal is sampled as a typed message naming the action', () => {
    const h = host();
    const { store, samples } = start(h);
    store.send({ type: 'buyUpgrade', id: 'no-such-upgrade' });
    expect(samples.at(-1)?.message).toEqual({
      kind: 'rejected',
      action: 'buyUpgrade',
      rejection: { kind: 'unknownUpgrade', id: 'no-such-upgrade' },
    });
  });

  it('the next accepted action clears the message', () => {
    const h = host();
    const { store, samples } = start(h);
    store.send({ type: 'buyUpgrade', id: 'no-such-upgrade' });
    store.send({ type: 'listen' });
    expect(samples.at(-1)?.message).toBeNull();
  });

  it('a sample starts with no message', () => {
    const h = host();
    const { samples } = start(h);
    expect(samples[0]?.message).toBeNull();
  });
});

describe('numbers leave the store unformatted (#128 AC6)', () => {
  it('understanding and rate are Num values, formatted only by the view layer', () => {
    const h = host();
    const { samples } = start(h);
    const first = samples[0]?.view;
    expect(typeof first?.understanding).toBe('object');
    expect(typeof first?.rate).toBe('object');
    expect(first === undefined ? undefined : Num.toTuple(first.rate)).toEqual(
      Num.toTuple(view(course, initialState(START, 7), START).rate),
    );
  });
});
