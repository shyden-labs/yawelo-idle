/** The expected season (#1068). Compile-only stub: tests first. */
import type { Estimates } from './summary';

export interface Season {
  half: 1 | 2;
  year: number;
}

export function expectedSeason(_e: Estimates): Season | null {
  throw new Error('not written yet (#1068)');
}
