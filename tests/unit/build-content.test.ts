import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalHash } from '@yawelo-idle/core';
import { attributionOf, loadCourse } from '@yawelo-idle/content';
import { main, type BuildIo } from '../../scripts/build-content.ts';

/**
 * `npm run build:content` (#106 AC1, AC2): the course file in, its bundle
 * and version out, the file system stood in.
 */

const FIXTURE = new URL(
  '../../packages/content/test/fixtures/en-id.min.json',
  import.meta.url,
);

/** The en-id fixture with its one item at `status`, as file text. */
const courseText = (status: string): string => {
  const json = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
    lexicon: { review: { status: string } }[];
  };
  for (const item of json.lexicon) item.review.status = status;
  return JSON.stringify(json);
};

/** The build run on `text`, with what it wrote and printed. */
function run(argv: readonly string[], text: string) {
  const written = new Map<string, string>();
  const out: string[] = [];
  const err: string[] = [];
  const io: BuildIo = {
    read: () => text,
    write: (path, body) => written.set(path, body),
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };
  return { code: main(argv, io), written, out, err };
}

const versionOf = (text: string): string => {
  const loaded = loadCourse(JSON.parse(text));
  if (!loaded.ok) throw new Error('the course does not load');
  return canonicalHash(loaded.course);
};

describe('build:content on a course that may ship', () => {
  const text = courseText('native-reviewed');

  it('writes the bundle and the version under the course id, and prints the version', () => {
    const { code, written, out } = run(['en-id.json', 'dist'], text);
    expect({ code, files: [...written.keys()], out }).toEqual({
      code: 0,
      files: [
        'dist/en-id.json',
        'dist/en-id.version',
        'dist/en-id.attribution.json',
      ],
      out: [`en-id ${versionOf(text)}`],
    });
    expect(written.get('dist/en-id.version')).toBe(`${versionOf(text)}\n`);
  });

  it('writes the attribution manifest beside the bundle (#122 AC1)', () => {
    const { written } = run(['en-id.json', 'dist'], text);
    const loaded = loadCourse(JSON.parse(text));
    if (!loaded.ok) throw new Error('the course does not load');
    expect(
      JSON.parse(written.get('dist/en-id.attribution.json') ?? 'null'),
    ).toEqual(attributionOf(loaded.course));
  });

  it('reports a registered source no item cites (#122 AC3)', () => {
    const json = JSON.parse(text) as {
      lexicon: { source: string; licence: string }[];
    };
    for (const item of json.lexicon) {
      item.source = 'original:rumah';
      item.licence = 'CC-BY-NC-SA-4.0';
    }
    const { code, out } = run(['en-id.json', 'dist'], JSON.stringify(json));
    expect(code).toBe(0);
    expect(out).toContain(
      'en-id attribution: source wiktionary is registered but cited by no item',
    );
  });
});

describe('build:content refuses', () => {
  it('a draft item, writing nothing and naming the ship gate', () => {
    const { code, written, err } = run(
      ['en-id.json', 'dist'],
      courseText('draft'),
    );
    expect({ code, files: written.size }).toEqual({ code: 1, files: 0 });
    expect(err.join('\n')).toMatch(/ship: lexicon rumah: review\.status/);
  });

  it('a file that does not load, naming the field', () => {
    const { code, written, err } = run(['en-id.json', 'dist'], '{"id": 1}');
    expect({ code, files: written.size }).toEqual({ code: 1, files: 0 });
    expect(err[0]).toBe('en-id.json does not load:');
  });

  it('a file that is not JSON, writing nothing and saying so', () => {
    const { code, written, err } = run(['en-id.json', 'dist'], '{not json');
    expect({ code, files: written.size }).toEqual({ code: 1, files: 0 });
    expect(err[0]).toMatch(/^en-id\.json is not JSON: /);
  });

  it('a call without the course file and the output folder, with its usage', () => {
    const { code, err } = run(['en-id.json'], '');
    expect({ code, err }).toEqual({
      code: 2,
      err: ['usage: build:content <course.json> <out-dir>'],
    });
  });
});
