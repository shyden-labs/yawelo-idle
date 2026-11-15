/**
 * When the save is written to its slots (#160 AC2; spec §6.5): on each
 * visibility change, on `pagehide`, and every `BACKUP_MS` while the page is
 * visible. A hidden page runs no timer.
 */
import type { PlatformLifecycle } from '@yawelo-idle/platform';
import type { Every } from './game-store';

export const BACKUP_MS = 30_000;

export interface BackupSchedulerOptions {
  readonly lifecycle: PlatformLifecycle;
  readonly visible: boolean;
  readonly every: Every;
  /** Writes the current save; the scheduler never waits on it. */
  readonly write: () => void;
}

export interface BackupScheduler {
  destroy(): void;
}

export function createBackupScheduler(
  _options: BackupSchedulerOptions,
): BackupScheduler {
  throw new Error('createBackupScheduler: not implemented (#160)');
}
