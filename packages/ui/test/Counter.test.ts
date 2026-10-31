// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Counter from './fixtures/Counter.svelte';

/**
 * The DOM test pattern (#806): a component test that clicks opts into jsdom
 * with the comment above, mounts the component, clicks, flushes Svelte's
 * updates, and reads the DOM. Every screen's behaviour is tested this way
 * in full (#804).
 */
let mounted: ReturnType<typeof mount> | undefined;

const view = (step: number): HTMLElement => {
  const target = document.createElement('div');
  document.body.append(target);
  mounted = mount(Counter, { target, props: { step } });
  return target;
};

const click = (root: HTMLElement): void => {
  root.querySelector('button')?.click();
  flushSync();
};

afterEach(() => {
  if (mounted !== undefined) void unmount(mounted);
  mounted = undefined;
  document.body.replaceChildren();
});

describe('a clickable component in jsdom', () => {
  it('shows the else arm before any click', () => {
    expect(view(2).querySelector('p')?.textContent).toBe('Nothing yet');
  });

  it('runs the click handler and shows the if arm', () => {
    const root = view(2);
    click(root);
    expect(root.querySelector('p')?.textContent).toBe('Count: 2');
  });

  it('keeps counting on later clicks', () => {
    const root = view(3);
    click(root);
    click(root);
    expect(root.querySelector('p')?.textContent).toBe('Count: 6');
  });
});
