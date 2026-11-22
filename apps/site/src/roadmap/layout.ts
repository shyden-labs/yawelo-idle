/**
 * Where the islands sit and where the ship is (#1068 AC4, spec §3), in the
 * design's 1000 × 440 viewBox (round 6, map 3).
 */
import type { Stage } from './stages';

export type Point = readonly [number, number];

/** Top row left to right, then the bottom row right to left. */
export const ISLANDS: readonly Point[] = [
  [100, 110],
  [310, 100],
  [520, 118],
  [720, 104],
  [905, 122],
  [820, 300],
  [600, 318],
  [390, 304],
  [170, 318],
];

/** Open water left of and below the first island, where the voyage starts. */
export const HARBOUR: Point = [20, 220];

/** Beside the last island, once every stage is done. */
export const MOORING: Point = [230, 340];

/** Island shore trimmed from each island end of a leg. */
const SHORE = 48;

/** From the route down onto the water. */
const WATERLINE = 22;

export interface Leg {
  from: Point;
  to: Point;
  share: number;
  /** The harbour end is open water, so it is not trimmed. */
  fromHarbour: boolean;
}

/** The leg into the first unfinished stage, or moored when all are done. */
export function ship(stages: readonly Stage[]): Leg | { moored: Point } {
  const k = stages.findIndex((stage) => stage.state !== 'done');
  if (k === -1) return { moored: MOORING };
  const stage = stages[k];
  const share =
    stage === undefined || stage.total === 0 ? 0 : stage.closed / stage.total;
  const to = ISLANDS[k] ?? MOORING;
  if (k === 0) return { from: HARBOUR, to, share, fromHarbour: true };
  return { from: ISLANDS[k - 1] ?? HARBOUR, to, share, fromHarbour: false };
}

/**
 * The ship's point on a leg: along the straight line between its trimmed
 * ends, at its share, then down onto the water. Works in any direction.
 */
export function shipPoint(leg: Leg): Point {
  const [ax, ay] = leg.from;
  const [bx, by] = leg.to;
  const length = Math.hypot(bx - ax, by - ay);
  const ux = length === 0 ? 0 : (bx - ax) / length;
  const uy = length === 0 ? 0 : (by - ay) / length;
  const startTrim = leg.fromHarbour ? 0 : SHORE;
  const sx = ax + startTrim * ux;
  const sy = ay + startTrim * uy;
  const ex = bx - SHORE * ux;
  const ey = by - SHORE * uy;
  return [sx + leg.share * (ex - sx), sy + leg.share * (ey - sy) + WATERLINE];
}
