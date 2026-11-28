import { describe, expect, it } from 'vitest';
import { drawing, type Shape } from './drawing';
import { ISLANDS, MOORING, ship, shipPoint, type Leg } from './layout';
import type { Stage, StageState } from './stages';

/**
 * The voyage map's picture (#1068 AC3, spec §4): Shyden's round 6 map 3,
 * built as a tree of SVG shapes from a seeded source, so it is the same on
 * every load and in every test.
 */
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

/** M0 and M1 done, M2 a quarter done, the rest not started. */
const STAGES = [
  stage(0, 4, 4),
  stage(1, 12, 12),
  stage(2, 1, 4),
  ...[3, 4, 5, 6, 7, 8].map((m) => stage(m, 0, 5)),
];
const NAMES = STAGES.map((s) => `Stage ${String(s.milestone)}`);

const all = (shape: Shape): Shape[] => [
  shape,
  ...shape.children.flatMap((child) => all(child)),
];
const islandsOf = (root: Shape) =>
  all(root).filter((s) =>
    String(s.attrs['class'] ?? '').startsWith('island-art'),
  );
const textsOf = (shape: Shape) =>
  all(shape)
    .filter((s) => s.tag === 'text')
    .map((s) => s.text);
/** The route's legs: the solid gold or dashed sand paths drawn straight onto the sea. */
const legsOf = (root: Shape) =>
  root.children.filter(
    (s) =>
      s.tag === 'path' &&
      s.attrs['fill'] === 'none' &&
      s.attrs['class'] === undefined,
  );

const where = ship(STAGES);
const picture = () => drawing(STAGES, NAMES, where);

describe('drawing (#1068)', () => {
  it('draws the same picture every time', () => {
    expect(JSON.stringify(picture())).toBe(JSON.stringify(picture()));
  });

  it('is a 1000 × 440 picture hidden from screen readers', () => {
    const svg = picture();
    expect(svg.tag).toBe('svg');
    expect(svg.attrs['viewBox']).toBe('0 0 1000 440');
    expect(svg.attrs['aria-hidden']).toBe('true');
  });

  it('draws one island per stage, marked by its state', () => {
    expect(islandsOf(picture()).map((g) => g.attrs['class'])).toEqual([
      'island-art done',
      'island-art done',
      'island-art under-way',
      ...[3, 4, 5, 6, 7, 8].map(() => 'island-art not-started'),
    ]);
  });

  it('draws the route gold and solid into done islands, dashed after', () => {
    const legs = legsOf(picture());
    expect(legs).toHaveLength(ISLANDS.length - 1);
    expect(legs.map((l) => l.attrs['stroke-dasharray'])).toEqual([
      'none',
      ...Array.from({ length: 7 }, () => '2 10'),
    ]);
    expect(legs[0]?.attrs['stroke']).toBe('#f4c95d');
  });

  it('shows a done island’s name with a tick on its sign', () => {
    expect(textsOf(islandsOf(picture())[0] as Shape)).toEqual(['Stage 0  ✓']);
  });

  it('shows an island under way with its percent in a ring', () => {
    expect(textsOf(islandsOf(picture())[2] as Shape)).toEqual([
      '25%',
      'Stage 2',
    ]);
  });

  it('draws a not-started island as a dashed, uncharted outline with no hut', () => {
    const g = islandsOf(picture())[3] as Shape;
    const shapes = all(g);
    expect(shapes.some((s) => s.attrs['stroke-dasharray'] === '4 5')).toBe(
      true,
    );
    expect(shapes.some((s) => s.attrs['fill'] === '#c89a5b')).toBe(false);
    expect(textsOf(g)).toEqual(['Stage 3']);
  });

  it('puts the ship where shipPoint says, just above the water line', () => {
    const boat = all(picture()).find((s) => s.attrs['class'] === 'ship');
    const [x, y] = shipPoint(where as Leg);
    expect(boat?.attrs['transform']).toBe(
      `translate(${x.toFixed(1)},${(y - 4).toFixed(1)}) scale(1.5)`,
    );
  });

  it('draws the ship’s gold trail and its wake', () => {
    const shapes = all(picture());
    expect(shapes.filter((s) => s.attrs['class'] === 'trail')).toHaveLength(1);
    expect(shapes.filter((s) => s.attrs['class'] === 'wake')).toHaveLength(1);
  });

  it('moors the ship beside the last island when every stage is done', () => {
    const finished = STAGES.map((s) => stage(s.milestone, 3, 3));
    const svg = drawing(finished, NAMES, ship(finished));
    const boat = all(svg).find((s) => s.attrs['class'] === 'ship');
    expect(boat?.attrs['transform']).toBe(
      `translate(${MOORING[0].toFixed(1)},${(MOORING[1] - 4).toFixed(1)}) scale(1.5)`,
    );
    expect(all(svg).filter((s) => s.attrs['class'] === 'trail')).toHaveLength(
      0,
    );
  });
});
