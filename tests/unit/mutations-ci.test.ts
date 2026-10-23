import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * The `mutations` workflow (#649, spec §7): on every pull request into
 * develop, it lists the mutation files the pull request adds or changes and
 * runs them through the runner, in the image CI tests in, keeping every log.
 * The first job also judges the changed non-unit tests (#619 AC2), and the
 * last, `mutations`, is develop's required check (#619 AC5). Each listed file
 * runs in its own job (#754): four files in one job outran its 30 minutes on
 * PR #753, and the check reads every file's own result.
 */

interface Step {
  readonly name?: string;
  readonly id?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly if?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly with?: Readonly<Record<string, unknown>>;
  readonly 'timeout-minutes'?: number;
}

interface Job {
  readonly needs?: string | readonly string[];
  readonly if?: string;
  readonly 'runs-on'?: string;
  readonly 'timeout-minutes'?: number;
  readonly container?: { readonly image?: string; readonly options?: string };
  readonly strategy?: Readonly<Record<string, unknown>>;
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

  it('has exactly the three jobs, changed, run, then mutations', () => {
    expect(Object.keys(workflow().jobs)).toEqual([
      'changed',
      'run',
      'mutations',
    ]);
  });

  it('judges the changed tests and lists the changed mutation files against the pull request’s base, with the whole history', () => {
    const changed = job('changed');
    const step = stepRunning(changed, 'node scripts/mutations-changed-cli.ts');
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

  it('installs only when the change is not docs-only, classified by build-and-test’s own script first', () => {
    const { steps } = job('changed');
    const classify = steps.findIndex(
      (s) => s.run?.trim() === 'node scripts/ci-scope.ts',
    );
    const install = steps.findIndex(
      (s) => s.run?.trim() === 'scripts/fail-on-warnings.sh npm ci',
    );
    const judge = steps.findIndex(
      (s) => s.run?.trim() === 'node scripts/mutations-changed-cli.ts',
    );
    expect(steps[classify]?.env).toEqual({
      EVENT: '${{ github.event_name }}',
    });
    expect(steps[classify]?.id).toBe('classify');
    expect(steps[install]?.if).toBe(
      "${{ steps.classify.outputs.scope != 'docs-only' }}",
    );
    expect(steps[judge]?.if).toBeUndefined();
    expect([classify >= 0, classify < install, install < judge]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('runs the listed files only when there are any', () => {
    const run = job('run');
    expect(run.needs).toBe('changed');
    expect(run.if).toBe("${{ needs.changed.outputs.count != '0' }}");
  });

  it('runs each listed file in its own job, none cancelling another', () => {
    expect(job('run').strategy).toEqual({
      'fail-fast': false,
      matrix: { file: '${{ fromJSON(needs.changed.outputs.files) }}' },
    });
  });

  it('passes the file through the environment, never into the script text', () => {
    const step = stepRunning(job('run'), 'npm run mutate -- "$FILE"');
    expect(step?.env).toEqual({ FILE: '${{ matrix.file }}' });
    expect(step?.id).toBe('mutate');
  });

  it('names the artifact after the file first, before any step can fail', () => {
    expect(job('run').steps[0]).toEqual({
      name: 'Name the artifact after the file',
      id: 'artifact',
      env: { FILE: '${{ matrix.file }}' },
      run: 'echo "name=mutations-$(basename "$FILE" .ts)" >> "$GITHUB_OUTPUT"',
    });
  });

  it('records how the file’s run ended, whatever it ended, between the run and the upload', () => {
    const { steps } = job('run');
    const record = steps.findIndex(
      (s) =>
        s.run?.trim() ===
        `mkdir -p .mutations && printf '{"file":"%s","outcome":"%s"}\\n' "$FILE" "$OUTCOME" > .mutations/run-outcome.json`,
    );
    const mutate = steps.findIndex(
      (s) => s.run?.trim() === 'npm run mutate -- "$FILE"',
    );
    const upload = steps.findIndex((s) =>
      s.uses?.startsWith('actions/upload-artifact@'),
    );
    expect(steps[record]?.if).toBe('${{ !cancelled() }}');
    expect(steps[record]?.env).toEqual({
      FILE: '${{ matrix.file }}',
      OUTCOME: '${{ steps.mutate.outcome }}',
    });
    expect([mutate >= 0, mutate < record, record < upload]).toEqual([
      true,
      true,
      true,
    ]);
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
      name: '${{ steps.artifact.outputs.name }}',
      path: '.mutations/',
      'include-hidden-files': true,
      'if-no-files-found': 'error',
    });
  });

  it('judges both jobs in the required check, whatever they ended', () => {
    const gate = job('mutations');
    expect(gate.needs).toEqual(['changed', 'run']);
    expect(gate.if).toBe('${{ !cancelled() }}');
    const step = stepRunning(gate, 'node scripts/mutations-verdict.ts');
    expect(step?.env).toEqual({
      CHANGED: '${{ needs.changed.result }}',
      COUNT: '${{ needs.changed.outputs.count }}',
      FILES: '${{ needs.changed.outputs.files }}',
      RUN: '${{ needs.run.result }}',
    });
    // A failed download still reaches the verdict, which names each file.
    expect(step?.if).toBe('${{ !cancelled() }}');
  });

  it('downloads every file job’s artifact before the verdict reads them', () => {
    const { steps } = job('mutations');
    const download = steps.findIndex((s) =>
      s.uses?.startsWith('actions/download-artifact@'),
    );
    const judge = steps.findIndex(
      (s) => s.run?.trim() === 'node scripts/mutations-verdict.ts',
    );
    expect(steps[download]?.if).toBe(
      "${{ needs.changed.outputs.count != '0' }}",
    );
    expect(steps[download]?.with).toEqual({
      pattern: 'mutations-*',
      path: 'results/',
    });
    expect([download >= 0, download < judge]).toEqual([true, true]);
  });

  it('bounds each job', () => {
    expect(job('changed')['timeout-minutes']).toBe(10);
    expect(job('run')['timeout-minutes']).toBe(30);
    expect(job('mutations')['timeout-minutes']).toBe(2);
  });
});
