// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { COPY } from '../copy';
import VoyageMap from './VoyageMap.svelte';
import type { Island, Voyage } from './voyage';

/**
 * The voyage map (#827), mounted in jsdom the #806 way, with `fetch` and the
 * snapshot-to-voyage step stood in: it says it is loading, then draws the
 * islands, the ship, the islands beyond launch and the other work; it says
 * so when the snapshot cannot be read; and it opens one island at a time.
 */
const drawn = vi.hoisted(() => ({ voyage: null as Voyage | null }));
vi.mock('./voyage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./voyage')>()),
  voyage: () => drawn.voyage,
}));

const copy = COPY.en.voyage;

const island = (
  epic: number,
  name: string,
  over: Partial<Island> = {},
): Island => ({
  epic,
  name,
  summary: null,
  status: 'not started',
  built: [],
  left: [],
  behindTheScenes: 0,
  ticketsLeft: 0,
  pointsLeft: 0,
  ...over,
});

const MAP: Voyage = {
  islands: [
    island(1, 'M1: Foundations', { status: 'done' }),
    island(2, 'M2: First words', { status: 'part done' }),
  ],
  beyond: [island(9, 'Mobile stores', { status: 'after launch' })],
  shipAt: 2,
  other: { ticketsLeft: 4, pointsLeft: 13, built: 1 },
};

const fetchStub = vi.fn<typeof fetch>();
let mounted: ReturnType<typeof mount> | undefined;

const respond = (response: Response): void => {
  fetchStub.mockResolvedValue(response);
};

const json = (): Response =>
  new Response(JSON.stringify({ items: [] }), { status: 200 });

const view = (): HTMLElement => {
  const target = document.createElement('div');
  document.body.append(target);
  mounted = mount(VoyageMap, { target, props: { copy, copyLang: 'en' } });
  flushSync();
  return target;
};

/** Lets the stood-in fetch settle, then Svelte draw what it set. */
const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

const text = (root: HTMLElement, selector: string): string[] =>
  [...root.querySelectorAll(selector)].map((e) => e.textContent.trim());

const press = (root: HTMLElement, epic: number): void => {
  root
    .querySelector<HTMLButtonElement>(`[data-epic="${String(epic)}"] button`)
    ?.click();
  flushSync();
};

const expanded = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('button[aria-expanded="true"]')].map(
    (b) => b.getAttribute('aria-controls') ?? '',
  );

beforeEach(() => {
  drawn.voyage = MAP;
  fetchStub.mockReset();
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  if (mounted !== undefined) void unmount(mounted);
  mounted = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('the voyage map', () => {
  it('asks for the roadmap snapshot as JSON', () => {
    respond(json());
    view();
    expect(fetchStub.mock.calls).toEqual([
      ['/api/roadmap.json', { headers: { Accept: 'application/json' } }],
    ]);
  });

  it('says it is reading the board, and is busy, until the snapshot comes', () => {
    fetchStub.mockReturnValue(new Promise<Response>(() => undefined));
    const root = view();
    expect([
      text(root, 'p'),
      root.querySelector('.voyage')?.getAttribute('aria-busy'),
    ]).toEqual([['Reading the board…'], 'true']);
  });

  it('draws one island per epic, in order, with the ship at its island', async () => {
    respond(json());
    const root = view();
    await settle();
    expect([
      text(root, '.islands:not(.beyond) .island-name'),
      text(root, '[data-epic="2"] .ship'),
      root.querySelectorAll('.ship').length,
      root.querySelector('.voyage')?.getAttribute('aria-busy'),
    ]).toEqual([
      ['M1: Foundations', 'M2: First words'],
      ['⛵ The ship is here'],
      1,
      'false',
    ]);
  });

  it('draws the islands beyond launch under their own heading, never with the ship', async () => {
    drawn.voyage = { ...MAP, shipAt: 9 };
    respond(json());
    const root = view();
    await settle();
    expect([
      text(root, 'h2'),
      text(root, '.beyond .island-name'),
      root.querySelectorAll('.ship').length,
    ]).toEqual([['Beyond launch'], ['Mobile stores'], 0]);
  });

  it('draws no beyond-launch heading when no island is beyond launch', async () => {
    drawn.voyage = { ...MAP, beyond: [] };
    respond(json());
    const root = view();
    await settle();
    expect([root.querySelector('h2'), root.querySelector('.beyond')]).toEqual([
      null,
      null,
    ]);
  });

  it('counts the other work on no island', async () => {
    respond(json());
    const root = view();
    await settle();
    expect(text(root, '.other')).toEqual([
      'Other work, on no island: 4 stories and 13 points left',
    ]);
  });

  it('says nothing of other work when none is left', async () => {
    drawn.voyage = {
      ...MAP,
      other: { ticketsLeft: 0, pointsLeft: 0, built: 3 },
    };
    respond(json());
    const root = view();
    await settle();
    expect(root.querySelector('.other')).toBeNull();
  });

  it('says the roadmap could not be read when the answer is not OK', async () => {
    respond(new Response('down', { status: 503 }));
    const root = view();
    await settle();
    expect([
      text(root, '[role="alert"]'),
      root.querySelector('.islands'),
      root.querySelector('.voyage')?.getAttribute('aria-busy'),
    ]).toEqual([['The roadmap could not be read just now.'], null, 'false']);
  });

  it('says the roadmap could not be read when the request fails', async () => {
    fetchStub.mockRejectedValue(new TypeError('offline'));
    const root = view();
    await settle();
    expect(text(root, '[role="alert"]')).toEqual([
      'The roadmap could not be read just now.',
    ]);
  });

  it('starts with every island closed', async () => {
    respond(json());
    const root = view();
    await settle();
    expect(expanded(root)).toEqual([]);
  });

  it('opens the island pressed', async () => {
    respond(json());
    const root = view();
    await settle();
    press(root, 2);
    expect(expanded(root)).toEqual(['panel-2']);
  });

  it('opens one island at a time', async () => {
    respond(json());
    const root = view();
    await settle();
    press(root, 1);
    press(root, 9);
    expect(expanded(root)).toEqual(['panel-9']);
  });

  it('closes the open island when it is pressed again', async () => {
    respond(json());
    const root = view();
    await settle();
    press(root, 1);
    press(root, 1);
    expect(expanded(root)).toEqual([]);
  });
});
