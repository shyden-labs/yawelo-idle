/** The voyage map's stages (#1068). Compile-only stub: tests first. */
import type { PublicItem } from '@yawelo-idle/progress';

export type StageState = 'done' | 'under way' | 'not started';

export interface Stage {
  epic: number;
  milestone: number;
  name: string | null;
  closed: number;
  total: number;
  percent: number;
  state: StageState;
}

export function stages(_items: PublicItem[]): Stage[] {
  throw new Error('not written yet (#1068)');
}
