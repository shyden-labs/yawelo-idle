import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import semver from 'semver';
import { floorBreach } from '../floors.ts';
import { searched } from '../searched.ts';
import {
  WORKFLOWS_DIR,
  workflow,
  type Workflow,
  type WorkflowStep,
} from './workflow-file.ts';

/**
 * The toolchain runs on one Node line, and `engines` holds the floor (#501).
 *
 * `.nvmrc` holds the exact version, never a bare major (global rule,
 * 2026-10-29, #785: "this is flaky and cannot be allowed. fix it properly").
 * With `26`, setup-node resolved the line's newest release on every run, so
 * a new Node that warned would turn every open pull request red with no
 * change in any of them. Node now changes only in a bump pull request, one
 * per project (the aligning-versions skill; Dependabot does not bump
 * `.nvmrc`). 26.12.1 is the version every project runs; nodejs.org listed
 * 26.13.0 (2026-10-28) on 2026-10-30, a bump left to that skill.
 * `engines.node` (with `.npmrc` `engine-strict=true`)
 * refuses what the line must not run: eslint-plugin-astro and
 * astro-eslint-parser need `^22.22.3 || ^24.16.0 || >=26.3.0`, so Node 26.0
 * to 26.2 are out.
 *
 * `engines` still admits the 24 line, deliberately: Dependabot's npm updater
 * installs on Node 24 (`ARG NODEJS_VERSION=24` in dependabot-core's
 * npm_and_yarn/Dockerfile, read 2026-10-08), and with engine-strict a
 * 26-only range would refuse its installs.
 */

const engines = (): string =>
  (
    JSON.parse(readFileSync('package.json', 'utf8')) as {
      engines?: { node?: string };
    }
  ).engines?.node ?? '(no engines.node)';

/** A version written exactly: three numbers and one newline, nothing else. */
const EXACT = /^\d+\.\d+\.\d+\n$/;

describe('the Node version (#785)', () => {
  it('.nvmrc holds 26.12.1 exactly, the version every project runs', () => {
    expect(readFileSync('.nvmrc', 'utf8')).toBe('26.12.1\n');
  });

  it('the exact form takes three numbers and one newline', () => {
    expect(EXACT.test('26.12.1\n')).toBe(true);
  });

  it.each([
    '26\n',
    '26.12\n',
    'v26.12.1\n',
    'lts/*\n',
    '26.12.1 \n',
    '26.12.1',
    '26.12.1\n\n',
  ])(
    'the exact form refuses %j (setup-node would resolve it, or read it loosely)',
    (text) => {
      expect(EXACT.test(text)).toBe(false);
    },
  );
});

/** Every workflow file, from the folder. */
const workflowFiles = (): string[] =>
  readdirSync(WORKFLOWS_DIR).filter((file) => /\.ya?ml$/.test(file));

/** Every setup-node step in one parsed workflow, with where it sits. */
const setupNodeStepsIn = (file: string, parsed: Workflow) =>
  Object.entries({ ...parsed.jobs }).flatMap(([id, job]) =>
    (job.steps ?? [])
      .filter((step) => (step.uses ?? '').startsWith('actions/setup-node@'))
      .map((step) => ({ file, where: `${file} ${id}`, step })),
  );

const setupNodeSteps = () =>
  workflowFiles().flatMap((file) => setupNodeStepsIn(file, workflow(file)));

/** Whether a setup-node step takes its Node from anywhere but .nvmrc. */
const takesItsOwnNode = (step: WorkflowStep): boolean =>
  step.with?.['node-version-file'] !== '.nvmrc' ||
  step.with['node-version'] !== undefined;

/** A file whose text names more or fewer setup-node steps than its parse holds. */
const misreadOf = (
  file: string,
  text: string,
  parsed: number,
): string | undefined => {
  const written = text
    .split('\n')
    .filter((line) =>
      /^\s*(-\s*)?uses:\s*actions\/setup-node@/.test(line),
    ).length;
  return written === parsed
    ? undefined
    : `${file}: ${String(written)} written, ${String(parsed)} parsed`;
};

const SETUP = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';

describe('the readers, on planted steps (#785)', () => {
  it('pass a step that takes .nvmrc alone', () => {
    expect(
      takesItsOwnNode({ uses: SETUP, with: { 'node-version-file': '.nvmrc' } }),
    ).toBe(false);
  });

  it('flag a step with no with block', () => {
    expect(takesItsOwnNode({ uses: SETUP })).toBe(true);
  });

  it('flag a step that takes another file', () => {
    expect(
      takesItsOwnNode({ uses: SETUP, with: { 'node-version-file': '.node' } }),
    ).toBe(true);
  });

  it('flag a step that names a version beside .nvmrc', () => {
    expect(
      takesItsOwnNode({
        uses: SETUP,
        with: { 'node-version-file': '.nvmrc', 'node-version': '26' },
      }),
    ).toBe(true);
  });

  it('name a file whose text holds a setup-node line its parse lacks', () => {
    expect(misreadOf('w.yml', `      - uses: ${SETUP}\n`, 0)).toBe(
      'w.yml: 1 written, 0 parsed',
    );
  });

  it('pass a file whose parse holds each line, comments left out', () => {
    expect(
      misreadOf('w.yml', `      - uses: ${SETUP}\n      # uses: ${SETUP}\n`, 1),
    ).toBeUndefined();
  });
});

describe('every workflow takes its Node from .nvmrc (#785)', () => {
  it('each setup-node step reads node-version-file .nvmrc and names no version', () => {
    const steps = setupNodeSteps();
    // Each finding is the step itself, with where it sits.
    const wrong = steps.filter(({ step }) => takesItsOwnNode(step));
    expect(searched(wrong, { of: steps, what: 'setup-node steps' })).toEqual(
      [],
    );
    expect(
      floorBreach('node-version/setup-node-steps', steps.length),
    ).toBeUndefined();
  });

  it('parses as many setup-node steps in each file as its text writes', () => {
    // Control c, per file: the parse against the lines that name the action,
    // comment lines left out.
    const files = workflowFiles();
    const parsed = setupNodeSteps();
    const misread = files
      .map((file) =>
        misreadOf(
          file,
          readFileSync(`${WORKFLOWS_DIR}/${file}`, 'utf8'),
          parsed.filter((step) => step.file === file).length,
        ),
      )
      .filter((line) => line !== undefined);
    expect(searched(misread, { of: files, what: 'workflow files' })).toEqual(
      [],
    );
    expect(
      floorBreach('node-version/workflow-files', files.length),
    ).toBeUndefined();
  });
});

describe('the Node line', () => {
  it('engines.node admits 26.3.0, the first 26 the astro lint packages take', () => {
    expect(semver.satisfies('26.3.0', engines())).toBe(true);
  });

  it.each(['26.0.0', '26.1.0', '26.2.0', '26.2.99'])(
    'engines.node refuses %s (the astro lint packages refuse it)',
    (version) => {
      expect(semver.satisfies(version, engines())).toBe(false);
    },
  );

  it("engines.node admits 24.16.0 (Dependabot's Node line)", () => {
    expect(semver.satisfies('24.16.0', engines())).toBe(true);
  });

  it('the README names the .nvmrc line beside npm ci', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain(
      'npm ci                # Node 26.3 or later (see .nvmrc); engine-strict is on',
    );
  });
});
