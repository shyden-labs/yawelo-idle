/**
 * The UI's one window onto the core (spec §6.3, DN22, #128). Stub: every
 * export throws until the tests that describe it have been seen red.
 */
import type {
  Course,
  GameEvent,
  GameState,
  Rejection,
  View,
  WallMs,
} from '@yawelo-idle/core';
import type { PlatformLifecycle, Unsubscribe } from '@yawelo-idle/platform';

/** About 4 samples a second while the page is visible (spec §6.3). */
export const SAMPLE_MS = 250;

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
export const intervalEvery: Every = () => {
  throw new Error('intervalEvery: not written yet (#128)');
};

export function createGameStore(options: GameStoreOptions): GameStore {
  void options;
  throw new Error('createGameStore: not written yet (#128)');
}
