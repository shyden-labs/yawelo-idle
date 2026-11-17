import { describe, expect, it } from 'vitest';
import type { PlatformLifecycle, Unsubscribe } from '@yawelo-idle/platform';
import type { Every } from '../src/game-store';
import { BACKUP_MS, createBackupScheduler } from '../src/backup-scheduler';

/**
 * When the save is written (#160 AC2): on each visibility change, on
 * `pagehide`, and every 30 s while visible, with no timer while hidden. The
 * timers and listeners are counted on a host the test drives.
 */

function host() {
  const timers: { ms: number; tick: () => void; running: boolean }[] = [];
  const shown = new Set<(visible: boolean) => void>();
  const hidden = new Set<() => void>();
  let writes = 0;
  const every: Every = (ms, tick) => {
    const timer = { ms, tick, running: true };
    timers.push(timer);
    return () => {
      timer.running = false;
    };
  };
  const lifecycle: PlatformLifecycle = {
    onVisibility(listener): Unsubscribe {
      shown.add(listener);
      return () => shown.delete(listener);
    },
    onPageHide(listener): Unsubscribe {
      hidden.add(listener);
      return () => hidden.delete(listener);
    },
  };
  return {
    every,
    lifecycle,
    write: () => {
      writes += 1;
    },
    writes: () => writes,
    running: () => timers.filter((t) => t.running),
    tick: () => {
      for (const timer of timers) if (timer.running) timer.tick();
    },
    show: (visible: boolean) => {
      for (const listener of shown) listener(visible);
    },
    pageHide: () => {
      for (const listener of hidden) listener();
    },
    listeners: () => shown.size + hidden.size,
  };
}

const start = (h: ReturnType<typeof host>, visible: boolean) =>
  createBackupScheduler({
    lifecycle: h.lifecycle,
    visible,
    every: h.every,
    write: h.write,
  });

describe('the backup scheduler (#160 AC2)', () => {
  it('BACKUP_MS is 30 s (spec §6.5)', () => {
    expect(BACKUP_MS).toBe(30_000);
  });

  it('starting visible runs one timer of BACKUP_MS and writes nothing yet', () => {
    const h = host();
    start(h, true);
    expect.soft(h.running().map((t) => t.ms)).toEqual([BACKUP_MS]);
    expect.soft(h.writes()).toBe(0);
  });

  it('each tick while visible writes once', () => {
    const h = host();
    start(h, true);
    h.tick();
    h.tick();
    expect(h.writes()).toBe(2);
  });

  it('starting hidden runs no timer', () => {
    const h = host();
    start(h, false);
    expect(h.running()).toEqual([]);
  });

  it('becoming hidden writes once and stops the timer', () => {
    const h = host();
    start(h, true);
    h.show(false);
    expect.soft(h.writes()).toBe(1);
    expect.soft(h.running()).toEqual([]);
  });

  it('becoming visible writes once and starts exactly one timer', () => {
    const h = host();
    start(h, false);
    h.show(true);
    h.show(true);
    expect.soft(h.writes()).toBe(2);
    expect.soft(h.running()).toHaveLength(1);
  });

  it('pagehide writes once', () => {
    const h = host();
    start(h, true);
    h.pageHide();
    expect(h.writes()).toBe(1);
  });

  it('while hidden, nothing ticks a write', () => {
    const h = host();
    start(h, true);
    h.show(false);
    h.tick();
    h.tick();
    expect(h.writes()).toBe(1);
  });

  it('destroy stops the timer and both listeners', () => {
    const h = host();
    const scheduler = start(h, true);
    scheduler.destroy();
    h.show(false);
    h.pageHide();
    expect.soft(h.running()).toEqual([]);
    expect.soft(h.listeners()).toBe(0);
    expect.soft(h.writes()).toBe(0);
  });
});
