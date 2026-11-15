/**
 * The UI's one window onto the core (spec §6.3, DN22, #128). While the page
 * is visible it samples `view` about 4 times a second; while hidden it holds
 * no timer and never asks for an animation frame. The live state changes
 * only through `apply`: each player action becomes an event stamped with the
 * next `seq` and the platform clock's time, and starting or coming back into
 * view records a `resume` (M1 design §6.2), so the core clamps the gap once:
 * a backwards jump credits nothing, a forward one at most the offline cap.
 */
import {
  apply,
  view,
  type Course,
  type GameEvent,
  type GameState,
  type Rejection,
  type View,
  type WallMs,
} from '@yawelo-idle/core';
import type { PlatformLifecycle, Unsubscribe } from '@yawelo-idle/platform';

/** About 4 samples a second while the page is visible (spec §6.3). */
export const SAMPLE_MS = 250;

/**
 * How long a visible page goes without an event before a sample commits a
 * `resume`. The core credits at most the offline cap since the last event,
 * so without it a window left open past the cap would stop earning.
 */
export const COMMIT_MS = 60_000;

/** A player's action: an event without the `seq` and time the store stamps. */
export type PlayerAction = GameEvent extends infer E
  ? E extends GameEvent
    ? Omit<E, 'seq' | 'wallMs'>
    : never
  : never;

/** Runs `tick` every `ms` until the returned function is called. */
export type Every = (ms: number, tick: () => void) => Unsubscribe;

/** What the UI can show after a refused action. */
export interface RejectedMessage {
  readonly kind: 'rejected';
  readonly action: PlayerAction['type'];
  readonly rejection: Rejection;
}

/** One sample: what the screen shows now. */
export interface Sample {
  readonly view: View;
  /** The last refused action, until the next accepted one. */
  readonly message: RejectedMessage | null;
}

export interface GameStoreOptions {
  readonly course: Course;
  readonly state: GameState;
  /** The platform clock: the only source of time. */
  readonly now: () => WallMs;
  readonly lifecycle: PlatformLifecycle;
  /** Whether the page is visible when the store starts. */
  readonly visible: boolean;
  readonly every: Every;
}

export interface GameStore {
  /** Svelte's store contract: `run` gets the current sample, then each new one. */
  subscribe(run: (sample: Sample) => void): Unsubscribe;
  /** Applies `action` at the platform clock's time; false when refused. */
  send(action: PlayerAction): boolean;
  /** The live state: changed only by `apply`. */
  state(): GameState;
  /** Stops sampling and listening. */
  destroy(): void;
}

/** `Every` over the browser's `setInterval`. */
export const intervalEvery: Every = (ms, tick) => {
  const handle = setInterval(tick, ms);
  return () => {
    clearInterval(handle);
  };
};

export function createGameStore(options: GameStoreOptions): GameStore {
  const { course, now, every } = options;
  let state = options.state;
  let message: RejectedMessage | null = null;
  let stopSampling: Unsubscribe | undefined;
  const subscribers = new Set<(sample: Sample) => void>();

  const sample = (): Sample => ({
    view: view(course, state, now()),
    message,
  });
  const publish = (): void => {
    if (subscribers.size === 0) return;
    const current = sample();
    for (const run of subscribers) run(current);
  };
  const record = (action: PlayerAction): boolean => {
    const event = {
      ...action,
      seq: state.seq + 1,
      wallMs: now(),
    } as GameEvent;
    const result = apply(course, state, event);
    if (result.ok) {
      state = result.state;
      message = null;
    } else {
      message = {
        kind: 'rejected',
        action: action.type,
        rejection: result.rejection,
      };
    }
    return result.ok;
  };
  const tick = (): void => {
    const at = now();
    if (at - state.wall >= COMMIT_MS) {
      const resumed = apply(course, state, {
        type: 'resume',
        seq: state.seq + 1,
        wallMs: at,
      });
      if (resumed.ok) state = resumed.state;
    }
    publish();
  };
  const show = (): void => {
    record({ type: 'resume' });
    stopSampling ??= every(SAMPLE_MS, tick);
    publish();
  };
  const hide = (): void => {
    stopSampling?.();
    stopSampling = undefined;
  };

  if (options.visible) show();
  const stopListening = options.lifecycle.onVisibility((visible) => {
    if (visible) show();
    else hide();
  });

  return {
    subscribe(run) {
      subscribers.add(run);
      run(sample());
      return () => {
        subscribers.delete(run);
      };
    },
    send(action) {
      const accepted = record(action);
      publish();
      return accepted;
    },
    state: () => state,
    destroy() {
      hide();
      stopListening();
    },
  };
}
