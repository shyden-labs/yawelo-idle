/**
 * Gives a project board the Number field `Estimate` that progress by effort
 * reads, and the single-select field `Priority` (P0 to P5) that
 * `board-next.ts` names the next ticket from (#576). Run once per board:
 *
 *   node scripts/board-setup.ts <board-node-id> "<board title>"
 *
 * It reads the board by node id, refuses a board whose title differs, creates
 * each field only if it is missing, and reads both back.
 */
import { execFileSync } from 'node:child_process';
import { assertTitle } from '../packages/progress/src/index.ts';
import type { Gh } from './board-progress.ts';

interface Field {
  name: string;
  dataType: string;
  options?: Array<{ name: string }>;
}

/**
 * The six priorities, in order, each with what it means (operator
 * 2026-10-12; P1 no longer counts blockers, 2026-10-13, #578: a blocker
 * takes at least the level of what waits on it instead). The board's option
 * descriptions carry these words, so a ticket is scored against the same
 * definition everywhere it is read.
 */
export const PRIORITY_OPTIONS = [
  {
    name: 'P0',
    color: 'RED',
    description:
      'Now: a live defect, a vulnerability, broken CI or deploy, or a release blocker.',
  },
  {
    name: 'P1',
    color: 'ORANGE',
    description:
      'Next: something the operator asked for directly, or work already in flight.',
  },
  {
    name: 'P2',
    color: 'YELLOW',
    description:
      'Important: user-facing improvements and the standing quality rules (test limits, guards that cannot see what they judge).',
  },
  { name: 'P3', color: 'GREEN', description: 'Planned: ordinary backlog.' },
  {
    name: 'P4',
    color: 'BLUE',
    description: 'Later: worth doing, no pressure.',
  },
  {
    name: 'P5',
    color: 'GRAY',
    description: 'Someday: ideas and nice-to-haves.',
  },
] as const;

/** The level names in order, P0 first: what board-next ranks by. */
export const PRIORITY_LEVELS: readonly string[] = PRIORITY_OPTIONS.map(
  (o) => o.name,
);

/** What the board needs for `Estimate`: the field created, or nothing. */
export function planEstimateField(fields: Field[]): 'create' | 'exists' {
  const found = fields.find((f) => f.name === 'Estimate');
  if (found === undefined) return 'create';
  if (found.dataType !== 'NUMBER') {
    throw new Error(
      `the board has an "Estimate" field of type ${found.dataType}; it must be NUMBER: rename or delete it first`,
    );
  }
  return 'exists';
}

/** What the board needs for `Priority`: the field created, or nothing. */
export function planPriorityField(fields: Field[]): 'create' | 'exists' {
  const found = fields.find((f) => f.name === 'Priority');
  if (found === undefined) return 'create';
  if (found.dataType !== 'SINGLE_SELECT') {
    throw new Error(
      `the board has a "Priority" field of type ${found.dataType}; it must be SINGLE_SELECT: rename or delete it first`,
    );
  }
  const have = (found.options ?? []).map((o) => o.name);
  const want = PRIORITY_OPTIONS.map((o) => o.name);
  if (have.join('|') !== want.join('|')) {
    throw new Error(
      `the board's "Priority" options are ${have.join(', ')}; they must be ${want.join(', ')} in that order: edit the field first`,
    );
  }
  return 'exists';
}

/** The roadmap's plain-words text fields (#826, #342 split). */
export type TextFieldName = 'Public title' | 'Public summary';

/** What the board needs for a text field `name`: the field created, or nothing. */
export function planTextField(
  fields: Field[],
  name: TextFieldName,
): 'create' | 'exists' {
  const found = fields.find((f) => f.name === name);
  if (found === undefined) return 'create';
  if (found.dataType !== 'TEXT') {
    throw new Error(
      `the board has a "${name}" field of type ${found.dataType}; it must be TEXT: rename or delete it first`,
    );
  }
  return 'exists';
}

const createText = (name: TextFieldName): string =>
  `mutation($id: ID!) { createProjectV2Field(input: {
  projectId: $id, dataType: TEXT, name: "${name}" }) { clientMutationId } }`;

export const CREATE_PUBLIC_TITLE = createText('Public title');
export const CREATE_PUBLIC_SUMMARY = createText('Public summary');

export const READ = `query($id: ID!) { node(id: $id) { ... on ProjectV2 { title
  fields(first: 50) { nodes { ... on ProjectV2FieldCommon { name dataType }
    ... on ProjectV2SingleSelectField { options { name } } } } } } }`;

const CREATE_ESTIMATE = `mutation($id: ID!) { createProjectV2Field(input: {
  projectId: $id, dataType: NUMBER, name: "Estimate" }) { clientMutationId } }`;

export const CREATE_PRIORITY = `mutation($id: ID!) { createProjectV2Field(input: {
  projectId: $id, dataType: SINGLE_SELECT, name: "Priority",
  singleSelectOptions: [${PRIORITY_OPTIONS.map(
    (o) =>
      `{ name: "${o.name}", color: ${o.color}, description: "${o.description}" }`,
  ).join(', ')}] }) { clientMutationId } }`;

interface Board {
  title: string;
  fields: { nodes: Field[] };
}

const USAGE =
  'usage: node scripts/board-setup.ts <board-node-id> "<board title>"';

/** Creates whichever of the four fields the board `args` names lacks, and reads both back. */
export function boardSetup(args: readonly string[], gh: Gh): string {
  const [id, title] = args;
  if (id === undefined || title === undefined) throw new Error(USAGE);
  const run = (query: string): string =>
    gh(['api', 'graphql', '-f', `query=${query}`, '-f', `id=${id}`]);
  const read = (): Board => {
    const board = (JSON.parse(run(READ)) as { data: { node: Board } }).data
      .node;
    assertTitle(board.title, title);
    return board;
  };
  const before = read();
  if (planEstimateField(before.fields.nodes) === 'create') run(CREATE_ESTIMATE);
  if (planPriorityField(before.fields.nodes) === 'create') run(CREATE_PRIORITY);
  if (planTextField(before.fields.nodes, 'Public title') === 'create')
    run(CREATE_PUBLIC_TITLE);
  if (planTextField(before.fields.nodes, 'Public summary') === 'create')
    run(CREATE_PUBLIC_SUMMARY);
  const after = read();
  if (planEstimateField(after.fields.nodes) !== 'exists') {
    throw new Error('the Estimate field was not there on reading back');
  }
  if (planPriorityField(after.fields.nodes) !== 'exists') {
    throw new Error('the Priority field was not there on reading back');
  }
  for (const name of ['Public title', 'Public summary'] as const) {
    if (planTextField(after.fields.nodes, name) !== 'exists') {
      throw new Error(`the ${name} field was not there on reading back`);
    }
  }
  return `"${after.title}" has a Number field "Estimate", a single-select field "Priority" (P0-P5), and text fields "Public title" and "Public summary".`;
}

if (import.meta.main) {
  const line = boardSetup(process.argv.slice(2), (args) =>
    execFileSync('gh', args, { encoding: 'utf8' }),
  );
  process.stdout.write(`${line}\n`);
}
