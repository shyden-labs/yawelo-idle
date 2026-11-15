// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initialState, wallMs } from '@yawelo-idle/core';
import { syntheticCourse } from '@yawelo-idle/core/fixtures/synthetic-course';
import { webPlatform } from '@yawelo-idle/platform';
import { createGameStore, intervalEvery, SAMPLE_MS } from '../src/game-store';

/**
 * While the page is hidden the store asks for no animation frame and no
 * timer (#128 AC2; spec §6.3, DN22). The browser's own timer and frame
 * functions are counted, and the web platform's real lifecycle hears
 * jsdom's `visibilitychange`. Hidden and visible windows run in one test, so
 * the visible window proves the counters count.
 */

const WINDOW_MS = 10_000;
let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  visibility = 'visible';
});

function setVisibility(state: DocumentVisibilityState): void {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

it('a hidden page gets no frames and no timers; a visible one is sampled every 250 ms (#128 AC2)', () => {
  const counts = { interval: 0, timeout: 0, frame: 0 };
  const setInterval = globalThis.setInterval;
  const setTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setInterval').mockImplementation(((
    ...args: Parameters<typeof setInterval>
  ) => {
    counts.interval += 1;
    return setInterval(...args);
  }) as typeof setInterval);
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    ...args: Parameters<typeof setTimeout>
  ) => {
    counts.timeout += 1;
    return setTimeout(...args);
  }) as typeof setTimeout);
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => {
    counts.frame += 1;
    return 0;
  });

  const platform = webPlatform();
  let samples = 0;
  const store = createGameStore({
    course: syntheticCourse(1),
    state: initialState(wallMs(Date.now()), 7),
    now: () => wallMs(Date.now()),
    lifecycle: platform.lifecycle,
    visible: true,
    every: intervalEvery,
  });
  store.subscribe(() => {
    samples += 1;
  });

  setVisibility('hidden');
  const hidden = { ...counts, samples };
  vi.advanceTimersByTime(WINDOW_MS);
  expect({ ...counts, samples }).toEqual(hidden);
  expect(vi.getTimerCount()).toBe(0);

  setVisibility('visible');
  const shown = samples;
  vi.advanceTimersByTime(WINDOW_MS);
  expect(samples - shown).toBe(WINDOW_MS / SAMPLE_MS);
  expect(counts.interval).toBe(hidden.interval + 1);
  expect(counts.frame).toBe(0);
  store.destroy();
  expect(vi.getTimerCount()).toBe(0);
});
