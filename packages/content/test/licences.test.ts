import { describe, expect, it } from 'vitest';
import enId from './fixtures/en-id.min.json' with { type: 'json' };
import idEn from './fixtures/id-en.min.json' with { type: 'json' };
import {
  LICENCES,
  SOURCES,
  licenceCheck,
  licenceChecks,
  loadCourse,
  type CoursePack,
  type LoadError,
} from '../src/index';

/**
 * The per-item licence guard (#102; spec §5.3, D17). Every item's licence is
 * on the allow-list, cites a registered source, and an item from a BY-SA
 * source stays BY-SA (ShareAlike forbids relicensing it NonCommercial).
 * Each refusal names the kind, the item and the field.
 */

type Json = Record<string, unknown>;

const copy = (pack: object): Json => JSON.parse(JSON.stringify(pack)) as Json;

const load = (json: unknown): CoursePack => {
  const loaded = loadCourse(copy(json as object));
  if (!loaded.ok) throw new Error('the fixture no longer loads');
  return loaded.course;
};

const KINDS = [
  'lexicon',
  'grammarNodes',
  'cultureCards',
  'motifs',
  'story',
] as const;

const item = (licence: string, source = 'original') => ({
  id: 'rumah',
  source,
  licence,
});

describe('the allow-list and the sources registry (AC1, AC4)', () => {
  it('the allow-list is exactly CC-BY-SA-4.0 and CC-BY-NC-SA-4.0', () => {
    expect([...LICENCES]).toEqual(['CC-BY-SA-4.0', 'CC-BY-NC-SA-4.0']);
  });

  it('registers wiktionary as CC-BY-SA-4.0, with its URL', () => {
    expect(SOURCES.wiktionary).toEqual({
      licence: 'CC-BY-SA-4.0',
      url: 'https://en.wiktionary.org/',
    });
  });

  it('registers original work by Shyden Labs as CC-BY-NC-SA-4.0, with its URL', () => {
    expect(SOURCES.original).toEqual({
      licence: 'CC-BY-NC-SA-4.0',
      url: 'https://github.com/shyden-labs/yawelo-idle',
    });
  });

  it('registers only licences on the allow-list', () => {
    const outside = Object.entries(SOURCES).filter(
      ([, source]) => !(LICENCES as readonly string[]).includes(source.licence),
    );
    expect(outside).toEqual([]);
  });
});

describe('licenceCheck: what it accepts', () => {
  it('accepts an original item under CC-BY-NC-SA-4.0', () => {
    expect(licenceCheck('motifs', [item('CC-BY-NC-SA-4.0')])).toEqual({
      name: 'licences: motifs',
      judged: 1,
      errors: [],
      message: 'licences: motifs: 1 judged, 0 refused',
    });
  });

  it('accepts an original item under CC-BY-SA-4.0', () => {
    expect(licenceCheck('motifs', [item('CC-BY-SA-4.0')]).errors).toEqual([]);
  });

  it('accepts a wiktionary item under CC-BY-SA-4.0', () => {
    expect(
      licenceCheck('lexicon', [item('CC-BY-SA-4.0', 'wiktionary:rumah')])
        .errors,
    ).toEqual([]);
  });

  it('judges every item it is given', () => {
    const items = [item('CC-BY-SA-4.0'), item('CC-BY-NC-SA-4.0')];
    expect(licenceCheck('story', items).judged).toBe(2);
  });
});

/** The one error a refused licence gives on `rumah`. */
const licenceError = (kind: string, message: string): LoadError => ({
  kind,
  item: 'rumah',
  field: 'licence',
  message,
});

describe('licenceCheck: a licence off the allow-list fails, naming the item (AC1)', () => {
  it.each([
    ['empty', ''],
    ['spaced, as on the deed', 'CC BY-SA 4.0'],
    ['lower case', 'cc-by-sa-4.0'],
    ['an older version', 'CC-BY-SA-3.0'],
    ['another licence', 'CC0-1.0'],
    ['the code licence', 'Apache-2.0'],
  ])('refuses %s', (_, licence) => {
    expect(licenceCheck('cultureCards', [item(licence)])).toEqual({
      name: 'licences: cultureCards',
      judged: 1,
      errors: [
        licenceError(
          'cultureCards',
          `cultureCards rumah: licence "${licence}" is not CC-BY-SA-4.0 or CC-BY-NC-SA-4.0`,
        ),
      ],
      message: 'licences: cultureCards: 1 judged, 1 refused',
    });
  });
});

describe('licenceCheck: a BY-SA source stays BY-SA (AC2)', () => {
  it('refuses a wiktionary item under CC-BY-NC-SA-4.0 (the planted positive)', () => {
    expect(
      licenceCheck('lexicon', [item('CC-BY-NC-SA-4.0', 'wiktionary:rumah')])
        .errors,
    ).toEqual([
      licenceError(
        'lexicon',
        'lexicon rumah: licence is CC-BY-NC-SA-4.0, but source wiktionary is CC-BY-SA-4.0, so ShareAlike keeps it CC-BY-SA-4.0',
      ),
    ]);
  });
});

describe('licenceCheck: every source is registered (AC4)', () => {
  it.each([
    ['an unregistered source', 'kaikki:rumah', 'kaikki'],
    ['a misspelt source', 'wikitionary:rumah', 'wikitionary'],
    ['an empty source', '', ''],
  ])('refuses %s, naming it', (_, source, id) => {
    expect(licenceCheck('lexicon', [item('CC-BY-SA-4.0', source)])).toEqual(
      expect.objectContaining({
        errors: [
          {
            kind: 'lexicon',
            item: 'rumah',
            field: 'source',
            message: `lexicon rumah: source "${source}" names no registered source (${id})`,
          },
        ],
      }),
    );
  });

  it('reads the source id before the first colon only', () => {
    expect(
      licenceCheck('lexicon', [item('CC-BY-SA-4.0', 'wiktionary:a:b')]).errors,
    ).toEqual([]);
  });
});

describe('licenceChecks: every kind of a course, each with its population (AC3)', () => {
  it.each(KINDS)('en-id judges its one %s item and refuses nothing', (kind) => {
    const found = licenceChecks(load(enId)).find(
      (each) => each.name === `licences: ${kind}`,
    );
    expect(found).toEqual({
      name: `licences: ${kind}`,
      judged: 1,
      errors: [],
      message: `licences: ${kind}: 1 judged, 0 refused`,
    });
  });

  it.each(KINDS)('id-en judges its one %s item and refuses nothing', (kind) => {
    const found = licenceChecks(load(idEn)).find(
      (each) => each.name === `licences: ${kind}`,
    );
    expect(found?.judged).toBe(1);
    expect(found?.errors).toEqual([]);
  });

  it('checks exactly the five content kinds, in order', () => {
    expect(licenceChecks(load(enId)).map((each) => each.name)).toEqual(
      KINDS.map((kind) => `licences: ${kind}`),
    );
  });

  it.each(KINDS)('names a refused %s item', (kind) => {
    const course = load(enId);
    const [first] = course[kind];
    if (first === undefined) throw new Error(`the fixture has no ${kind}`);
    const changed = {
      ...course,
      [kind]: [{ ...first, licence: 'CC0-1.0' }],
    };
    const found = licenceChecks(changed).find(
      (each) => each.name === `licences: ${kind}`,
    );
    expect(found?.errors).toEqual([
      {
        kind,
        item: first.id,
        field: 'licence',
        message: `${kind} ${first.id}: licence "CC0-1.0" is not CC-BY-SA-4.0 or CC-BY-NC-SA-4.0`,
      },
    ]);
  });
});

describe('loadCourse: every content kind records its source and licence (AC3)', () => {
  const kinds = ['grammarNodes', 'cultureCards', 'motifs', 'story'] as const;
  const cases = kinds.flatMap((kind) =>
    (['source', 'licence'] as const).map((field) => [kind, field] as const),
  );

  it.each(cases)('refuses a %s item missing %s, naming it', (kind, field) => {
    const pack = copy(enId);
    const items = pack[kind] as Json[];
    const [first] = items;
    if (first === undefined) throw new Error(`the fixture has no ${kind}`);
    items[0] = Object.fromEntries(
      Object.entries(first).filter(([key]) => key !== field),
    );
    const result = loadCourse(pack);
    expect(result.ok ? [] : result.errors).toEqual([
      {
        kind,
        item: first.id,
        field,
        message: expect.stringContaining(String(first.id)) as unknown,
      },
    ]);
  });
});
