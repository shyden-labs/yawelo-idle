import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The holding page's text contrast (#621, spec §7: WCAG 2.2 AA), measured from
 * the tokens apps/site/src/styles/holding.css declares, on screen (`:root`)
 * and in print (the `@media print` block). Normal text needs 4.5:1; the
 * wordmark and the 404 heading are large text and need 3:1. A rendered check
 * comes with the visual sign-off (#345).
 */
const CSS = new URL('../../apps/site/src/styles/holding.css', import.meta.url);

type Medium = 'screen' | 'print';

/** The `--name: #rrggbb;` tokens of the first `:root { … }` block in `text`. */
function rootTokens(text: string): Map<string, string> {
  const open = text.indexOf(':root {');
  if (open < 0) throw new Error('no :root block');
  const close = text.indexOf('}', open);
  const tokens = new Map<string, string>();
  for (const match of text
    .slice(open, close)
    .matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6});/g)) {
    const [, name, value] = match;
    if (name === undefined || value === undefined) throw new Error('bad token');
    tokens.set(name, value);
  }
  return tokens;
}

let read: Record<Medium, Map<string, string>> | undefined;
/** Read on first use, inside a test, not at collection. */
function tokens(medium: Medium): Map<string, string> {
  read ??= (() => {
    const text = readFileSync(CSS, 'utf8');
    const print = text.indexOf('@media print {');
    if (print < 0) throw new Error('no @media print block');
    const screen = rootTokens(text.slice(0, print));
    // Print redefines tokens; anything it leaves alone keeps its screen value.
    const printed = new Map([...screen, ...rootTokens(text.slice(print))]);
    return { screen, print: printed };
  })();
  return read[medium];
}

const channel = (hex: string, at: number): number => {
  const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) +
  0.7152 * channel(hex, 3) +
  0.0722 * channel(hex, 5);
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  if (hi === undefined || lo === undefined) throw new Error('no luminance');
  return (hi + 0.05) / (lo + 0.05);
}

function token(medium: Medium, name: string): string {
  const value = tokens(medium).get(name);
  if (value === undefined) throw new Error(`${medium}: no ${name}`);
  return value;
}

/** Every text colour the page sets, on the ground it sits on, and the ratio it needs. */
/**
 * WCAG 2.2's AA minimums (SC 1.4.3): 4.5:1 for normal text, 3:1 for large
 * text (the wordmark and the 404 heading) and, by SC 1.4.11, for the focus
 * ring. Spec values, not counted floors.
 */
const AA = { text: 4.5, large: 3 } as const;
type Size = keyof typeof AA;
const meets = (ratio: number, size: Size): boolean => ratio >= AA[size];

const PAIRS: readonly [string, string, string, Size][] = [
  ['body text and the wordmark', '--text', '--bg', 'text'],
  ['the wordmark on the sky’s glow', '--text', '--bg-glow', 'large'],
  ['the tagline', '--muted', '--bg', 'text'],
  ['the tagline on the sky’s glow', '--muted', '--bg-glow', 'text'],
  ['links', '--mint', '--bg', 'text'],
  ['links on the sky’s glow', '--mint', '--bg-glow', 'text'],
  ['the focus ring', '--focus', '--bg', 'large'],
  ['the pill’s text at its mint end', '--pill-text', '--pill-from', 'text'],
  ['the pill’s text at its teal end', '--pill-text', '--pill-to', 'text'],
];

describe.each(['screen', 'print'] as const)(
  'holding page contrast, %s (#621)',
  (medium) => {
    it.each(PAIRS)(
      '%s: %s on %s meets AA for %s',
      (_what, fore, ground, size) => {
        expect(
          meets(contrast(token(medium, fore), token(medium, ground)), size),
        ).toBe(true);
      },
    );

    // A token a pair names but the medium lacks throws in token(), failing that pair.
  },
);

describe('the AA minimums themselves', () => {
  it.each([
    [4.5, 'text', true],
    [4.49, 'text', false],
    [3, 'large', true],
    [2.99, 'large', false],
  ] as const)(
    'a ratio of %d for %s text meets AA: %s',
    (ratio, size, expected) => {
      expect(meets(ratio, size)).toBe(expected);
    },
  );
});

describe('the contrast measure itself', () => {
  it('gives white on black 21:1 and a colour on itself 1:1', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#7ff3cf', '#7ff3cf')).toBeCloseTo(1, 5);
  });

  it('gives #767676 on white 4.54:1, the WCAG worked example', () => {
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});
