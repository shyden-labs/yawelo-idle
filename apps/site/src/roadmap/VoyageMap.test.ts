// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import type { BoardItem, Progress } from '@yawelo-idle/progress';
import { COPY } from '../copy';
import VoyageMap from './VoyageMap.svelte';
import type { Island, Voyage } from './voyage';

/**
 * The voyage map (#827), mounted in jsdom the #806 way, with `fetch` and the
 * snapshot-to-voyage step stood in: it says it is loading, then draws the
 * islands, the ship and the other work, nothing after launch; it says
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
  shipAt: 2,
  other: { ticketsLeft: 4, pointsLeft: 13, built: 1 },
};

const fetchStub = vi.fn<typeof fetch>();
let mounted: ReturnType<typeof mount> | undefined;

const respond = (response: Response): void => {
  fetchStub.mockResolvedValue(response);
};

/** A snapshot as /api/roadmap.json serves it; its items are drawn by the stand-in. */
interface Snapshot {
  version: number;
  items: BoardItem[];
  progress: Progress;
  readAt: string;
}

const SNAPSHOT: Snapshot = {
  version: 1,
  items: [],
  progress: {
    tickets: {
      closed: 1,
      total: 4,
      epics: 3,
      postLaunch: 1,
      notPlanned: 0,
      pace: [1, 0, 0, 0, 0, 0, 0],
    },
    effort: { available: false, scored: 2, open: 3 },
  },
  readAt: '2026-11-02T04:00:00.000Z',
};

const json = (): Response =>
  new Response(JSON.stringify(SNAPSHOT), { status: 200 });

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

/** The live socket stood in (#829): it records itself and is driven by hand. */
class FakeSocket extends EventTarget {
  static opened: FakeSocket[] = [];
  closed = false;
  readonly url: string;
  constructor(url: string) {
    super();
    this.url = url;
    FakeSocket.opened.push(this);
  }
  close(): void {
    this.closed = true;
  }
  push(snapshot: Snapshot): void {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(snapshot) }),
    );
    flushSync();
  }
  drop(kind: 'close' | 'error'): void {
    this.dispatchEvent(new Event(kind));
    flushSync();
  }
}

const socket = (): FakeSocket => {
  const [first] = FakeSocket.opened;
  if (first === undefined) throw new Error('no socket was opened');
  return first;
};

beforeEach(() => {
  FakeSocket.opened = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  drawn.voyage = MAP;
  fetchStub.mockReset();
  vi.stubGlobal('fetch', fetchStub);
});

const leave = (): void => {
  if (mounted !== undefined) void unmount(mounted);
  mounted = undefined;
};

afterEach(() => {
  leave();
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
      text(root, '.islands .island-name'),
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

  it('draws one list of islands and nothing after launch', async () => {
    respond(json());
    const root = view();
    await settle();
    expect([
      root.querySelectorAll('ol.islands').length,
      root.querySelector('.voyage > h2'),
    ]).toEqual([1, null]);
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

  it('draws the summary above the islands from the same snapshot', async () => {
    respond(json());
    const root = view();
    await settle();
    const summary = root.querySelector('.roadmap-summary');
    expect([
      summary?.querySelector('h2')?.textContent,
      summary?.compareDocumentPosition(root.querySelector('.islands') as Node),
      text(root, '.roadmap-summary .whats-left tfoot td'),
    ]).toEqual([
      'Where the voyage stands',
      Node.DOCUMENT_POSITION_FOLLOWING,
      ['4', '13'],
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
    press(root, 2);
    expect(expanded(root)).toEqual(['panel-2']);
  });

  it('closes the open island when it is pressed again', async () => {
    respond(json());
    const root = view();
    await settle();
    press(root, 1);
    press(root, 1);
    expect(expanded(root)).toEqual([]);
  });

  it('opens the live socket at the Worker’s address', () => {
    respond(json());
    view();
    expect(FakeSocket.opened.map((o) => o.url)).toEqual([
      'ws://localhost:3000/api/roadmap/live',
    ]);
  });

  it('says nothing of being live until the socket speaks', async () => {
    respond(json());
    const root = view();
    await settle();
    expect(root.querySelector('.live-state')).toBeNull();
  });

  it('says it is live once the socket delivers a snapshot', async () => {
    respond(json());
    const root = view();
    await settle();
    socket().push(SNAPSHOT);
    expect(text(root, '.live-state')).toEqual([
      'Live: changes on the board show here as they happen.',
    ]);
  });

  it('redraws from a newer pushed snapshot, without a reload', async () => {
    respond(json());
    const root = view();
    await settle();
    drawn.voyage = { ...MAP, islands: [island(5, 'M5: Pushed')] };
    socket().push({ ...SNAPSHOT, version: 2 });
    expect(text(root, '.islands .island-name')).toEqual(['M5: Pushed']);
  });

  it('keeps what it shows over an older pushed snapshot', async () => {
    respond(new Response(JSON.stringify({ ...SNAPSHOT, version: 3 })));
    const root = view();
    await settle();
    drawn.voyage = { ...MAP, islands: [island(5, 'M5: Stale')] };
    socket().push({ ...SNAPSHOT, version: 2 });
    expect(text(root, '.islands .island-name')).toEqual([
      'M1: Foundations',
      'M2: First words',
    ]);
  });

  it('says it is not live when the socket is refused', async () => {
    respond(json());
    const root = view();
    await settle();
    socket().drop('error');
    expect(text(root, '.live-state')).toEqual([
      'Not live: this is the board as it was when the page loaded.',
    ]);
  });

  it('says it is not live when the socket closes, keeping the snapshot read', async () => {
    respond(json());
    const root = view();
    await settle();
    socket().push(SNAPSHOT);
    socket().drop('close');
    expect([
      text(root, '.live-state'),
      root.querySelectorAll('.island').length,
    ]).toEqual([
      ['Not live: this is the board as it was when the page loaded.'],
      2,
    ]);
  });

  it('draws a pushed snapshot when the JSON read failed', async () => {
    respond(new Response('down', { status: 503 }));
    const root = view();
    await settle();
    socket().push(SNAPSHOT);
    expect([
      root.querySelector('[role="alert"]'),
      root.querySelectorAll('.island').length,
    ]).toEqual([null, 2]);
  });

  it('closes the socket when it leaves the page', () => {
    respond(json());
    view();
    leave();
    expect(socket().closed).toBe(true);
  });
});
