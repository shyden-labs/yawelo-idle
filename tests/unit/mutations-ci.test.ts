import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * The `mutations` workflow (#649, spec §7): on every pull request into
 * develop, it lists the mutation files the pull request adds or changes and
 * runs them through the runner, in the image CI tests in, keeping every log.
 */

interface Step {
  readonly name?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly if?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly with?: Readonly<Record<string, unknown>>;
  readonly 'timeout-minutes'?: number;
}

interface Job {
  readonly needs?: string;
  readonly if?: string;
  readonly 'runs-on'?: string;
  readonly 'timeout-minutes'?: number;
  readonly container?: { readonly image?: string; readonly options?: string };
  readonly outputs?: Readonly<Record<string, string>>;
  readonly steps: readonly Step[];
}

interface Workflow {
  readonly on: { readonly pull_request?: { readonly branches?: string[] } };
  readonly permissions: Readonly<Record<string, string>>;
  readonly jobs: Readonly<Record<string, Job>>;
}

const read = (path: string): Workflow =>
  parse(readFileSync(path, 'utf8')) as Workflow;

const workflow = (): Workflow => read('.github/workflows/mutations.yml');
const job = (name: string): Job => {
  const found = workflow().jobs[name];
  if (found === undefined) throw new Error(`mutations.yml has no job ${name}`);
  return found;
};
const stepRunning = (j: Job, command: string): Step | undefined =>
  j.steps.find((s) => s.run?.trim() === command);

describe('mutations.yml', () => {
  it('runs on every pull request into develop, reading the repository only', () => {
    const { on, permissions } = workflow();
    expect(on.pull_request?.branches).toEqual(['develop']);
    expect(permissions).toEqual({ contents: 'read' });
  });

  it('has exactly the two jobs, changed then run', () => {
    expect(Object.keys(workflow().jobs)).toEqual(['changed', 'run']);
  });

  it('lists the changed mutation files against the pull request’s base, with the whole history', () => {
    const changed = job('changed');
    const step = stepRunning(changed, 'node scripts/mutations-changed.ts');
    expect(step?.env).toEqual({
      BASE: '${{ github.event.pull_request.base.sha }}',
    });
    const checkout = changed.steps.find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with?.['fetch-depth']).toBe(0);
    expect(changed.outputs).toEqual({
      count: '${{ steps.list.outputs.count }}',
      files: '${{ steps.list.outputs.files }}',
    });
  });

  it('runs the listed files only when there are any', () => {
    const run = job('run');
    expect(run.needs).toBe('changed');
    expect(run.if).toBe("${{ needs.changed.outputs.count != '0' }}");
  });

  it('passes the files through the environment, never into the script text', () => {
    const step = stepRunning(job('run'), 'npm run mutate -- $FILES');
    expect(step?.env).toEqual({
      FILES: '${{ needs.changed.outputs.files }}',
    });
  });

  it('runs in the image and as the user CI tests in', () => {
    const ci = read('.github/workflows/ci.yml').jobs['build-and-test'];
    expect(job('run').container).toEqual(ci?.container);
  });

  it('keeps every log, whatever the result', () => {
    const upload = job('run').steps.find((s) =>
      s.uses?.startsWith('actions/upload-artifact@'),
    );
    expect(upload?.if).toBe('${{ !cancelled() }}');
    // `.mutations/` is a dot-folder, which upload-artifact skips unless
    // asked (default false at the pinned SHA): PR #651's first green run
    // uploaded nothing and only warned.
    expect(upload?.with).toEqual({
      name: 'mutations',
      path: '.mutations/',
      'include-hidden-files': true,
      'if-no-files-found': 'error',
    });
  });

  it('bounds each job', () => {
    expect(job('changed')['timeout-minutes']).toBe(5);
    expect(job('run')['timeout-minutes']).toBe(30);
  });
});
