/**
 * The voyage map's picture (#1068 AC3, spec §4): Shyden's chosen design,
 * round 6 map 3 (`.superpowers/sdd/830/island-designs-round6.html`:
 * `renderTimeline` with the navy sea, `pattern: 'wavestars'`, moonlight,
 * wooden signs, wide beaches and dashed "uncharted" outlines for islands
 * not started). Pure: it returns a tree of SVG shapes from a seeded random
 * source, so the picture is the same on every load and in every test;
 * `SeaMap.svelte` draws the tree. The ship's place comes from `layout.ts`.
 */
import { ISLANDS, shipPoint, type Leg, type Point } from './layout';
import type { Stage } from './stages';

/** One SVG element: its tag, attributes, children and any text. */
export interface Shape {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string | number>>;
  readonly children: Shape[];
  text?: string;
}

const W = 1000;
const H = 440;
const NAVY = ['#0d1b3d', '#142a5c', '#24407a'] as const;
const OCHRE = ['#d9b36c', '#b8913f', '#8a6b2e'] as const;
const INK = '#f6e7c1';
const SAND = '#f0d9a0';
const GOLD = '#f4c95d';
const MOON = '#fff4d6';
const WOOD = '#c89a5b';
const DARK_WOOD = '#5a3a1e';
const FONT = 'Inter, system-ui, sans-serif';

/** The design's seeded source (mulberry32), seeded as round 6 seeds its map. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n1 = (v: number): string => v.toFixed(1);

function add(
  parent: Shape,
  tag: string,
  attrs: Record<string, string | number>,
  text?: string,
): Shape {
  const shape: Shape = { tag, attrs, children: [] };
  if (text !== undefined) shape.text = text;
  parent.children.push(shape);
  return shape;
}

/** A rough island shore around (cx, cy), squashed to sit flat on the sea. */
function shore(cx: number, cy: number, r: number, rand: () => number): Point[] {
  const points = 22;
  const rough = 0.55;
  const phase = rand() * 6.28;
  return Array.from({ length: points }, (_, i): Point => {
    const a = (i / points) * 6.2832;
    const k =
      1 +
      rough *
        (Math.sin(a * 3 + phase) * 0.35 +
          Math.sin(a * 5 + phase * 2) * 0.2 +
          (rand() - 0.5) * 0.5);
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.72];
  });
}

/** A smooth closed path through the midpoints of a shore's points. */
function smooth(p: readonly Point[]): string {
  const at = (i: number): Point => p[(i + p.length) % p.length] ?? [0, 0];
  const start = at(-1);
  const first = at(0);
  let d = `M${n1((start[0] + first[0]) / 2)},${n1((start[1] + first[1]) / 2)}`;
  for (let i = 0; i < p.length; i += 1) {
    const a = at(i);
    const b = at(i + 1);
    d += ` Q${n1(a[0])},${n1(a[1])} ${n1((a[0] + b[0]) / 2)},${n1((a[1] + b[1]) / 2)}`;
  }
  return `${d}Z`;
}

const grown = (p: readonly Point[], cx: number, cy: number, s: number) =>
  p.map(([x, y]): Point => [cx + (x - cx) * s, cy + (y - cy) * s]);

function drawSea(svg: Shape, rand: () => number): void {
  const defs = add(svg, 'defs', {});
  const fall = add(defs, 'linearGradient', {
    id: 'voyage-sea',
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
  });
  add(fall, 'stop', { offset: 0, 'stop-color': NAVY[0] });
  add(fall, 'stop', { offset: 1, 'stop-color': NAVY[1] });
  const glow = add(defs, 'radialGradient', { id: 'voyage-moon' });
  add(glow, 'stop', { offset: 0, 'stop-color': MOON, 'stop-opacity': 0.35 });
  add(glow, 'stop', { offset: 1, 'stop-color': MOON, 'stop-opacity': 0 });
  add(svg, 'rect', { width: W, height: H, fill: 'url(#voyage-sea)' });
  const moonX = W * 0.62;
  const moonY = Math.min(H * 0.13, 30);
  add(svg, 'circle', {
    cx: moonX,
    cy: moonY,
    r: Math.min(H * 0.9, 420),
    fill: 'url(#voyage-moon)',
  });
  add(svg, 'circle', { cx: moonX, cy: moonY, r: 14, fill: MOON });
  const waves = add(svg, 'g', { class: 'waves' });
  const crests = ' q6,-5 12,0 q6,5 12,0'.repeat(Math.ceil(W / 24));
  for (let y = H * 0.45; y < H; y += 18)
    add(waves, 'path', {
      d: `M0,${n1(y)}${crests}`,
      stroke: NAVY[2],
      'stroke-width': 1,
      fill: 'none',
      opacity: 0.7,
    });
  for (let i = 0; i < 40; i += 1)
    add(svg, 'circle', {
      cx: n1(rand() * W),
      cy: n1(rand() * H * 0.45),
      r: n1(rand() * 1.4 + 0.3),
      fill: MOON,
      opacity: n1(rand() * 0.6 + 0.2),
    });
}

function drawPalm(g: Shape, x: number, y: number, h: number, lean: number) {
  add(g, 'path', {
    d: `M${n1(x)},${n1(y)} q${n1(lean * 0.4)},${n1(-h * 0.55)} ${n1(lean)},${n1(-h)}`,
    stroke: '#7a4a2a',
    'stroke-width': n1(Math.max(2.2, h * 0.09)),
    fill: 'none',
    'stroke-linecap': 'round',
  });
  const tx = x + lean;
  const ty = y - h;
  const reach = h * 0.62;
  for (const a of [-2.6, -1.9, -1.2, -0.5, 0.2])
    add(g, 'path', {
      d: `M${n1(tx)},${n1(ty)} q${n1(Math.cos(a) * reach * 0.55)},${n1(Math.sin(a) * reach * 0.55 - reach * 0.25)} ${n1(Math.cos(a) * reach)},${n1(Math.sin(a) * reach * 0.4 + reach * 0.15)}`,
      stroke: '#2f6129',
      'stroke-width': n1(Math.max(2.4, h * 0.1)),
      fill: 'none',
      'stroke-linecap': 'round',
    });
  add(g, 'circle', {
    cx: n1(tx + 1),
    cy: n1(ty + 2),
    r: n1(h * 0.06 + 1),
    fill: '#7a4a2a',
  });
}

function drawHut(g: Shape, x: number, y: number, lamp: boolean) {
  add(g, 'rect', {
    x: n1(x - 8),
    y: n1(y - 10),
    width: 16,
    height: 10,
    fill: WOOD,
  });
  add(g, 'path', {
    d: `M${n1(x - 12)},${n1(y - 9)} Q${n1(x)},${n1(y - 26)} ${n1(x + 12)},${n1(y - 9)}Z`,
    fill: '#8a5a2e',
  });
  add(g, 'rect', {
    x: n1(x - 2),
    y: n1(y - 6),
    width: 4,
    height: 6,
    fill: DARK_WOOD,
  });
  if (!lamp) return;
  add(g, 'circle', {
    cx: n1(x),
    cy: n1(y - 5),
    r: 9,
    fill: '#ffd166',
    opacity: 0.35,
  });
  add(g, 'rect', {
    x: n1(x - 2),
    y: n1(y - 7),
    width: 4,
    height: 4,
    fill: '#ffd166',
  });
}

/** A charted island: glow, wide sand beach, two land rings, a hut, two palms. */
function drawLand(
  g: Shape,
  x: number,
  y: number,
  rand: () => number,
  lamp: boolean,
) {
  const r = 40;
  const p = shore(x, y, r, rand);
  add(g, 'path', { d: smooth(grown(p, x, y, 1.5)), fill: MOON, opacity: 0.08 });
  add(g, 'path', { d: smooth(grown(p, x, y, 1.2)), fill: SAND });
  add(g, 'path', { d: smooth(p), fill: OCHRE[0] });
  add(g, 'path', { d: smooth(grown(p, x, y, 0.69)), fill: OCHRE[1] });
  add(g, 'path', {
    d: smooth(grown(p, x, y, 0.38)),
    fill: OCHRE[2],
    opacity: 0.9,
  });
  drawHut(g, x + r * 0.25, y + r * 0.2, lamp);
  drawPalm(g, x - r * 0.45, y + r * 0.28, r * 0.62, -5);
  drawPalm(g, x + r * 0.45, y + r * 0.28, r * 0.62, 5);
}

function drawSign(
  g: Shape,
  x: number,
  y: number,
  text: string,
  plain: boolean,
) {
  if (plain) {
    add(
      g,
      'text',
      {
        x,
        y,
        'text-anchor': 'middle',
        fill: INK,
        'font-family': FONT,
        'font-size': 12.5,
        'font-weight': 600,
        'paint-order': 'stroke',
        stroke: NAVY[0],
        'stroke-width': 3,
      },
      text,
    );
    return;
  }
  const w = text.length * 6.6 + 14;
  add(g, 'line', {
    x1: x,
    y1: y + 8,
    x2: x,
    y2: y + 18,
    stroke: DARK_WOOD,
    'stroke-width': 2.5,
  });
  add(g, 'rect', {
    x: n1(x - w / 2),
    y: y - 10,
    width: n1(w),
    height: 18,
    rx: 3,
    fill: WOOD,
    stroke: DARK_WOOD,
    'stroke-width': 1.2,
  });
  add(
    g,
    'text',
    {
      x,
      y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: '#3d2a12',
      'font-family': FONT,
      'font-size': 11.5,
      'font-weight': 600,
    },
    text,
  );
}

function drawDone(g: Shape, x: number, y: number) {
  add(g, 'line', {
    x1: x + 26,
    y1: y - 6,
    x2: x + 26,
    y2: y - 46,
    stroke: DARK_WOOD,
    'stroke-width': 2.2,
  });
  add(g, 'path', {
    d: `M${String(x + 26)},${String(y - 46)} l22,7 l-22,7z`,
    fill: '#e63946',
  });
  add(g, 'circle', {
    cx: x - 30,
    cy: y - 30,
    r: 12,
    fill: '#2f9e5b',
    stroke: MOON,
    'stroke-width': 2,
  });
  add(g, 'path', {
    d: `M${String(x - 36)},${String(y - 30)} l4,5 l8,-9`,
    stroke: MOON,
    'stroke-width': 2.6,
    fill: 'none',
    'stroke-linecap': 'round',
  });
}

function drawRing(g: Shape, x: number, y: number, percent: number) {
  const cx = x - 30;
  const cy = y - 30;
  const r = 13;
  const turn = (percent / 100) * 2 * Math.PI;
  add(g, 'circle', {
    cx,
    cy,
    r,
    fill: NAVY[0],
    stroke: '#5a6a8a',
    'stroke-width': 3,
  });
  add(g, 'path', {
    d: `M${String(cx)},${String(cy - r)} A${String(r)},${String(r)} 0 ${turn > Math.PI ? '1' : '0'} 1 ${n1(cx + r * Math.sin(turn))},${n1(cy - r * Math.cos(turn))}`,
    stroke: GOLD,
    'stroke-width': 3,
    fill: 'none',
  });
  add(
    g,
    'text',
    {
      x: cx,
      y: cy + 3.5,
      'text-anchor': 'middle',
      fill: MOON,
      'font-size': 9,
      'font-weight': 700,
      'font-family': FONT,
    },
    `${String(percent)}%`,
  );
}

function drawShip(svg: Shape, x: number, y: number) {
  const hull = '#8b4513';
  const b = add(svg, 'g', {
    class: 'ship',
    transform: `translate(${n1(x)},${n1(y)}) scale(1.5)`,
  });
  add(b, 'path', {
    class: 'wake',
    d: 'M-22,6 q-18,4 -40,2 M-22,9 q-16,7 -34,8',
    stroke: MOON,
    'stroke-width': 1.4,
    fill: 'none',
    opacity: 0.5,
  });
  add(b, 'path', { d: 'M-20,2 q20,12 40,0 l-4,-3 q-16,6 -32,0z', fill: hull });
  add(b, 'path', {
    d: 'M-24,-3 q4,3 6,4 M24,-3 q-4,3 -6,4',
    stroke: hull,
    'stroke-width': 2,
    fill: 'none',
  });
  for (const ox of [-6, 8])
    add(b, 'line', {
      x1: ox,
      y1: 4,
      x2: ox,
      y2: 14,
      stroke: hull,
      'stroke-width': 1.5,
    });
  add(b, 'path', {
    d: 'M-16,14 h30',
    stroke: hull,
    'stroke-width': 2.4,
    'stroke-linecap': 'round',
  });
  add(b, 'path', { d: 'M-2,1 V-24 L14,-2Z', fill: '#e63946' });
  add(b, 'path', { d: 'M-4,1 V-18 L-14,-1Z', fill: '#f1faee' });
  add(b, 'path', { d: 'M-2,-24 l0,-5 l6,2z', fill: GOLD });
}

/** The leg from island a to island b, bowed down onto the water. */
function drawLeg(
  svg: Shape,
  a: Point,
  b: Point,
  travelled: boolean,
  next: boolean,
) {
  const bow = (a[1] + b[1]) / 2 + (a[1] === b[1] ? 40 : 0) + 30;
  add(svg, 'path', {
    d: `M${String(a[0])},${String(a[1] + 12)} Q${n1((a[0] + b[0]) / 2)},${n1(bow)} ${String(b[0])},${String(b[1] + 12)}`,
    fill: 'none',
    stroke: travelled ? GOLD : SAND,
    'stroke-width': travelled ? 3.5 : 2.4,
    'stroke-dasharray': travelled ? 'none' : '2 10',
    'stroke-linecap': 'round',
    opacity: travelled ? 1 : next ? 0.8 : 0.4,
  });
}

/**
 * The whole picture: the sea, the route, each stage's island (charted with
 * a flag and tick when done, a percent ring when under way, a dashed
 * uncharted outline when not started) named on its sign, and the ship with
 * its gold trail, or moored when every stage is done.
 */
export function drawing(
  stages: readonly Stage[],
  names: readonly string[],
  where: Leg | { moored: Point },
): Shape {
  const rand = seeded(7000);
  const svg: Shape = {
    tag: 'svg',
    attrs: {
      viewBox: `0 0 ${String(W)} ${String(H)}`,
      'aria-hidden': 'true',
      focusable: 'false',
    },
    children: [],
  };
  drawSea(svg, rand);
  const firstOpen = stages.findIndex((s) => s.state !== 'done');
  for (let k = 1; k < ISLANDS.length; k += 1)
    drawLeg(
      svg,
      ISLANDS[k - 1] ?? [0, 0],
      ISLANDS[k] ?? [0, 0],
      firstOpen === -1 || k < firstOpen,
      k === firstOpen,
    );
  stages.forEach((stage, k) => {
    const [x, y] = ISLANDS[k] ?? [0, 0];
    const g = add(svg, 'g', {
      class: `island-art ${stage.state.replace(' ', '-')}`,
    });
    const name = names[k] ?? '';
    if (stage.state === 'not started') {
      add(g, 'path', {
        d: smooth(shore(x, y, 40, rand)),
        fill: 'none',
        stroke: SAND,
        'stroke-width': 1.6,
        'stroke-dasharray': '4 5',
        opacity: 0.55,
      });
      drawSign(g, x, y + 66, name, true);
      return;
    }
    const done = stage.state === 'done';
    drawLand(g, x, y, rand, done);
    if (done) drawDone(g, x, y);
    else drawRing(g, x, y, stage.percent);
    drawSign(g, x, y + 66, done ? `${name}  ✓` : name, false);
  });
  if ('moored' in where) {
    drawShip(svg, where.moored[0], where.moored[1] - 4);
    return svg;
  }
  const [sx, sy] = shipPoint(where);
  const [ax, ay] = where.from;
  const off = where.fromHarbour ? 0 : 30;
  add(svg, 'path', {
    class: 'trail',
    d: `M${n1(ax + off)},${n1(ay + 14)} Q${n1((ax + sx) / 2)},${n1(sy + 10)} ${n1(sx)},${n1(sy)}`,
    fill: 'none',
    stroke: GOLD,
    'stroke-width': 3.5,
    'stroke-linecap': 'round',
  });
  drawShip(svg, sx, sy - 4);
  return svg;
}
