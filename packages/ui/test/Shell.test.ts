import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Shell from '../src/Shell.svelte';

/**
 * The /play/ shell (#332, #802): until launch it says the game is coming, in
 * both site languages, and points to the roadmap and the launch list.
 */
const { body } = render(Shell);

describe('the play shell', () => {
  it('names the game', () => {
    expect(body).toContain('<h1>Yawelo Idle</h1>');
  });

  it.each([
    ['en', 'Coming soon.', '/roadmap', '/#launch-list'],
    ['id', 'Segera hadir.', '/id/roadmap', '/id/#launch-list'],
  ])(
    'says, in %s, that it is coming, linking the roadmap and launch list',
    (lang, text, roadmap, list) => {
      const section =
        new RegExp(`<section lang="${lang}">([\\s\\S]*?)</section>`).exec(
          body,
        )?.[1] ?? '';
      expect([
        section.includes(text),
        section.includes(`href="${roadmap}"`),
        section.includes(`href="${list}"`),
      ]).toEqual([true, true, true]);
    },
  );
});
