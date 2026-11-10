import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import semver from 'semver';
import {
  WORKFLOWS_DIR,
  workflow,
  type Workflow,
  type WorkflowStep,
} from './workflow-file.ts';

/**
 * The toolchain runs on one Node line, and `engines` holds the floor (#501).
 *
 * `docker/node/Dockerfile` holds the exact version, never a bare major
 * (global rule, 2026-10-29, #785: "this is flaky and cannot be allowed. fix
 * it properly"). With `26`, setup-node resolved the line's newest release on
 * every run, so a new Node that warned would turn every open pull request red
 * with no change in any of them. The version lives in a one-line Dockerfile
 * because Dependabot's docker ecosystem bumps it and no ecosystem bumps
 * `.nvmrc` (#793, global rule amended 2026-10-30; the shape is
 * shyden-labs/repo-template#143's): each Node release arrives as Dependabot's
 * own pull request. 26.12.1 is the version every project runs.
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

const DOCKERFILE = 'docker/node/Dockerfile';

/** The Dockerfile written exactly: one FROM line naming three numbers. */
const EXACT = /^FROM node:\d+\.\d+\.\d+\n$/;

/** The step that reads the version, the same in every job (repo-template#143). */
const READ_VERSION = [
  "version=$(sed -nE 's/^FROM node:([0-9]+\\.[0-9]+\\.[0-9]+)$/\\1/p' docker/node/Dockerfile)",
  'test -n "$version"',
  'echo "version=$version" >> "$GITHUB_OUTPUT"',
  '',
].join('\n');

const VERSION_OUTPUT = '${{ steps.node.outputs.version }}';

describe('the Node version (#785, #793)', () => {
  it('the Dockerfile holds node 26.12.1 exactly, the version every project runs', () => {
    expect(readFileSync(DOCKERFILE, 'utf8')).toBe('FROM node:26.12.1\n');
  });

  it('.nvmrc is gone, so the version has one home', () => {
    expect(existsSync('.nvmrc')).toBe(false);
  });

  it('the exact form takes one FROM line with three numbers', () => {
    expect(EXACT.test('FROM node:26.12.1\n')).toBe(true);
  });

  it.each([
    'FROM node:26\n',
    'FROM node:26.12\n',
    'FROM node:v26.12.1\n',
    'FROM node:lts\n',
    'FROM node:26.12.1-alpine\n',
    'FROM node:26.12.1 \n',
    'FROM node:26.12.1',
    'FROM node:26.12.1\n\n',
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

/** Whether a setup-node step takes its Node from anywhere but the read step. */
const takesItsOwnNode = (step: WorkflowStep): boolean =>
  step.with?.['node-version'] !== VERSION_OUTPUT ||
  step.with['node-version-file'] !== undefined;

/** Each job with a setup-node step whose read step is missing or altered. */
const unreadJobs = (file: string, parsed: Workflow): string[] =>
  Object.entries({ ...parsed.jobs }).flatMap(([id, job]) => {
    const steps = job.steps ?? [];
    const setup = steps.findIndex((step) =>
      (step.uses ?? '').startsWith('actions/setup-node@'),
    );
    if (setup === -1) return [];
    const read = steps.findIndex((step) => step.id === 'node');
    return read !== -1 && read < setup && steps[read]?.run === READ_VERSION
      ? []
      : [`${file} ${id}`];
  });

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
  it('pass a step that takes the read version alone', () => {
    expect(
      takesItsOwnNode({
        uses: SETUP,
        with: { 'node-version': VERSION_OUTPUT },
      }),
    ).toBe(false);
  });

  it('flag a step that names a literal version', () => {
    expect(
      takesItsOwnNode({ uses: SETUP, with: { 'node-version': '26.12.1' } }),
    ).toBe(true);
  });

  it('flag a step with no with block', () => {
    expect(takesItsOwnNode({ uses: SETUP })).toBe(true);
  });

  it('flag a step that takes a version file', () => {
    expect(
      takesItsOwnNode({ uses: SETUP, with: { 'node-version-file': '.nvmrc' } }),
    ).toBe(true);
  });

  it('flag a step that names a file beside the read version', () => {
    expect(
      takesItsOwnNode({
        uses: SETUP,
        with: { 'node-version': VERSION_OUTPUT, 'node-version-file': '.nvmrc' },
      }),
    ).toBe(true);
  });

  const job = (...steps: WorkflowStep[]): Workflow => ({
    jobs: { j: { steps } },
  });
  const read: WorkflowStep = { id: 'node', run: READ_VERSION };
  const setup: WorkflowStep = { uses: SETUP };

  it('pass a job that reads the version before setting up', () => {
    expect(unreadJobs('w.yml', job(read, setup))).toEqual([]);
  });

  it('flag a job with no read step', () => {
    expect(unreadJobs('w.yml', job(setup))).toEqual(['w.yml j']);
  });

  it('flag a job that reads after setting up', () => {
    expect(unreadJobs('w.yml', job(setup, read))).toEqual(['w.yml j']);
  });

  it('flag a job whose read step is altered', () => {
    expect(
      unreadJobs('w.yml', job({ id: 'node', run: 'echo version=26' }, setup)),
    ).toEqual(['w.yml j']);
  });

  it('pass a job with no setup-node step', () => {
    expect(unreadJobs('w.yml', job({ run: 'true' }))).toEqual([]);
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

describe('every workflow takes its Node from the Dockerfile (#785, #793)', () => {
  it('each job reads the Dockerfile before its setup-node step', () => {
    expect(
      workflowFiles().flatMap((file) => unreadJobs(file, workflow(file))),
    ).toEqual([]);
  });

  it('each setup-node step takes the read version and names no file', () => {
    const steps = setupNodeSteps();
    // Each finding is the step itself, with where it sits.
    const wrong = steps.filter(({ step }) => takesItsOwnNode(step));
    expect(wrong).toEqual([]);
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
    expect(misread).toEqual([]);
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

  it('the README names the Dockerfile beside npm ci', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain(
      'npm ci                # Node 26.3 or later (see docker/node/Dockerfile); engine-strict is on',
    );
  });
});
