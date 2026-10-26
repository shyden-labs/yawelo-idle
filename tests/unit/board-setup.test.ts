import { describe, expect, it } from 'vitest';
import type { Gh } from '../../scripts/board-progress.ts';
import {
  boardSetup,
  CREATE_PRIORITY,
  planEstimateField,
  planPriorityField,
  PRIORITY_OPTIONS,
  READ,
} from '../../scripts/board-setup.ts';
import { againstControl } from '../searched.ts';

/**
 * scripts/board-setup.ts (#576): the board's `Estimate` and `Priority`
 * fields, created only when missing and read back. In-process with `gh`
 * stood in: a unit test starts no process.
 */

const TITLE = 'Yawelo Idle Stories';
const RIGHT_OPTIONS = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'].map((name) => ({
  name,
}));
const ESTIMATE = { name: 'Estimate', dataType: 'NUMBER' };
const PRIORITY = {
  name: 'Priority',
  dataType: 'SINGLE_SELECT',
  options: RIGHT_OPTIONS,
};

describe('the Priority levels (operator 2026-10-12, P1 amended 2026-10-13)', () => {
  it('are P0 to P5 in order', () => {
    expect(PRIORITY_OPTIONS.map((o) => o.name)).toEqual([
      'P0',
      'P1',
      'P2',
      'P3',
      'P4',
      'P5',
    ]);
  });

  it('describe each level in the operator’s words, P1 without blockers (#578)', () => {
    expect(PRIORITY_OPTIONS.map((o) => o.description)).toEqual([
      'Now: a live defect, a vulnerability, broken CI or deploy, or a release blocker.',
      'Next: something the operator asked for directly, or work already in flight.',
      'Important: user-facing improvements and the standing quality rules (test limits, guards that cannot see what they judge).',
      'Planned: ordinary backlog.',
      'Later: worth doing, no pressure.',
      'Someday: ideas and nice-to-haves.',
    ]);
  });

  it('are what the create mutation sends, in order', () => {
    const sent = [...CREATE_PRIORITY.matchAll(/name: "(P\d)"/g)].map(
      (m) => m[1],
    );
    expect(sent).toEqual(['P0', 'P1', 'P2', 'P3', 'P4', 'P5']);
  });
});

describe('planEstimateField (#576)', () => {
  it('creates a missing Estimate', () => {
    expect(planEstimateField([PRIORITY])).toBe('create');
  });

  it('keeps a Number Estimate', () => {
    expect(planEstimateField([ESTIMATE])).toBe('exists');
  });

  it('refuses an Estimate of another type', () => {
    expect(() =>
      planEstimateField([{ name: 'Estimate', dataType: 'TEXT' }]),
    ).toThrow(
      'the board has an "Estimate" field of type TEXT; it must be NUMBER: rename or delete it first',
    );
  });
});

describe('planPriorityField (#576)', () => {
  it('creates a missing Priority', () => {
    expect(planPriorityField([ESTIMATE])).toBe('create');
  });

  it('keeps a single-select Priority with P0 to P5 in order', () => {
    expect(planPriorityField([PRIORITY])).toBe('exists');
  });

  it('refuses a Priority of another type', () => {
    expect(() =>
      planPriorityField([{ name: 'Priority', dataType: 'TEXT' }]),
    ).toThrow(
      'the board has a "Priority" field of type TEXT; it must be SINGLE_SELECT: rename or delete it first',
    );
  });

  it('refuses options out of order', () => {
    const swapped = { ...PRIORITY, options: [...RIGHT_OPTIONS].reverse() };
    expect(() => planPriorityField([swapped])).toThrow(
      'the board\'s "Priority" options are P5, P4, P3, P2, P1, P0; they must be P0, P1, P2, P3, P4, P5 in that order: edit the field first',
    );
  });

  it('refuses a missing option', () => {
    const short = { ...PRIORITY, options: RIGHT_OPTIONS.slice(0, 5) };
    expect(() => planPriorityField([short])).toThrow(
      'the board\'s "Priority" options are P0, P1, P2, P3, P4; they must be',
    );
  });
});

/** A `gh` that answers reads with the board's fields in turn, and records every call. */
function ghBoard(reads: Array<{ title: string; fields: unknown[] }>): {
  gh: Gh;
  calls: string[][];
} {
  const calls: string[][] = [];
  let read = 0;
  return {
    calls,
    gh: (args) => {
      calls.push([...args]);
      const query = args.find((a) => a.startsWith('query='));
      if (query?.startsWith('query=mutation')) return '{"data":{}}';
      const board = reads[Math.min(read++, reads.length - 1)];
      return JSON.stringify({
        data: {
          node: { title: board?.title, fields: { nodes: board?.fields } },
        },
      });
    },
  };
}

/** The one call that reads the board's title and fields. */
const readCall = [
  'api',
  'graphql',
  '-f',
  `query=${READ}`,
  '-f',
  'id=PVT_fixture',
];

const mutations = (calls: string[][]) =>
  calls.filter((c) => c.some((a) => a.startsWith('query=mutation')));

describe('boardSetup (#576)', () => {
  it('creates nothing on a board that has both fields, and says so', () => {
    const { gh, calls } = ghBoard([
      { title: TITLE, fields: [ESTIMATE, PRIORITY] },
    ]);
    expect(boardSetup(['PVT_fixture', TITLE], gh)).toBe(
      '"Yawelo Idle Stories" has a Number field "Estimate" and a single-select field "Priority" (P0-P5).',
    );
    expect(calls).toEqual([readCall, readCall]);
  });

  it('creates the missing Priority once, then reads it back', () => {
    const { gh, calls } = ghBoard([
      { title: TITLE, fields: [ESTIMATE] },
      { title: TITLE, fields: [ESTIMATE, PRIORITY] },
    ]);
    boardSetup(['PVT_fixture', TITLE], gh);
    expect(mutations(calls)).toEqual([
      [
        'api',
        'graphql',
        '-f',
        `query=${CREATE_PRIORITY}`,
        '-f',
        'id=PVT_fixture',
      ],
    ]);
  });

  it('refuses when the Priority is not there on reading back', () => {
    const { gh } = ghBoard([{ title: TITLE, fields: [ESTIMATE] }]);
    expect(() => boardSetup(['PVT_fixture', TITLE], gh)).toThrow(
      'the Priority field was not there on reading back',
    );
  });

  it('refuses a board whose title differs, before any change', () => {
    const { gh, calls } = ghBoard([{ title: 'ShyTalk Stories', fields: [] }]);
    expect(() => boardSetup(['PVT_fixture', TITLE], gh)).toThrow(
      'ShyTalk Stories',
    );
    expect(calls).toEqual([readCall]);
  });

  it('refuses before calling gh when the title is missing', () => {
    const { gh } = ghBoard([]);
    expect(() => boardSetup(['PVT_fixture'], gh)).toThrow(
      'usage: node scripts/board-setup.ts <board-node-id> "<board title>"',
    );
  });

  it('calls gh for nothing when the title is missing, and reads when it is given', () => {
    /** The gh calls made for the node id followed by `rest`, the refusal swallowed. */
    const callsWith = (rest: string[]) => {
      const { gh, calls } = ghBoard([
        { title: TITLE, fields: [ESTIMATE, PRIORITY] },
      ]);
      try {
        boardSetup(['PVT_fixture', ...rest], gh);
      } catch {
        // The refusal is the other test's; this one counts the calls.
      }
      return calls;
    };
    expect(againstControl(callsWith, { input: [], control: [TITLE] })).toEqual(
      [],
    );
  });
});
