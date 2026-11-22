/**
 * The voyage map's stages (#1068 AC2, spec §3): one per epic with a
 * milestone 0–8, in milestone order, each from the closed share of its own
 * stories. The epic's own open or closed state is not read.
 */
import type { PublicItem } from '@yawelo-idle/progress';

export type StageState = 'done' | 'under way' | 'not started';

export interface Stage {
  epic: number;
  milestone: number;
  /** The epic's Public title, or null (the page falls back to `islandName`). */
  name: string | null;
  closed: number;
  total: number;
  /** Rounded down, so 99.6% never shows as 100. */
  percent: number;
  state: StageState;
}

/** The milestones the map draws: M0 to M8. */
const FIRST = 0;
const LAST = 8;

function stateOf(closed: number, total: number): StageState {
  if (total > 0 && closed === total) return 'done';
  return closed === 0 ? 'not started' : 'under way';
}

export function stages(items: PublicItem[]): Stage[] {
  return items
    .filter(
      (item): item is PublicItem & { milestone: number } =>
        item.epic &&
        item.milestone !== null &&
        Number.isInteger(item.milestone) &&
        item.milestone >= FIRST &&
        item.milestone <= LAST,
    )
    .sort((a, b) => a.milestone - b.milestone)
    .map((epic) => {
      const stories = items.filter(
        (item) => !item.epic && item.parent === epic.number,
      );
      const total = stories.length;
      const closed = stories.filter((s) => s.state === 'CLOSED').length;
      return {
        epic: epic.number,
        milestone: epic.milestone,
        name: epic.publicTitle,
        closed,
        total,
        percent: total === 0 ? 0 : Math.floor((100 * closed) / total),
        state: stateOf(closed, total),
      };
    });
}
