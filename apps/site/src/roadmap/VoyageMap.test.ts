// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import type { PublicItem, PublicSnapshot } from '@yawelo-idle/progress';
import { COPY } from '../copy';
import type { Locale } from '../i18n';
import { FEATURES } from './features';
import { expectedSeason } from './season';
import { estimates } from './summary';
import VoyageMap from './VoyageMap.svelte';
import { updatedLine } from './updated';
import { fill } from './voyage';

/**
 * The voyage map page (#1068, spec §4 and §7), mounted in jsdom the #806
 * way with `fetch` and the live socket stood in: nine island buttons named
 * and stated from the snapshot, one progress bar, the expected season and
 * its note (hidden with no forecast), one island panel open at a time, and
 * a newer socket snapshot drawn when it comes.
 */
const item = (over: Partial<PublicItem> & { number: number }): PublicItem => ({
  epic: false,
  milestone: null,
  state: 'OPEN',
  closedAt: null,
  estimate: 3,
  parent: null,
  publicTitle: null,
  publicSummary: null,
  waiting: false,
  ...over,
});

const NAMES = [
  'Shipyard',
  'The engine',
  'First words',
  'First playable',
  'Saves and sync',
  'Fair play',
  'The wider world',
  'Desktop and phone apps',
  'Into the stores',
];

/** Epics 100–108 for M0–M8; M0 done (2 of 2), M1 under way, the rest 0 of 1. */
function board(closedInM1 = 1): PublicItem[] {
  const epics = NAMES.map((name, milestone) =>
    item({ number: 100 + milestone, epic: true, milestone, publicTitle: name }),
  );
  const m0 = [200, 201].map((number) =>
    item({ number, parent: 100, state: 'CLOSED' }),
  );
  const m1 = [0, 1, 2, 3].map((n) =>
    item({
      number: 210 + n,
      parent: 101,
      state: n < closedInM1 ? 'CLOSED' : 'OPEN',
    }),
  );
  const rest = [2, 3, 4, 5, 6, 7, 8].map((m) =>
    item({ number: 300 + m, parent: 100 + m }),
  );
  return [...epics, ...m0, ...m1, ...rest];
}

const snapshot = (
  over: Partial<PublicSnapshot> = {},
  pace = [1, 2, 0, 1, 3, 0, 1],
): PublicSnapshot => ({
  version: 1,
  items: board(),
  progress: {
    tickets: { closed: 3, total: 13, pace },
    effort: {
      available: true,
      openPoints: 30,
      assumedClosed: 0,
      scoredMean: 3,
      pace: pace.map((n) => n * 3),
    },
  },
  readAt: '2026-11-22T04:00:00.000Z',
  ...over,
});

const fetchStub = vi.fn<typeof fetch>();
let mounted: ReturnType<typeof mount> | undefined;

const serve = (body: PublicSnapshot): void => {
  fetchStub.mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200 }),
  );
};

const view = (locale: Locale = 'en'): HTMLElement => {
  const target = document.createElement('div');
  document.body.append(target);
  mounted = mount(VoyageMap, { target, props: { locale } });
  flushSync();
  return target;
};

/** Lets the stood-in fetch settle, then Svelte draw what it set. */
const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

const islands = (root: HTMLElement): HTMLButtonElement[] => [
  ...root.querySelectorAll<HTMLButtonElement>('button[data-island]'),
];

const press = (root: HTMLElement, milestone: number): void => {
  root
    .querySelector<HTMLButtonElement>(
      `button[data-island="${String(milestone)}"]`,
    )
    ?.click();
  flushSync();
};

const panels = (root: HTMLElement): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('[data-island-panel]'),
];

/** The live socket stood in (#829): it records itself and is driven by hand. */
class FakeSocket extends EventTarget {
  static opened: FakeSocket[] = [];
  readonly url: string;
  constructor(url: string) {
    super();
    this.url = url;
    FakeSocket.opened.push(this);
  }
  close(): void {
    // The stand-in holds no connection.
  }
  push(body: PublicSnapshot): void {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(body) }),
    );
    flushSync();
  }
}

// The first mount in a test worker pays Svelte's and jsdom's one-time set-up
// (over 1 s once under the full parallel suite, PR #849's unit run). It runs
// in the first beforeEach, before that test's own timing starts mattering; a
// throw there fails that test by name (a beforeAll throw would skip them all,
// #97).
let warmed = false;
const warmUp = (): void => {
  warmed = true;
  vi.stubGlobal('fetch', () => new Promise<Response>(() => undefined));
  vi.stubGlobal('WebSocket', FakeSocket);
  void unmount(
    mount(VoyageMap, {
      target: document.createElement('div'),
      props: { locale: 'en' },
    }),
  );
  vi.unstubAllGlobals();
};

beforeEach(() => {
  if (!warmed) warmUp();
  FakeSocket.opened = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  fetchStub.mockReset();
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  if (mounted !== undefined) void unmount(mounted);
  mounted = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const en = COPY.en.map;

describe('the voyage map page (#1068)', () => {
  it('asks for the roadmap snapshot as JSON', () => {
    serve(snapshot());
    view();
    expect(fetchStub.mock.calls).toEqual([
      ['/api/roadmap.json', { headers: { Accept: 'application/json' } }],
    ]);
  });

  it('says it is reading the board until the snapshot comes, with no islands yet', () => {
    fetchStub.mockReturnValue(new Promise<Response>(() => undefined));
    const root = view();
    expect(root.textContent).toContain(COPY.en.voyage.loading);
    expect(islands(root)).toEqual([]);
  });

  it('says so when the snapshot cannot be read', async () => {
    fetchStub.mockResolvedValue(new Response('{}', { status: 503 }));
    const root = view();
    await settle();
    expect(root.textContent).toContain(COPY.en.voyage.failed);
    expect(islands(root)).toEqual([]);
  });

  it('draws nine island buttons in milestone order, each named with its state', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    expect(islands(root).map((b) => b.getAttribute('aria-label'))).toEqual([
      `Shipyard, ${en.done}`,
      `The engine, ${fill(en.underWay, { percent: 25 })}`,
      ...NAMES.slice(2).map((name) => `${name}, ${en.notStarted}`),
    ]);
  });

  it('hides the drawing itself from screen readers, with the map named', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    expect(root.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(
      root.querySelector('[data-voyage]')?.getAttribute('aria-label'),
    ).toBe(en.label);
  });

  it('shows one progress bar with the all-in-scope figure, labelled in words', async () => {
    const body = snapshot();
    serve(body);
    const root = view();
    await settle();
    const { percent } = estimates(
      body.progress,
      body.readAt.slice(0, 10),
    ).tickets;
    const bars = root.querySelectorAll('progress');
    expect(bars).toHaveLength(1);
    expect(bars[0]?.getAttribute('value')).toBe(String(percent));
    expect(bars[0]?.getAttribute('max')).toBe('100');
    expect(root.querySelector('[data-bar-label]')?.textContent.trim()).toBe(
      fill(en.bar, { percent }),
    );
  });

  it('shows the expected season from the later forecast, with its note', async () => {
    const body = snapshot();
    serve(body);
    const root = view();
    await settle();
    const season = expectedSeason(
      estimates(body.progress, body.readAt.slice(0, 10)),
    );
    expect(season, 'the fixture has both forecasts').not.toBeNull();
    const line = season?.half === 1 ? en.season1 : en.season2;
    expect(root.querySelector('[data-season]')?.textContent.trim()).toBe(
      fill(line, { year: season?.year ?? 0 }),
    );
    expect(root.querySelector('[data-season-note]')?.textContent.trim()).toBe(
      en.seasonNote,
    );
  });

  it('shows the first half when the later forecast falls in it', async () => {
    const base = snapshot();
    const body = {
      ...base,
      progress: {
        ...base.progress,
        tickets: { ...base.progress.tickets, total: 200 },
      },
    };
    serve(body);
    const root = view();
    await settle();
    const season = expectedSeason(
      estimates(body.progress, body.readAt.slice(0, 10)),
    );
    expect(season?.half, 'the fixture lands in a first half').toBe(1);
    expect(root.querySelector('[data-season]')?.textContent.trim()).toBe(
      fill(en.season1, { year: season?.year ?? 0 }),
    );
  });

  it('draws only the stages the board has, when an epic is missing', async () => {
    serve(
      snapshot({
        items: board().filter((i) => i.number !== 108 && i.parent !== 108),
      }),
    );
    const root = view();
    await settle();
    expect(islands(root)).toHaveLength(8);
  });

  it('hides the season and its note with no forecast', async () => {
    serve(snapshot({}, [0, 0, 0, 0, 0, 0, 0]));
    const root = view();
    await settle();
    expect(root.querySelector('[data-season]')).toBeNull();
    expect(root.querySelector('[data-season-note]')).toBeNull();
  });

  it.each([
    ['the summary heading', COPY.en.voyage.summary.heading],
    ['the live line', COPY.en.voyage.live],
    ['the recently-shipped list', COPY.en.voyage.summary.shipped],
    ['the waiting-on-decisions list', COPY.en.voyage.summary.waiting],
    ['the built list', COPY.en.voyage.built],
    ['the left list', COPY.en.voyage.left],
  ])('shows none of the old page: %s', async (_what, gone) => {
    serve(snapshot());
    const root = view();
    await settle();
    expect(root.textContent).not.toContain(gone);
  });

  it('opens an island’s panel with its name, state and features', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    press(root, 3);
    const [panel] = panels(root);
    expect(panels(root)).toHaveLength(1);
    expect(panel?.querySelector('h2')?.textContent.trim()).toBe(
      'First playable',
    );
    expect(panel?.textContent).toContain(en.notStarted);
    expect(panel?.textContent).toContain(en.brings);
    expect(
      [...(panel?.querySelectorAll('li') ?? [])].map((li) =>
        li.textContent.trim(),
      ),
    ).toEqual(FEATURES.en[3]);
    expect(
      root
        .querySelector('button[data-island="3"]')
        ?.getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('keeps one panel open at a time', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    press(root, 3);
    press(root, 5);
    expect(
      panels(root).map((p) => p.querySelector('h2')?.textContent.trim()),
    ).toEqual(['Fair play']);
  });

  it('closes the panel when its island is pressed again', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    press(root, 3);
    press(root, 3);
    expect(panels(root)).toEqual([]);
  });

  it('closes the panel with its close button', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    press(root, 2);
    const close =
      panels(root)[0]?.querySelector<HTMLButtonElement>('button[data-close]');
    expect(close?.textContent.trim()).toBe(en.close);
    close?.click();
    flushSync();
    expect(panels(root)).toEqual([]);
  });

  it('closes the panel with Escape', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    press(root, 2);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    flushSync();
    expect(panels(root)).toEqual([]);
  });

  it('keeps the panel open when another key is pressed', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    press(root, 2);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    );
    flushSync();
    expect(panels(root)).toHaveLength(1);
  });

  it('draws a newer snapshot from the live socket', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    const [socket] = FakeSocket.opened;
    socket?.push(
      snapshot({
        version: 2,
        items: board(3),
        readAt: '2026-11-22T05:00:00.000Z',
      }),
    );
    expect(islands(root)[1]?.getAttribute('aria-label')).toBe(
      `The engine, ${fill(en.underWay, { percent: 75 })}`,
    );
    expect(root.querySelector('[data-updated]')?.textContent).toBe(
      updatedLine('2026-11-22T05:00:00.000Z', en.lastUpdated, 'en'),
    );
  });

  it('says when the board it shows was last updated (#1074)', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    expect(root.querySelector('[data-updated]')?.textContent).toBe(
      updatedLine('2026-11-22T04:00:00.000Z', en.lastUpdated, 'en'),
    );
  });

  // The Worker marks a board whose refresh failed (`readFailed`, #1074 AC5);
  // Shyden, 2026-11-23: "just show what we have and when it was last
  // updated". The page draws that board as any other, with no failure words.
  it('shows a board whose refresh failed like any other, never saying the read failed (#1074)', async () => {
    serve({ ...snapshot(), stale: false, readFailed: true } as PublicSnapshot);
    const root = view();
    await settle();
    const [socket] = FakeSocket.opened;
    socket?.push({
      ...snapshot({ version: 2, readAt: '2026-11-22T05:00:00.000Z' }),
      stale: false,
      readFailed: true,
    } as PublicSnapshot);
    expect({
      islands: islands(root).length,
      updated: root.querySelector('[data-updated]')?.textContent,
      failed: root.textContent.includes(COPY.en.voyage.failed),
      loading: root.textContent.includes(COPY.en.voyage.loading),
    }).toEqual({
      islands: 9,
      updated: updatedLine('2026-11-22T05:00:00.000Z', en.lastUpdated, 'en'),
      failed: false,
      loading: false,
    });
  });

  it('keeps what it drew when the live socket brings a snapshot no newer', async () => {
    serve(snapshot());
    const root = view();
    await settle();
    const [socket] = FakeSocket.opened;
    socket?.push(snapshot({ version: 1, items: board(3) }));
    expect(islands(root)[1]?.getAttribute('aria-label')).toBe(
      `The engine, ${fill(en.underWay, { percent: 25 })}`,
    );
  });

  it('notes on the Indonesian page that island names stay English', async () => {
    serve(snapshot());
    const root = view('id');
    await settle();
    expect(
      root.querySelector('[data-island-names-note]')?.textContent.trim(),
    ).toBe(COPY.id.map.islandNamesNote);
    expect(islands(root)[0]?.getAttribute('aria-label')).toBe(
      `Shipyard, ${COPY.id.map.done}`,
    );
  });

  it('has no island-names note on the English page', async () => {
    serve(snapshot());
    const root = view('en');
    await settle();
    expect(root.querySelector('[data-island-names-note]')).toBeNull();
  });
});
