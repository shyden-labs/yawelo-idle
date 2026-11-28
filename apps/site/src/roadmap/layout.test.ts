import { describe, expect, it } from 'vitest';
import { HARBOUR, ISLANDS, MOORING, ship, shipPoint, type Leg } from './layout';
import type { Stage, StageState } from './stages';

/**
 * Where the islands sit and where the ship is (#1068 AC4, spec §3). Expected
 * points were worked out apart from the code (Python, 2026-11-23): each
 * island end of a leg trimmed by 48 px of shore along the leg, the harbour
 * end not trimmed, then 22 px down onto the water.
 */
const close = (
  actual: readonly [number, number],
  expected: [number, number],
) => {
  expect(actual[0]).toBeCloseTo(expected[0], 2);
  expect(actual[1]).toBeCloseTo(expected[1], 2);
};

const stage = (milestone: number, closed: number, total: number): Stage => {
  const state: StageState =
    total > 0 && closed === total
      ? 'done'
      : closed === 0
        ? 'not started'
        : 'under way';
  return {
    epic: 100 + milestone,
    milestone,
    name: null,
    closed,
    total,
    percent: total === 0 ? 0 : Math.floor((100 * closed) / total),
    state,
  };
};

describe('the islands and the harbour (#1068)', () => {
  it('places the nine islands as the design does', () => {
    expect(ISLANDS).toEqual([
      [100, 110],
      [310, 100],
      [520, 118],
      [720, 104],
      [905, 122],
      [820, 300],
      [600, 318],
      [390, 304],
      [170, 318],
    ]);
  });

  it('starts the voyage at the harbour and moors beside the last island', () => {
    expect(HARBOUR).toEqual([20, 220]);
    expect(MOORING).toEqual([230, 340]);
  });
});

describe('shipPoint (#1068 AC4)', () => {
  const leg = (from: number, to: number, share: number): Leg => ({
    from: ISLANDS[from] ?? [0, 0],
    to: ISLANDS[to] ?? [0, 0],
    share,
    fromHarbour: false,
  });

  it('sits off the first shore at 0% of a leg', () => {
    close(shipPoint(leg(0, 1, 0)), [147.946, 129.717]);
  });

  it('sits halfway between the islands at 50%', () => {
    close(shipPoint(leg(0, 1, 0.5)), [205, 127]);
  });

  it('sits off the next shore at 100%', () => {
    close(shipPoint(leg(0, 1, 1)), [262.054, 124.283]);
  });

  it('trims the right shore on a right-to-left leg', () => {
    close(shipPoint(leg(5, 6, 0)), [772.16, 325.914]);
    close(shipPoint(leg(5, 6, 1)), [647.84, 336.086]);
  });

  it('follows a leg that runs down the map', () => {
    close(shipPoint(leg(4, 5, 0.5)), [862.5, 233]);
  });

  it('leaves the harbour end untrimmed', () => {
    const fromHarbour = (share: number): Leg => ({
      from: HARBOUR,
      to: ISLANDS[0] ?? [0, 0],
      share,
      fromHarbour: true,
    });
    close(shipPoint(fromHarbour(0)), [20, 242]);
    close(shipPoint(fromHarbour(1)), [71.768, 170.819]);
  });
});

describe('ship (#1068 AC4)', () => {
  const nine = (...firsts: Stage[]): Stage[] => [
    ...firsts,
    ...Array.from({ length: 9 - firsts.length }, (_, i) =>
      stage(firsts.length + i, 0, 5),
    ),
  ];

  it('puts the ship on the water before the first island when nothing is done', () => {
    expect(ship(nine())).toEqual({
      from: HARBOUR,
      to: ISLANDS[0],
      share: 0,
      fromHarbour: true,
    });
  });

  it('moves it along the harbour leg by the first stage’s closed share', () => {
    expect(ship(nine(stage(0, 1, 4)))).toMatchObject({
      share: 0.25,
      fromHarbour: true,
    });
  });

  it('puts it on the leg into the first unfinished stage, by that stage’s share', () => {
    const where = ship(nine(stage(0, 4, 4), stage(1, 12, 12), stage(2, 7, 27)));
    expect(where).toEqual({
      from: ISLANDS[1],
      to: ISLANDS[2],
      share: 7 / 27,
      fromHarbour: false,
    });
    if ('share' in where) close(shipPoint(where), [387.471, 128.64]);
  });

  it('gives a share of 0 into a stage with no stories', () => {
    expect(ship(nine(stage(0, 4, 4), stage(1, 0, 0)))).toMatchObject({
      share: 0,
    });
  });

  it('moors the ship when every stage is done', () => {
    expect(ship(Array.from({ length: 9 }, (_, i) => stage(i, 3, 3)))).toEqual({
      moored: MOORING,
    });
  });
});
