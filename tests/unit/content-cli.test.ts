import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { main, type ContentIo } from '../../scripts/content.ts';

/**
 * The content tool's command line (#109). Files and the clock are stood in,
 * so each case runs in-process and can read back what the tool wrote.
 */

const FIXTURE = readFileSync(
  new URL(
    '../../packages/content/test/fixtures/en-id.min.json',
    import.meta.url,
  ),
  'utf8',
);
const FILE = 'en-id.json';
const NOW = '2026-11-15T03:00:00.000Z';

interface Outcome {
  readonly code: number;
  readonly out: readonly string[];
  readonly err: readonly string[];
  readonly files: Map<string, string>;
}

const tool = (
  argv: readonly string[],
  files: Map<string, string> = new Map([[FILE, FIXTURE]]),
  now = NOW,
): Outcome => {
  const out: string[] = [];
  const err: string[] = [];
  const io: ContentIo = {
    read: (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`no file ${path}`);
      return text;
    },
    write: (path, text) => {
      files.set(path, text);
    },
    out: (line) => {
      out.push(line);
    },
    err: (line) => {
      err.push(line);
    },
    now: () => now,
  };
  return { code: main(argv, io), out, err, files };
};

/** Runs each command in turn on the same files; returns the last outcome. */
const steps = (...commands: readonly (readonly string[])[]): Outcome => {
  let files = new Map([[FILE, FIXTURE]]);
  let last: Outcome | undefined;
  for (const command of commands) {
    last = tool(command, files);
    files = last.files;
  }
  if (last === undefined) throw new Error('no command');
  return last;
};

const firstReview = (outcome: Outcome): Record<string, unknown> => {
  const json = JSON.parse(outcome.files.get(FILE) ?? 'null') as {
    lexicon: { review: Record<string, unknown> }[];
  };
  const item = json.lexicon[0];
  if (item === undefined) throw new Error('no item');
  return item.review;
};

const EVIDENCE = [
  ['source', FILE, 'rumah', 'wiktionary:rumah'],
  ['source', FILE, 'rumah', 'kbbi:rumah'],
  ['back-translation', FILE, 'rumah', 'Google Cloud Translation', 'house'],
  ['label-audit', FILE, 'rumah', 'a dwelling'],
] as const;

describe('check (AC1)', () => {
  it('prints each draft and what it lacks', () => {
    expect(tool(['check', FILE])).toMatchObject({
      code: 0,
      err: [],
      out: [
        'rumah (draft) lacks:',
        '  review.sources needs at least two distinct source ids',
        '  review.backTranslation is required on a claude-checked item',
        '  review.labelAudit is required on a claude-checked item of 3 words or fewer',
        '1 item below claude-checked in en-id.',
      ],
    });
  });

  it('says a draft with all its evidence is ready to promote', () => {
    expect(steps(...EVIDENCE, ['check', FILE]).out).toEqual([
      'rumah (draft) has its evidence: ready to promote.',
      '1 item below claude-checked in en-id.',
    ]);
  });

  it('counts in the plural once nothing is below claude-checked', () => {
    expect(
      steps(...EVIDENCE, ['promote', FILE, 'rumah'], ['check', FILE]).out,
    ).toEqual(['0 items below claude-checked in en-id.']);
  });

  it('refuses a file that does not load, naming each error', () => {
    const outcome = tool(['check', FILE], new Map([[FILE, '{"id":"en-id"}']]));
    expect(outcome.code).toBe(1);
    expect(outcome.err[0]).toBe(`${FILE} does not load:`);
    expect(outcome.err.slice(1).every((line) => line.startsWith('  '))).toBe(
      true,
    );
    expect(outcome.err.length).toBeGreaterThan(1);
  });
});

describe('source (AC2)', () => {
  it('writes the source and its history line into the file', () => {
    const outcome = tool(['source', FILE, 'rumah', 'kbbi:rumah']);
    expect(outcome).toMatchObject({ code: 0, out: [], err: [] });
    expect(firstReview(outcome)).toMatchObject({
      sources: ['kbbi:rumah'],
      history: [
        { at: NOW, by: 'claude', change: 'Source recorded: kbbi:rumah.' },
      ],
    });
  });

  it('writes the file as two-space JSON ending in a newline', () => {
    const text =
      tool(['source', FILE, 'rumah', 'kbbi:rumah']).files.get(FILE) ?? '';
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  });

  it('refuses a repeated source and leaves the file alone', () => {
    const first = tool(['source', FILE, 'rumah', 'kbbi:rumah']);
    const written = first.files.get(FILE);
    const second = tool(['source', FILE, 'rumah', 'kbbi:rumah'], first.files);
    expect(second).toMatchObject({
      code: 1,
      err: ['rumah: source kbbi:rumah is already recorded'],
    });
    expect(second.files.get(FILE)).toBe(written);
  });
});

describe('back-translation (AC3)', () => {
  it('writes the text and prints the flag for one identical to the source', () => {
    const outcome = tool([
      'back-translation',
      FILE,
      'rumah',
      'Google Cloud Translation',
      'rumah',
    ]);
    expect(outcome).toMatchObject({
      code: 0,
      out: [
        'flag: rumah: the back-translation is identical to the source string, so it needs human attention',
      ],
    });
    expect(firstReview(outcome)).toMatchObject({ backTranslation: 'rumah' });
  });
});

describe('label-audit', () => {
  it('writes the note', () => {
    expect(
      firstReview(tool(['label-audit', FILE, 'rumah', 'a dwelling'])),
    ).toMatchObject({
      labelAudit: 'a dwelling',
    });
  });
});

describe('promote (AC4, AC6)', () => {
  it('promotes once the evidence is in', () => {
    const outcome = steps(...EVIDENCE, ['promote', FILE, 'rumah']);
    expect(outcome).toMatchObject({
      code: 0,
      out: ['rumah: promoted to claude-checked.'],
    });
    expect(firstReview(outcome)).toMatchObject({
      status: 'claude-checked',
      reviewer: 'claude',
      reviewedAt: NOW,
    });
  });

  it('refuses a bare draft and leaves the file alone', () => {
    const outcome = tool(['promote', FILE, 'rumah']);
    expect(outcome.code).toBe(1);
    expect(outcome.err).toEqual([
      'rumah: not promoted: review.sources needs at least two distinct source ids; review.backTranslation is required on a claude-checked item; review.labelAudit is required on a claude-checked item of 3 words or fewer',
    ]);
    expect(outcome.files.get(FILE)).toBe(FIXTURE);
  });
});

describe('writing only a course that loads', () => {
  it('refuses to write an edit whose result the schema refuses', () => {
    const files = new Map([[FILE, FIXTURE]]);
    const outcome = tool(
      ['source', FILE, 'rumah', 'kbbi:rumah'],
      files,
      'yesterday',
    );
    expect(outcome.code).toBe(1);
    expect(outcome.err[0]).toBe(
      `the edited course does not load, so ${FILE} was not written:`,
    );
    expect(outcome.err.length).toBeGreaterThan(1);
    expect(outcome.files.get(FILE)).toBe(FIXTURE);
  });
});

describe('report (AC5)', () => {
  it('prints counts by status and by kind, and the share below native-reviewed', () => {
    expect(tool(['report', FILE])).toMatchObject({
      code: 0,
      out: [
        'en-id',
        '  draft 1, claude-checked 0, native-reviewed 0, rejected 0',
        '  lexicon: draft 1, claude-checked 0, native-reviewed 0, rejected 0',
        '  below native-reviewed: 0 of 0 shipped items (0%)',
      ],
    });
  });

  it('prints the share as a whole percentage', () => {
    expect(
      steps(...EVIDENCE, ['promote', FILE, 'rumah'], ['report', FILE]).out[3],
    ).toBe('  below native-reviewed: 1 of 1 shipped items (100%)');
  });
});

describe('the usage', () => {
  it('is printed for an unknown command', () => {
    expect(tool(['approve', FILE])).toMatchObject({
      code: 2,
      err: expect.arrayContaining([
        expect.stringMatching(/^usage: /),
      ]) as unknown,
    });
  });

  it('is printed for a command with too few arguments', () => {
    expect(tool(['source', FILE, 'rumah']).code).toBe(2);
  });

  it('is printed for no arguments at all', () => {
    expect(tool([]).code).toBe(2);
  });
});
