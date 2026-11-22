/** The voyage map's picture (#1068). Compile-only stub: tests first. */
import type { Leg, Point } from './layout';
import type { Stage } from './stages';

export interface Shape {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string | number>>;
  readonly children: Shape[];
  text?: string;
}

export function drawing(
  _stages: readonly Stage[],
  _names: readonly string[],
  _where: Leg | { moored: Point },
): Shape {
  throw new Error('not written yet (#1068)');
}
