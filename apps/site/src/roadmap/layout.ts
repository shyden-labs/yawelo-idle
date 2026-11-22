/** Where the islands sit and where the ship is (#1068). Compile-only stub: tests first. */
import type { Stage } from './stages';

export type Point = readonly [number, number];

export const ISLANDS: readonly Point[] = [];
export const HARBOUR: Point = [0, 0];
export const MOORING: Point = [0, 0];

export interface Leg {
  from: Point;
  to: Point;
  share: number;
  /** The harbour end is open water, so it is not trimmed. */
  fromHarbour: boolean;
}

export function ship(_stages: readonly Stage[]): Leg | { moored: Point } {
  throw new Error('not written yet (#1068)');
}

export function shipPoint(_leg: Leg): Point {
  throw new Error('not written yet (#1068)');
}
