import { describe, expect, it } from 'vitest';
import { checkRehearsal, rehearsalRefusal } from '../../scripts/rehearsal.ts';
import { WORKFLOW_FLOOR, type Manifest } from '../../scripts/rehearse.ts';

/**
 * The coverage record's Measure step reads the rehearsal the record's
 * rehearse job left (#771 AC4). Given the folder, it refuses one that is
 * missing, unreadable, from another commit or another act, or whose
 * population disagrees with its own list or falls below the floor. Given
 * none (a pull request's coverage job), it asks nothing.
 */

const HEAD = 'c'.repeat(40);
const workflows = Object.fromEntries(
  Array.from({ length: WORKFLOW_FLOOR }, (_, i) => [
    `w${String(i)}.yml`,
    ['job'],
  ]),
);
const GOOD: Manifest = {
  commit: HEAD,
  act: '0.2.89',
  population: {
    of: WORKFLOW_FLOOR,
    what: 'workflow files act reads in .github/workflows',
  },
  workflows,
};

/** A reader asked only for `rehearsal/manifest.json`, which holds `text`. */
const holding =
  (text: string | undefined) =>
  (path: string): string | undefined => {
    expect(path).toBe('rehearsal/manifest.json');
    return text;
  };

const json = (value: unknown): string => JSON.stringify(value);

describe('the rehearsal the record measures with (#771 AC4)', () => {
  it('asks nothing when given no folder', () => {
    expect(
      rehearsalRefusal(undefined, holding(undefined), HEAD),
    ).toBeUndefined();
  });

  it('passes the manifest of HEAD, the folder named with or without its slash', () => {
    expect([
      rehearsalRefusal('rehearsal/', holding(json(GOOD)), HEAD),
      rehearsalRefusal('rehearsal', holding(json(GOOD)), HEAD),
    ]).toEqual([undefined, undefined]);
  });

  it.each([
    [
      'a folder holding no manifest',
      undefined,
      'no rehearsal manifest at rehearsal/manifest.json: the record’s rehearse job writes it (#771).',
    ],
    [
      'text that is not JSON',
      'not json',
      'rehearsal/manifest.json is not a rehearsal manifest (#771).',
    ],
    [
      'JSON that is not an object',
      'null',
      'rehearsal/manifest.json is not a rehearsal manifest (#771).',
    ],
    [
      'a manifest without its commit',
      json({ ...GOOD, commit: 1 }),
      'rehearsal/manifest.json is not a rehearsal manifest (#771).',
    ],
    [
      'a manifest without its act',
      json({ ...GOOD, act: undefined }),
      'rehearsal/manifest.json is not a rehearsal manifest (#771).',
    ],
    [
      'a manifest without its population',
      json({ ...GOOD, population: undefined }),
      'rehearsal/manifest.json is not a rehearsal manifest (#771).',
    ],
    [
      'a population that is not a number',
      json({ ...GOOD, population: { of: '11' } }),
      'rehearsal/manifest.json is not a rehearsal manifest (#771).',
    ],
    [
      'a manifest without its workflows',
      json({ ...GOOD, workflows: null }),
      'rehearsal/manifest.json is not a rehearsal manifest (#771).',
    ],
    [
      'a manifest of another commit',
      json({ ...GOOD, commit: 'd'.repeat(40) }),
      `the rehearsal ran at ${'d'.repeat(40)}, not ${HEAD} (#771).`,
    ],
    [
      'another act',
      json({ ...GOOD, act: '0.2.90' }),
      'the rehearsal ran act 0.2.90, not 0.2.89 (#771).',
    ],
    [
      'a population its list disagrees with',
      json({
        ...GOOD,
        population: { ...GOOD.population, of: WORKFLOW_FLOOR + 1 },
      }),
      `the rehearsal counted ${String(WORKFLOW_FLOOR + 1)} workflow files but lists ${String(WORKFLOW_FLOOR)} (#771).`,
    ],
    [
      'a population below the floor',
      json({
        ...GOOD,
        population: { ...GOOD.population, of: 0 },
        workflows: {},
      }),
      `the rehearsal found 0 workflow files, below its floor of ${String(WORKFLOW_FLOOR)} (#771).`,
    ],
  ])('refuses %s', (_case, text, refusal) => {
    expect(rehearsalRefusal('rehearsal/', holding(text), HEAD)).toBe(refusal);
  });
});

describe('the Measure step stops on a refused rehearsal (#771 AC4)', () => {
  const stopping = (message: string): never => {
    throw new Error(`stopped: ${message}`);
  };

  it('stops, naming the refusal, before anything is measured', () => {
    expect(() => {
      checkRehearsal('rehearsal/', holding(undefined), HEAD, stopping);
    }).toThrow(
      'stopped: no rehearsal manifest at rehearsal/manifest.json: the record’s rehearse job writes it (#771).',
    );
  });

  it('goes on when the rehearsal passes', () => {
    expect(() => {
      checkRehearsal('rehearsal/', holding(json(GOOD)), HEAD, stopping);
    }).not.toThrow();
  });

  it('goes on when no rehearsal was asked for', () => {
    expect(() => {
      checkRehearsal(undefined, holding(undefined), HEAD, stopping);
    }).not.toThrow();
  });
});
