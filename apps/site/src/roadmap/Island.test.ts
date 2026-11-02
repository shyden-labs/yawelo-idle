// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { COPY } from '../copy';
import Island from './Island.svelte';
import type { Island as IslandData } from './voyage';

/**
 * One island of the voyage map (#827), mounted in jsdom the #806 way: its
 * button names the epic and its status, carries the ship when the ship is
 * there, and asks to toggle; its panel lists what's built and what's left.
 */
const copy = COPY.en.voyage;

const data = (over: Partial<IslandData> = {}): IslandData => ({
  epic: 7,
  name: 'Learning loop',
  summary: 'Words come back when you are about to forget them.',
  status: 'part done',
  built: [{ number: 11, title: 'Cards return on time' }],
  left: [
    { number: 12, title: 'Harder cards come sooner', points: 5 },
    { number: 13, title: 'A review screen', points: null },
  ],
  behindTheScenes: 2,
  ticketsLeft: 2,
  pointsLeft: 5,
  ...over,
});

let mounted: ReturnType<typeof mount> | undefined;

const view = (
  over: {
    item?: IslandData;
    ship?: boolean;
    open?: boolean;
    onToggle?: (epic: number) => void;
  } = {},
): HTMLElement => {
  const target = document.createElement('ol');
  document.body.append(target);
  mounted = mount(Island, {
    target,
    props: {
      item: over.item ?? data(),
      ship: over.ship ?? false,
      open: over.open ?? true,
      onToggle: over.onToggle ?? (() => undefined),
      copy,
      copyLang: 'en',
    },
  });
  flushSync();
  return target;
};

const text = (root: HTMLElement, selector: string): string[] =>
  [...root.querySelectorAll(selector)].map((e) => e.textContent.trim());

afterEach(() => {
  if (mounted !== undefined) void unmount(mounted);
  mounted = undefined;
  document.body.replaceChildren();
});

describe('an island of the voyage map', () => {
  it('names the epic and its status on its button', () => {
    const root = view();
    expect([
      text(root, '.island-name'),
      text(root, '.island-status'),
      root.querySelector('.island')?.getAttribute('data-status'),
    ]).toEqual([['Learning loop'], ['Part done'], 'part done']);
  });

  it('carries the ship when the ship is there', () => {
    expect(text(view({ ship: true }), '.ship')).toEqual([
      '⛵ The ship is here',
    ]);
  });

  it('carries no ship elsewhere', () => {
    expect(view({ ship: false }).querySelector('.ship')).toBeNull();
  });

  it('asks to toggle its own epic when its button is pressed', () => {
    const onToggle = vi.fn<(epic: number) => void>();
    const root = view({ onToggle });
    root.querySelector('button')?.click();
    expect(onToggle.mock.calls).toEqual([[7]]);
  });

  it('shows its panel, marked expanded, when open', () => {
    const root = view({ open: true });
    expect([
      root.querySelector('button')?.getAttribute('aria-expanded'),
      root.querySelector('#panel-7')?.hasAttribute('hidden'),
      root.querySelector('button')?.getAttribute('aria-controls'),
    ]).toEqual(['true', false, 'panel-7']);
  });

  it('hides its panel, marked collapsed, when closed', () => {
    const root = view({ open: false });
    expect([
      root.querySelector('button')?.getAttribute('aria-expanded'),
      root.querySelector('#panel-7')?.hasAttribute('hidden'),
    ]).toEqual(['false', true]);
  });

  it('shows the Public summary', () => {
    expect(text(view(), '.summary')).toEqual([
      'Words come back when you are about to forget them.',
    ]);
  });

  it('shows no summary when the epic has none', () => {
    expect(
      view({ item: data({ summary: null }) }).querySelector('.summary'),
    ).toBeNull();
  });

  it('links each built story to its issue', () => {
    const root = view();
    expect(
      [...root.querySelectorAll('.built a')].map((a) => [
        a.textContent,
        a.getAttribute('href'),
      ]),
    ).toEqual([
      [
        'Cards return on time',
        'https://github.com/shyden-labs/yawelo-idle/issues/11',
      ],
    ]);
  });

  it('lists each story left, with its points when it has them', () => {
    const root = view();
    expect([text(root, '.left a'), text(root, '.left .points')]).toEqual([
      ['Harder cards come sooner', 'A review screen'],
      ['5 points'],
    ]);
  });

  it('says nothing yet under both headings when it has no named stories', () => {
    const root = view({ item: data({ built: [], left: [] }) });
    expect([
      text(root, 'h3'),
      text(root, '.panel > p:not(.summary):not(.behind)'),
      root.querySelector('ul'),
    ]).toEqual([
      ['What’s built', 'What’s left'],
      ['Nothing yet.', 'Nothing yet.'],
      null,
    ]);
  });

  it('counts the behind-the-scenes stories', () => {
    expect(text(view(), '.behind')).toEqual([
      'plus 2 behind-the-scenes improvements',
    ]);
  });

  it('says nothing of behind the scenes when there are none', () => {
    expect(
      view({ item: data({ behindTheScenes: 0 }) }).querySelector('.behind'),
    ).toBeNull();
  });
});
