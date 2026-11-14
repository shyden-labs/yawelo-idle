/**
 * The one contract every shell implements (spec §6.4, #124): the browser
 * here, Electron and Capacitor in M7. Game code reaches the host only through
 * it; eslint.platform-only.ts refuses `indexedDB`, `Notification` and
 * `navigator.vibrate` anywhere else.
 */

/**
 * What a call that a host may not support did. When it did nothing (the host
 * lacks the feature, or the player cancelled), it says why; it never
 * succeeds silently.
 */
export type Outcome =
  { readonly done: true } | { readonly done: false; readonly reason: string };

/** Saves and backups, as bytes, by key (spec §6.5). */
export interface PlatformStorage {
  /** The bytes stored under `key`, or `undefined` when there are none. */
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  /** Every stored key, sorted. */
  keys(): Promise<readonly string[]>;
}

export interface LocalNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** When to show it, in milliseconds since the Unix epoch. */
  readonly atMs: number;
}

export interface PlatformNotifications {
  schedule(notification: LocalNotification): Promise<Outcome>;
  cancel(id: string): Promise<Outcome>;
}

export interface PlatformAchievements {
  unlock(id: string): Promise<Outcome>;
}

/** Which regions this build unlocks: the seam for future purchases. */
export interface PlatformEntitlements {
  /** The unlocked region numbers, ascending. */
  regions(): readonly number[];
}

export interface ShareRequest {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

export interface PlatformShare {
  share(request: ShareRequest): Promise<Outcome>;
}

export type HapticStrength = 'light' | 'medium' | 'heavy';

export interface PlatformHaptics {
  pulse(strength: HapticStrength): Outcome;
}

/** Stops a listener; calling it again does nothing. */
export type Unsubscribe = () => void;

export interface PlatformLifecycle {
  /** Called once per change: `false` when hidden, `true` when shown. */
  onVisibility(listener: (visible: boolean) => void): Unsubscribe;
  /** Called when the page is being put away or unloaded. */
  onPageHide(listener: () => void): Unsubscribe;
}

export interface Platform {
  readonly storage: PlatformStorage;
  readonly notifications: PlatformNotifications;
  readonly achievements: PlatformAchievements;
  readonly entitlements: PlatformEntitlements;
  readonly share: PlatformShare;
  readonly haptics: PlatformHaptics;
  readonly lifecycle: PlatformLifecycle;
}

/** The seven members, in the spec's order (§6.4). */
export const PLATFORM_MEMBERS = [
  'storage',
  'notifications',
  'achievements',
  'entitlements',
  'share',
  'haptics',
  'lifecycle',
] as const satisfies readonly (keyof Platform)[];
